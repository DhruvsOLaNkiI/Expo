import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import {
  getFullExpoConfig,
  patchBoothOverride,
  deleteBoothOverride as deleteBoothOverrideMongo,
  saveAllBoothOverrides,
  patchSceneSettings,
  resetSceneSettings as resetSceneSettingsMongo,
} from './src/server/mongodb';

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

/** Dev + production: MongoDB-backed booth CMS + scene settings API. */
export function boothCmsApiPlugin(_rootDir: string): Plugin {
  return {
    name: 'virtual-expo-booth-cms-api',
    configureServer(server) {
      attachBoothCmsApi(server);
    },
    configurePreviewServer(server) {
      attachBoothCmsApi(server);
    },
  };
}

function attachBoothCmsApi(server: ApiConnectServer) {
  server.middlewares.use((req, res, next) => {
    const url = req.url?.split('?')[0] ?? '';

    // ── GET /api/expo/config — full config for frontend hydration ──
    if (url === '/api/expo/config' && req.method === 'GET') {
      void (async () => {
        try {
          const config = await getFullExpoConfig();
          sendJson(res, 200, { ok: true, ...config });
        } catch (e) {
          sendJson(res, 500, { ok: false, error: e instanceof Error ? e.message : 'Failed to load config' });
        }
      })();
      return;
    }

    // ── POST /api/booth-cms/patch — patch a single booth ──
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

          const ok = await patchBoothOverride(boothId, patch);
          if (!ok) {
            sendJson(res, 500, { ok: false, error: 'MongoDB write failed' });
            return;
          }

          console.log(`✓ booth-cms patch (MongoDB): ${boothId}`, Object.keys(patch).join(', '));
          sendJson(res, 200, { ok: true, boothId });
        } catch (e) {
          sendJson(res, 500, { ok: false, error: e instanceof Error ? e.message : 'Patch failed' });
        }
      })();
      return;
    }

    // ── POST /api/booth-cms/save — bulk save all booths ──
    if (url === '/api/booth-cms/save' && req.method === 'POST') {
      void (async () => {
        try {
          const raw = await readBody(req);
          const body = JSON.parse(raw) as {
            booths?: Record<string, Record<string, unknown>>;
            scene?: Record<string, unknown>;
            r2PublicBase?: string;
          };
          if (!body?.booths || typeof body.booths !== 'object') {
            sendJson(res, 400, { ok: false, error: 'Expected { booths, scene }' });
            return;
          }

          const boothOk = await saveAllBoothOverrides(body.booths);
          let sceneOk = true;
          if (body.scene && typeof body.scene === 'object') {
            sceneOk = await patchSceneSettings(body.scene, body.r2PublicBase);
          }
          sendJson(res, 200, { ok: boothOk && sceneOk });
        } catch (e) {
          sendJson(res, 500, { ok: false, error: e instanceof Error ? e.message : 'Save failed' });
        }
      })();
      return;
    }

    // ── DELETE /api/booth-cms/:boothId — delete a single booth override ──
    if (url.startsWith('/api/booth-cms/') && req.method === 'DELETE') {
      const boothId = url.replace('/api/booth-cms/', '').trim();
      if (!boothId) { sendJson(res, 400, { ok: false, error: 'Missing boothId' }); return; }
      void (async () => {
        try {
          await deleteBoothOverrideMongo(boothId);
          sendJson(res, 200, { ok: true, boothId });
        } catch (e) {
          sendJson(res, 500, { ok: false, error: e instanceof Error ? e.message : 'Delete failed' });
        }
      })();
      return;
    }

    // ── POST /api/scene/patch — patch scene settings ──
    if (url === '/api/scene/patch' && req.method === 'POST') {
      void (async () => {
        try {
          const raw = await readBody(req);
          const body = JSON.parse(raw) as {
            patch?: Record<string, unknown>;
            r2PublicBase?: string;
          };
          if (!body?.patch || typeof body.patch !== 'object') {
            sendJson(res, 400, { ok: false, error: 'Expected { patch }' });
            return;
          }
          const ok = await patchSceneSettings(body.patch, body.r2PublicBase);
          sendJson(res, ok ? 200 : 500, { ok });
        } catch (e) {
          sendJson(res, 500, { ok: false, error: e instanceof Error ? e.message : 'Scene patch failed' });
        }
      })();
      return;
    }

    // ── DELETE /api/scene — reset scene settings ──
    if (url === '/api/scene' && req.method === 'DELETE') {
      void (async () => {
        try {
          await resetSceneSettingsMongo();
          sendJson(res, 200, { ok: true });
        } catch (e) {
          sendJson(res, 500, { ok: false, error: e instanceof Error ? e.message : 'Reset failed' });
        }
      })();
      return;
    }

    next();
  });
}
