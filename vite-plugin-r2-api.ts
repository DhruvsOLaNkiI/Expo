import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { loadEnv } from 'vite';
import multer from 'multer';
import { normalizeR2PublicUrl } from './src/api/r2Urls';
import {
  formatMulterUploadError,
  maxUploadBytesFromEnv,
  maxUploadMbFromEnv,
} from './src/constants/uploadLimits';
import { isAllowedR2TextureUrl } from './src/config/webglTextureUrl';
import { buildObjectKey, isR2Configured, normalizeR2ObjectKey, uploadBufferToR2 } from './src/server/r2';

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

async function handleTextureProxy(
  req: IncomingMessage,
  res: ServerResponse,
  publicBase: string,
) {
  const fullUrl = req.url ?? '';
  const q = fullUrl.indexOf('?');
  const params = new URLSearchParams(q >= 0 ? fullUrl.slice(q + 1) : '');
  const target = params.get('url')?.trim() ?? '';
  if (!target || !isAllowedR2TextureUrl(target, publicBase)) {
    sendJson(res, 400, { ok: false, error: 'Invalid or disallowed texture URL' });
    return;
  }

  try {
    const normalized = normalizeR2PublicUrl(target);
    const upstream = await fetch(normalized, { headers: { Accept: 'image/*,*/*' } });
    if (!upstream.ok) {
      sendJson(res, upstream.status, { ok: false, error: `Upstream returned ${upstream.status}` });
      return;
    }
    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.statusCode = 200;
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.end(buf);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('Texture proxy failed:', msg);
    sendJson(res, 502, { ok: false, error: msg });
  }
}

/** Stream R2 videos with Range support so LED screens work without bucket CORS. */
async function handleMediaProxy(
  req: IncomingMessage,
  res: ServerResponse,
  publicBase: string,
) {
  const fullUrl = req.url ?? '';
  const q = fullUrl.indexOf('?');
  const params = new URLSearchParams(q >= 0 ? fullUrl.slice(q + 1) : '');
  const target = params.get('url')?.trim() ?? '';
  if (!target || !isAllowedR2TextureUrl(target, publicBase)) {
    sendJson(res, 400, { ok: false, error: 'Invalid or disallowed media URL' });
    return;
  }

  try {
    const normalized = normalizeR2PublicUrl(target);
    const upstreamHeaders: Record<string, string> = { Accept: '*/*' };
    const range = req.headers.range;
    if (typeof range === 'string' && range.trim()) {
      upstreamHeaders.Range = range.trim();
    }

    const upstream = await fetch(normalized, { headers: upstreamHeaders });
    if (!(upstream.ok || upstream.status === 206)) {
      sendJson(res, upstream.status, { ok: false, error: `Upstream returned ${upstream.status}` });
      return;
    }

    res.statusCode = upstream.status;
    const contentType = upstream.headers.get('content-type') || 'video/mp4';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Accept-Ranges', upstream.headers.get('accept-ranges') || 'bytes');
    const contentLength = upstream.headers.get('content-length');
    if (contentLength) res.setHeader('Content-Length', contentLength);
    const contentRange = upstream.headers.get('content-range');
    if (contentRange) res.setHeader('Content-Range', contentRange);

    if (!upstream.body) {
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.end(buf);
      return;
    }

    const reader = upstream.body.getReader();
    const pump = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          res.end();
          break;
        }
        if (!res.write(Buffer.from(value))) {
          await new Promise<void>((resolve) => res.once('drain', resolve));
        }
      }
    };
    req.on('close', () => {
      try {
        void reader.cancel();
      } catch {
        /* ignore */
      }
    });
    await pump();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('Media proxy failed:', msg);
    if (!res.headersSent) {
      sendJson(res, 502, { ok: false, error: msg });
    } else {
      res.end();
    }
  }
}

type ApiConnectServer = { middlewares: { use: (fn: (req: IncomingMessage, res: ServerResponse, next: () => void) => void) => void } };

function attachR2Api(server: ApiConnectServer, rootDir: string, mode: string) {
      const env = loadEnv(mode, rootDir, '');
      if (env.R2_ENDPOINT) process.env.R2_ENDPOINT = env.R2_ENDPOINT;
      if (env.R2_ACCESS_KEY_ID) process.env.R2_ACCESS_KEY_ID = env.R2_ACCESS_KEY_ID;
      if (env.R2_SECRET_ACCESS_KEY) process.env.R2_SECRET_ACCESS_KEY = env.R2_SECRET_ACCESS_KEY;
      if (env.R2_BUCKET) process.env.R2_BUCKET = env.R2_BUCKET;
      if (env.R2_PUBLIC_BASE_URL) process.env.R2_PUBLIC_BASE_URL = env.R2_PUBLIC_BASE_URL;

      const maxUploadBytes = maxUploadBytesFromEnv(env);
      const maxUploadMb = maxUploadMbFromEnv(env);
      const upload = multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: maxUploadBytes },
      });

      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0] ?? '';

        if (url === '/api/assets/upload' && req.method === 'POST') {
          const fieldsUpload = upload.fields([
            { name: 'file', maxCount: 1 },
            { name: 'boothId', maxCount: 1 },
            { name: 'folder', maxCount: 1 },
          ]);
          fieldsUpload(req as never, res as never, async (err: unknown) => {
            if (err) {
              sendJson(res as ServerResponse, 400, {
                ok: false,
                error: formatMulterUploadError(err, maxUploadMb),
              });
              return;
            }
            if (!isR2Configured()) {
              sendJson(res as ServerResponse, 503, {
                ok: false,
                error: 'R2 not configured. Add R2_* variables to .env (see .env.example).',
              });
              return;
            }

            const files = (req as { files?: { file?: Express.Multer.File[] } }).files;
            const file = files?.file?.[0];
            if (!file?.buffer?.length) {
              sendJson(res as ServerResponse, 400, { ok: false, error: 'Missing file (field name: file)' });
              return;
            }

            const body = (req as { body?: Record<string, string> }).body ?? {};
            const boothIdField = (body.boothId ?? 'global').trim() || 'global';
            const folderField = (body.folder ?? 'assets').trim() || 'assets';

            try {
              const key = buildObjectKey(boothIdField, folderField, file.originalname || 'upload');
              const objectKey = normalizeR2ObjectKey(key);
              const publicUrl = normalizeR2PublicUrl(
                await uploadBufferToR2(
                  Buffer.from(file.buffer),
                  objectKey,
                  file.mimetype || 'application/octet-stream',
                ),
              );
              console.log(`✓ R2 upload: ${publicUrl}`);
              sendJson(res as ServerResponse, 200, {
                ok: true,
                url: publicUrl,
                key: objectKey,
                boothId: boothIdField || 'global',
                folder: folderField,
              });
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : String(e);
              console.error('R2 upload failed:', msg);
              sendJson(res as ServerResponse, 500, { ok: false, error: msg });
            }
          });
          return;
        }

        if (url === '/api/assets/status' && req.method === 'GET') {
          sendJson(res as ServerResponse, 200, { ok: true, configured: isR2Configured() });
          return;
        }

        if (url === '/api/assets/texture' && req.method === 'GET') {
          void handleTextureProxy(req, res as ServerResponse, env.R2_PUBLIC_BASE_URL ?? '');
          return;
        }

        if (url === '/api/assets/media' && req.method === 'GET') {
          void handleMediaProxy(req, res as ServerResponse, env.R2_PUBLIC_BASE_URL ?? '');
          return;
        }

        next();
      });
}

/** Dev + preview: upload booth assets (PDF, images, video) to Cloudflare R2. */
export function r2ApiPlugin(rootDir: string): Plugin {
  return {
    name: 'virtual-expo-r2-api',
    configureServer(server) {
      attachR2Api(server, rootDir, server.config.mode);
    },
    configurePreviewServer(server) {
      attachR2Api(server, rootDir, 'production');
    },
  };
}
