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

const R2_SCHEME = 'r2:';

/** True when value is a relative R2 object key (not http, data, or site path). */
export function isRelativeR2ObjectKey(value: string): boolean {
  const raw = value.trim();
  if (!raw || raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('data:')) {
    return false;
  }
  if (raw.startsWith('/')) return false;
  if (raw.startsWith(R2_SCHEME)) return true;
  return raw.startsWith('booths/') || raw.startsWith(`${R2_BUCKET_NAME}/`);
}

/**
 * Resolve CMS asset URLs for production:
 * - `https://…` → normalized public R2 URL
 * - `r2:booths/…` or `booths/…` → `${publicBase}/booths/…`
 * - `/maps/…` and `data:…` → unchanged
 */
export function resolvePublicAssetUrl(url: string, publicBase?: string): string {
  const raw = url.trim();
  if (!raw) return '';
  if (raw.startsWith('data:') || (raw.startsWith('/') && !raw.startsWith('//'))) return raw;
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    return normalizeR2PublicUrl(raw);
  }

  const base = (publicBase ?? '').trim().replace(/\/$/, '');
  let key = raw.startsWith(R2_SCHEME) ? raw.slice(R2_SCHEME.length) : raw;
  key = stripBucketPrefixFromPath(key.replace(/^\/+/, ''));
  if (!key) return raw;
  if (!base) return raw;
  return buildPublicR2Url(base, key);
}
