import { useStore } from '../store';
import { DEFAULT_SCENE_CONFIG, mergeSceneConfig, type SceneConfig } from '../data/boothLayouts';
import React, { useMemo } from 'react';

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
  const sceneOverrides = useStore((s) => s.sceneOverrides);
  const patchScene = useStore((s) => s.patchSceneOverride);
  const resetScene = useStore((s) => s.resetSceneOverrides);
  const cfg: SceneConfig = useMemo(() => mergeSceneConfig(sceneOverrides), [sceneOverrides]);
  const [showApiKey, setShowApiKey] = React.useState(false);

  return (
    <>
      <SectionTitle>Performance</SectionTitle>
      <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
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
