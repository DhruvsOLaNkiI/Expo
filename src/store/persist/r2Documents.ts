import type { BoothLayoutPatch } from '@/features/shared/data/boothLayouts';
import { buildPublicR2Url, isRelativeR2ObjectKey, normalizeR2PublicUrl, resolvePublicAssetUrl } from '@/api/r2Urls';
import { setR2PublicBase } from '@/config/r2Public';

const DOC_URL_FIELDS = ['brochureUrl', 'priceListUrl', 'unitLayoutUrl', 'siteMapUrl', 'videoUrl'] as const;

export type R2DocumentsManifest = {
  publicBase?: string;
  documents?: Record<string, Partial<Record<(typeof DOC_URL_FIELDS)[number], string>>>;
};

function resolvePatchDocumentUrls(patch: BoothLayoutPatch, publicBase: string): BoothLayoutPatch {
  if (!publicBase) return patch;
  const out: BoothLayoutPatch = { ...patch };
  for (const field of DOC_URL_FIELDS) {
    const value = out[field];
    if (typeof value === 'string' && value.trim()) {
      const resolved = resolvePublicAssetUrl(value, publicBase);
      out[field] = isRelativeR2ObjectKey(value) && resolved === value ? '' : resolved;
    }
  }
  const gallery = out.siteMapGallery;
  if (Array.isArray(gallery) && gallery.length > 0) {
    out.siteMapGallery = gallery.map((u) => resolvePublicAssetUrl(String(u), publicBase)).filter(Boolean);
  }
  return out;
}

function documentEntryToPatch(
  entry: Partial<Record<(typeof DOC_URL_FIELDS)[number], string>>,
  publicBase: string,
): BoothLayoutPatch {
  const patch: BoothLayoutPatch = {};
  for (const field of DOC_URL_FIELDS) {
    const raw = entry[field]?.trim();
    if (!raw || /REPLACE-WITH/i.test(raw)) continue;
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      patch[field] = normalizeR2PublicUrl(raw);
    } else if (isRelativeR2ObjectKey(raw)) {
      if (!publicBase) continue;
      patch[field] = buildPublicR2Url(publicBase, raw.replace(/^r2:/, ''));
    } else {
      patch[field] = raw;
    }
  }
  return patch;
}

/** Load R2 document paths + public base; merge into booth overrides (lowest priority). */
export async function loadR2DocumentDefaults(): Promise<{
  publicBase: string;
  defaults: Record<string, BoothLayoutPatch>;
}> {
  let publicBase = '';
  let defaults: Record<string, BoothLayoutPatch> = {};

  try {
    const res = await fetch('/r2-documents.json', { cache: 'no-store' });
    if (!res.ok) return { publicBase, defaults };
    const j = (await res.json()) as R2DocumentsManifest;
    publicBase = String(j.publicBase ?? '').trim().replace(/\/$/, '');
    if (j.documents && typeof j.documents === 'object') {
      for (const [boothId, entry] of Object.entries(j.documents)) {
        if (!entry || typeof entry !== 'object') continue;
        const patch = documentEntryToPatch(entry, publicBase);
        if (Object.keys(patch).length > 0) defaults[boothId] = patch;
      }
    }
  } catch {
  }

  if (publicBase) setR2PublicBase(publicBase);
  return { publicBase, defaults };
}

export function applyR2PublicBaseFromCmsFile(r2PublicBase: unknown): string {
  const base = String(r2PublicBase ?? '').trim().replace(/\/$/, '');
  if (base) setR2PublicBase(base);
  return base;
}

export function resolveBoothOverridesForR2(
  overrides: Record<string, BoothLayoutPatch>,
  publicBase: string,
): Record<string, BoothLayoutPatch> {
  if (!publicBase) return overrides;
  const out: Record<string, BoothLayoutPatch> = {};
  for (const [id, patch] of Object.entries(overrides)) {
    out[id] = resolvePatchDocumentUrls(patch, publicBase);
  }
  return out;
}
