import fs from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';

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

type ApiConnectServer = {
  middlewares: {
    use: (fn: (req: IncomingMessage, res: ServerResponse, next: () => void) => void) => void;
  };
};

type BoothCmsFile = {
  r2PublicBase?: string;
  booths?: Record<string, Record<string, unknown>>;
  scene?: Record<string, unknown>;
};

function readBoothCmsFile(outPath: string): BoothCmsFile {
  try {
    if (fs.existsSync(outPath)) {
      return JSON.parse(fs.readFileSync(outPath, 'utf8')) as BoothCmsFile;
    }
  } catch {
    /* */
  }
  return { booths: {}, scene: {} };
}

function writeBoothCmsFile(outPath: string, data: BoothCmsFile): void {
  fs.writeFileSync(outPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

/** Dev + production: persist booth-cms.json (shared asset URLs for all visitors). */
export function boothCmsApiPlugin(rootDir: string): Plugin {
  return {
    name: 'virtual-expo-booth-cms-api',
    configureServer(server) {
      attachBoothCmsApi(server, rootDir);
    },
    configurePreviewServer(server) {
      attachBoothCmsApi(server, rootDir);
    },
  };
}

function attachBoothCmsApi(server: ApiConnectServer, rootDir: string) {
  const outPath = path.join(rootDir, 'public', 'booth-cms.json');
  const r2DocsPath = path.join(rootDir, 'public', 'r2-documents.json');

  server.middlewares.use((req, res, next) => {
    const url = req.url?.split('?')[0] ?? '';

    if (url === '/api/booth-cms/save' && req.method === 'POST') {
      void (async () => {
        try {
          const raw = await readBody(req);
          const body = JSON.parse(raw) as { booths?: unknown; scene?: unknown; r2PublicBase?: string };
          if (!body?.booths || typeof body.booths !== 'object') {
            sendJson(res, 400, { ok: false, error: 'Expected { booths, scene }' });
            return;
          }
          const payload: BoothCmsFile = {
            r2PublicBase: typeof body.r2PublicBase === 'string' ? body.r2PublicBase : undefined,
            booths: body.booths as Record<string, Record<string, unknown>>,
            scene: body.scene && typeof body.scene === 'object' ? (body.scene as Record<string, unknown>) : {},
          };
          writeBoothCmsFile(outPath, payload);
          sendJson(res, 200, { ok: true, path: 'public/booth-cms.json' });
        } catch (e) {
          sendJson(res, 500, { ok: false, error: e instanceof Error ? e.message : 'Save failed' });
        }
      })();
      return;
    }

    if (url === '/api/booth-cms/patch' && req.method === 'POST') {
      void (async () => {
        try {
          const raw = await readBody(req);
          const body = JSON.parse(raw) as {
            boothId?: string;
            patch?: Record<string, unknown>;
          };
          const boothId = body.boothId?.trim();
          const patch = body.patch;
          if (!boothId || !patch || typeof patch !== 'object') {
            sendJson(res, 400, { ok: false, error: 'Expected { boothId, patch }' });
            return;
          }

          const current = readBoothCmsFile(outPath);
          const booths = current.booths ?? {};
          const prev = booths[boothId] ?? {};
          booths[boothId] = { ...prev, ...patch };

          writeBoothCmsFile(outPath, {
            r2PublicBase: current.r2PublicBase,
            booths,
            scene: current.scene ?? {},
          });

          syncR2DocumentsManifest(r2DocsPath, boothId, patch);

          console.log(`✓ booth-cms patch: ${boothId}`, Object.keys(patch).join(', '));
          sendJson(res, 200, { ok: true, boothId, path: 'public/booth-cms.json' });
        } catch (e) {
          sendJson(res, 500, { ok: false, error: e instanceof Error ? e.message : 'Patch failed' });
        }
      })();
      return;
    }

    next();
  });
}

function toR2ObjectKey(publicUrl: string, publicBase: string): string | null {
  const u = publicUrl.trim();
  const base = publicBase.trim().replace(/\/$/, '');
  if (!u.startsWith('http') || !base) return null;
  try {
    const parsed = new URL(u);
    const baseUrl = new URL(base);
    if (parsed.origin !== baseUrl.origin) return null;
    return decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  } catch {
    return null;
  }
}

/** Keep r2-documents.json in sync when CMS saves https brochure/price URLs. */
function syncR2DocumentsManifest(
  r2DocsPath: string,
  boothId: string,
  patch: Record<string, unknown>,
): void {
  let manifest: {
    publicBase?: string;
    documents?: Record<string, Record<string, string>>;
    _readme?: string;
  } = {};
  try {
    if (fs.existsSync(r2DocsPath)) {
      manifest = JSON.parse(fs.readFileSync(r2DocsPath, 'utf8')) as typeof manifest;
    }
  } catch {
    /* */
  }

  const publicBase = String(manifest.publicBase ?? '').trim();
  if (!publicBase) return;

  const docFields = ['brochureUrl', 'priceListUrl', 'unitLayoutUrl'] as const;
  let changed = false;
  if (!manifest.documents) manifest.documents = {};
  if (!manifest.documents[boothId]) manifest.documents[boothId] = {};

  for (const field of docFields) {
    const raw = patch[field];
    if (typeof raw !== 'string' || !raw.trim()) continue;
    const key = toR2ObjectKey(raw, publicBase);
    if (key) {
      manifest.documents[boothId][field] = key;
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(r2DocsPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  }
}
