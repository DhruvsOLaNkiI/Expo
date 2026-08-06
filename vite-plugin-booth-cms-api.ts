import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { DEFAULT_EXPO_HALL_ID, normalizeHallId } from './src/features/shared/data/expoHalls';
import {
  getFullExpoConfig,
  getCmsExpoOverview,
  listExpoHalls,
  getExpoGlobalSettings,
  setVisitorLandingHallId,
  patchBoothOverrideForHall,
  copyBoothLayoutToHall,
  deleteBoothOverrideForHall,
  saveAllBoothOverridesForHall,
  patchSceneSettingsForHall,
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

function getServerAdminKey(): string {
  return (
    process.env.EXPO_ADMIN_KEY?.trim() ||
    process.env.VITE_EXPO_ADMIN_KEY?.trim() ||
    'expo-admin-dev'
  );
}

function normalizeVisitorId(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

function getServerAdminVisitorIds(): string[] {
  const raw =
    process.env.EXPO_ADMIN_VISITOR_IDS?.trim() ||
    process.env.VITE_EXPO_ADMIN_VISITOR_IDS?.trim() ||
    'VX-1BVJQ9CZ';
  return raw.split(',').map(normalizeVisitorId).filter(Boolean);
}

function isAdminRequest(req: IncomingMessage): boolean {
  const keyHeader = req.headers['x-expo-admin-key'];
  const key = Array.isArray(keyHeader) ? keyHeader[0] : keyHeader;
  if (key?.trim() && key.trim() === getServerAdminKey()) return true;

  const visitorHeader = req.headers['x-expo-admin-visitor-id'];
  const visitorId = normalizeVisitorId(
    Array.isArray(visitorHeader) ? visitorHeader[0] ?? '' : visitorHeader ?? '',
  );
  if (!visitorId) return false;
  return getServerAdminVisitorIds().includes(visitorId);
}

function rejectUnlessAdmin(req: IncomingMessage, res: ServerResponse): boolean {
  if (isAdminRequest(req)) return true;
  sendJson(res, 403, { ok: false, error: 'Admin key required (X-Expo-Admin-Key)' });
  return false;
}

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

    // ── GET /api/expo/halls — hall list for CMS + Fast Travel ──
    if (url === '/api/expo/halls' && req.method === 'GET') {
      void (async () => {
        try {
          const [halls, settings] = await Promise.all([listExpoHalls(), getExpoGlobalSettings()]);
          sendJson(res, 200, {
            ok: true,
            halls,
            visitorLandingHallId: settings.visitorLandingHallId,
          });
        } catch (e) {
          sendJson(res, 500, { ok: false, error: e instanceof Error ? e.message : 'Failed to load halls' });
        }
      })();
      return;
    }

    // ── POST /api/expo/visitor-landing-hall — admin sets which hall visitors open into ──
    if (url === '/api/expo/visitor-landing-hall' && req.method === 'POST') {
      void (async () => {
        if (!rejectUnlessAdmin(req, res)) return;
        try {
          const raw = await readBody(req);
          const body = raw ? JSON.parse(raw) : {};
          const hallId = normalizeHallId(
            typeof body?.hallId === 'string' ? body.hallId : body?.visitorLandingHallId,
          );
          const settings = await setVisitorLandingHallId(hallId);
          sendJson(res, 200, { ok: true, ...settings });
        } catch (e) {
          sendJson(res, 500, {
            ok: false,
            error: e instanceof Error ? e.message : 'Failed to save visitor landing hall',
          });
        }
      })();
      return;
    }

    // ── GET /api/expo/cms-overview — all halls for CMS grid ──
    if (url === '/api/expo/cms-overview' && req.method === 'GET') {
      void (async () => {
        try {
          const overview = await getCmsExpoOverview();
          sendJson(res, 200, { ok: true, ...overview });
        } catch (e) {
          sendJson(res, 500, { ok: false, error: e instanceof Error ? e.message : 'Failed to load overview' });
        }
      })();
      return;
    }

    // ── GET /api/expo/config?hallId= — full config for one hall ──
    if (url === '/api/expo/config' && req.method === 'GET') {
      void (async () => {
        try {
          const q = new URL(req.url ?? '', 'http://local').searchParams;
          const hallId = normalizeHallId(q.get('hallId') ?? DEFAULT_EXPO_HALL_ID);
          const config = await getFullExpoConfig(hallId);
          sendJson(res, 200, { ok: true, ...config });
        } catch (e) {
          sendJson(res, 500, { ok: false, error: e instanceof Error ? e.message : 'Failed to load config' });
        }
      })();
      return;
    }

    // ── POST /api/booth-cms/copy-booth-layout — copy layout fields one slot hall → hall ──
    if (url === '/api/booth-cms/copy-booth-layout' && req.method === 'POST') {
      void (async () => {
        if (!rejectUnlessAdmin(req, res)) return;
        try {
          const raw = await readBody(req);
          const body = JSON.parse(raw) as {
            sourceHallId?: string;
            targetHallId?: string;
            slotId?: string;
            boothId?: string;
          };
          const sourceHallId = normalizeHallId(body.sourceHallId ?? DEFAULT_EXPO_HALL_ID);
          const targetHallId = normalizeHallId(body.targetHallId ?? '');
          const slotId = (body.slotId ?? body.boothId)?.trim();
          if (!targetHallId || !slotId) {
            sendJson(res, 400, { ok: false, error: 'Expected { sourceHallId?, targetHallId, slotId }' });
            return;
          }
          const result = await copyBoothLayoutToHall(sourceHallId, targetHallId, slotId);
          sendJson(res, result.ok ? 200 : 500, result);
        } catch (e) {
          sendJson(res, 500, { ok: false, error: e instanceof Error ? e.message : 'Copy failed' });
        }
      })();
      return;
    }

    // ── POST /api/booth-cms/patch — patch a single booth ──
    if (url === '/api/booth-cms/patch' && req.method === 'POST') {
      void (async () => {
        if (!rejectUnlessAdmin(req, res)) return;
        try {
          const raw = await readBody(req);
          const body = JSON.parse(raw) as {
            hallId?: string;
            boothId?: string;
            slotId?: string;
            patch?: Record<string, unknown>;
          };
          const hallId = normalizeHallId(body.hallId ?? DEFAULT_EXPO_HALL_ID);
          const slotId = (body.slotId ?? body.boothId)?.trim();
          const patch = body.patch;
          if (!slotId || !patch || typeof patch !== 'object') {
            sendJson(res, 400, { ok: false, error: 'Expected { hallId?, slotId|boothId, patch }' });
            return;
          }

          const ok = await patchBoothOverrideForHall(hallId, slotId, patch);
          if (!ok) {
            sendJson(res, 500, { ok: false, error: 'MongoDB write failed' });
            return;
          }

          console.log(`✓ booth-cms patch (MongoDB): ${hallId}/${slotId}`, Object.keys(patch).join(', '));
          sendJson(res, 200, { ok: true, hallId, slotId, boothId: slotId });
        } catch (e) {
          sendJson(res, 500, { ok: false, error: e instanceof Error ? e.message : 'Patch failed' });
        }
      })();
      return;
    }

    // ── POST /api/booth-cms/save — bulk save all booths ──
    if (url === '/api/booth-cms/save' && req.method === 'POST') {
      void (async () => {
        if (!rejectUnlessAdmin(req, res)) return;
        try {
          const raw = await readBody(req);
          const body = JSON.parse(raw) as {
            hallId?: string;
            booths?: Record<string, Record<string, unknown>>;
            scene?: Record<string, unknown>;
            r2PublicBase?: string;
          };
          if (!body?.booths || typeof body.booths !== 'object') {
            sendJson(res, 400, { ok: false, error: 'Expected { booths, scene, hallId? }' });
            return;
          }

          const hallId = normalizeHallId(body.hallId ?? DEFAULT_EXPO_HALL_ID);
          const boothOk = await saveAllBoothOverridesForHall(hallId, body.booths);
          let sceneOk = true;
          if (body.scene && typeof body.scene === 'object') {
            sceneOk = await patchSceneSettingsForHall(hallId, body.scene, body.r2PublicBase);
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
      const rest = url.replace('/api/booth-cms/', '').trim();
      const parts = rest.split('/').filter(Boolean);
      const hallId = normalizeHallId(parts.length >= 2 ? parts[0] : DEFAULT_EXPO_HALL_ID);
      const slotId = (parts.length >= 2 ? parts[1] : parts[0])?.trim();
      if (!slotId) { sendJson(res, 400, { ok: false, error: 'Missing slotId' }); return; }
      void (async () => {
        if (!rejectUnlessAdmin(req, res)) return;
        try {
          await deleteBoothOverrideForHall(hallId, slotId);
          sendJson(res, 200, { ok: true, hallId, slotId });
        } catch (e) {
          sendJson(res, 500, { ok: false, error: e instanceof Error ? e.message : 'Delete failed' });
        }
      })();
      return;
    }

    // ── POST /api/scene/patch — patch scene settings ──
    if (url === '/api/scene/patch' && req.method === 'POST') {
      void (async () => {
        if (!rejectUnlessAdmin(req, res)) return;
        try {
          const raw = await readBody(req);
          const body = JSON.parse(raw) as {
            hallId?: string;
            patch?: Record<string, unknown>;
            r2PublicBase?: string;
          };
          if (!body?.patch || typeof body.patch !== 'object') {
            sendJson(res, 400, { ok: false, error: 'Expected { patch, hallId? }' });
            return;
          }
          const hallId = normalizeHallId(body.hallId ?? DEFAULT_EXPO_HALL_ID);
          const ok = await patchSceneSettingsForHall(hallId, body.patch, body.r2PublicBase);
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
        if (!rejectUnlessAdmin(req, res)) return;
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
