import { useStore } from '@/store';
import {
  getRenderQualityPreset,
  isRenderQuality,
} from '@/features/shared/data/renderQuality';
import { mergeSceneConfig } from '@/features/shared/data/boothLayouts';

/**
 * Read-only badge so every visitor can see which display settings the hall is running
 * (admin sets these globally via the Quality bar / CMS).
 */
export function VisitorDisplaySettingsBadge() {
  const sceneOverrides = useStore((s) => s.sceneOverrides);
  const cmsHydrated = useStore((s) => s._boothCmsHydrated);
  const showInstructions = useStore((s) => s.showInstructions);
  const cmsPage = useStore((s) => s.cmsPage);
  const registrationUi = useStore((s) => s.registrationUi);
  const hallLayoutEditMode = useStore((s) => s.hallLayoutEditMode);
  const isAdmin = useStore((s) => s.isAdmin);

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

  return (
    <div
      className="pointer-events-none fixed bottom-3 left-1/2 z-[54] -translate-x-1/2"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-black/70 px-3 py-2 shadow-xl backdrop-blur-md">
        <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/45">
          Display
        </span>
        <span className="rounded-md bg-[#d4af37]/20 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#f5e6b8]">
          {qualityLabel}
        </span>
        <span
          className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${
            boostOn
              ? 'bg-sky-500/20 text-sky-200'
              : 'bg-white/10 text-white/55'
          }`}
        >
          {boostOn ? 'Boost ON' : 'Boost OFF'}
        </span>
      </div>
    </div>
  );
}
