import type { BoothLayoutPatch } from '@/features/shared/data/boothLayouts';

/** Booth fields stored on the server so every visitor sees the same assets. */
export const SHARED_BOOTH_DOC_KEYS = [
  'brochureUrl',
  'priceListUrl',
  'unitLayoutUrl',
  'videoUrl',
  'siteMapUrl',
  'siteMapGallery',
] as const;

export type SharedBoothDocKey = (typeof SHARED_BOOTH_DOC_KEYS)[number];

export function isSharedServerAssetUrl(url: string): boolean {
  const u = url.trim();
  return u.startsWith('https://') || u.startsWith('http://') || u.startsWith('/');
}

export function pickSharedBoothDocs(patch?: BoothLayoutPatch): Partial<BoothLayoutPatch> {
  if (!patch) return {};
  const out: Partial<BoothLayoutPatch> = {};
  for (const key of SHARED_BOOTH_DOC_KEYS) {
    if (key === 'siteMapGallery') {
      const g = patch.siteMapGallery;
      if (Array.isArray(g) && g.length > 0) out.siteMapGallery = g;
      continue;
    }
    const v = patch[key];
    if (typeof v === 'string' && v.trim() && isSharedServerAssetUrl(v)) {
      out[key] = v;
    }
  }
  return out;
}

/** Prefer server file URLs (R2/https) over browser-only data: URLs. */
export function mergeSharedBoothDocs(
  filePatch?: BoothLayoutPatch,
  browserPatch?: BoothLayoutPatch,
): Partial<BoothLayoutPatch> {
  const fromFile = pickSharedBoothDocs(filePatch);
  const fromBrowser = pickSharedBoothDocs(browserPatch);
  const out: Partial<BoothLayoutPatch> = { ...fromBrowser, ...fromFile };
  for (const key of SHARED_BOOTH_DOC_KEYS) {
    if (key === 'siteMapGallery') {
      const fg = fromFile.siteMapGallery;
      if (Array.isArray(fg) && fg.length > 0) {
        out.siteMapGallery = fg;
        continue;
      }
      const bg = fromBrowser.siteMapGallery;
      if (Array.isArray(bg) && bg.some((u) => String(u).startsWith('data:'))) {
        delete out.siteMapGallery;
      }
      continue;
    }
    const fv = fromFile[key];
    if (typeof fv === 'string' && fv.trim()) {
      out[key] = fv;
      continue;
    }
    const bv = fromBrowser[key];
    if (typeof bv === 'string' && bv.startsWith('data:')) {
      delete out[key];
    }
  }
  return out;
}

export async function patchBoothCmsOnServer(
  boothId: string,
  patch: BoothLayoutPatch,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const shared = pickSharedBoothDocs(patch);
  if (!Object.keys(shared).length) {
    return { ok: false, error: 'Nothing to save on server (use R2 https URL or /public path)' };
  }
  try {
    const res = await fetch('/api/booth-cms/patch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ boothId, patch: shared }),
    });
    const text = await res.text();
    let data: { ok?: boolean; error?: string };
    try {
      data = JSON.parse(text) as typeof data;
    } catch {
      return {
        ok: false,
        error: 'Server API unavailable — run npm run start:prod on Coolify (not static hosting)',
      };
    }
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error || `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Network error' };
  }
}
