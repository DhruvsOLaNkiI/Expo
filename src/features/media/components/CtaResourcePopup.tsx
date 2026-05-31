import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { isPdfUrl } from '@/api/pageindexAutoIndex';
import { normalizeCtaUrl } from '@/api/boothCta';
import { CustomFaqVisitorPopup } from '@/features/exhibitorDashboard/CustomFaqVisitorPopup';
import type { CtaResourcePopup } from '@/store';
import { isUnopenableAssetUrl, openUrlInNewTab } from '@/utils/openUrl';

function isSvgSiteMapUrl(url: string): boolean {
  const u = url.trim();
  if (/^data:image\/svg\+xml/i.test(u)) return true;
  return /\.svg(\?|#|$)/i.test(u);
}

const DEFAULT_OVERLAY =
  'fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm pointer-events-auto';

function overlayZIndexClass(overlayClassName: string | undefined): string {
  const m = overlayClassName?.match(/\bz-\[[^\]]+\]|\bz-\d+/);
  return m ? m[0] : 'z-[60]';
}

/** Very long data URLs can fail as an <img> src in some browsers — use a short blob: URL instead. */
function useDisplayImageSrc(url: string, isRasterImage: boolean): string {
  const [src, setSrc] = useState(url);
  const blobRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (!isRasterImage) {
      setSrc(url);
      return;
    }
    const u = url.trim();
    const longData = /^data:image\//i.test(u) && u.length > 120_000;
    if (!longData) {
      if (blobRef.current) {
        URL.revokeObjectURL(blobRef.current);
        blobRef.current = null;
      }
      setSrc(u);
      return;
    }

    let cancelled = false;
    fetch(u)
      .then((r) => r.blob())
      .then((blob) => {
        if (cancelled) return;
        if (blobRef.current) URL.revokeObjectURL(blobRef.current);
        const next = URL.createObjectURL(blob);
        blobRef.current = next;
        setSrc(next);
      })
      .catch(() => {
        if (!cancelled) setSrc(u);
      });

    return () => {
      cancelled = true;
    };
  }, [url, isRasterImage]);

  useEffect(
    () => () => {
      if (blobRef.current) {
        URL.revokeObjectURL(blobRef.current);
        blobRef.current = null;
      }
    },
    [],
  );

  return src;
}

function pdfEmbedSrc(url: string): string {
  const u = normalizeCtaUrl(url);
  if (!u) return u;
  if (u.includes('#')) return u;
  return `${u}#toolbar=1&navpanes=0&view=FitH`;
}

/** Instant viewer URL — streams from R2/CDN; never wait for a full download in JS. */
function pdfViewerSrc(url: string): string {
  const u = normalizeCtaUrl(url).trim();
  if (!u || u.startsWith('data:')) return '';
  return pdfEmbedSrc(u);
}

/** data:application/pdf → blob: so Safari can render inside the viewer. */
async function pdfDataUrlToBlobUrl(dataUrl: string): Promise<string> {
  const comma = dataUrl.indexOf(',');
  if (comma < 0) throw new Error('invalid data url');
  const payload = dataUrl.slice(comma + 1);
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
}

/** Sites like w3.org block iframe embeds — open those in a new tab instead. */
function canEmbedPdfInIframe(url: string): boolean {
  const u = normalizeCtaUrl(url).trim();
  if (!u || u.startsWith('data:')) return true;
  try {
    const parsed = new URL(u, typeof window !== 'undefined' ? window.location.origin : 'https://expo.digitalbroker.in');
    if (typeof window !== 'undefined' && parsed.origin === window.location.origin) return true;
    const host = parsed.hostname.toLowerCase();
    if (host === 'www.w3.org' || host === 'w3.org') return false;
    if (host.endsWith('.r2.dev') || host.includes('r2.cloudflarestorage.com')) return true;
    if (typeof window !== 'undefined' && parsed.origin !== window.location.origin) return false;
    return true;
  } catch {
    return false;
  }
}

function EmbeddedVideoPanel({
  title,
  url,
  onClose,
  overlayClassName,
}: {
  title: string;
  url: string;
  onClose: () => void;
  overlayClassName?: string;
}) {
  const src = useMemo(() => normalizeCtaUrl(url), [url]);
  const overlay = overlayClassName?.trim() || DEFAULT_OVERLAY;
  const openTab = () => {
    if (!openUrlInNewTab(src)) {
      window.alert('This file URL is not valid yet. Upload to Cloudflare R2 and set the URL in public/r2-documents.json, then redeploy.');
    }
  };

  return (
    <div role="presentation" className={overlay} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cta-video-title"
        className="flex h-[min(92dvh,900px)] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-[#d4af37]/40 bg-[#0a0a10]/98 text-[#fffef8] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3 md:px-5">
          <h2 id="cta-video-title" className="text-sm font-bold uppercase tracking-[0.18em] text-[#d4af37] md:text-base">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/80 hover:bg-white/20 hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="relative min-h-0 flex-1 bg-black">
          <video
            key={src}
            src={src}
            className="absolute inset-0 h-full w-full object-contain"
            controls
            playsInline
            autoPlay
            title={title}
          />
        </div>
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-white/10 px-4 py-2.5 md:px-5">
          <button type="button" onClick={openTab} className="text-[10px] font-semibold uppercase tracking-wider text-white/50 hover:text-white/80">
            Open in new tab
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-white/90 hover:bg-white/10"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function EmbeddedPdfPanel({
  title,
  url,
  onClose,
  overlayClassName,
}: {
  title: string;
  url: string;
  onClose: () => void;
  overlayClassName?: string;
}) {
  const resolvedUrl = useMemo(() => normalizeCtaUrl(url), [url]);
  const embedAllowed = useMemo(
    () => canEmbedPdfInIframe(url) && !isUnopenableAssetUrl(resolvedUrl),
    [url, resolvedUrl],
  );
  const [loadFailed, setLoadFailed] = useState(!embedAllowed);
  const [dataBlobSrc, setDataBlobSrc] = useState('');
  const blobRef = useRef<string | null>(null);
  const isDataPdf = resolvedUrl.startsWith('data:application/pdf');
  const streamSrc = useMemo(
    () => (embedAllowed && !isDataPdf ? pdfViewerSrc(resolvedUrl) : ''),
    [embedAllowed, isDataPdf, resolvedUrl],
  );
  const viewerSrc = isDataPdf ? dataBlobSrc : streamSrc;

  useLayoutEffect(() => {
    const resolved = normalizeCtaUrl(url);
    setLoadFailed(!canEmbedPdfInIframe(url) || isUnopenableAssetUrl(resolved));
    setDataBlobSrc('');
  }, [url]);

  useEffect(() => {
    if (!embedAllowed || !isDataPdf) return;

    let cancelled = false;
    void pdfDataUrlToBlobUrl(resolvedUrl)
      .then((blobUrl) => {
        if (cancelled) {
          URL.revokeObjectURL(blobUrl);
          return;
        }
        if (blobRef.current) URL.revokeObjectURL(blobRef.current);
        blobRef.current = blobUrl;
        setDataBlobSrc(blobUrl);
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });

    return () => {
      cancelled = true;
      if (blobRef.current) {
        URL.revokeObjectURL(blobRef.current);
        blobRef.current = null;
      }
    };
  }, [embedAllowed, isDataPdf, resolvedUrl]);

  const overlay = overlayClassName?.trim() || DEFAULT_OVERLAY;
  const openTab = () => {
    const target = normalizeCtaUrl(url);
    if (!openUrlInNewTab(target)) {
      window.alert(
        'Brochure URL is not configured for production.\n\nUpload the PDF in Cloudflare R2, add the path to public/r2-documents.json, and redeploy.',
      );
    }
  };

  return (
    <div role="presentation" className={overlay} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cta-pdf-title"
        className="flex h-[min(92dvh,900px)] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-[#d4af37]/40 bg-[#0a0a10]/98 text-[#fffef8] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3 md:px-5">
          <h2 id="cta-pdf-title" className="text-sm font-bold uppercase tracking-[0.18em] text-[#d4af37] md:text-base">
            {title}
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openTab}
              className="hidden rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/80 hover:bg-white/10 sm:inline-block"
            >
              New tab
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/80 hover:bg-white/20 hover:text-white"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="relative min-h-0 flex-1 bg-[#1a1a22]">
          {!loadFailed && viewerSrc ? (
            <iframe
              key={viewerSrc}
              title={title}
              src={viewerSrc}
              className="absolute inset-0 h-full w-full border-0 bg-white"
              onError={() => setLoadFailed(true)}
            />
          ) : loadFailed ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
              <p className="text-sm text-amber-200/90">
                {isUnopenableAssetUrl(resolvedUrl)
                  ? 'Brochure PDF is not linked yet. Set public/r2-documents.json (or upload via CMS when Node + R2 are running on Coolify).'
                  : embedAllowed
                    ? 'This PDF could not be embedded here. Open it in a new tab instead.'
                    : 'This PDF must open in a new browser tab (the host blocks embedded previews).'}
              </p>
              <button
                type="button"
                className="rounded-lg bg-[#d4af37] px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-black hover:bg-[#c9a43a]"
                onClick={openTab}
              >
                Open PDF
              </button>
            </div>
          ) : isDataPdf ? (
            <div className="flex h-full items-center justify-center p-6">
              <p className="text-sm text-white/60">Preparing brochure…</p>
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-white/10 px-4 py-2.5 md:px-5">
          <p className="truncate text-[10px] text-white/40">Scroll inside the viewer · Close to keep exploring</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-white/90 hover:bg-white/10"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export function CtaResourcePopupView({
  popup,
  onClose,
  overlayClassName,
}: {
  popup: CtaResourcePopup;
  onClose: () => void;
  overlayClassName?: string;
}) {
  const variant = popup.variant ?? 'document';
  const docUrl = normalizeCtaUrl(popup.url);

  if (variant === 'customFaq') {
    return (
      <CustomFaqVisitorPopup
        title={popup.title}
        questions={popup.customFaqQuestions ?? []}
        boothId={popup.boothId}
        faqPdfUrl={docUrl || undefined}
        onClose={onClose}
        overlayClassName={overlayClassName}
      />
    );
  }

  const showEmbeddedVideo = variant === 'video' && Boolean(docUrl);
  const showEmbeddedPdf = variant === 'document' && docUrl && isPdfUrl(docUrl);

  if (showEmbeddedVideo) {
    return (
      <EmbeddedVideoPanel
        title={popup.title}
        url={docUrl}
        onClose={onClose}
        overlayClassName={overlayClassName}
      />
    );
  }

  if (showEmbeddedPdf) {
    return (
      <EmbeddedPdfPanel
        title={popup.title}
        url={docUrl}
        onClose={onClose}
        overlayClassName={overlayClassName}
      />
    );
  }

  return (
    <CtaResourcePopupContent
      popup={popup}
      onClose={onClose}
      overlayClassName={overlayClassName}
    />
  );
}

function CtaResourcePopupContent({
  popup,
  onClose,
  overlayClassName,
}: {
  popup: CtaResourcePopup;
  onClose: () => void;
  overlayClassName?: string;
}) {
  const variant = popup.variant ?? 'document';
  const [imageError, setImageError] = useState(false);

  const imageUrls = useMemo(() => {
    const g = popup.imageGallery?.map((u) => u.trim()).filter(Boolean) ?? [];
    if (g.length > 0) return g;
    const u = popup.url.trim();
    return u ? [u] : [];
  }, [popup.imageGallery, popup.url]);

  const [slideIdx, setSlideIdx] = useState(0);
  const currentUrl = imageUrls[slideIdx] ?? '';

  useLayoutEffect(() => {
    setSlideIdx(0);
    setImageError(false);
  }, [popup.title, popup.url, popup.imageGallery]);

  useLayoutEffect(() => {
    setImageError(false);
  }, [currentUrl]);

  const openTab = () => {
    const target = currentUrl || popup.url;
    if (!openUrlInNewTab(normalizeCtaUrl(target))) {
      window.alert('This resource URL is not valid or is too large to open in a new tab.');
    }
  };

  const isImage = variant === 'image';
  const showSvg = isImage && isSvgSiteMapUrl(currentUrl);
  const remoteHttp = /^https?:\/\//i.test(currentUrl.trim());
  const displaySrc = useDisplayImageSrc(currentUrl, isImage && !showSvg);

  const overlay = overlayClassName?.trim() || DEFAULT_OVERLAY;
  const zForLightbox = overlayZIndexClass(overlayClassName);

  const goPrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (imageUrls.length < 2) return;
    setSlideIdx((i) => (i - 1 + imageUrls.length) % imageUrls.length);
  };
  const goNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (imageUrls.length < 2) return;
    setSlideIdx((i) => (i + 1) % imageUrls.length);
  };

  useEffect(() => {
    if (!isImage || imageUrls.length < 2) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setSlideIdx((i) => (i - 1 + imageUrls.length) % imageUrls.length);
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setSlideIdx((i) => (i + 1) % imageUrls.length);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isImage, imageUrls.length]);

  if (isImage && !imageError && imageUrls.length > 0) {
    return (
      <div
        role="presentation"
        className={`fixed inset-0 flex flex-col bg-black/94 p-0 pointer-events-auto backdrop-blur-[2px] ${zForLightbox}`}
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={popup.title}
          className="relative flex h-[100dvh] max-h-[100dvh] w-full flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-lg text-white/90 ring-1 ring-white/15 transition-colors hover:bg-black/75 hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>

          {imageUrls.length > 1 && (
            <>
              <button
                type="button"
                onClick={goPrev}
                className="absolute left-2 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-2xl text-white/95 ring-1 ring-white/20 transition-colors hover:bg-black/70 md:left-4 md:h-14 md:w-14"
                aria-label="Previous image"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={goNext}
                className="absolute right-14 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-2xl text-white/95 ring-1 ring-white/20 transition-colors hover:bg-black/70 md:right-16 md:h-14 md:w-14"
                aria-label="Next image"
              >
                ›
              </button>
              <div className="pointer-events-none absolute bottom-5 left-1/2 z-20 -translate-x-1/2 rounded-full bg-black/65 px-3 py-1.5 text-[11px] font-medium tabular-nums text-white/90 ring-1 ring-white/15">
                {slideIdx + 1} / {imageUrls.length}
              </div>
            </>
          )}

          <div className="flex min-h-0 flex-1 items-center justify-center px-2 pb-8 pt-14 sm:px-6 sm:pb-10 sm:pt-16">
            {showSvg ? (
              <img
                key={currentUrl}
                src={currentUrl}
                alt={popup.title}
                className="max-h-full max-w-full select-none object-contain"
                draggable={false}
                decoding="async"
                onError={() => setImageError(true)}
              />
            ) : (
              <img
                key={displaySrc}
                src={displaySrc}
                alt={`${popup.title} ${slideIdx + 1}`}
                className="max-h-full max-w-full object-contain select-none"
                draggable={false}
                decoding="async"
                referrerPolicy={remoteHttp ? 'no-referrer' : undefined}
                onError={() => setImageError(true)}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div role="presentation" className={overlay} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cta-popup-title"
        className={`w-full rounded-xl border border-[#d4af37]/40 bg-[#0a0a10]/95 p-6 text-[#fffef8] shadow-2xl ${isImage ? 'max-w-4xl' : 'max-w-lg'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3 border-b border-white/10 pb-4">
          <h2 id="cta-popup-title" className="text-lg font-bold uppercase tracking-[0.18em] text-[#d4af37]">
            {popup.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {isImage && imageError ? (
          <>
            <p className="mb-4 text-sm text-amber-200/90">
              This URL could not be shown as an image. Use &quot;Open in new tab&quot;, or set Site Map URL in CMS to a PNG, JPG, WebP, or SVG.
            </p>
            <p className="mb-6 max-h-32 overflow-auto break-all rounded-lg bg-black/40 px-3 py-2 font-mono text-xs text-[#f5d060]">
              {(currentUrl || popup.url).length > 400 ? `${(currentUrl || popup.url).slice(0, 400)}…` : (currentUrl || popup.url)}
            </p>
          </>
        ) : (
          <>
            <p className="mb-4 text-sm text-white/70">
              Open the resource below, or close this panel to keep exploring the hall.
            </p>
            <p className="mb-6 max-h-32 overflow-auto break-all rounded-lg bg-black/40 px-3 py-2 font-mono text-xs text-[#f5d060]">
              {popup.url.length > 400 ? `${popup.url.slice(0, 400)}…` : popup.url}
            </p>
          </>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="min-h-[44px] flex-1 rounded-lg bg-[#d4af37] px-4 py-3 text-xs font-bold uppercase tracking-wider text-black transition-colors hover:bg-[#c9a43a]"
            onClick={openTab}
          >
            Open in new tab
          </button>
          <button
            type="button"
            className="min-h-[44px] flex-1 rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-white/90 transition-colors hover:bg-white/10"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
