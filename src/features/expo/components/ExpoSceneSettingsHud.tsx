import { useState } from 'react';
import { useStore } from '@/store';
import { mergeSceneConfig } from '@/features/shared/data/boothLayouts';
import {
  RENDER_QUALITY_PRESETS,
  getRenderQualityPreset,
  isRenderQuality,
  type RenderQuality,
} from '@/features/shared/data/renderQuality';
import { SMOOTH_MODE_SCENE_PATCH } from '@/utils/devicePerformance';

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-white/10 bg-white/[0.04] p-2.5">
      <input
        type="checkbox"
        className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[#d4af37]"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span className="block text-[11px] font-medium text-white/90">{label}</span>
        <span className="mt-0.5 block text-[9px] leading-snug text-white/45">{hint}</span>
      </span>
    </label>
  );
}

export function ExpoSceneSettingsHud() {
  const [open, setOpen] = useState(false);
  const sceneOverrides = useStore((s) => s.sceneOverrides);
  const patchScene = useStore((s) => s.patchSceneOverride);
  const setCmsPage = useStore((s) => s.setCmsPage);
  const hallLayoutEditMode = useStore((s) => s.hallLayoutEditMode);
  const registrationUi = useStore((s) => s.registrationUi);
  const showInstructions = useStore((s) => s.showInstructions);
  const cmsPage = useStore((s) => s.cmsPage);

  if (cmsPage !== 'expo' || hallLayoutEditMode || registrationUi !== 'none' || showInstructions) {
    return null;
  }

  const cfg = mergeSceneConfig(sceneOverrides);
  const activeQuality: RenderQuality = isRenderQuality(cfg.renderQuality) ? cfg.renderQuality : 'hd';

  return (
    <div className="pointer-events-auto fixed bottom-[4.75rem] left-3 z-[56] flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`rounded-lg border px-4 py-2.5 text-xs font-bold uppercase tracking-wider shadow-xl backdrop-blur-md transition-all ${
          open
            ? 'border-[#d4af37] bg-[#d4af37] text-black'
            : 'border-white/20 bg-[#1a1a22]/92 text-white/85 hover:bg-[#1a1a22]'
        }`}
      >
        Settings
      </button>

      {open && (
        <div className="w-[min(92vw,20rem)] max-h-[min(70vh,28rem)] overflow-y-auto rounded-xl border border-[#d4af37]/30 bg-[#1a1a22]/96 p-3 shadow-2xl backdrop-blur-md">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.15em] text-[#d4af37]">Screen &amp; LED</p>
          <div className="space-y-2">
            <ToggleRow
              label="Show LED screens & videos"
              hint="One shared video stream — pauses when you walk away"
              checked={cfg.showVideos}
              onChange={(v) => patchScene({ showVideos: v })}
            />
            <ToggleRow
              label="Center ring canopy"
              hint="8 screens on the center ring — at 480p videos run in lower quality"
              checked={cfg.showHallCanopy}
              onChange={(v) => patchScene({ showHallCanopy: v })}
            />
            <ToggleRow
              label="Ballroom stage"
              hint="Chairs + stage at north end"
              checked={cfg.showBallroom}
              onChange={(v) => patchScene({ showBallroom: v })}
            />
          </div>

          <p className="mb-2 mt-4 text-[10px] font-bold uppercase tracking-[0.15em] text-[#d4af37]">Quality</p>
          <div className="mb-3 flex flex-wrap gap-1">
            {RENDER_QUALITY_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => patchScene(getRenderQualityPreset(p.id).patch)}
                className={`rounded-lg px-2.5 py-1.5 text-[9px] font-bold uppercase ${
                  activeQuality === p.id ? 'bg-[#d4af37] text-black' : 'bg-white/10 text-white/75'
                }`}
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => patchScene(SMOOTH_MODE_SCENE_PATCH)}
              className="rounded-lg border border-emerald-500/40 bg-emerald-950/70 px-2.5 py-1.5 text-[9px] font-bold uppercase text-emerald-200"
            >
              Smooth
            </button>
          </div>

          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-[#d4af37]">Performance</p>
          <div className="space-y-2">
            <ToggleRow
              label="Compress 3D models"
              hint="Fewer triangles + simpler materials"
              checked={cfg.modelCompression === '30fps'}
              onChange={(v) => patchScene({ modelCompression: v ? '30fps' : 'off' })}
            />
            <ToggleRow
              label="Distance fog"
              hint="Off recommended — can look like white haze"
              checked={cfg.fogEnabled === true}
              onChange={(v) => patchScene({ fogEnabled: v })}
            />
          </div>

          <button
            type="button"
            className="mt-3 w-full rounded-lg border border-white/15 bg-white/10 py-2 text-[10px] font-bold uppercase tracking-wider text-[#d4af37] hover:bg-white/15"
            onClick={() => {
              setOpen(false);
              setCmsPage('cms');
            }}
          >
            More in CMS →
          </button>
        </div>
      )}
    </div>
  );
}
