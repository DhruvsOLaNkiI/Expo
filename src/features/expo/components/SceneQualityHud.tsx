import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/store';
import {
  RENDER_QUALITY_PRESETS,
  getRenderQualityPreset,
  isRenderQuality,
  type RenderQuality,
} from '@/features/shared/data/renderQuality';
import { mergeSceneConfig } from '@/features/shared/data/boothLayouts';
import { SMOOTH_MODE_SCENE_PATCH } from '@/utils/devicePerformance';

/** In-expo render quality: Full HD / HD / 480p — admin sets this for every visitor on this hall. */
export function SceneQualityHud() {
  const sceneOverrides = useStore((s) => s.sceneOverrides);
  const patchScene = useStore((s) => s.patchSceneOverride);
  const hallLayoutEditMode = useStore((s) => s.hallLayoutEditMode);
  const registrationUi = useStore((s) => s.registrationUi);
  const showInstructions = useStore((s) => s.showInstructions);
  const cmsPage = useStore((s) => s.cmsPage);
  const isAdmin = useStore((s) => s.isAdmin);
  const [saveHint, setSaveHint] = useState<string | null>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (hintTimer.current) clearTimeout(hintTimer.current);
    };
  }, []);

  if (!isAdmin || cmsPage !== 'expo' || hallLayoutEditMode || registrationUi !== 'none' || showInstructions) {
    return null;
  }

  const cfg = mergeSceneConfig(sceneOverrides);
  const active = isRenderQuality(cfg.renderQuality) ? cfg.renderQuality : 'hd';

  const flash = (msg: string) => {
    setSaveHint(msg);
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setSaveHint(null), 2200);
  };

  const apply = (id: RenderQuality) => {
    patchScene(getRenderQualityPreset(id).patch);
    flash(`✓ ${getRenderQualityPreset(id).label} saved for all visitors`);
  };

  return (
    <div className="pointer-events-auto fixed bottom-3 left-1/2 z-[55] -translate-x-1/2 flex flex-col items-center gap-1">
      <div className="flex items-center gap-2">
        <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/45">
          Quality · all visitors
        </span>
        {saveHint && (
          <span className="text-[9px] font-semibold text-emerald-400/90">{saveHint}</span>
        )}
      </div>
      <div className="flex max-w-[min(96vw,42rem)] flex-wrap justify-center gap-1 rounded-xl border border-[#d4af37]/30 bg-[#1a1a22]/92 p-1 shadow-xl backdrop-blur-md">
        {RENDER_QUALITY_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => apply(p.id)}
            className={`rounded-lg px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-all ${
              active === p.id
                ? 'bg-[#d4af37] text-black shadow-md'
                : 'text-white/70 hover:bg-white/10'
            }`}
            title={`${p.hint} — saved for every visitor on this hall`}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            patchScene(SMOOTH_MODE_SCENE_PATCH);
            flash('✓ Smooth (480p) saved for all visitors');
          }}
          className="rounded-lg border border-emerald-500/45 bg-emerald-950/80 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-emerald-200 hover:bg-emerald-900/90"
          title="480p + softer LED video + compress meshes — all screens stay visible"
        >
          Smooth
        </button>
        <button
          type="button"
          onClick={() => {
            const next = !cfg.showVideos;
            patchScene({ showVideos: next });
            flash(next ? '✓ Videos on for all visitors' : '✓ 3D only for all visitors');
          }}
          className={`rounded-lg border px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-all ${
            cfg.showVideos
              ? 'border-white/15 text-white/70 hover:bg-white/10'
              : 'border-amber-500/55 bg-amber-950/85 text-amber-100 shadow-md'
          }`}
          title={
            cfg.showVideos
              ? 'Turn off all LED videos — test 3D performance only (panels stay, no playback)'
              : 'Turn LED videos back on'
          }
        >
          {cfg.showVideos ? '3D only' : 'Videos off'}
        </button>
        <button
          type="button"
          onClick={() => {
            const next = !cfg.showHallCanopy;
            patchScene({ showHallCanopy: next });
            flash(next ? '✓ Ring on for all visitors' : '✓ Ring hidden for all visitors');
          }}
          className={`rounded-lg border px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-all ${
            cfg.showHallCanopy
              ? 'border-white/15 text-white/70 hover:bg-white/10'
              : 'border-violet-500/55 bg-violet-950/85 text-violet-100 shadow-md'
          }`}
          title={
            cfg.showHallCanopy
              ? 'Hide the center circular LED ring (8 screens + ticker) for better FPS'
              : 'Show center hall canopy ring again'
          }
        >
          {cfg.showHallCanopy ? 'Hide ring' : 'Ring off'}
        </button>
        <button
          type="button"
          onClick={() => {
            const next = !cfg.performanceBoost;
            patchScene({ performanceBoost: next });
            flash(next ? '✓ Boost ON for all visitors' : '✓ Boost OFF for all visitors');
          }}
          className={`rounded-lg border px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-all ${
            cfg.performanceBoost
              ? 'border-sky-400/55 bg-sky-950/85 text-sky-100 shadow-md'
              : 'border-white/15 text-white/70 hover:bg-white/10'
          }`}
          title={
            cfg.performanceBoost
              ? 'Performance Boost ON — hostess gating, fewer lights, smaller shadows, 1024px textures, soft decimation. Tap to compare raw FPS.'
              : 'Performance Boost OFF — full lights/textures/geometry (heavier). Tap to re-enable optimizations.'
          }
        >
          {cfg.performanceBoost ? 'Boost ON' : 'Boost OFF'}
        </button>
      </div>
    </div>
  );
}
