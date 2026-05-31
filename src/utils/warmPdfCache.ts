import { normalizeCtaUrl } from '@/api/boothCta';
import { preconnectR2Cdn } from '@/config/r2Public';
import { isUnopenableAssetUrl } from '@/utils/openUrl';

const warmed = new Set<string>();

/** Hint the browser to fetch a brochure PDF before the visitor taps Brochure. */
export function warmPdfCache(url: string): void {
  if (typeof document === 'undefined') return;
  const u = normalizeCtaUrl(url).trim();
  if (!u || u.startsWith('data:') || isUnopenableAssetUrl(u)) return;
  if (warmed.has(u)) return;
  warmed.add(u);
  preconnectR2Cdn();

  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.as = 'document';
  link.href = u;
  document.head.appendChild(link);
}
