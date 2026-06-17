import { useStore } from '@/store';
import {
  RENDER_QUALITY_PRESETS,
  getRenderQualityPreset,
  isRenderQuality,
  type RenderQuality,
} from '@/features/shared/data/renderQuality';
import { mergeSceneConfig } from '@/features/shared/data/boothLayouts';
import { SMOOTH_MODE_SCENE_PATCH } from '@/utils/devicePerformance';

/** In-expo render quality: Full HD / HD / 480p */
export function SceneQualityHud() {
  const sceneOverrides = useStore((s) => s.sceneOverrides);
  const patchScene = useStore((s) => s.patchSceneOverride);
  const hallLayoutEditMode = useStore((s) => s.hallLayoutEditMode);
  const registrationUi = useStore((s) => s.registrationUi);
  const showInstructions = useStore((s) => s.showInstructions);
  const cmsPage = useStore((s) => s.cmsPage);
  const isAdmin = useStore((s) => s.isAdmin);

  if (!isAdmin || cmsPage !== 'expo' || hallLayoutEditMode || registrationUi !== 'none' || showInstructions) {
    return null;
  }

  const cfg = mergeSceneConfig(sceneOverrides);
  const active = isRenderQuality(cfg.renderQuality) ? cfg.renderQuality : 'hd';

  const apply = (id: RenderQuality) => {
    const preset = getRenderQualityPreset(id);
    patchScene(preset.patch);
  };

  return (
    <div className="pointer-events-auto fixed bottom-3 left-1/2 z-[55] -translate-x-1/2 flex flex-col items-center gap-1">
      <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/45">
        Quality
      </span>
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
            title={p.hint}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => patchScene(SMOOTH_MODE_SCENE_PATCH)}
          className="rounded-lg border border-emerald-500/45 bg-emerald-950/80 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-emerald-200 hover:bg-emerald-900/90"
          title="480p + softer LED video + compress meshes — all screens stay visible"
        >
          Smooth
        </button>
        <button
          type="button"
          onClick={() => patchScene({ showVideos: !cfg.showVideos })}
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
          onClick={() => patchScene({ showHallCanopy: !cfg.showHallCanopy })}
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
      </div>
    </div>
  );
}
