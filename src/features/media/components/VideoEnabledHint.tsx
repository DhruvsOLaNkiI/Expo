import { useStore } from '@/store';
import { mergeSceneConfig } from '@/features/shared/data/boothLayouts';

/** Shown when LED videos are disabled so visitors know how to turn them back on. */
export function VideoEnabledHint() {
  const sceneOverrides = useStore((s) => s.sceneOverrides);
  const patchScene = useStore((s) => s.patchSceneOverride);
  const cmsPage = useStore((s) => s.cmsPage);
  const showInstructions = useStore((s) => s.showInstructions);
  const hallLayoutEditMode = useStore((s) => s.hallLayoutEditMode);

  if (cmsPage !== 'expo' || showInstructions || hallLayoutEditMode) return null;

  const cfg = mergeSceneConfig(sceneOverrides);
  if (cfg.showVideos) return null;

  return (
    <div className="pointer-events-auto fixed top-20 left-1/2 z-[56] max-w-md -translate-x-1/2 rounded-xl border border-amber-500/40 bg-[#1a1a22]/95 px-4 py-3 shadow-xl backdrop-blur-md">
      <p className="text-[11px] font-bold uppercase tracking-wider text-amber-200">LED videos are off</p>
      <p className="mt-1 text-[10px] leading-snug text-white/60">
        Booth screens &amp; reception wall are black until you enable them.
      </p>
      <button
        type="button"
        className="mt-2 w-full rounded-lg bg-[#d4af37] py-2 text-[10px] font-bold uppercase tracking-wider text-black hover:bg-[#e8c547]"
        onClick={() => patchScene({ showVideos: true })}
      >
        Turn on videos
      </button>
    </div>
  );
}
