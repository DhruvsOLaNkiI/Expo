import { normalizeR2PublicUrl } from '../api/r2Urls';
import { getR2PublicBase } from './r2Public';

const TEXTURE_PROXY_PATH = '/api/assets/texture';
/** Streaming proxy for LED / walkthrough videos (supports Range) — avoids R2 CORS blocks. */
export const MEDIA_PROXY_PATH = '/api/assets/media';

/** True when URL can load in Three.js without cross-origin taint (data, same-site, or our proxy). */
export function isWebGLSafeTextureUrl(url: string | undefined): boolean {
  const u = url?.trim() ?? '';
  if (!u) return false;
  if (u.startsWith('data:image/')) return true;
  if (u.startsWith('/') && !u.startsWith('//')) return true;
  return false;
}

export function isRemoteTextureUrl(url: string | undefined): boolean {
  const u = url?.trim() ?? '';
  return u.startsWith('http://') || u.startsWith('https://');
}

/** Hosts we allow the dev/preview texture proxy to fetch (R2 public CDN only). */
export function isAllowedR2TextureOrigin(origin: string, publicBase?: string): boolean {
  try {
    const o = new URL(origin);
    const base = (publicBase ?? getR2PublicBase()).trim();
    if (base) {
      const allowed = new URL(base);
      if (o.origin === allowed.origin) return true;
    }
    const host = o.hostname.toLowerCase();
    return host.endsWith('.r2.dev') || host.includes('r2.cloudflarestorage.com');
  } catch {
    return false;
  }
}

export function isAllowedR2TextureUrl(url: string, publicBase?: string): boolean {
  try {
    const u = new URL(url.trim());
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    return isAllowedR2TextureOrigin(u.origin, publicBase);
  } catch {
    return false;
  }
}

/**
 * Resolve a texture URL for WebGL — R2 CDN URLs are rewritten to a same-origin proxy
 * so missing R2 CORS headers do not crash the Three.js canvas.
 */
export function resolveTextureUrlForWebGL(url: string | undefined): string {
  const raw = url?.trim() ?? '';
  if (!raw) return '';
  if (isWebGLSafeTextureUrl(raw)) return raw;
  if (raw.startsWith(TEXTURE_PROXY_PATH) || raw.startsWith(MEDIA_PROXY_PATH)) return raw;

  if (isRemoteTextureUrl(raw) && isAllowedR2TextureUrl(raw)) {
    const normalized = normalizeR2PublicUrl(raw);
    return `${TEXTURE_PROXY_PATH}?url=${encodeURIComponent(normalized)}`;
  }

  return '';
}

/**
 * Resolve a video/media URL for WebGL VideoTexture.
 * Same-origin paths stay; R2 public URLs go through the streaming media proxy.
 */
export function resolveMediaUrlForWebGL(url: string | undefined): string {
  const raw = url?.trim() ?? '';
  if (!raw) return '';
  if (raw.startsWith('data:')) return raw;
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw;
  if (raw.startsWith(MEDIA_PROXY_PATH) || raw.startsWith(TEXTURE_PROXY_PATH)) return raw;

  if (isRemoteTextureUrl(raw) && isAllowedR2TextureUrl(raw)) {
    const normalized = normalizeR2PublicUrl(raw);
    return `${MEDIA_PROXY_PATH}?url=${encodeURIComponent(normalized)}`;
  }

  // Non-R2 remote URL — leave as-is (caller still sets crossOrigin).
  return raw;
}
