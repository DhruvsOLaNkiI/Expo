import type { IncomingMessage, ServerResponse } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';
import { loadEnv } from 'vite';
import multer from 'multer';
import {
  ensurePageIndexSlot,
  getPageIndexes,
  hasValidPageIndexStructure,
  savePageIndex,
  getPageIndexByBoothAndType,
  type PageIndexDocType,
} from './src/server/mongodb';
import { downloadPdfFromPublicUrl, isR2Configured } from './src/server/r2';
import {
  getOpenRouterModel,
  openRouterChat,
  pageIndexChildEnv,
  requirePageIndexLlmEnv,
} from './src/server/openrouter';

const execFileAsync = promisify(execFile);

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c as Buffer));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function venvPython(rootDir: string): string {
  return process.platform === 'win32'
    ? path.join(rootDir, 'pageindex', '.venv', 'Scripts', 'python.exe')
    : path.join(rootDir, 'pageindex', '.venv', 'bin', 'python3');
}

function flattenNodes(nodes: unknown, depth = 0): string {
  if (!Array.isArray(nodes)) return '';
  const lines: string[] = [];
  const pad = '  '.repeat(depth);
  for (const n of nodes as Record<string, unknown>[]) {
    const title = typeof n.title === 'string' ? n.title : 'Untitled';
    const summary = typeof n.summary === 'string' ? ` — ${n.summary.slice(0, 280)}` : '';
    let excerpt = '';
    if (typeof n.text === 'string' && n.text.trim()) {
      excerpt = ` | text: ${n.text.replace(/\s+/g, ' ').trim().slice(0, 520)}`;
    }
    const p0 = n.start_index;
    const p1 = n.end_index;
    const pages =
      typeof p0 === 'number'
        ? ` (pages ${p0}${typeof p1 === 'number' && p1 !== p0 ? `–${p1}` : ''})`
        : '';
    lines.push(`${pad}- ${title}${pages}${summary}${excerpt}`);
    if (Array.isArray(n.nodes) && n.nodes.length) lines.push(flattenNodes(n.nodes, depth + 1));
  }
  return lines.join('\n');
}

const PAGEINDEX_DOC_TYPES = ['brochure', 'priceList', 'siteLayout', 'unitLayout'] as const;

function normalizeDocUrl(url: string): string {
  const raw = url.trim();
  if (!raw) return '';
  try {
    const u = new URL(raw);
    return `${u.origin}${u.pathname}`.replace(/\/$/, '');
  } catch {
    return raw.split('?')[0].split('#')[0].replace(/\/$/, '');
  }
}

function normalizeStructure(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object' && Array.isArray((data as { structure?: unknown }).structure)) {
    return (data as { structure: unknown[] }).structure;
  }
  return [];
}

/** Dev-only API: run PageIndex on uploaded PDFs + Gemini Q&A over the generated tree. */
export function pageindexApiPlugin(rootDir: string): Plugin {
  return {
    name: 'virtual-expo-pageindex-api',
    configureServer(server) {
      const env = loadEnv(server.config.mode, rootDir, '');
      if (env.MONGODB_URI) process.env.MONGODB_URI = env.MONGODB_URI;
      if (env.OPENROUTER_API_KEY) process.env.OPENROUTER_API_KEY = env.OPENROUTER_API_KEY;
      if (env.VITE_OPENROUTER_API_KEY) process.env.VITE_OPENROUTER_API_KEY = env.VITE_OPENROUTER_API_KEY;
      if (env.OPENROUTER_MODEL) process.env.OPENROUTER_MODEL = env.OPENROUTER_MODEL;
      if (env.VITE_OPENROUTER_MODEL) process.env.VITE_OPENROUTER_MODEL = env.VITE_OPENROUTER_MODEL;
      if (env.GEMINI_API_KEY) process.env.GEMINI_API_KEY = env.GEMINI_API_KEY;
      if (env.VITE_GEMINI_API_KEY) process.env.VITE_GEMINI_API_KEY = env.VITE_GEMINI_API_KEY;
      const uploadDir = path.join(rootDir, 'pageindex', 'uploads');
      fs.mkdirSync(uploadDir, { recursive: true });

      const storage = multer.diskStorage({
        destination: uploadDir,
        filename: (_req, file, cb) => {
          const safe = (file.originalname || 'upload.pdf').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120);
          cb(null, `${Date.now()}_${safe}`);
        },
      });
      const upload = multer({ storage, limits: { fileSize: 52 * 1024 * 1024 } });

      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0] ?? '';

        if (url === '/api/pageindex/status' && req.method === 'GET') {
          void (async () => {
            const urlParts = req.url?.split('?') ?? [];
            const queryParams = new URLSearchParams(urlParts[1] || '');
            const boothId = queryParams.get('boothId')?.trim();
            if (!boothId) {
              sendJson(res as ServerResponse, 400, { ok: false, error: 'Missing boothId' });
              return;
            }
            if (!process.env.MONGODB_URI?.trim()) {
              sendJson(res as ServerResponse, 503, {
                ok: false,
                error: 'MONGODB_URI not set — cannot read index status',
              });
              return;
            }
            const currentUrls: Record<string, string> = {
              brochure: queryParams.get('brochureUrl')?.trim() || '',
              priceList: queryParams.get('priceListUrl')?.trim() || '',
              siteLayout: queryParams.get('siteLayoutUrl')?.trim() || '',
              unitLayout: queryParams.get('unitLayoutUrl')?.trim() || '',
            };
            try {
              const rows = await getPageIndexes(boothId);
              const latestByType = new Map<string, (typeof rows)[0]>();
              for (const row of rows) {
                if (!latestByType.has(row.documentType)) {
                  latestByType.set(row.documentType, row);
                }
              }
              const documents = PAGEINDEX_DOC_TYPES.map((documentType) => {
                const currentUrl = currentUrls[documentType] || '';
                const stored = latestByType.get(documentType);
                const indexed = hasValidPageIndexStructure(stored?.structure);
                const indexStatus =
                  stored?.indexStatus ?? (indexed ? 'ready' : stored ? 'pending' : undefined);
                const storedUrl = stored?.pdfUrl?.trim() || '';
                const urlMatches =
                  !indexed ||
                  !currentUrl ||
                  !storedUrl ||
                  normalizeDocUrl(currentUrl) === normalizeDocUrl(storedUrl);
                return {
                  documentType,
                  indexed,
                  indexStatus: indexStatus ?? null,
                  slotExists: Boolean(stored),
                  indexedAt: stored?.indexedAt ? new Date(stored.indexedAt).toISOString() : null,
                  pdfUrl: storedUrl || null,
                  currentUrl: currentUrl || null,
                  urlMatches,
                  stale: indexed && Boolean(currentUrl) && Boolean(storedUrl) && !urlMatches,
                  readyForChat: indexed && urlMatches,
                  isPdf: /\.pdf(\?|#|$)/i.test(currentUrl) || currentUrl.startsWith('data:application/pdf'),
                };
              });
              sendJson(res as ServerResponse, 200, { ok: true, boothId, documents });
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : String(e);
              sendJson(res as ServerResponse, 500, { ok: false, error: msg });
            }
          })();
          return;
        }

        /** Index PDF already on R2 — server downloads (no browser CORS / 404 from wrong public path). */
        if (url === '/api/pageindex/index-from-url' && req.method === 'POST') {
          void (async () => {
            const urlParts = req.url?.split('?') ?? [];
            const queryParams = new URLSearchParams(urlParts[1] || '');
            const boothId = queryParams.get('boothId') || 'unknown';
            const documentType = queryParams.get('documentType') || 'brochure';
            const pdfUrl = queryParams.get('pdfUrl')?.trim() || '';
            if (!pdfUrl) {
              sendJson(res as ServerResponse, 400, { ok: false, error: 'Missing pdfUrl query parameter' });
              return;
            }
            if (!isR2Configured()) {
              sendJson(res as ServerResponse, 503, { ok: false, error: 'R2 not configured in .env' });
              return;
            }
            const docType = documentType as PageIndexDocType;
            try {
              await ensurePageIndexSlot(boothId, docType, pdfUrl, 'indexing');
              console.log(`✓ MongoDB slot: ${boothId}/${documentType} (indexing)`);
            } catch (slotErr) {
              console.warn('Could not ensure PageIndex slot:', slotErr);
            }
            const py = venvPython(rootDir);
            if (!fs.existsSync(py)) {
              sendJson(res as ServerResponse, 500, {
                ok: false,
                error: 'pageindex/.venv not found. Run: npm run pageindex:install',
              });
              return;
            }
            let pdfPath: string;
            try {
              const { buffer } = await downloadPdfFromPublicUrl(pdfUrl);
              const name = pdfUrl.split('/').pop()?.split('?')[0] || 'document.pdf';
              const safe = name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120);
              pdfPath = path.join(uploadDir, `${Date.now()}_${safe}`);
              fs.writeFileSync(pdfPath, buffer);
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : String(e);
              try {
                await ensurePageIndexSlot(boothId, docType, pdfUrl, 'failed');
              } catch {
                /* ignore */
              }
              sendJson(res as ServerResponse, 404, { ok: false, error: msg });
              return;
            }
            const runner = path.join(rootDir, 'scripts', 'pageindex_run.py');
            const llmCheck = requirePageIndexLlmEnv();
            if (!llmCheck.ok) {
              sendJson(res as ServerResponse, 500, { ok: false, error: llmCheck.error });
              return;
            }
            const childEnv = pageIndexChildEnv({
              ...process.env,
              GEMINI_API_KEY: env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY,
              GOOGLE_API_KEY: env.GOOGLE_API_KEY || process.env.GOOGLE_API_KEY,
            });
            fs.mkdirSync(path.join(rootDir, 'pageindex', 'results'), { recursive: true });
            try {
              await execFileAsync(py, [runner, '--pdf_path', path.resolve(pdfPath)], {
                cwd: rootDir,
                env: childEnv,
                maxBuffer: 64 * 1024 * 1024,
                timeout: 900_000,
              });
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : String(e);
              sendJson(res as ServerResponse, 500, { ok: false, error: `PageIndex failed: ${msg}` });
              return;
            }
            const base = path.parse(pdfPath).name;
            const outPath = path.join(rootDir, 'pageindex', 'results', `${base}_structure.json`);
            if (!fs.existsSync(outPath)) {
              sendJson(res as ServerResponse, 500, { ok: false, error: `Expected output missing: ${outPath}` });
              return;
            }
            let tree: unknown;
            try {
              tree = JSON.parse(fs.readFileSync(outPath, 'utf8')) as unknown;
            } catch {
              sendJson(res as ServerResponse, 500, { ok: false, error: 'Could not read result JSON' });
              return;
            }
            let savedToDb = false;
            let dbErrorMsg: string | undefined;
            try {
              if (!process.env.MONGODB_URI?.trim()) {
                throw new Error('MONGODB_URI is not set in .env — restart npm run dev after adding it');
              }
              const docId = await savePageIndex({
                boothId,
                documentType: documentType as 'brochure' | 'priceList' | 'siteLayout' | 'unitLayout',
                pdfUrl,
                pdfHash: '',
                structure: tree,
                indexedAt: new Date(),
                modelVersion: getOpenRouterModel(),
              });
              savedToDb = true;
              console.log(`✓ Saved PageIndex to MongoDB: ${boothId}/${documentType} (ID: ${docId})`);
            } catch (dbError) {
              dbErrorMsg = dbError instanceof Error ? dbError.message : String(dbError);
              console.error('Warning: Failed to save to MongoDB:', dbErrorMsg);
            }
            sendJson(res as ServerResponse, 200, {
              ok: true,
              outputPath: path.relative(rootDir, outPath),
              tree,
              boothId,
              documentType,
              savedToDb,
              dbError: dbErrorMsg,
            });
          })();
          return;
        }

        if (url === '/api/pageindex/index' && req.method === 'POST') {
          upload.single('pdf')(req as never, res as never, async (err: unknown) => {
            if (err) {
              sendJson(res as ServerResponse, 400, { ok: false, error: String(err) });
              return;
            }
            const file = (req as { file?: { path: string; originalname: string } }).file;
            if (!file?.path) {
              sendJson(res as ServerResponse, 400, { ok: false, error: 'Missing PDF file (field name: pdf)' });
              return;
            }
            const py = venvPython(rootDir);
            if (!fs.existsSync(py)) {
              sendJson(res as ServerResponse, 500, {
                ok: false,
                error: 'pageindex/.venv not found. Run: npm run pageindex:install',
              });
              return;
            }
            const pdfPath = path.resolve(file.path);
            const urlParts = req.url?.split('?') ?? [];
            const queryParams = new URLSearchParams(urlParts[1] || '');
            const boothId = queryParams.get('boothId') || 'unknown';
            const documentType = queryParams.get('documentType') || 'brochure';
            const pdfUrlStored = queryParams.get('pdfUrl')?.trim() || pdfPath;
            const docType = documentType as PageIndexDocType;
            try {
              await ensurePageIndexSlot(boothId, docType, pdfUrlStored, 'indexing');
            } catch (slotErr) {
              console.warn('Could not ensure PageIndex slot:', slotErr);
            }
            const runner = path.join(rootDir, 'scripts', 'pageindex_run.py');
            const llmCheckUpload = requirePageIndexLlmEnv();
            if (!llmCheckUpload.ok) {
              sendJson(res as ServerResponse, 500, { ok: false, error: llmCheckUpload.error });
              return;
            }
            const childEnv = pageIndexChildEnv({
              ...process.env,
              GEMINI_API_KEY: env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY,
              GOOGLE_API_KEY: env.GOOGLE_API_KEY || process.env.GOOGLE_API_KEY,
            });
            fs.mkdirSync(path.join(rootDir, 'pageindex', 'results'), { recursive: true });
            try {
              await execFileAsync(py, [runner, '--pdf_path', pdfPath], {
                cwd: rootDir,
                env: childEnv,
                maxBuffer: 64 * 1024 * 1024,
                timeout: 900_000,
              });
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : String(e);
              sendJson(res as ServerResponse, 500, { ok: false, error: `PageIndex failed: ${msg}` });
              return;
            }
            const base = path.parse(file.path).name;
            const outPath = path.join(rootDir, 'pageindex', 'results', `${base}_structure.json`);
            if (!fs.existsSync(outPath)) {
              sendJson(res as ServerResponse, 500, {
                ok: false,
                error: `Expected output missing: ${outPath}`,
              });
              return;
            }
            let tree: unknown;
            try {
              tree = JSON.parse(fs.readFileSync(outPath, 'utf8')) as unknown;
            } catch {
              sendJson(res as ServerResponse, 500, { ok: false, error: 'Could not read result JSON' });
              return;
            }

            // Save to MongoDB
            let savedToDb = false;
            let dbErrorMsg: string | undefined;
            try {
              if (!process.env.MONGODB_URI?.trim()) {
                throw new Error('MONGODB_URI is not set in .env — add your Atlas connection string and restart npm run dev');
              }
              const docId = await savePageIndex({
                boothId,
                documentType: documentType as 'brochure' | 'priceList' | 'siteLayout' | 'unitLayout',
                pdfUrl: pdfUrlStored,
                pdfHash: '',
                structure: tree,
                indexedAt: new Date(),
                modelVersion: getOpenRouterModel(),
              });
              savedToDb = true;
              console.log(`✓ Saved PageIndex to MongoDB: ${boothId}/${documentType} (ID: ${docId})`);
            } catch (dbError) {
              dbErrorMsg = dbError instanceof Error ? dbError.message : String(dbError);
              console.error('Warning: Failed to save to MongoDB:', dbErrorMsg);
            }

            sendJson(res as ServerResponse, 200, {
              ok: true,
              outputPath: path.relative(rootDir, outPath),
              tree,
              boothId,
              documentType,
              savedToDb,
              dbError: dbErrorMsg,
            });
          });
          return;
        }

        if (url === '/api/pageindex/ask' && req.method === 'POST') {
          void (async () => {
            const raw = await readBody(req);
            let body: { question?: string; tree?: unknown; boothId?: string; documentType?: string };
            try {
              body = JSON.parse(raw) as { question?: string; tree?: unknown; boothId?: string; documentType?: string };
            } catch {
              sendJson(res as ServerResponse, 400, { ok: false, error: 'Invalid JSON body' });
              return;
            }
            const q = (body.question ?? '').trim();
            if (!q) {
              sendJson(res as ServerResponse, 400, { ok: false, error: 'Missing question' });
              return;
            }

            let tree = body.tree;

            // Try to load from MongoDB if boothId and documentType are provided
            if (body.boothId && body.documentType && !tree) {
              try {
                const dbDoc = await getPageIndexByBoothAndType(body.boothId, body.documentType);
                if (dbDoc?.structure) {
                  tree = dbDoc.structure;
                  console.log(`✓ Loaded PageIndex from MongoDB: ${body.boothId}/${body.documentType}`);
                }
              } catch (dbError) {
                console.warn('Failed to load from MongoDB:', dbError);
                // Continue with provided tree if available
              }
            }

            if (!tree) {
              sendJson(res as ServerResponse, 400, { ok: false, error: 'No tree provided and could not load from MongoDB' });
              return;
            }

            const nodes = normalizeStructure(tree);
            const deck = flattenNodes(nodes).slice(0, 18_000);
            const prompt = `You are answering questions using the document index below. It contains section titles, page ranges, summaries, and short text excerpts extracted from the PDF (image-only pages may have little or no text). Use only this material plus reasonable inferences. If the detail is not present (common for floor-plan drawings), say so clearly and tell the user to open the full PDF, naming the most relevant section and page range.

Document index:
${deck}

User question: ${q}`;

            try {
              const text = await openRouterChat({
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.3,
                maxTokens: 2048,
              });
              sendJson(res as ServerResponse, 200, { ok: true, answer: text });
            } catch (e: unknown) {
              sendJson(res as ServerResponse, 500, { ok: false, error: e instanceof Error ? e.message : String(e) });
            }
          })();
          return;
        }

        if (url === '/api/chat' && req.method === 'POST') {
          void (async () => {
            const raw = await readBody(req);
            let body: {
              messages?: { role: string; content: string }[];
              systemPrompt?: string;
              temperature?: number;
              maxOutputTokens?: number;
            };
            try {
              body = JSON.parse(raw) as typeof body;
            } catch {
              sendJson(res as ServerResponse, 400, { ok: false, error: 'Invalid JSON body' });
              return;
            }
            const incoming = body.messages ?? [];
            if (!incoming.length && !body.systemPrompt?.trim()) {
              sendJson(res as ServerResponse, 400, { ok: false, error: 'Missing messages' });
              return;
            }
            const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [];
            if (body.systemPrompt?.trim()) {
              messages.push({ role: 'system', content: body.systemPrompt.trim() });
            }
            for (const m of incoming) {
              const role = m.role === 'assistant' ? 'assistant' : m.role === 'system' ? 'system' : 'user';
              if (m.content?.trim()) messages.push({ role, content: m.content });
            }
            try {
              const answer = await openRouterChat({
                messages,
                temperature: body.temperature ?? 0.5,
                maxTokens: body.maxOutputTokens ?? 2048,
              });
              sendJson(res as ServerResponse, 200, { ok: true, answer, model: getOpenRouterModel() });
            } catch (e: unknown) {
              sendJson(res as ServerResponse, 500, {
                ok: false,
                error: e instanceof Error ? e.message : String(e),
              });
            }
          })();
          return;
        }

        next();
      });
    },
  };
}
