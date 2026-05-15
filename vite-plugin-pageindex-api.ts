import type { IncomingMessage, ServerResponse } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';
import { loadEnv } from 'vite';
import multer from 'multer';

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
            const runner = path.join(rootDir, 'scripts', 'pageindex_run.py');
            const childEnv = {
              ...process.env,
              GEMINI_API_KEY: env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY,
              GOOGLE_API_KEY: env.GOOGLE_API_KEY || process.env.GOOGLE_API_KEY,
            };
            if (!childEnv.GEMINI_API_KEY && !childEnv.GOOGLE_API_KEY) {
              sendJson(res as ServerResponse, 500, {
                ok: false,
                error: 'No Gemini key: set VITE_GEMINI_API_KEY or GEMINI_API_KEY in .env',
              });
              return;
            }
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
            sendJson(res as ServerResponse, 200, {
              ok: true,
              outputPath: path.relative(rootDir, outPath),
              tree,
            });
          });
          return;
        }

        if (url === '/api/pageindex/ask' && req.method === 'POST') {
          void (async () => {
            const raw = await readBody(req);
            let body: { question?: string; tree?: unknown };
            try {
              body = JSON.parse(raw) as { question?: string; tree?: unknown };
            } catch {
              sendJson(res as ServerResponse, 400, { ok: false, error: 'Invalid JSON body' });
              return;
            }
            const q = (body.question ?? '').trim();
            if (!q) {
              sendJson(res as ServerResponse, 400, { ok: false, error: 'Missing question' });
              return;
            }
            const key = env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
            if (!key) {
              sendJson(res as ServerResponse, 500, { ok: false, error: 'Missing VITE_GEMINI_API_KEY in .env' });
              return;
            }
            const modelRaw = (env.VITE_GEMINI_MODEL || '').trim() || 'gemini-3.1-flash-lite-preview';
            const modelId = modelRaw.startsWith('gemini/') ? modelRaw.slice(7) : modelRaw;

            const nodes = normalizeStructure(body.tree);
            const deck = flattenNodes(nodes).slice(0, 18_000);
            const prompt = `You are answering questions using the document index below. It contains section titles, page ranges, summaries, and short text excerpts extracted from the PDF (image-only pages may have little or no text). Use only this material plus reasonable inferences. If the detail is not present (common for floor-plan drawings), say so clearly and tell the user to open the full PDF, naming the most relevant section and page range.

Document index:
${deck}

User question: ${q}`;

            try {
              const urlGemini = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent?key=${encodeURIComponent(key)}`;
              const gemRes = await fetch(urlGemini, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [{ role: 'user', parts: [{ text: prompt }] }],
                  generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
                }),
              });
              const gemJson = (await gemRes.json()) as {
                error?: { message?: string };
                candidates?: { content?: { parts?: { text?: string }[] } }[];
              };
              if (!gemRes.ok) {
                sendJson(res as ServerResponse, 502, {
                  ok: false,
                  error: gemJson.error?.message || `Gemini HTTP ${gemRes.status}`,
                });
                return;
              }
              const text =
                gemJson.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
              sendJson(res as ServerResponse, 200, { ok: true, answer: text });
            } catch (e: unknown) {
              sendJson(res as ServerResponse, 500, { ok: false, error: e instanceof Error ? e.message : String(e) });
            }
          })();
          return;
        }

        next();
      });
    },
  };
}
