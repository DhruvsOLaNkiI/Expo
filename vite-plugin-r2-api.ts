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
import { buildObjectKey, isR2Configured, normalizeR2ObjectKey, uploadBufferToR2 } from './src/server/r2';

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
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
