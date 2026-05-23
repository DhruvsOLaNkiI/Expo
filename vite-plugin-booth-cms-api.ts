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

/** Dev-only: write `public/booth-cms.json` from the CMS / layout editor. */
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

  server.middlewares.use((req, res, next) => {
    const url = req.url?.split('?')[0] ?? '';
    if (url !== '/api/booth-cms/save' || req.method !== 'POST') {
      next();
      return;
    }

    void (async () => {
      try {
        const raw = await readBody(req);
        const body = JSON.parse(raw) as { booths?: unknown; scene?: unknown };
        if (!body?.booths || typeof body.booths !== 'object') {
          sendJson(res, 400, { error: 'Expected { booths, scene }' });
          return;
        }
        const payload = {
          booths: body.booths,
          scene: body.scene && typeof body.scene === 'object' ? body.scene : {},
        };
        fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
        sendJson(res, 200, { ok: true, path: 'public/booth-cms.json' });
      } catch (e) {
        sendJson(res, 500, { error: e instanceof Error ? e.message : 'Save failed' });
      }
    })();
  });
}
