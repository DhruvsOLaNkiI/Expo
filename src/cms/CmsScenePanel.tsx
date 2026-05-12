import { useStore } from '../store';
import { DEFAULT_SCENE_CONFIG } from '../data/boothLayouts';

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
  const cfg = useStore((s) => s.getSceneConfig)();
  const patchScene = useStore((s) => s.patchSceneOverride);
  const resetScene = useStore((s) => s.resetSceneOverrides);

  return (
    <>
      <SectionTitle>Hall Ambient</SectionTitle>
      <CmsSlider label="Ambient Intensity" value={cfg.hallAmbientIntensity} onChange={(v) => patchScene({ hallAmbientIntensity: v })} min={0} max={2} />
      <CmsColor label="Ambient Color" value={cfg.hallAmbientColor} onChange={(v) => patchScene({ hallAmbientColor: v })} />

      <SectionTitle>Ceiling Light</SectionTitle>
      <CmsSlider label="Intensity" value={cfg.ceilingLightIntensity} onChange={(v) => patchScene({ ceilingLightIntensity: v })} min={0} max={500} step={1} />
      <CmsColor label="Color" value={cfg.ceilingLightColor} onChange={(v) => patchScene({ ceilingLightColor: v })} />

      <SectionTitle>Fog</SectionTitle>
      <CmsSlider label="Near" value={cfg.fogNear} onChange={(v) => patchScene({ fogNear: v })} min={1} max={100} step={1} />
      <CmsSlider label="Far" value={cfg.fogFar} onChange={(v) => patchScene({ fogFar: v })} min={10} max={300} step={1} />
      <CmsColor label="Fog Color" value={cfg.fogColor} onChange={(v) => patchScene({ fogColor: v })} />

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
