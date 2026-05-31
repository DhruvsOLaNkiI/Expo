import type { CompanyProfile, MediaItem, PlacedImage, UnitLayoutItem } from '@/features/shared/data/boothLayouts';
import { floorPlansFromConfig } from '@/features/shared/data/boothLayouts';
import { isPdfUrl } from './pageindexAutoIndex';
import { getR2PublicBase } from '@/config/r2Public';
import { normalizeR2PublicUrl, resolvePublicAssetUrl } from './r2Urls';
import { warmPdfCache } from '@/utils/warmPdfCache';

export function normalizeCtaUrl(url: string): string {
  const raw = url.trim();
  if (!raw) return '';
  if (raw.startsWith('data:') || (raw.startsWith('/') && !raw.startsWith('//'))) return raw;
  const resolved = resolvePublicAssetUrl(raw, getR2PublicBase());
  if (resolved !== raw || !raw.startsWith('http')) return resolved;
  return normalizeR2PublicUrl(raw);
}

export function isVideoUrl(url: string): boolean {
  const u = url.trim().toLowerCase();
  return /\.(mp4|webm|ogg|mov)(\?|#|$)/i.test(u) || u.startsWith('data:video/');
}

export function isSvgUrl(url: string): boolean {
  const u = url.trim();
  return /^data:image\/svg\+xml/i.test(u) || /\.svg(\?|#|$)/i.test(u);
}

export function isRasterImageUrl(url: string): boolean {
  const u = url.trim();
  if (/^data:image\//i.test(u) && !/^data:image\/svg/i.test(u)) return true;
  return /\.(png|jpe?g|webp|gif|avif)(\?|#|$)/i.test(u);
}

export type ResolvedBoothCta = {
  brochureUrl: string;
  priceListUrl: string;
  walkthroughUrl: string;
  unitLayoutUrl: string;
  imageGalleryUrls: string[];
  siteSlides: string[];
  brochureOk: boolean;
  walkOk: boolean;
  imagesOk: boolean;
  unitOk: boolean;
  floorOk: boolean;
  siteOk: boolean;
  priceOk: boolean;
  faqUrl: string;
  faqOk: boolean;
  quoteOk: boolean;
};

export function resolveBoothCta(input: {
  brochureUrl?: string;
  priceListUrl?: string;
  unitLayoutUrl?: string;
  floorPlanUrl?: string;
  floorPlans?: UnitLayoutItem[];
  faqUrl?: string;
  customFaqQuestions?: { question: string; options: { text: string }[] }[];
  siteMapUrls?: string[];
  videoUrl?: string;
  media?: MediaItem[];
  placedImages?: PlacedImage[];
  company?: CompanyProfile;
}): ResolvedBoothCta {
  const brochureUrl = normalizeCtaUrl(input.brochureUrl ?? '');
  const priceListUrl = normalizeCtaUrl(input.priceListUrl ?? '');
  const faqUrl = normalizeCtaUrl(input.faqUrl ?? '');
  const hasCustomFaq = (input.customFaqQuestions ?? []).some(
    (q) => q.question.trim() && q.options.filter((o) => o.text.trim()).length >= 2,
  );
  const siteSlides = (input.siteMapUrls ?? []).map(normalizeCtaUrl).filter(Boolean);

  const media = input.media ?? [];
  const placedImages = input.placedImages ?? [];

  const fromMedia = media
    .filter((m) => m.type === 'image' && m.url?.trim())
    .map((m) => normalizeCtaUrl(m.url));
  const fromPlaced = placedImages.map((p) => normalizeCtaUrl(p.url)).filter(Boolean);

  const v = media.find((m) => m.type === 'video' && m.url?.trim());
  const walkthroughUrl = normalizeCtaUrl(v?.url ?? input.videoUrl ?? '');

  const layoutPdf = media.find(
    (m) =>
      m.type === 'pdf' &&
      m.url?.trim() &&
      /layout|floor|plan|unit/i.test(`${m.label} ${m.url}`),
  );
  const otherPdf = media.find(
    (m) =>
      m.type === 'pdf' &&
      m.url?.trim() &&
      normalizeCtaUrl(m.url) !== brochureUrl &&
      normalizeCtaUrl(m.url) !== priceListUrl,
  );

  let unitLayoutUrl = normalizeCtaUrl(input.unitLayoutUrl ?? '');
  if (!unitLayoutUrl && layoutPdf?.url) unitLayoutUrl = normalizeCtaUrl(layoutPdf.url);
  if (!unitLayoutUrl && otherPdf?.url) unitLayoutUrl = normalizeCtaUrl(otherPdf.url);
  if (!unitLayoutUrl) {
    const anyPdf = media.find((m) => m.type === 'pdf' && m.url?.trim());
    if (anyPdf?.url) unitLayoutUrl = normalizeCtaUrl(anyPdf.url);
  }

  const imageGalleryUrls = [
    ...new Set([
      ...fromMedia,
      ...fromPlaced,
      ...siteSlides.filter((u) => isRasterImageUrl(u) || isSvgUrl(u)),
    ]),
  ];

  if (!unitLayoutUrl && imageGalleryUrls.length > 1) {
    unitLayoutUrl = imageGalleryUrls[1];
  }

  const floorPlanEntries = floorPlansFromConfig({
    floorPlans: input.floorPlans,
    floorPlanUrl: input.floorPlanUrl,
  });

  const company = input.company;
  const email = (company?.email ?? '').trim();
  const phone = (company?.phone ?? '').trim();
  const whatsapp = (company?.whatsapp ?? '').trim();

  return {
    brochureUrl,
    priceListUrl,
    walkthroughUrl,
    unitLayoutUrl,
    imageGalleryUrls,
    siteSlides,
    brochureOk: Boolean(brochureUrl),
    walkOk: Boolean(walkthroughUrl),
    imagesOk: imageGalleryUrls.length > 0,
    unitOk: Boolean(unitLayoutUrl),
    floorOk: floorPlanEntries.length > 0,
    siteOk: siteSlides.length > 0,
    priceOk: Boolean(priceListUrl),
    faqUrl,
    faqOk: Boolean(faqUrl) || hasCustomFaq,
    quoteOk: Boolean(email) || Boolean(phone) || Boolean(whatsapp) || Boolean(brochureUrl),
  };
}

export type CtaOpenPayload = {
  title: string;
  url: string;
  variant: 'document' | 'image' | 'video';
  imageGallery?: string[];
};

export function buildCtaOpenPayload(
  title: string,
  url: string,
  imageGallery?: string[],
): CtaOpenPayload | null {
  const u = normalizeCtaUrl(url);
  if (!u) return null;
  if (isVideoUrl(u)) {
    return { title, url: u, variant: 'video' };
  }
  if (imageGallery && imageGallery.length > 0) {
    const slides = imageGallery.map(normalizeCtaUrl).filter(Boolean);
    if (slides.length === 0) return null;
    return {
      title,
      url: slides[0],
      variant: 'image',
      imageGallery: slides.length > 1 ? slides : undefined,
    };
  }
  if (isPdfUrl(u) || isRasterImageUrl(u) || isSvgUrl(u)) {
    if (isPdfUrl(u)) warmPdfCache(u);
    return {
      title,
      url: u,
      variant: isPdfUrl(u) ? 'document' : 'image',
    };
  }
  return { title, url: u, variant: 'document' };
}
