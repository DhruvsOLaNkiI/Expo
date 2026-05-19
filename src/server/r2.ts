import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { stripBucketPrefixFromPath } from '../api/r2Urls';

type R2Config = {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBase: string;
};

function getR2Config(): R2Config | null {
  let endpoint = process.env.R2_ENDPOINT?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.R2_BUCKET?.trim();
  let publicBase = process.env.R2_PUBLIC_BASE_URL?.trim().replace(/\/$/, '');
  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket || !publicBase) {
    return null;
  }
  // Endpoint must be account root only — not .../bucket-name (causes double path + 404 on public URLs)
  if (endpoint.endsWith(`/${bucket}`)) {
    endpoint = endpoint.slice(0, -(bucket.length + 1));
  }
  // Public base must be the r2.dev (or custom) origin only — not .../bucket-name
  if (publicBase.endsWith(`/${bucket}`)) {
    publicBase = publicBase.slice(0, -(bucket.length + 1));
  }
  return { endpoint, accessKeyId, secretAccessKey, bucket, publicBase };
}

/** Normalize object key before upload — never prefix with bucket name. */
export function normalizeR2ObjectKey(key: string, bucket?: string): string {
  const b = bucket ?? process.env.R2_BUCKET?.trim() ?? '';
  return stripBucketPrefixFromPath(key.replace(/^\/+/, ''), b);
}

export function isR2Configured(): boolean {
  return getR2Config() !== null;
}

let cachedClient: S3Client | null = null;

function getClient(cfg: R2Config): S3Client {
  if (!cachedClient) {
    cachedClient = new S3Client({
      region: 'auto',
      endpoint: cfg.endpoint,
      credentials: {
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
      },
    });
  }
  return cachedClient;
}

export function sanitizeObjectKeyPart(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^\.+/, '').slice(0, 120) || 'file';
}

export function buildObjectKey(boothId: string, folder: string, filename: string): string {
  const bucket = process.env.R2_BUCKET?.trim() ?? '';
  const boothRaw = normalizeR2ObjectKey(boothId || 'global', bucket) || 'global';
  const folderRaw = normalizeR2ObjectKey(folder || 'assets', bucket) || 'assets';
  const booth = sanitizeObjectKeyPart(boothRaw.split('/').pop() || boothRaw);
  const dir = sanitizeObjectKeyPart(folderRaw.split('/').pop() || folderRaw);
  const stamp = Date.now();
  const safe = sanitizeObjectKeyPart(filename);
  return `booths/${booth}/${dir}/${stamp}_${safe}`;
}

export async function uploadBufferToR2(
  body: Buffer,
  key: string,
  contentType: string,
): Promise<string> {
  const cfg = getR2Config();
  if (!cfg) {
    throw new Error(
      'R2 is not configured. Set R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, and R2_PUBLIC_BASE_URL in .env',
    );
  }
  const objectKey = normalizeR2ObjectKey(key, cfg.bucket);
  if (!objectKey.startsWith('booths/')) {
    throw new Error(`Invalid R2 object key (must start with booths/): ${objectKey}`);
  }
  const client = getClient(cfg);
  await client.send(
    new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: objectKey,
      Body: body,
      ContentType: contentType || 'application/octet-stream',
    }),
  );
  return `${cfg.publicBase}/${objectKey}`;
}

/** Object keys to try for a public R2 URL (handles legacy uploads with bucket prefix in key). */
export function resolveR2KeysFromPublicUrl(pdfUrl: string): string[] {
  const cfg = getR2Config();
  if (!cfg) return [];
  const raw = pdfUrl.trim();
  let pathPart = '';
  try {
    const u = new URL(raw);
    const base = cfg.publicBase.replace(/\/$/, '');
    const baseUrl = new URL(base);
    if (u.origin !== baseUrl.origin) return [];
    pathPart = normalizeR2ObjectKey(decodeURIComponent(u.pathname.replace(/^\//, '')), cfg.bucket);
  } catch {
    return [];
  }
  if (!pathPart) return [];
  const keys = [pathPart];
  const bucketPrefix = `${cfg.bucket}/`;
  // Legacy: objects uploaded with bucket name accidentally in the key path
  if (!pathPart.startsWith(bucketPrefix)) {
    keys.push(`${cfg.bucket}/${pathPart}`);
  }
  return keys;
}

export async function downloadBufferFromR2(key: string): Promise<Buffer> {
  const cfg = getR2Config();
  if (!cfg) {
    throw new Error('R2 is not configured');
  }
  const client = getClient(cfg);
  const out = await client.send(new GetObjectCommand({ Bucket: cfg.bucket, Key: key }));
  const body = out.Body;
  if (!body) throw new Error(`Empty object: ${key}`);
  if (body instanceof Buffer) return body;
  const chunks: Buffer[] = [];
  for await (const chunk of body as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/** Download PDF bytes for a public R2 URL (tries multiple key shapes). */
export async function downloadPdfFromPublicUrl(pdfUrl: string): Promise<{ buffer: Buffer; key: string }> {
  const keys = resolveR2KeysFromPublicUrl(pdfUrl);
  if (!keys.length) {
    throw new Error('Could not parse R2 URL — check R2_PUBLIC_BASE_URL matches your bucket public domain');
  }
  let lastErr: Error | null = null;
  for (const key of keys) {
    try {
      const buffer = await downloadBufferFromR2(key);
      return { buffer, key };
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw new Error(
    lastErr?.message?.includes('NoSuchKey') || lastErr?.message?.includes('404')
      ? `PDF not found in R2 (tried: ${keys.join(', ')}). Re-upload the file in CMS.`
      : lastErr?.message || 'Could not download PDF from R2',
  );
}
