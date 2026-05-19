/** Upload CMS / expo assets to R2 (dev server). Falls back to data URL if R2 is unavailable. */

import { normalizeR2PublicUrl } from './r2Urls';

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(r.error);
    r.readAsDataURL(file);
  });
}

export type UploadResult = {
  url: string;
  storage: 'r2' | 'local';
};

export async function uploadAssetToR2(
  file: File,
  boothId: string,
  folder: string,
): Promise<UploadResult | null> {
  const fd = new FormData();
  fd.append('file', file, file.name);
  fd.append('boothId', boothId);
  fd.append('folder', folder);

  try {
    const res = await fetch('/api/assets/upload', { method: 'POST', body: fd });
    const data = (await res.json()) as { ok: boolean; url?: string; error?: string };
    if (!res.ok || !data.ok || !data.url) {
      console.warn('[R2] Upload failed:', data.error || res.statusText);
      return null;
    }
    return { url: normalizeR2PublicUrl(data.url), storage: 'r2' };
  } catch (e) {
    console.warn('[R2] Upload request failed:', e);
    return null;
  }
}

/** Try R2 first; use embedded data URL only when R2 is not configured or upload fails. */
export async function uploadCmsFile(file: File, boothId: string, folder: string): Promise<UploadResult> {
  const r2 = await uploadAssetToR2(file, boothId, folder);
  if (r2) return r2;
  const url = await readFileAsDataUrl(file);
  return { url, storage: 'local' };
}

export async function isR2Available(): Promise<boolean> {
  try {
    const res = await fetch('/api/assets/status');
    const data = (await res.json()) as { configured?: boolean };
    return Boolean(data.configured);
  } catch {
    return false;
  }
}
