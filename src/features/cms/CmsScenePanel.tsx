import { useStore } from '@/store';
import { DEFAULT_SCENE_CONFIG, mergeSceneConfig, type SceneConfig, buildDefaultBoothLayoutList, applyBoothOverrides } from '@/features/shared/data/boothLayouts';
import { PERFORMANCE_30FPS_SCENE_PATCH } from '@/utils/glbPerformance';
import {
  RENDER_QUALITY_PRESETS,
  getRenderQualityPreset,
  isRenderQuality,
  type RenderQuality,
} from '@/features/shared/data/renderQuality';
import React, { useMemo, useRef, useState } from 'react';
import { SIDE_SPECS } from '@/features/booths/components/SideExpoBooths';
import { uploadCmsFile } from '@/api/cmsUpload';

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[11px] font-bold uppercase tracking-widest text-white/30 mb-2">{children}</h3>;
}

function CmsColor({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] uppercase tracking-wide text-white/35">{label}</label>
      <div className="flex items-center gap-2">
        <input type="color" className="h-8 w-8 cursor-pointer rounded border border-white/[0.08] bg-transparent p-0" value={value} onChange={(e) => onChange(e.target.value)} />
        <input className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-white outline-none focus:border-[#d4af37]/40 font-mono" value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    </div>
  );
}

export function HallLedMediaField({
  label,
  hint,
  value,
  onChange,
  uploadFolder,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (url: string) => void;
  uploadFolder: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);

  const onUpload = async (file: File) => {
    setStatus('Uploading…');
    try {
      const folder = file.type.startsWith('video/') ? `${uploadFolder}-video` : `${uploadFolder}-image`;
      const up = await uploadCmsFile(file, 'hall', folder);
      onChange(up.url);
      setStatus(up.storage === 'r2' ? 'Uploaded to R2' : 'Saved (local preview)');
      setTimeout(() => setStatus(null), 2500);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Upload failed');
    }
  };

  return (
    <div className="mb-3 rounded-lg border border-white/[0.08] bg-white/[0.03] p-3">
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-white/50">{label}</label>
      <p className="mb-2 text-[9px] leading-relaxed text-white/35">{hint}</p>
      <input
        className="mb-2 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-white outline-none focus:border-[#d4af37]/40 font-mono"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="/expo-led-video.mp4 or https://…/render.jpg"
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded-lg border border-[#d4af37]/30 bg-[#d4af37]/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#d4af37] hover:bg-[#d4af37]/20"
          onClick={() => fileRef.current?.click()}
        >
          Upload image or video
        </button>
        {value.trim() && (
          <button
            type="button"
            className="rounded-lg border border-white/10 px-2 py-1.5 text-[10px] text-white/50 hover:bg-white/5"
            onClick={() => onChange('')}
          >
            Reset to default
          </button>
        )}
        {status && <span className="text-[9px] text-white/40">{status}</span>}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*,.mp4,.webm"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onUpload(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}

function CmsSlider({ label, value, onChange, min, max, step = 0.01, unit = '' }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number; unit?: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between">
        <label className="text-[10px] uppercase tracking-wide text-white/35">{label}</label>
        <span className="text-[10px] font-mono text-white/30">{value.toFixed(2)}{unit}</span>
      </div>
      <input type="range" className="w-full accent-[#d4af37] h-1" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} />
    </div>
  );
}

export function CmsScenePanel() {
  const sceneOverrides = useStore((s) => s.sceneOverrides);
  const boothOverrides = useStore((s) => s.boothOverrides);
  const patchScene = useStore((s) => s.patchSceneOverride);
  const resetScene = useStore((s) => s.resetSceneOverrides);
  const cfg: SceneConfig = useMemo(() => mergeSceneConfig(sceneOverrides), [sceneOverrides]);
  const [showApiKey, setShowApiKey] = React.useState(false);

  // Get all booths (main + side)
  const allBooths = useMemo(() => {
    const mainBooths = applyBoothOverrides(buildDefaultBoothLayoutList(), boothOverrides);
    const sideBooths = SIDE_SPECS.map(spec => {
      const template = mainBooths.find(b => b.id === spec.templateId);
      return template ? {
        id: spec.sideId,
        name: template.name + ' (Side)',
      } : null;
    }).filter((b): b is { id: string; name: string } => b !== null);
    return [...mainBooths.map(b => ({ id: b.id, name: b.name })), ...sideBooths];
  }, [boothOverrides]);

  const hiddenBoothIds = cfg.hiddenBooths ?? [];
  const activeQuality: RenderQuality = isRenderQuality(cfg.renderQuality) ? cfg.renderQuality : 'hd';

  const applyQuality = (id: RenderQuality) => {
    patchScene(getRenderQualityPreset(id).patch);
  };

  return (
    <>
      <SectionTitle>Render quality</SectionTitle>
      <div className="mb-3 grid grid-cols-3 gap-2">
        {RENDER_QUALITY_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => applyQuality(p.id)}
            className={`rounded-lg border px-2 py-2.5 text-left transition-all ${
              activeQuality === p.id
                ? 'border-[#d4af37] bg-[#d4af37]/15 ring-1 ring-[#d4af37]/40'
                : 'border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]'
            }`}
          >
            <span className="block text-[11px] font-bold text-white/90">{p.label}</span>
            <span className="mt-1 block text-[8px] leading-snug text-white/40">{p.hint}</span>
          </button>
        ))}
      </div>
      <p className="mb-4 text-[9px] text-white/30 leading-relaxed">
        Same presets as the <strong className="text-white/50">Quality</strong> bar in the expo (bottom center).
        Only changes resolution — fog, compress models, and videos stay as you set them below.
      </p>

      <SectionTitle>Performance (advanced)</SectionTitle>
      <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-sky-400/25 bg-sky-400/[0.05] p-3">
        <input
          type="checkbox"
          className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-sky-400"
          checked={cfg.performanceBoost}
          onChange={(e) => patchScene({ performanceBoost: e.target.checked })}
        />
        <span>
          <span className="block text-[11px] font-medium text-sky-300">Performance Boost (recommended)</span>
          <span className="mt-1 block text-[9px] leading-relaxed text-white/40">
            Distance-gates the hostess idle animation, drops 2 global fill lights, shrinks the shadow map, caps GLB textures to 1024px, and uses soft non-destructive decimation (heavy meshes only). Big phone FPS win with minimal visual change. Turn off to compare raw vs optimized FPS.
          </span>
        </span>
      </label>
      <label className="mt-2 flex cursor-pointer items-start gap-2.5 rounded-lg border border-[#d4af37]/20 bg-[#d4af37]/[0.04] p-3">
        <input
          type="checkbox"
          className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[#d4af37]"
          checked={cfg.modelCompression === '30fps'}
          onChange={(e) => patchScene({ modelCompression: e.target.checked ? '30fps' : 'off' })}
        />
        <span>
          <span className="block text-[11px] font-medium text-[#d4af37]">Compress 3D models (30 FPS target)</span>
          <span className="mt-1 block text-[9px] leading-relaxed text-white/40">
            Decimates GLB triangle count (~65% fewer), switches heavy PBR to lighter Lambert materials, disables shadows &amp; HDR environment map, throttles proximity checks, and hides decorative GLBs (trees/standees). Major FPS boost for integrated GPUs.
          </span>
        </span>
      </label>
      <button
        type="button"
        className="mt-2 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-white/70 hover:bg-white/[0.07] transition-colors"
        onClick={() => patchScene(PERFORMANCE_30FPS_SCENE_PATCH)}
      >
        Apply full 30 FPS preset
      </button>
      <p className="mt-1.5 mb-1 text-[9px] text-white/30 leading-relaxed">
        Preset enables model compression plus turns off bloom, videos, ballroom, roaming executive, and hall canopy.
      </p>

      <SectionTitle>Distance fog</SectionTitle>
      <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-white/[0.08] bg-white/[0.03] p-3">
        <input
          type="checkbox"
          className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[#d4af37]"
          checked={cfg.fogEnabled === true}
          onChange={(e) => patchScene({ fogEnabled: e.target.checked })}
        />
        <span>
          <span className="flex items-center gap-2">
            <span className="block text-[11px] font-medium text-white/80">Enable distance fog</span>
            <span
              className={`rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider ${
                cfg.fogEnabled === true
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'bg-white/10 text-white/40'
              }`}
            >
              {cfg.fogEnabled === true ? 'On' : 'Off'}
            </span>
          </span>
          <span className="mt-1 block text-[9px] leading-relaxed text-white/35">
            Soft haze on the far end of the 90m hall — hides distant geometry and can improve FPS. Turn off for a fully clear view end-to-end.
          </span>
        </span>
      </label>
      {cfg.fogEnabled === true ? (
        <div className="mt-2 space-y-3 rounded-lg border border-white/[0.06] bg-black/20 p-3">
          <CmsSlider label="Fog starts (near, m)" value={cfg.fogNear} onChange={(v) => patchScene({ fogNear: v })} min={1} max={80} step={1} unit="m" />
          <CmsSlider label="Fog full (far, m)" value={cfg.fogFar} onChange={(v) => patchScene({ fogFar: v })} min={15} max={120} step={1} unit="m" />
          <CmsColor label="Fog color" value={cfg.fogColor} onChange={(v) => patchScene({ fogColor: v })} />
          <p className="text-[9px] text-white/30 leading-relaxed">
            Keep <strong className="text-white/50">Far</strong> above 80m or the hall looks like a white wall that moves with the camera. Off is recommended for a clean expo look.
          </p>
        </div>
      ) : (
        <p className="mt-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[9px] text-white/35 leading-relaxed">
          Fog is disabled — the hall renders with full visibility to the walls.
        </p>
      )}

      <label className="mt-2 flex cursor-pointer items-start gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
        <input
          type="checkbox"
          className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[#d4af37]"
          checked={cfg.showStandardBooths}
          onChange={(e) => patchScene({ showStandardBooths: e.target.checked })}
        />
        <span>
          <span className="block text-[11px] font-medium text-white/80">Show standard white exhibition booths</span>
          <span className="mt-1 block text-[9px] leading-relaxed text-white/35">
            Off by default for smoother FPS. Hides LUXE / AURUM / CROWN / MONARCH / HORIZON stalls; Vertex Elite, help desk, and hall stay.
          </span>
        </span>
      </label>
      
      <label className="mt-2 flex cursor-pointer items-start gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
        <input
          type="checkbox"
          className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[#d4af37]"
          checked={cfg.postProcessing}
          onChange={(e) => patchScene({ postProcessing: e.target.checked })}
        />
        <span>
          <span className="block text-[11px] font-medium text-white/80">Bloom &amp; post-processing</span>
          <span className="mt-1 block text-[9px] leading-relaxed text-white/35">
            Off by default. Enables bloom, tone mapping, and vignette — nicer LEDs, heavier GPU.
          </span>
        </span>
      </label>
      
      <label className="mt-2 flex cursor-pointer items-start gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
        <input
          type="checkbox"
          className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[#d4af37]"
          checked={cfg.showBallroom}
          onChange={(e) => patchScene({ showBallroom: e.target.checked })}
        />
        <span>
          <span className="block text-[11px] font-medium text-white/80">Show ballroom</span>
          <span className="mt-1 block text-[9px] leading-relaxed text-white/35">
            Off by default. The ballroom has many chairs and video — expensive on integrated GPUs.
          </span>
        </span>
      </label>

      <SectionTitle>Hall LED branding (stage &amp; center ring)</SectionTitle>
      <p className="mb-2 text-[9px] leading-relaxed text-white/35">
        Same as booth <strong className="text-white/50">Main stage screen</strong>: MP4/WebM video or PNG/JPG image.
        Images show even when <em>Show video planes</em> is off. Leave URL empty to use the default expo video.
      </p>
      <HallLedMediaField
        label="Ballroom stage screen (east wall)"
        hint="Large LED behind the podium — Fast Travel → Ballroom stage."
        value={cfg.ballroomStageScreenUrl ?? ''}
        onChange={(url) => patchScene({ ballroomStageScreenUrl: url })}
        uploadFolder="ballroom-stage"
      />
      <HallLedMediaField
        label="Center canopy ring (circular LED)"
        hint="Suspended screens above the help desk — Fast Travel → Center plaza / Reception."
        value={cfg.hallCanopyScreenUrl ?? ''}
        onChange={(url) => patchScene({ hallCanopyScreenUrl: url })}
        uploadFolder="hall-canopy"
      />
      <HallLedMediaField
        label="Entrance wall TV (faces visitor spawn)"
        hint="Large LED in front of the gold entry ring — Edit Layout → Entrance wall TV to move it."
        value={cfg.entranceWallScreenUrl ?? ''}
        onChange={(url) => patchScene({ entranceWallScreenUrl: url })}
        uploadFolder="entrance-wall"
      />
      
      <label className="mt-2 flex cursor-pointer items-start gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
        <input
          type="checkbox"
          className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[#d4af37]"
          checked={cfg.showRoamingExecutive}
          onChange={(e) => patchScene({ showRoamingExecutive: e.target.checked })}
        />
        <span>
          <span className="block text-[11px] font-medium text-white/80">Show roaming executive</span>
          <span className="mt-1 block text-[9px] leading-relaxed text-white/35">
            Off by default. Animated GLB model patrolling the hall.
          </span>
        </span>
      </label>
      
      <label className="mt-2 flex cursor-pointer items-start gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
        <input
          type="checkbox"
          className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[#d4af37]"
          checked={cfg.showVideos}
          onChange={(e) => patchScene({ showVideos: e.target.checked })}
        />
        <span>
          <span className="block text-[11px] font-medium text-white/80">Show video planes</span>
          <span className="mt-1 block text-[9px] leading-relaxed text-white/35">
            Off by default. Video decoding is very expensive. When off, videos are replaced with black screens; images still work.
          </span>
        </span>
      </label>

      <label className="mt-2 flex cursor-pointer items-start gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
        <input
          type="checkbox"
          className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[#d4af37]"
          checked={cfg.showHallCanopy}
          onChange={(e) => patchScene({ showHallCanopy: e.target.checked })}
        />
        <span>
          <span className="block text-[11px] font-medium text-white/80">Show suspended hall canopy (LED ring)</span>
          <span className="mt-1 block text-[9px] leading-relaxed text-white/35">
            Uncheck to hide the center ceiling jumbotron (8 LED screens + ticker animation) for better FPS on old phones and integrated GPUs. Help desk and booths stay.
          </span>
        </span>
      </label>

      <label className="mt-2 flex cursor-pointer items-start gap-2.5 rounded-lg border border-amber-500/25 bg-amber-500/[0.04] p-3">
        <input
          type="checkbox"
          className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[#d4af37]"
          checked={cfg.showVertexEliteCtaKiosk}
          onChange={(e) => patchScene({ showVertexEliteCtaKiosk: e.target.checked })}
        />
        <span>
          <span className="block text-[11px] font-medium text-white/80">Show Vertex Elite CTA kiosk (tall black stand)</span>
          <span className="mt-1 block text-[9px] leading-relaxed text-white/35">
            Tall black “EXPLORE MORE” kiosk on the aisle. Off by default — leave unchecked to hide it.
          </span>
        </span>
      </label>

      <label className="mt-2 flex cursor-pointer items-start gap-2.5 rounded-lg border border-amber-500/25 bg-amber-500/[0.04] p-3">
        <input
          type="checkbox"
          className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[#d4af37]"
          checked={cfg.showHallAisleStandees}
          onChange={(e) => patchScene({ showHallAisleStandees: e.target.checked })}
        />
        <span>
          <span className="block text-[11px] font-medium text-white/80">Show aisle digital standees (GLB)</span>
          <span className="mt-1 block text-[9px] leading-relaxed text-white/35">
            Tall displays in the gaps between booths on a row. They auto-move when you reposition
            booths. Turn off if you do not want them in the walkway. Off by default (heavy on GPU).
          </span>
        </span>
      </label>

      <label className="mt-2 flex cursor-pointer items-start gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
        <input
          type="checkbox"
          className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[#d4af37]"
          checked={cfg.showBoothStandee}
          onChange={(e) => patchScene({ showBoothStandee: e.target.checked })}
        />
        <span>
          <span className="block text-[11px] font-medium text-white/80">Show booth roll-up standee</span>
          <span className="mt-1 block text-[9px] leading-relaxed text-white/35">
            Small name sign on a pole beside each luxury booth desk (Luxe, Aurum, Crown, Horizon).
          </span>
        </span>
      </label>

      <label className="mt-2 flex cursor-pointer items-start gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
        <input
          type="checkbox"
          className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[#d4af37]"
          checked={cfg.showHallPlants}
          onChange={(e) => patchScene({ showHallPlants: e.target.checked })}
        />
        <span>
          <span className="block text-[11px] font-medium text-white/80">Show hall path trees</span>
          <span className="mt-1 block text-[9px] leading-relaxed text-white/35">
            Four decorative tree models on the main aisle. Off by default — each uses a heavy GLB mesh.
          </span>
        </span>
      </label>

      <SectionTitle>Booth Visibility ({allBooths.length} booths)</SectionTitle>
      <div className="mb-2 p-2 bg-white/[0.02] border border-white/[0.06] rounded-lg">
        <p className="text-[9px] text-white/40 mb-2">
          Hide specific booths to reduce GPU load. Unchecked booths will not be rendered. Main and (Side) entries are independent.
        </p>
        <div className="flex gap-2 mb-2">
          <button
            onClick={() => patchScene({ hiddenBooths: [] })}
            className="px-2 py-1 text-[9px] bg-[#d4af37]/20 hover:bg-[#d4af37]/30 text-[#d4af37] rounded transition-colors"
          >
            Show All
          </button>
          <button
            onClick={() => patchScene({ hiddenBooths: allBooths.map((b) => b.id) })}
            className="px-2 py-1 text-[9px] bg-white/[0.06] hover:bg-white/[0.08] text-white/60 rounded transition-colors"
          >
            Hide All
          </button>
        </div>
      </div>
      <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
        {allBooths.map((booth) => {
          const isVisible = !hiddenBoothIds.includes(booth.id);
          return (
            <label
              key={booth.id}
              className="flex cursor-pointer items-center gap-2.5 rounded border border-white/[0.06] bg-white/[0.02] p-2 hover:bg-white/[0.04] transition-colors"
            >
              <input
                type="checkbox"
                className="h-3.5 w-3.5 shrink-0 accent-[#d4af37]"
                checked={isVisible}
                onChange={(e) => {
                  const newHidden = e.target.checked
                    ? hiddenBoothIds.filter((id) => id !== booth.id)
                    : [...hiddenBoothIds, booth.id];
                  patchScene({ hiddenBooths: newHidden });
                }}
              />
              <div className="flex-1">
                <span className="block text-[10px] font-medium text-white/80">{booth.name}</span>
                <span className="block text-[8px] text-white/30 font-mono">{booth.id}</span>
              </div>
              <span className={`text-[8px] px-1.5 py-0.5 rounded ${isVisible ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                {isVisible ? 'Visible' : 'Hidden'}
              </span>
            </label>
          );
        })}
      </div>

      <SectionTitle>AI Settings</SectionTitle>
      <div>
        {(import.meta as any).env.VITE_GEMINI_API_KEY ? (
          <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-green-400 text-sm">✓</span>
              <span className="text-[11px] font-medium text-green-400">API Key Configured</span>
            </div>
            <p className="text-[9px] text-white/40">
              Using VITE_GEMINI_API_KEY from .env. Model can still be set in <strong className="text-white/50">Gemini model</strong> below unless <code className="rounded bg-black/30 px-1">VITE_GEMINI_MODEL</code> is set.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-2 p-3 bg-[#d4af37]/10 border border-[#d4af37]/20 rounded-lg">
              <p className="text-[10px] text-[#d4af37] font-medium mb-1">⚠️ Recommended: Use .env file</p>
              <p className="text-[9px] text-white/40">
                Add <code className="bg-black/30 px-1 py-0.5 rounded">VITE_GEMINI_API_KEY=your_key</code> to .env file for better security.
              </p>
            </div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[10px] uppercase tracking-wide text-white/35">Gemini API Key (Optional)</label>
              <button
                onClick={() => setShowApiKey(!showApiKey)}
                className="text-[9px] text-[#d4af37] hover:underline"
              >
                {showApiKey ? 'Hide' : 'Show'}
              </button>
            </div>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-white outline-none focus:border-[#d4af37]/40 font-mono pr-16"
                placeholder="AIza... (or use .env file)"
                value={cfg.aiApiKey || ''}
                onChange={(e) => patchScene({ aiApiKey: e.target.value })}
              />
              {cfg.aiApiKey && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px]">
                  {cfg.aiApiKey.startsWith('AIza') ? '✓' : '⚠️'}
                </span>
              )}
            </div>
            <p className="mt-1 text-[9px] text-white/30 leading-relaxed">
              Get your FREE API key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-[#d4af37] hover:underline">aistudio.google.com/app/apikey</a>. Default model is set under <strong className="text-white/45">Gemini model</strong> below; <code className="bg-black/30 px-1 rounded">VITE_GEMINI_MODEL</code> in <code className="bg-black/30 px-1 rounded">.env</code> overrides it.
            </p>
          </>
        )}
      </div>

      <div className="mt-3 space-y-1.5">
        <label className="block text-[10px] uppercase tracking-wide text-white/35">Gemini model</label>
        <input
          className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-white outline-none focus:border-[#d4af37]/40 font-mono"
          list="gemini-model-presets"
          placeholder="e.g. gemini-2.5-flash"
          value={cfg.aiGeminiModel ?? DEFAULT_SCENE_CONFIG.aiGeminiModel}
          onChange={(e) => {
            const t = e.target.value.trim();
            patchScene({ aiGeminiModel: t || DEFAULT_SCENE_CONFIG.aiGeminiModel });
          }}
        />
        <datalist id="gemini-model-presets">
          <option value="gemini-3.1-flash-lite-preview" />
          <option value="gemini-3-flash-preview" />
          <option value="gemini-2.5-flash" />
          <option value="gemini-2.5-pro" />
          <option value="gemini-2.0-flash" />
          <option value="gemini-2.0-flash-001" />
          <option value="gemini-1.5-flash" />
          <option value="gemini-1.5-pro" />
        </datalist>
        <p className="text-[9px] text-white/30 leading-relaxed">
          Paste any model id your API key can call (see{' '}
          <a href="https://ai.google.dev/gemini-api/docs/models/gemini" target="_blank" rel="noopener noreferrer" className="text-[#d4af37] hover:underline">
            Gemini models
          </a>
          ). If <code className="rounded bg-black/30 px-1 text-[8px]">VITE_GEMINI_MODEL</code> is set in <code className="rounded bg-black/30 px-1 text-[8px]">.env</code>, it wins over this field.
        </p>
      </div>

      <div className="mt-3 space-y-1.5">
        <label className="block text-[10px] uppercase tracking-wide text-white/35">AI deck context (one project only)</label>
        <textarea
          className="w-full min-h-[120px] resize-y rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-[11px] text-white outline-none focus:border-[#d4af37]/40"
          placeholder="Paste facts for this deck only: project name, location, configurations, price band, amenities, timeline, how to book, contact… The AI will stay within this text and won’t invent other projects."
          value={cfg.aiDeckContext ?? ''}
          onChange={(e) => patchScene({ aiDeckContext: e.target.value })}
        />
        <p className="text-[9px] text-white/30 leading-relaxed">
          Leave empty for a general expo assistant. When filled, answers are limited to these facts. If you set{' '}
          <code className="rounded bg-black/30 px-1 text-[8px]">VITE_AI_DECK_CONTEXT</code> in <code className="rounded bg-black/30 px-1 text-[8px]">.env</code>, it overrides this box (useful for production).
        </p>
      </div>

      <SectionTitle>Hall Ambient</SectionTitle>
      <CmsSlider label="Ambient Intensity" value={cfg.hallAmbientIntensity} onChange={(v) => patchScene({ hallAmbientIntensity: v })} min={0} max={2} />
      <CmsColor label="Ambient Color" value={cfg.hallAmbientColor} onChange={(v) => patchScene({ hallAmbientColor: v })} />

      <SectionTitle>Ceiling Light</SectionTitle>
      <CmsSlider label="Intensity" value={cfg.ceilingLightIntensity} onChange={(v) => patchScene({ ceilingLightIntensity: v })} min={0} max={500} step={1} />
      <CmsColor label="Color" value={cfg.ceilingLightColor} onChange={(v) => patchScene({ ceilingLightColor: v })} />

      <SectionTitle>Post-Processing</SectionTitle>
      <CmsSlider label="Bloom Intensity" value={cfg.bloomIntensity} onChange={(v) => patchScene({ bloomIntensity: v })} min={0} max={2} />
      <CmsSlider label="Bloom Threshold" value={cfg.bloomThreshold} onChange={(v) => patchScene({ bloomThreshold: v })} min={0} max={4} />
      <CmsSlider label="Vignette" value={cfg.vignetteIntensity} onChange={(v) => patchScene({ vignetteIntensity: v })} min={0} max={1.5} />

      <SectionTitle>Background</SectionTitle>
      <CmsColor label="Background Color" value={cfg.bgColor} onChange={(v) => patchScene({ bgColor: v })} />

      <div className="pt-3">
        <button className="w-full rounded-lg border border-red-500/20 px-3 py-2 text-[11px] text-red-400/70 hover:bg-red-500/10 transition-colors" onClick={resetScene}>
          Reset Scene to Defaults
        </button>
      </div>
      <p className="mt-2 text-[10px] text-white/25 leading-relaxed">
        Scene changes apply live in the expo. Values: Ambient {DEFAULT_SCENE_CONFIG.hallAmbientIntensity}, Ceiling {DEFAULT_SCENE_CONFIG.ceilingLightIntensity}, Bloom {DEFAULT_SCENE_CONFIG.bloomIntensity}/{DEFAULT_SCENE_CONFIG.bloomThreshold}.
      </p>
    </>
  );
}
