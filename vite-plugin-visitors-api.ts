import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { loadEnv } from 'vite';
import { computeCatalogStats } from './src/data/expoStats';
import { getVisitorRegistrationStats, markVisitorLobbyCheckIn, saveVisitorRegistration } from './src/server/mongodb';
import type { ExpoLiveStats } from './src/data/expoStats';

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

/** Dev-only API: persist registration-hall visitors to MongoDB. */
export function visitorsApiPlugin(rootDir: string): Plugin {
  return {
    name: 'virtual-expo-visitors-api',
    configureServer(server) {
      const env = loadEnv(server.config.mode, rootDir, '');
      if (env.MONGODB_URI) process.env.MONGODB_URI = env.MONGODB_URI;

      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0] ?? '';

        if (url === '/api/visitors/register' && req.method === 'POST') {
          void (async () => {
            const raw = await readBody(req);
            let body: {
              visitorId?: string;
              displayName?: string;
              email?: string;
              phone?: string;
              avatar?: { outfitColor: string; skinTone: string; hairColor: string };
              createdAt?: number;
              lobbyCheckIn?: boolean;
            };
            try {
              body = JSON.parse(raw) as typeof body;
            } catch {
              sendJson(res, 400, { ok: false, error: 'Invalid JSON body' });
              return;
            }

            const visitorId = (body.visitorId ?? '').trim();
            const displayName = (body.displayName ?? '').trim();
            const email = (body.email ?? '').trim();
            const phone = (body.phone ?? '').trim();
            if (!visitorId || !displayName) {
              sendJson(res, 400, { ok: false, error: 'visitorId and displayName are required' });
              return;
            }
            if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
              sendJson(res, 400, { ok: false, error: 'A valid email is required' });
              return;
            }
            if (!phone || phone.replace(/\D/g, '').length < 8) {
              sendJson(res, 400, { ok: false, error: 'A valid phone number is required' });
              return;
            }
            if (!body.avatar?.outfitColor || !body.avatar?.skinTone || !body.avatar?.hairColor) {
              sendJson(res, 400, { ok: false, error: 'avatar colors are required' });
              return;
            }

            if (!process.env.MONGODB_URI) {
              sendJson(res, 500, {
                ok: false,
                error: 'MONGODB_URI is not set in .env',
              });
              return;
            }

            try {
              const mongoId = await saveVisitorRegistration({
                visitorId,
                displayName,
                email,
                phone,
                avatar: body.avatar,
                createdAt: body.createdAt ? new Date(body.createdAt) : new Date(),
                lobbyCheckInAt: body.lobbyCheckIn ? new Date() : undefined,
              });
              console.log(`✓ Visitor saved to MongoDB: ${displayName} (${visitorId})`);
              sendJson(res, 200, { ok: true, mongoId, visitorId, displayName });
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : String(e);
              console.error('Visitor register failed:', msg);
              sendJson(res, 500, { ok: false, error: msg });
            }
          })();
          return;
        }

        if (url === '/api/expo/stats' && req.method === 'GET') {
          void (async () => {
            const catalog = computeCatalogStats({});
            const statsAsOf = new Date().toISOString();
            let mongoConnected = false;
            let visitorsTotal: number | null = null;
            let visitorsRegisteredToday: number | null = null;
            let visitorsCheckedInToday: number | null = null;

            if (process.env.MONGODB_URI?.trim()) {
              try {
                const v = await getVisitorRegistrationStats();
                mongoConnected = true;
                visitorsTotal = v.visitorsTotal;
                visitorsRegisteredToday = v.visitorsRegisteredToday;
                visitorsCheckedInToday = v.visitorsCheckedInToday;
              } catch (e) {
                console.warn('Expo stats: MongoDB visitor counts failed:', e);
              }
            }

            const stats: ExpoLiveStats = {
              ...catalog,
              visitorsTotal,
              visitorsRegisteredToday,
              visitorsCheckedInToday,
              statsAsOf,
              mongoConnected,
            };
            sendJson(res as ServerResponse, 200, { ok: true, stats });
          })();
          return;
        }

        if (url === '/api/visitors/check-in' && req.method === 'POST') {
          void (async () => {
            const raw = await readBody(req);
            let body: { visitorId?: string };
            try {
              body = JSON.parse(raw) as { visitorId?: string };
            } catch {
              sendJson(res, 400, { ok: false, error: 'Invalid JSON body' });
              return;
            }
            const visitorId = (body.visitorId ?? '').trim();
            if (!visitorId) {
              sendJson(res, 400, { ok: false, error: 'visitorId is required' });
              return;
            }
            if (!process.env.MONGODB_URI) {
              sendJson(res, 500, { ok: false, error: 'MONGODB_URI is not set in .env' });
              return;
            }
            try {
              await markVisitorLobbyCheckIn(visitorId);
              console.log(`✓ Visitor check-in recorded: ${visitorId}`);
              sendJson(res, 200, { ok: true, visitorId });
            } catch (e: unknown) {
              sendJson(res, 500, {
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
