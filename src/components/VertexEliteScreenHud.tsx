import { useCallback, useEffect, useMemo, type CSSProperties, type ReactNode } from 'react';
import { useStore, type VertexEliteHudContext } from '../store';

function unlockPointer() {
  if (typeof document !== 'undefined' && document.pointerLockElement) {
    document.exitPointerLock();
  }
}

function GlassCircleButton({
  label,
  enabled,
  onClick,
  glow,
}: {
  label: string;
  enabled: boolean;
  onClick: () => void;
  glow: string;
}) {
  return (
    <button
      type="button"
      disabled={!enabled}
      onClick={(e) => {
        e.stopPropagation();
        if (!enabled) return;
        onClick();
      }}
      className="group relative flex h-14 w-14 shrink-0 select-none items-center justify-center rounded-full border-2 border-white/10 bg-gradient-to-b from-[#1f1810]/95 to-[#06060c]/98 text-[9px] font-bold uppercase leading-tight tracking-wider text-[#fffef8] shadow-[0_0_22px_rgba(212,175,55,0.25)] transition-all duration-200 ease-out hover:scale-110 hover:border-[#f5d060]/80 hover:shadow-[0_0_32px_rgba(245,208,96,0.45)] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:scale-100"
      style={
        {
          borderColor: enabled ? `${glow}88` : '#333',
          ['--glow' as string]: glow,
        } as CSSProperties
      }
    >
      <span className="pointer-events-none z-10 whitespace-pre-line drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">{label}</span>
      {enabled && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full opacity-35"
          style={{
            background: `radial-gradient(circle, ${glow}66 0%, transparent 72%)`,
            animation: 'vertex-screen-hud-pulse 2.8s ease-in-out infinite',
          }}
        />
      )}
      <style>{`
        @keyframes vertex-screen-hud-pulse {
          0%, 100% { opacity: 0.2; transform: scale(0.94); }
          50% { opacity: 0.5; transform: scale(1.06); }
        }
      `}</style>
    </button>
  );
}

function SidePanel({
  side,
  alpha,
  glow,
  children,
}: {
  side: 'left' | 'right';
  alpha: number;
  glow: string;
  children: ReactNode;
}) {
  const base =
    side === 'left'
      ? 'left-3 md:left-8 pl-[max(0.75rem,env(safe-area-inset-left))]'
      : 'right-3 md:right-8 pr-[max(0.75rem,env(safe-area-inset-right))]';
  return (
    <div
      className={`pointer-events-none fixed top-1/2 z-[48] flex -translate-y-1/2 flex-col items-center gap-3 ${base}`}
      style={{
        opacity: alpha,
        pointerEvents: alpha > 0.08 ? 'auto' : 'none',
      }}
    >
      <div
        className="flex flex-col items-center gap-3 rounded-3xl border px-3 py-5 shadow-2xl backdrop-blur-xl"
        style={{
          borderColor: `color-mix(in srgb, ${glow} 35%, transparent)`,
          background: 'linear-gradient(165deg, rgba(10,10,18,0.78) 0%, rgba(4,4,10,0.88) 100%)',
          boxShadow: `0 0 40px rgba(0,0,0,0.5), 0 0 28px ${glow}22, inset 0 1px 0 rgba(255,255,255,0.07)`,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function useDerived(ctx: VertexEliteHudContext | null) {
  return useMemo(() => {
    if (!ctx) return null;
    const fromMedia = ctx.media.filter((m) => m.type === 'image' && m.url?.trim()).map((m) => m.url.trim());
    const fromPlaced = ctx.placedImages.map((p) => p.url.trim()).filter(Boolean);
    const imageGalleryUrls = [...new Set([...fromMedia, ...fromPlaced])];
    const v = ctx.media.find((m) => m.type === 'video' && m.url?.trim());
    const walkthroughUrl = (v?.url ?? ctx.videoUrl ?? '').trim();
    const pdf = ctx.media.find(
      (m) =>
        m.type === 'pdf' &&
        m.url?.trim() &&
        /layout|floor|plan|unit/i.test(`${m.label} ${m.url}`),
    );
    let unitLayoutUrl = '';
    if (pdf?.url) unitLayoutUrl = pdf.url.trim();
    else {
      const anyPdf = ctx.media.find((m) => m.type === 'pdf' && m.url?.trim());
      unitLayoutUrl = anyPdf?.url.trim() ?? '';
    }
    if (!unitLayoutUrl && imageGalleryUrls[1]) unitLayoutUrl = imageGalleryUrls[1];
    const siteSlides = ctx.siteMapUrls.map((u) => u.trim()).filter(Boolean);
    return {
      imageGalleryUrls,
      walkthroughUrl,
      unitLayoutUrl,
      siteSlides,
      brochureOk: Boolean(ctx.brochureUrl?.trim()),
      walkOk: Boolean(walkthroughUrl),
      imagesOk: imageGalleryUrls.length > 0,
      unitOk: Boolean(unitLayoutUrl),
      siteOk: siteSlides.length > 0,
      priceOk: Boolean(ctx.priceListUrl?.trim()),
      quoteOk: Boolean((ctx.company.email || '').trim()) || Boolean(ctx.brochureUrl?.trim()),
    };
  }, [ctx]);
}

/** Screen-space Vertex Elite booth controls — fades with `vertexEliteHudAlpha`. */
export function VertexEliteScreenHud() {
  const ctx = useStore((s) => s.vertexEliteHudContext);
  const alpha = useStore((s) => s.vertexEliteHudAlpha);
  const d = useDerived(ctx);

  const openDocument = useCallback((title: string, url: string) => {
    if (!url.trim()) return;
    unlockPointer();
    useStore.getState().setCtaResourcePopup({ title, url: url.trim(), variant: 'document' });
  }, []);

  const openImageGallery = useCallback((title: string, urls: string[]) => {
    const clean = urls.filter(Boolean);
    if (clean.length === 0) return;
    unlockPointer();
    useStore.getState().setCtaResourcePopup({
      title,
      url: clean[0],
      variant: 'image',
      imageGallery: clean.length > 1 ? clean : undefined,
    });
  }, []);

  const openQuote = useCallback(
    (c: VertexEliteHudContext) => {
      unlockPointer();
      const email = (c.company.email || '').trim();
      if (email) {
        const q = encodeURIComponent('Vertex Elite — quote request');
        window.open(`mailto:${email}?subject=${q}`, '_blank', 'noopener,noreferrer');
        return;
      }
      if (c.brochureUrl.trim()) openDocument('QUOTE — PROJECT PDF', c.brochureUrl);
    },
    [openDocument],
  );

  const openChat = useCallback(() => {
    unlockPointer();
    useStore.getState().setAiChatOpen(true);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.key !== ' ') return;
      if (alpha < 0.12 || !ctx) return;
      e.preventDefault();
      unlockPointer();
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [alpha, ctx]);

  if (!ctx || alpha < 0.02 || !d) return null;

  const glow = ctx.glow || '#d4af37';

  return (
    <>
      <SidePanel side="left" alpha={alpha} glow={glow}>
        <GlassCircleButton label="Brochure" enabled={d.brochureOk} glow={glow} onClick={() => openDocument('BROCHURE', ctx.brochureUrl)} />
        <GlassCircleButton label={'Walk\nthrough'} enabled={d.walkOk} glow={glow} onClick={() => openDocument('WALKTHROUGH', d.walkthroughUrl)} />
        <GlassCircleButton label="Images" enabled={d.imagesOk} glow={glow} onClick={() => openImageGallery('IMAGES', d.imageGalleryUrls)} />
        <GlassCircleButton label={'Unit\nlayout'} enabled={d.unitOk} glow={glow} onClick={() => openDocument('UNIT LAYOUT', d.unitLayoutUrl)} />
      </SidePanel>

      <SidePanel side="right" alpha={alpha} glow={glow}>
        <GlassCircleButton label={'Site\nlayout'} enabled={d.siteOk} glow={glow} onClick={() => openImageGallery('SITE LAYOUT', d.siteSlides)} />
        <GlassCircleButton label={'Price\nlist'} enabled={d.priceOk} glow={glow} onClick={() => openDocument('PRICE LIST', ctx.priceListUrl)} />
        <GlassCircleButton label="Quote" enabled={d.quoteOk} glow={glow} onClick={() => openQuote(ctx)} />
        <GlassCircleButton label="Chat" enabled glow={glow} onClick={openChat} />
      </SidePanel>

      <div
        className="pointer-events-none fixed bottom-24 left-1/2 z-[48] -translate-x-1/2 text-center md:bottom-28"
        style={{ opacity: alpha * 0.95 }}
      >
        <p className="text-[11px] font-medium tracking-wide text-white/90 drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]">
          Approach further to interact
        </p>
        <p className="mt-0.5 text-[10px] text-white/50">Press Space to Exit</p>
      </div>
    </>
  );
}
