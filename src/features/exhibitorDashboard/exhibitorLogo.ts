/** Booth logos for exhibitor setup — local data URLs only (no R2 / remote CDN). */

/** Reject absurdly large source files before decode (not the stored size). */
export const MAX_BOOTH_LOGO_SOURCE_BYTES = 15 * 1024 * 1024;

/** Target max width for fascia logos — keeps data URLs small in booth config. */
const LOGO_MAX_WIDTH = 640;
const SETUP_IMAGE_MAX_WIDTH = 1280;
const IMAGE_JPEG_QUALITY = 0.88;

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read image file'));
    };
    img.src = url;
  });
}

async function compressImageToDataUrl(file: File, maxWidth: number): Promise<string> {
  const img = await loadImageFromFile(file);
  const scale = img.width > maxWidth ? maxWidth / img.width : 1;
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not prepare image');

  const sourceType = file.type.toLowerCase();
  const shouldPreserveAlpha =
    sourceType === 'image/png' || sourceType === 'image/webp' || sourceType === 'image/gif';

  // Only flatten to white when the source format is opaque.
  if (!shouldPreserveAlpha) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
  }
  ctx.drawImage(img, 0, 0, w, h);

  // PNG keeps transparent backgrounds intact for booth logos/posters.
  const mime = shouldPreserveAlpha ? 'image/png' : 'image/jpeg';
  const dataUrl = canvas.toDataURL(mime, IMAGE_JPEG_QUALITY);
  if (!dataUrl.startsWith('data:image/')) {
    throw new Error('Image compression failed');
  }
  return dataUrl;
}

/** Shrink logo for local storage — booth header only needs a small texture. */
export async function compressBoothLogoToDataUrl(file: File): Promise<string> {
  return compressImageToDataUrl(file, LOGO_MAX_WIDTH);
}

/** Unit layouts, floor plans, site maps — local testing without R2. */
export async function compressSetupImageToDataUrl(file: File): Promise<string> {
  return compressImageToDataUrl(file, SETUP_IMAGE_MAX_WIDTH);
}

/** True when URL is safe for Three.js textures without R2 CORS (data URL or same-site path). */
export function isLocalBoothLogoUrl(url: string | undefined): boolean {
  const u = url?.trim() ?? '';
  if (!u) return false;
  if (u.startsWith('data:image/')) return true;
  if (u.startsWith('/') && !u.startsWith('//')) return true;
  return false;
}

/** Strip legacy R2 / remote logo URLs so WebGL preview does not crash. */
export function sanitizeBoothLogoUrlForWebGL(url: string | undefined): string {
  return isLocalBoothLogoUrl(url) ? url!.trim() : '';
}

export function isRemoteBoothLogoUrl(url: string | undefined): boolean {
  const u = url?.trim() ?? '';
  if (!u) return false;
  return u.startsWith('http://') || u.startsWith('https://');
}
