/** Default bucket name — must match R2_BUCKET in .env when using Cloudflare R2. */
export const R2_BUCKET_NAME = 'virtual-expo-pdfs';

/**
 * Remove a leading `{bucket}/` segment from an object key or URL path.
 * Keys must be `booths/...`, never `virtual-expo-pdfs/booths/...`.
 */
export function stripBucketPrefixFromPath(path: string, bucket = R2_BUCKET_NAME): string {
  let p = path.replace(/^\/+/, '').replace(/\\/g, '/');
  const b = bucket.trim();
  if (!b) return p;
  while (p.startsWith(`${b}/`)) p = p.slice(b.length + 1);
  if (p === b) return '';
  return p;
}

/** Normalize a public R2 asset URL (strip erroneous bucket segment from the path). */
export function normalizeR2PublicUrl(url: string, bucket = R2_BUCKET_NAME): string {
  const raw = url.trim();
  if (!raw) return raw;
  try {
    const u = new URL(raw);
    const path = stripBucketPrefixFromPath(u.pathname, bucket);
    u.pathname = path ? `/${path}` : '/';
    return u.toString();
  } catch {
    return raw;
  }
}

/** Build `${publicBase}/${objectKey}` — objectKey must not include the bucket name. */
export function buildPublicR2Url(publicBase: string, objectKey: string, bucket = R2_BUCKET_NAME): string {
  const base = publicBase.trim().replace(/\/$/, '');
  let key = stripBucketPrefixFromPath(objectKey, bucket);
  if (bucket && base.endsWith(`/${bucket}`)) {
    const suffix = `/${bucket}`;
    return `${base.slice(0, -suffix.length)}/${key}`;
  }
  return `${base}/${key}`;
}
