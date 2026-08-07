import type { BoothLayoutConfig, BoothLayoutPatch, MediaItem } from '@/features/shared/data/boothLayouts';
import { floorPlansFromConfig, siteMapUrlsFromConfig, unitLayoutsFromConfig } from '@/features/shared/data/boothLayouts';
import { STORAGE_LIMIT_GB } from './exhibitorConfig';

export type DocCategory = 'Brochures' | 'Floor Plans' | 'Price Lists' | 'Images' | 'Videos' | 'FAQ' | 'Logo';

export type BoothDocument = {
  id: string;
  name: string;
  fileName: string;
  category: DocCategory;
  fileType: 'PDF' | 'JPG' | 'PNG' | 'MP4' | 'WEBP' | 'SVG' | 'OTHER';
  sizeLabel: string;
  url: string;
  opens: number;
  downloads: number;
  avgTime: string;
  status: 'Published';
  uploadedAt: string;
  source: 'field' | 'gallery' | 'media';
  fieldKey?: keyof BoothLayoutPatch;
  galleryIndex?: number;
  mediaId?: string;
};

export const DOC_CATEGORIES: DocCategory[] = [
  'Brochures',
  'Floor Plans',
  'Price Lists',
  'Images',
  'Videos',
  'FAQ',
  'Logo',
];

export const UPLOAD_FOLDER_BY_CATEGORY: Record<DocCategory, string> = {
  Brochures: 'brochure',
  'Floor Plans': 'floor-plan',
  'Price Lists': 'price-list',
  Images: 'site-map',
  Videos: 'walkthrough-video',
  FAQ: 'faq',
  Logo: 'logo',
};

export const PRIMARY_FIELD_BY_CATEGORY: Partial<Record<DocCategory, keyof BoothLayoutPatch>> = {
  Brochures: 'brochureUrl',
  'Floor Plans': 'floorPlanUrl',
  'Price Lists': 'priceListUrl',
  Images: 'siteMapUrl',
  Videos: 'videoUrl',
  FAQ: 'faqUrl',
  Logo: 'headerLogoUrl',
};

function hashStat(seed: string, min: number, max: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const span = max - min + 1;
  return min + (Math.abs(h) % span);
}

function fileNameFromUrl(url: string): string {
  try {
    const path = url.split('?')[0];
    const parts = path.split('/');
    const last = parts[parts.length - 1] || 'document';
    return decodeURIComponent(last);
  } catch {
    return 'document';
  }
}

function inferFileType(url: string): BoothDocument['fileType'] {
  const lower = url.toLowerCase();
  if (lower.includes('.pdf') || lower.includes('/brochure') || lower.includes('price-list')) return 'PDF';
  if (lower.includes('.mp4') || lower.includes('video')) return 'MP4';
  if (lower.includes('.webp')) return 'WEBP';
  if (lower.includes('.svg')) return 'SVG';
  if (lower.includes('.png')) return 'PNG';
  if (lower.includes('.jpg') || lower.includes('.jpeg')) return 'JPG';
  return 'OTHER';
}

function formatAvgTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

function demoStats(id: string) {
  const opens = hashStat(id, 40, 320);
  const downloads = hashStat(`${id}-dl`, 8, Math.max(9, Math.floor(opens * 0.45)));
  const avgSec = hashStat(`${id}-t`, 45, 320);
  return { opens, downloads, avgTime: formatAvgTime(avgSec) };
}

function addFieldDoc(
  list: BoothDocument[],
  url: string,
  name: string,
  category: DocCategory,
  fieldKey: keyof BoothLayoutPatch,
  id: string,
) {
  const trimmed = url.trim();
  if (!trimmed) return;
  const stats = demoStats(id);
  list.push({
    id,
    name,
    fileName: fileNameFromUrl(trimmed),
    category,
    fileType: inferFileType(trimmed),
    sizeLabel: '—',
    url: trimmed,
    ...stats,
    status: 'Published',
    uploadedAt: new Date().toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }),
    source: 'field',
    fieldKey,
  });
}

export type DocumentAnalyticsRow = {
  docUrl: string;
  opens: number;
  closes: number;
  avgDwellMs: number;
};

function normalizeDocUrl(url: string): string {
  return url.trim().split('#')[0];
}

function formatDwellMs(ms: number): string {
  if (ms <= 0) return '—';
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

export function applyDocumentAnalytics(
  docs: BoothDocument[],
  stats: DocumentAnalyticsRow[],
): BoothDocument[] {
  const byUrl = new Map(stats.map((s) => [normalizeDocUrl(s.docUrl), s]));
  return docs.map((doc) => {
    const row = byUrl.get(normalizeDocUrl(doc.url));
    if (!row) return doc;
    return {
      ...doc,
      opens: row.opens,
      downloads: row.closes,
      avgTime: formatDwellMs(row.avgDwellMs),
    };
  });
}

export function buildBoothDocumentInventory(booth: BoothLayoutConfig): BoothDocument[] {
  const docs: BoothDocument[] = [];

  addFieldDoc(docs, booth.brochureUrl, 'Project Brochure', 'Brochures', 'brochureUrl', `${booth.id}-brochure`);
  addFieldDoc(docs, booth.priceListUrl, 'Price List', 'Price Lists', 'priceListUrl', `${booth.id}-price`);
  for (const layout of unitLayoutsFromConfig(booth)) {
    addFieldDoc(
      docs,
      layout.imageUrl,
      layout.name.trim() || 'Unit layout',
      'Floor Plans',
      'unitLayoutUrl',
      `${booth.id}-unit-layout-${layout.id}`,
    );
  }
  for (const plan of floorPlansFromConfig(booth)) {
    addFieldDoc(
      docs,
      plan.imageUrl,
      plan.name.trim() || 'Floor plan',
      'Floor Plans',
      'floorPlanUrl',
      `${booth.id}-floor-plan-${plan.id}`,
    );
  }

  if (booth.headerLogoUrl?.trim()) {
    addFieldDoc(docs, booth.headerLogoUrl, 'Booth logo', 'Logo', 'headerLogoUrl', `${booth.id}-logo`);
  }

  if (booth.faqUrl?.trim()) {
    addFieldDoc(docs, booth.faqUrl, 'FAQ', 'FAQ', 'faqUrl', `${booth.id}-faq`);
  }

  const siteMaps = siteMapUrlsFromConfig(booth);
  siteMaps.forEach((url, i) => {
    addFieldDoc(
      docs,
      url,
      i === 0 ? 'Site Map' : `Site Map ${i + 1}`,
      'Images',
      i === 0 ? 'siteMapUrl' : 'siteMapUrl',
      `${booth.id}-sitemap-${i}`,
    );
    if (i > 0) {
      const last = docs[docs.length - 1];
      last.source = 'gallery';
      last.galleryIndex = i;
      last.fieldKey = 'siteMapGallery';
    }
  });

  if (booth.stageScreenUrl?.trim()) {
    addFieldDoc(docs, booth.stageScreenUrl, 'LED TV Screen', 'Videos', 'stageScreenUrl', `${booth.id}-stage`);
  }
  if (booth.videoUrl?.trim()) {
    addFieldDoc(docs, booth.videoUrl, 'Walkthrough Video', 'Videos', 'videoUrl', `${booth.id}-video`);
  }
  if (booth.signageImageUrl?.trim()) {
    addFieldDoc(docs, booth.signageImageUrl, 'Signage', 'Images', 'signageImageUrl', `${booth.id}-signage`);
  }

  for (const item of booth.media ?? []) {
    if (!item.url?.trim()) continue;
    const category: DocCategory =
      item.type === 'video' ? 'Videos' : item.type === 'pdf' ? 'Brochures' : item.type === 'image' ? 'Images' : 'Brochures';
    const stats = demoStats(item.id);
    docs.push({
      id: item.id,
      name: item.label || fileNameFromUrl(item.url),
      fileName: fileNameFromUrl(item.url),
      category,
      fileType: item.type === 'pdf' ? 'PDF' : item.type === 'video' ? 'MP4' : inferFileType(item.url),
      sizeLabel: '—',
      url: item.url,
      ...stats,
      status: 'Published',
      uploadedAt: new Date().toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }),
      source: 'media',
      mediaId: item.id,
    });
  }

  return docs;
}

export function categoryCounts(docs: BoothDocument[]): Record<DocCategory, number> {
  const counts: Record<DocCategory, number> = {
    Brochures: 0,
    'Floor Plans': 0,
    'Price Lists': 0,
    Images: 0,
    Videos: 0,
    FAQ: 0,
    Logo: 0,
  };
  for (const d of docs) counts[d.category] += 1;
  return counts;
}

export function formatStorageUsedGb(docs: BoothDocument[]): number {
  const base = docs.length * 0.08;
  return Math.min(STORAGE_LIMIT_GB - 0.01, Math.round((base + 0.45) * 100) / 100);
}

export function inferMediaItemType(file: File): MediaItem['type'] {
  if (file.type.startsWith('video/')) return 'video';
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) return 'pdf';
  if (file.type.startsWith('image/')) return 'image';
  return 'pdf';
}

export function newMediaItem(file: File, url: string, category: DocCategory): MediaItem {
  return {
    id: `exb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: inferMediaItemType(file),
    url,
    label: file.name.replace(/\.[^.]+$/, '') || category,
  };
}
