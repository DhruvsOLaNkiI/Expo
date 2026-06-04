import { useCallback, useEffect, useMemo, type CSSProperties, type ReactNode } from 'react';
import { buildCtaOpenPayload, resolveBoothCta } from '@/api/boothCta';
import {
  applyBoothOverrides,
  buildDefaultBoothLayoutList,
  floorPlansFromConfig,
  unitLayoutsFromConfig,
} from '@/features/shared/data/boothLayouts';
import { sanitizeCustomFaqQuestions } from '@/features/exhibitorDashboard/customFaqQuestions';
import { warmPdfCache } from '@/utils/warmPdfCache';
import { isEditableKeyboardTarget } from '@/utils/keyboard';
import { useStore } from '@/store';
import {
  engagementActionFromLabel,
  trackEngagementClick,
  type EngagementAction,
} from '@/dashboard/engagementLeadScore';
import { LuxuryAnimatedMenu, type LuxuryMenuOption } from './LuxuryAnimatedMenu';

function splitUnitLabel(text: string): [string, string?] {
  const parts = text.trim().split(/\s+/);
  if (parts.length <= 1) return [parts[0] ?? 'VIEW'];
  const mid = Math.ceil(parts.length / 2);
  return [parts.slice(0, mid).join(' '), parts.slice(mid).join(' ')];
}

function unlockPointer() {
  if (typeof document !== 'undefined' && document.pointerLockElement) {
    document.exitPointerLock();
  }
}

function stepBackFromBoothHud(boothId: string) {
  const { teleportPlayer, reportBoothHudProximity, boothOverrides } = useStore.getState();
  const booth = applyBoothOverrides(buildDefaultBoothLayoutList(), boothOverrides).find(
    (b) => b.id === boothId,
  );
  if (booth) {
    const towardAisle = booth.position[0] > 0 ? -5 : 5;
    teleportPlayer([booth.position[0] + towardAisle, 1.7, booth.position[2] - 5]);
  }
  reportBoothHudProximity(boothId, 0, null);
  unlockPointer();
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
  children,
}: {
  side: 'left' | 'right';
  alpha: number;
  children: ReactNode;
}) {
  const base =
    side === 'left'
      ? 'left-3 md:left-8 pl-[max(0.75rem,env(safe-area-inset-left))]'
      : 'right-3 md:right-8 pr-[max(0.75rem,env(safe-area-inset-right))]';
  return (
    <div
      className={`pointer-events-none fixed top-1/2 z-[48] flex -translate-y-1/2 flex-col items-center gap-3 overflow-visible ${base}`}
      style={{
        opacity: alpha,
        pointerEvents: alpha > 0.08 ? 'auto' : 'none',
      }}
    >
      <div className="flex w-14 flex-col items-center gap-3 overflow-visible">
        {children}
      </div>
    </div>
  );
}

/** Screen-space Vertex Elite booth controls — fades with `vertexEliteHudAlpha`. */
export function VertexEliteScreenHud() {
  const ctx = useStore((s) => s.vertexEliteHudContext);
  const alpha = useStore((s) => s.vertexEliteHudAlpha);

  const d = useMemo(() => {
    if (!ctx) return null;
    return resolveBoothCta({
      brochureUrl: ctx.brochureUrl,
      priceListUrl: ctx.priceListUrl,
      unitLayoutUrl: ctx.unitLayoutUrl,
      floorPlanUrl: ctx.floorPlanUrl,
      floorPlans: ctx.floorPlans,
      faqUrl: ctx.faqUrl,
      customFaqQuestions: ctx.customFaqQuestions,
      siteMapUrls: ctx.siteMapUrls,
      videoUrl: ctx.videoUrl,
      media: ctx.media,
      placedImages: ctx.placedImages,
      company: ctx.company,
    });
  }, [ctx]);

  useEffect(() => {
    if (d?.brochureUrl) warmPdfCache(d.brochureUrl);
    if (d?.priceListUrl) warmPdfCache(d.priceListUrl);
    if (d?.faqUrl) warmPdfCache(d.faqUrl);
  }, [d?.brochureUrl, d?.priceListUrl, d?.faqUrl]);

  const recordEngagement = useCallback(
    (action: EngagementAction) => {
      if (!ctx?.boothId) return;
      const profile = useStore.getState().visitorProfile;
      trackEngagementClick(action, ctx.boothId, {
        visitorId: profile?.id,
        visitorName: profile?.displayName,
      });
    },
    [ctx?.boothId],
  );

  const openCta = useCallback(
    (title: string, url: string, gallery?: string[], action?: EngagementAction) => {
      const payload = buildCtaOpenPayload(title, url, gallery);
      if (!payload) return;
      const engagementAction = action ?? engagementActionFromLabel(title);
      if (engagementAction) recordEngagement(engagementAction);
      unlockPointer();
      useStore.getState().setCtaResourcePopup({
        title: payload.title,
        url: payload.url,
        variant: payload.variant,
        imageGallery: payload.imageGallery,
      });
    },
    [recordEngagement],
  );

  const openFaq = useCallback(() => {
    recordEngagement('faq');
    const customQuestions = sanitizeCustomFaqQuestions(ctx?.customFaqQuestions ?? []);
    if (customQuestions.length > 0) {
      unlockPointer();
      useStore.getState().setCtaResourcePopup({
        title: 'FAQ',
        url: d?.faqUrl ?? '',
        variant: 'customFaq',
        customFaqQuestions: customQuestions,
        boothId: ctx.boothId,
      });
      return;
    }
    openCta('FAQ', d?.faqUrl ?? '');
  }, [ctx, d, openCta, recordEngagement]);

  const unitLayoutOptions = useMemo((): LuxuryMenuOption[] => {
    if (!ctx || !d?.unitOk) return [];
    const layouts = unitLayoutsFromConfig({
      unitLayouts: ctx.unitLayouts,
      unitLayoutUrl: ctx.unitLayoutUrl || d.unitLayoutUrl,
    });

    const primaryUrl = layouts[0]?.imageUrl ?? d.unitLayoutUrl;
    const gallery = layouts.map((l) => l.imageUrl).filter(Boolean);

    if (layouts.length > 1) {
      return layouts.slice(0, 4).map((layout) => ({
        id: layout.id,
        lines: splitUnitLabel(layout.name.trim() || 'Unit layout'),
        onClick: () => {
          const urls = layouts.map((l) => l.imageUrl).filter(Boolean);
          openCta(layout.name.trim() || 'UNIT LAYOUT', layout.imageUrl, urls.length > 1 ? urls : undefined, 'unit_layout');
        },
      }));
    }

    return [
      {
        id: 'home',
        lines: ['HOME'],
        icon: '⌂',
        onClick: () => openCta('UNIT LAYOUT', primaryUrl, undefined, 'unit_layout'),
      },
      {
        id: 'pages',
        lines: ['PAGES'],
        icon: '⎘',
        onClick: () => openCta('UNIT LAYOUT', primaryUrl, gallery, 'unit_layout'),
      },
    ];
  }, [ctx, d, openCta]);

  const floorPlanOptions = useMemo((): LuxuryMenuOption[] => {
    if (!ctx || !d?.floorOk) return [];
    const plans = floorPlansFromConfig({
      floorPlans: ctx.floorPlans,
      floorPlanUrl: ctx.floorPlanUrl,
    });

    const primaryUrl = plans[0]?.imageUrl ?? '';
    const gallery = plans.map((p) => p.imageUrl).filter(Boolean);

    if (plans.length > 1) {
      return plans.slice(0, 4).map((plan) => ({
        id: plan.id,
        lines: splitUnitLabel(plan.name.trim() || 'Floor plan'),
        onClick: () => {
          const urls = plans.map((p) => p.imageUrl).filter(Boolean);
          openCta(plan.name.trim() || 'FLOOR PLAN', plan.imageUrl, urls.length > 1 ? urls : undefined, 'floor_plan');
        },
      }));
    }

    return [
      {
        id: 'home',
        lines: ['HOME'],
        icon: '⌂',
        onClick: () => openCta('FLOOR PLAN', primaryUrl, undefined, 'floor_plan'),
      },
      {
        id: 'pages',
        lines: ['PAGES'],
        icon: '⎘',
        onClick: () => openCta('FLOOR PLAN', primaryUrl, gallery, 'floor_plan'),
      },
    ];
  }, [ctx, d, openCta]);

  const openChat = useCallback(() => {
    if (!ctx) return;
    recordEngagement('ai_chat');
    unlockPointer();
    useStore.getState().setAiChatOpen(true, ctx.boothId);
  }, [ctx, recordEngagement]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.key !== ' ') return;
      if (alpha < 0.12 || !ctx) return;
      const { aiChatOpen, ctaResourcePopup, helpDeskOpen } = useStore.getState();
      if (aiChatOpen || ctaResourcePopup || helpDeskOpen) return;
      if (isEditableKeyboardTarget(e.target)) return;
      e.preventDefault();
      stepBackFromBoothHud(ctx.boothId);
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [alpha, ctx]);

  if (!ctx || alpha < 0.02 || !d) return null;

  const glow = ctx.glow || '#d4af37';

  return (
    <>
      <SidePanel side="left" alpha={alpha}>
        <GlassCircleButton label="Brochure" enabled={d.brochureOk} glow={glow} onClick={() => openCta('BROCHURE', d.brochureUrl, undefined, 'brochure')} />
        <GlassCircleButton label={'Walk\nthrough'} enabled={d.walkOk} glow={glow} onClick={() => openCta('WALKTHROUGH', d.walkthroughUrl, undefined, 'walkthrough')} />
        <GlassCircleButton label="Images" enabled={d.imagesOk} glow={glow} onClick={() => openCta('IMAGES', d.imageGalleryUrls[0], d.imageGalleryUrls, 'images')} />
        <LuxuryAnimatedMenu
          triggerLines={['UNIT', 'LAYOUT']}
          enabled={d.unitOk}
          options={unitLayoutOptions}
          expandDirection="right"
        />
        <LuxuryAnimatedMenu
          triggerLines={['FLOOR', 'PLAN']}
          enabled={d.floorOk}
          options={floorPlanOptions}
          expandDirection="right"
        />
      </SidePanel>

      <SidePanel side="right" alpha={alpha}>
        <GlassCircleButton label={'Site\nlayout'} enabled={d.siteOk} glow={glow} onClick={() => openCta('SITE LAYOUT', d.siteSlides[0], d.siteSlides, 'site_layout')} />
        <GlassCircleButton label={'Price\nlist'} enabled={d.priceOk} glow={glow} onClick={() => openCta('PRICE LIST', d.priceListUrl, undefined, 'price_list')} />
        <GlassCircleButton label="FAQ" enabled={d.faqOk} glow={glow} onClick={openFaq} />
        <GlassCircleButton label="Chat" enabled glow={glow} onClick={openChat} />
      </SidePanel>

      <div
        className="pointer-events-none fixed bottom-24 left-1/2 z-[48] -translate-x-1/2 text-center md:bottom-28"
        style={{ opacity: alpha * 0.95 }}
      >
        <p className="text-[11px] font-medium tracking-wide text-white/90 drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]">
          {alpha >= 0.55
            ? 'Use the side buttons — Brochure, Floor plan, Chat…'
            : 'Move closer to the reception desk for full booth controls'}
        </p>
        <p className="mt-0.5 text-[10px] text-white/50">
          Press Space to step back · click side buttons to open content
        </p>
      </div>
    </>
  );
}
