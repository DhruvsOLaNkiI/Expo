import { useState } from 'react';
import { useStore } from '@/store';
import { mergeSceneConfig } from '@/features/shared/data/boothLayouts';

const DISMISS_KEY = 'expo-video-hint-dismissed';

/** Optional hint when LED videos are off — hidden for admins (Quality bar shows state). */
export function VideoEnabledHint() {
  const sceneOverrides = useStore((s) => s.sceneOverrides);
  const patchScene = useStore((s) => s.patchSceneOverride);
  const cmsPage = useStore((s) => s.cmsPage);
  const showInstructions = useStore((s) => s.showInstructions);
  const hallLayoutEditMode = useStore((s) => s.hallLayoutEditMode);
  const isAdmin = useStore((s) => s.isAdmin);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });

  if (isAdmin || cmsPage !== 'expo' || showInstructions || hallLayoutEditMode || dismissed) {
    return null;
  }

  const cfg = mergeSceneConfig(sceneOverrides);
  if (cfg.showVideos) return null;

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* */
    }
    setDismissed(true);
  };

  return (
    <div className="pointer-events-auto fixed top-20 left-1/2 z-[56] max-w-md -translate-x-1/2 rounded-xl border border-amber-500/40 bg-[#1a1a22]/95 px-4 py-3 shadow-xl backdrop-blur-md">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-amber-200">LED videos are off</p>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold text-white/45 hover:bg-white/10 hover:text-white/80"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
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
