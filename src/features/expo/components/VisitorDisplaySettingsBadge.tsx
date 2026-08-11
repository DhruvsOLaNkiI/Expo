import { useEffect, useState } from 'react';
import { useStore } from '@/store';
import {
  getRenderQualityPreset,
  isRenderQuality,
} from '@/features/shared/data/renderQuality';
import { mergeSceneConfig } from '@/features/shared/data/boothLayouts';
import { useFullscreen } from '@/hooks/useFullscreen';

/**
 * Visitor display badge + Full screen control on phones.
 * iPhone Safari has no Fullscreen API — we still show the button with an Add-to-Home-Screen tip.
 */
export function VisitorDisplaySettingsBadge() {
  const sceneOverrides = useStore((s) => s.sceneOverrides);
  const cmsHydrated = useStore((s) => s._boothCmsHydrated);
  const showInstructions = useStore((s) => s.showInstructions);
  const cmsPage = useStore((s) => s.cmsPage);
  const registrationUi = useStore((s) => s.registrationUi);
  const hallLayoutEditMode = useStore((s) => s.hallLayoutEditMode);
  const isAdmin = useStore((s) => s.isAdmin);
  const fullscreen = useFullscreen();
  const [isTouch, setIsTouch] = useState(false);
  const [iosTip, setIosTip] = useState(false);

  useEffect(() => {
    setIsTouch('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  useEffect(() => {
    if (!iosTip) return;
    const t = window.setTimeout(() => setIosTip(false), 6000);
    return () => window.clearTimeout(t);
  }, [iosTip]);

  if (
    !cmsHydrated ||
    cmsPage !== 'expo' ||
    hallLayoutEditMode ||
    registrationUi !== 'none' ||
    showInstructions
  ) {
    return null;
  }

  // Admins already have the interactive Quality bar — skip the duplicate badge for them.
  if (isAdmin) return null;

  const cfg = mergeSceneConfig(sceneOverrides);
  const quality = isRenderQuality(cfg.renderQuality) ? cfg.renderQuality : 'hd';
  const qualityLabel = getRenderQualityPreset(quality).label;
  const boostOn = cfg.performanceBoost === true;

  const onFullscreenTap = () => {
    if (fullscreen.supported) {
      fullscreen.toggle();
      return;
    }
    // iPhone Safari: no Fullscreen API — guide the user.
    setIosTip(true);
  };

  return (
    <div className="pointer-events-none fixed bottom-3 left-1/2 z-[54] -translate-x-1/2 flex flex-col items-center gap-1.5">
      {iosTip && (
        <div className="pointer-events-auto max-w-[min(92vw,20rem)] rounded-lg border border-amber-400/40 bg-black/85 px-3 py-2 text-center text-[10px] leading-snug text-amber-100 shadow-xl backdrop-blur-md">
          iPhone Safari cannot hide the browser bar. Tap Share → <strong>Add to Home Screen</strong>, then open from the icon for full screen.
        </div>
      )}
      <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-white/15 bg-black/70 px-3 py-2 shadow-xl backdrop-blur-md">
        <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/45">
          Display
        </span>
        <span className="rounded-md bg-[#d4af37]/20 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#f5e6b8]">
          {qualityLabel}
        </span>
        <span
          className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${
            boostOn ? 'bg-sky-500/20 text-sky-200' : 'bg-white/10 text-white/55'
          }`}
        >
          {boostOn ? 'Boost ON' : 'Boost OFF'}
        </span>
        {isTouch && (
          <button
            type="button"
            onClick={onFullscreenTap}
            className={`rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${
              fullscreen.active
                ? 'border-emerald-400/50 bg-emerald-950/80 text-emerald-100'
                : 'border-white/25 bg-white/10 text-white/85 hover:bg-white/15'
            }`}
            aria-label={fullscreen.active ? 'Exit full screen' : 'Enter full screen'}
          >
            {fullscreen.active ? 'Exit FS' : 'Full screen'}
          </button>
        )}
      </div>
    </div>
  );
}
