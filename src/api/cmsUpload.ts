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


export { readFileAsDataUrl };

export type UploadResult = {
  url: string;
  storage: 'r2' | 'local';
};

export class CmsUploadError extends Error {
  constructor(
    message: string,
    readonly code: 'api_offline' | 'r2_not_configured' | 'upload_failed' | 'pdf_too_large',
  ) {
    super(message);
    this.name = 'CmsUploadError';
  }
}

const PRODUCTION_UPLOAD_HINT =
  'CMS upload needs the Node server on Coolify (Start: npm run start:prod, not static-only). Set all R2_* env vars with Runtime ON, then redeploy. Until then, upload PDFs in Cloudflare R2 and edit public/r2-documents.json.';

async function parseUploadResponse(res: Response): Promise<{ ok: boolean; url?: string; error?: string }> {
  const text = await res.text();
  try {
    return JSON.parse(text) as { ok: boolean; url?: string; error?: string };
  } catch {
    const isHtml = /^\s*</.test(text) || text.includes('<!DOCTYPE');
    if (res.status === 405 || isHtml) {
      throw new CmsUploadError(PRODUCTION_UPLOAD_HINT, 'api_offline');
    }
    throw new CmsUploadError(`Upload server returned invalid JSON (HTTP ${res.status}).`, 'upload_failed');
  }
}

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
    const data = await parseUploadResponse(res);
    if (!res.ok || !data.ok || !data.url) {
      if (res.status === 503 && data.error?.includes('R2 not configured')) {
        throw new CmsUploadError(
          'R2 is not configured on the server. Add R2_* env vars in Coolify (Runtime ON) and redeploy.',
          'r2_not_configured',
        );
      }
      console.warn('[R2] Upload failed:', data.error || res.statusText);
      return null;
    }
    return { url: normalizeR2PublicUrl(data.url), storage: 'r2' };
  } catch (e) {
    if (e instanceof CmsUploadError) throw e;
    console.warn('[R2] Upload request failed:', e);
    throw new CmsUploadError(PRODUCTION_UPLOAD_HINT, 'api_offline');
  }
}

/** Try R2 first; use embedded data URL only when R2 is not configured or upload fails (dev/small files). */
export async function uploadCmsFile(file: File, boothId: string, folder: string): Promise<UploadResult> {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);

  try {
    const r2 = await uploadAssetToR2(file, boothId, folder);
    if (r2) return r2;
  } catch (e) {
    if (e instanceof CmsUploadError) {
      if (isPdf) throw e;
    } else {
      throw e;
    }
  }

  if (isPdf && import.meta.env.PROD) {
    throw new CmsUploadError(
      `${PRODUCTION_UPLOAD_HINT} PDFs cannot be stored in the browser on production (causes about:blank#blocked).`,
      'pdf_too_large',
    );
  }

  if (isPdf && file.size > 4 * 1024 * 1024) {
    throw new CmsUploadError(
      'PDF is too large to store in the browser. Run npm run dev locally with R2_* in .env, or upload to Cloudflare R2 manually.',
      'pdf_too_large',
    );
  }

  const url = await readFileAsDataUrl(file);
  return { url, storage: 'local' };
}

export async function isR2Available(): Promise<boolean> {
  try {
    const res = await fetch('/api/assets/status');
    const text = await res.text();
    if (/^\s*</.test(text)) return false;
    const data = JSON.parse(text) as { configured?: boolean };
    return Boolean(data.configured);
  } catch {
    return false;
  }
}
