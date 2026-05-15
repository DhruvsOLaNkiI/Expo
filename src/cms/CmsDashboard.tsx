import { useState, useCallback, useMemo, useEffect, useLayoutEffect, useRef } from 'react';
import { useStore } from '../store';
import {
  applyBoothOverrides,
  buildDefaultBoothLayoutList,
  deg3ToRad3,
  rad3ToDeg3,
  siteMapToStorageFields,
  siteMapUrlsFromConfig,
  type BoothLayoutConfig,
  type BoothLayoutPatch,
  type CompanyProfile,
  type BoothLighting,
  type MediaItem,
  type PlacedImage,
  type HostessQuickReply,
} from '../data/boothLayouts';
import { CmsPreview3D } from './CmsPreview3D';
import { CmsScenePanel } from './CmsScenePanel';
import { CtaResourcePopupView } from '../components/CtaResourcePopup';

function num(v: string, fb: number) { const n = parseFloat(v); return Number.isFinite(n) ? n : fb; }

function readFile(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(r.error);
    r.readAsDataURL(file);
  });
}

type Tab = 'layout' | 'branding' | 'images' | 'media' | 'company' | 'lighting' | 'scene';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'layout', label: 'Layout', icon: '⊞' },
  { id: 'branding', label: 'Branding', icon: '◈' },
  { id: 'images', label: 'Images', icon: '◫' },
  { id: 'media', label: 'Media', icon: '▶' },
  { id: 'company', label: 'Company', icon: '◉' },
  { id: 'lighting', label: 'Lighting', icon: '☀' },
  { id: 'scene', label: 'Scene', icon: '⛶' },
];

export function CmsDashboard() {
  const overrides = useStore((s) => s.boothOverrides);
  const patch = useStore((s) => s.patchBoothOverride);
  const resetBooth = useStore((s) => s.resetBoothOverride);
  const resetAll = useStore((s) => s.resetAllBoothOverrides);
  const initCms = useStore((s) => s.initBoothCms);
  const setCmsPage = useStore((s) => s.setCmsPage);
  const boothCmsHydrated = useStore((s) => s._boothCmsHydrated);
  const ctaResourcePopup = useStore((s) => s.ctaResourcePopup);
  const setCtaResourcePopup = useStore((s) => s.setCtaResourcePopup);

  useEffect(() => { void initCms(); }, [initCms]);

  const defaults = useMemo(() => buildDefaultBoothLayoutList(), []);
  const mergedList = useMemo(() => applyBoothOverrides(defaults, overrides), [defaults, overrides]);

  const [selectedId, setSelectedId] = useState(defaults[0]?.id ?? 'vertex-elite');
  const [tab, setTab] = useState<Tab>('layout');
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState('');

  const selected = useMemo(() => mergedList.find((b) => b.id === selectedId), [mergedList, selectedId]);

  const [px, setPx] = useState('0'); const [py, setPy] = useState('0'); const [pz, setPz] = useState('0');
  const [rxDeg, setRxDeg] = useState('0'); const [ryDeg, setRyDeg] = useState('0'); const [rzDeg, setRzDeg] = useState('0');
  const [sx, setSx] = useState('1'); const [sy, setSy] = useState('1'); const [sz, setSz] = useState('1');
  const [name, setName] = useState(''); const [color, setColor] = useState(''); const [accent, setAccent] = useState('');
  const [counterColor, setCounterColor] = useState('');
  const [videoUrl, setVideoUrl] = useState(''); const [headerLogoUrl, setHeaderLogoUrl] = useState('');
  const [description, setDescription] = useState('');
  const [brochureUrl, setBrochureUrl] = useState('');
  const [siteMapSlides, setSiteMapSlides] = useState<string[]>([]);
  const [priceListUrl, setPriceListUrl] = useState('');
  const [company, setCompany] = useState<CompanyProfile>({ companyName: '', tagline: '', website: '', phone: '', email: '', whatsapp: '', facebook: '', instagram: '', twitter: '', brandPrimary: '#d4af37', brandSecondary: '#1a1a1a' });
  const [lighting, setLighting] = useState<BoothLighting>({ spotlightIntensity: 55, spotlightColor: '#ffe7bf', ledStripColor: '#d4af37', ledStripIntensity: 2, emissiveGlow: 0.15, ambientIntensity: 0.35 });
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [placedImages, setPlacedImages] = useState<PlacedImage[]>([]);
  const [placingImageUrl, setPlacingImageUrl] = useState<string | null>(null);
  const [placingLabel, setPlacingLabel] = useState('');
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [hostessQuickReplies, setHostessQuickReplies] = useState<HostessQuickReply[]>([]);

  const loadForm = useCallback((b: BoothLayoutConfig) => {
    setPx(String(b.position[0])); setPy(String(b.position[1])); setPz(String(b.position[2]));
    const [dx, dy, dz] = rad3ToDeg3(b.rotation[0], b.rotation[1], b.rotation[2]);
    setRxDeg(dx.toFixed(2)); setRyDeg(dy.toFixed(2)); setRzDeg(dz.toFixed(2));
    setSx(String(b.scale[0])); setSy(String(b.scale[1])); setSz(String(b.scale[2]));
    setName(b.name); setColor(b.color); setAccent(b.accent); setCounterColor(b.counterColor);
    setVideoUrl(b.videoUrl); setHeaderLogoUrl(b.headerLogoUrl ?? '');
    setDescription(b.description); setBrochureUrl(b.brochureUrl); setSiteMapSlides(siteMapUrlsFromConfig(b)); setPriceListUrl(b.priceListUrl);
    setCompany({ ...b.company }); setLighting({ ...b.lighting }); setMedia([...b.media]);
    setPlacedImages([...(b.placedImages || [])]);
    setHostessQuickReplies([...(b.hostessQuickReplies ?? [])]);
    setPlacingImageUrl(null); setSelectedImageId(null);
  }, []);

  const prevSelectedIdRef = useRef<string | null>(null);
  const prevHydratedRef = useRef(false);
  useEffect(() => {
    const b = mergedList.find((x) => x.id === selectedId);
    if (!b) return;
    const switchedBooth = prevSelectedIdRef.current !== selectedId;
    if (switchedBooth) prevSelectedIdRef.current = selectedId;
    const becameHydrated = boothCmsHydrated && !prevHydratedRef.current;
    if (becameHydrated) prevHydratedRef.current = true;
    if (switchedBooth || becameHydrated) loadForm(b);
  }, [selectedId, mergedList, loadForm, boothCmsHydrated]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2400);
  }, []);

  const persistDocumentField = useCallback(
    async (field: 'brochureUrl' | 'priceListUrl', url: string, label: string) => {
      const ok = await patch(selectedId, { [field]: url } as BoothLayoutPatch);
      if (ok) showToast(`${label} saved to expo`);
      else showToast('Could not save (browser storage full). Try /maps/… in public/ or remove large Media gallery items.');
    },
    [patch, selectedId, showToast],
  );

  const persistSiteMapSlides = useCallback(
    async (next: string[]) => {
      const { siteMapUrl, siteMapGallery } = siteMapToStorageFields(next);
      setSiteMapSlides(siteMapUrlsFromConfig({ siteMapUrl, siteMapGallery }));
      const ok = await patch(selectedId, { siteMapUrl, siteMapGallery });
      if (ok) showToast('Site map saved to expo');
      else showToast('Could not save (browser storage full). Use /maps/… paths or fewer large uploads.');
    },
    [patch, selectedId, showToast],
  );

  const switchSiteMapToBundledPublicPath = useCallback(async () => {
    await persistSiteMapSlides(['/maps/site-map.svg']);
  }, [persistSiteMapSlides]);

  const handleApply = async () => {
    const sm = siteMapToStorageFields(siteMapSlides);
    const hqFiltered = hostessQuickReplies.filter((x) => x.label.trim() && (x.response.trim() || x.action === 'askAi'));
    const ok = await patch(selectedId, {
      position: [num(px, 0), num(py, 0), num(pz, 0)],
      rotation: deg3ToRad3(num(rxDeg, 0), num(ryDeg, 0), num(rzDeg, 0)),
      scale: [num(sx, 1), num(sy, 1), num(sz, 1)],
      name: name.trim() || undefined,
      color: color.trim() || undefined,
      accent: accent.trim() || undefined,
      counterColor: counterColor.trim() || undefined,
      videoUrl: videoUrl.trim() || undefined,
      headerLogoUrl: headerLogoUrl.trim() || undefined,
      description,
      brochureUrl, siteMapUrl: sm.siteMapUrl, siteMapGallery: sm.siteMapGallery, priceListUrl,
      company, lighting, media, placedImages,
      hostessQuickReplies: hqFiltered,
    });
    if (ok) {
      setSiteMapSlides(siteMapUrlsFromConfig({ siteMapUrl: sm.siteMapUrl, siteMapGallery: sm.siteMapGallery }));
      setHostessQuickReplies(hqFiltered);
      showToast('Changes applied & saved');
    } else showToast('Could not persist booth data (localStorage and IndexedDB). Export JSON or use /maps/… paths.');
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify({ booths: overrides, scene: useStore.getState().sceneOverrides }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'booth-cms-export.json'; a.click();
    URL.revokeObjectURL(a.href);
    showToast('Exported JSON');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      void (async () => {
        try {
          const j = JSON.parse(String(reader.result));
          const src = j?.booths || j?.overrides;
          if (src && typeof src === 'object') {
            for (const [id, p] of Object.entries(src)) {
              if (p && typeof p === 'object') await patch(id, p as BoothLayoutPatch);
            }
          }
          if (j?.scene) useStore.getState().patchSceneOverride(j.scene);
          showToast('Imported successfully');
        } catch {
          showToast('Invalid JSON file');
        }
      })();
    };
    reader.readAsText(file); e.target.value = '';
  };

  const filteredBooths = mergedList.filter((b) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return b.id.toLowerCase().includes(q) || b.name.toLowerCase().includes(q);
  });

  const handleSurfaceClick = useCallback((pos: [number, number, number], normal: [number, number, number]) => {
    if (!placingImageUrl) return;
    const ry = Math.atan2(normal[0], normal[2]);
    const rx = -Math.asin(normal[1]);
    const nudge = 0.02;
    const newImg: PlacedImage = {
      id: `pi-${Date.now()}`,
      url: placingImageUrl,
      label: placingLabel || 'image',
      position: [pos[0] + normal[0] * nudge, pos[1] + normal[1] * nudge, pos[2] + normal[2] * nudge],
      rotation: [rx, ry, 0],
      size: [2, 1.5],
    };
    setPlacedImages((prev) => [...prev, newImg]);
    setPlacingImageUrl(null);
    setPlacingLabel('');
    setSelectedImageId(newImg.id);
    showToast('Image placed — drag to reposition, adjust size in panel');
  }, [placingImageUrl, placingLabel]);

  const handleDragImage = useCallback((id: string, pos: [number, number, number]) => {
    setPlacedImages((prev) => prev.map((p) => p.id === id ? { ...p, position: pos } : p));
  }, []);

  const removePlacedImage = (id: string) => {
    setPlacedImages((prev) => prev.filter((p) => p.id !== id));
    if (selectedImageId === id) setSelectedImageId(null);
  };

  const updatePlacedImage = (id: string, patch: Partial<PlacedImage>) => {
    setPlacedImages((prev) => prev.map((p) => p.id === id ? { ...p, ...patch } : p));
  };

  const addMediaItem = async (file: File, type: MediaItem['type']) => {
    const url = await readFile(file);
    setMedia((prev) => [...prev, { id: `m-${Date.now()}`, type, url, label: file.name }]);
  };

  const removeMediaItem = (id: string) => { setMedia((prev) => prev.filter((m) => m.id !== id)); };

  const siteMapFields = useMemo(() => siteMapToStorageFields(siteMapSlides), [siteMapSlides]);

  return (
    <div className="fixed inset-0 z-[100] flex bg-[#0a0a0f] text-white font-sans select-none">
      {/* Sidebar */}
      <aside className="flex w-64 shrink-0 flex-col border-r border-white/[0.06] bg-[#0d0d14]">
        <div className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-4">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#d4af37] to-[#b08d29] flex items-center justify-center text-black text-sm font-bold">E</div>
          <div>
            <h1 className="text-sm font-bold tracking-wide text-[#d4af37]">EXPO CMS</h1>
            <p className="text-[10px] text-white/40">Virtual Residential Expo</p>
          </div>
        </div>
        <div className="px-3 pt-3 pb-2">
          <input
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-white placeholder-white/30 outline-none focus:border-[#d4af37]/40"
            placeholder="Search booths…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
          {filteredBooths.map((b) => (
            <button
              key={b.id}
              className={`group w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition-all ${b.id === selectedId ? 'bg-[#d4af37]/15 text-[#d4af37]' : 'text-white/60 hover:bg-white/[0.04] hover:text-white/80'}`}
              onClick={() => setSelectedId(b.id)}
            >
              <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${b.id === selectedId ? 'bg-[#d4af37]' : 'bg-white/20'}`} style={{ backgroundColor: b.id === selectedId ? b.accent : undefined }} />
              <div className="min-w-0">
                <div className="truncate text-xs font-semibold">{b.name}</div>
                <div className="truncate text-[10px] text-white/30">{b.id}</div>
              </div>
            </button>
          ))}
        </div>
        <div className="space-y-1 border-t border-white/[0.06] p-3">
          <button className="w-full rounded-lg bg-[#d4af37]/10 px-3 py-2 text-[11px] font-semibold text-[#d4af37] hover:bg-[#d4af37]/20 transition-colors" onClick={handleExport}>
            Export JSON
          </button>
          <label className="block w-full cursor-pointer rounded-lg border border-white/[0.08] px-3 py-2 text-center text-[11px] text-white/50 hover:bg-white/[0.04] transition-colors">
            Import JSON
            <input type="file" accept=".json" className="hidden" onChange={handleImport} />
          </label>
          <button className="w-full rounded-lg border border-red-500/20 px-3 py-2 text-[11px] text-red-400/70 hover:bg-red-500/10 transition-colors" onClick={() => void resetAll()}>
            Reset All Booths
          </button>
          <button className="w-full rounded-lg border border-white/[0.08] px-3 py-2 text-[11px] text-white/50 hover:bg-white/[0.04] transition-colors" onClick={() => setCmsPage('expo')}>
            ← Back to Expo
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center justify-between border-b border-white/[0.06] bg-[#0d0d14]/80 px-6 py-3 backdrop-blur-lg">
          <div className="flex items-center gap-4">
            <h2 className="text-base font-bold tracking-wider">{name || 'Select a booth'}</h2>
            <span className="rounded bg-white/[0.06] px-2 py-0.5 text-[10px] text-white/40 font-mono">{selectedId}</span>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-[11px] text-white/50 hover:bg-white/[0.05] transition-colors" onClick={() => void resetBooth(selectedId)}>
              Reset Booth
            </button>
            <button type="button" className="rounded-lg bg-gradient-to-r from-[#d4af37] to-[#b08d29] px-5 py-1.5 text-xs font-bold text-black hover:brightness-110 transition-all shadow-lg shadow-[#d4af37]/20" onClick={() => void handleApply()}>
              Apply Changes
            </button>
          </div>
        </header>

        {/* Tabs */}
        <div className="flex border-b border-white/[0.06] bg-[#0d0d14]/50 px-6">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-3 text-xs font-medium transition-all border-b-2 ${tab === t.id ? 'border-[#d4af37] text-[#d4af37]' : 'border-transparent text-white/40 hover:text-white/60'}`}
            >
              <span className="mr-1.5">{t.icon}</span>{t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* 3D Preview */}
          <div className="flex-1 min-w-0 relative">
            {selected && (
              <CmsPreview3D
                boothId={selectedId}
                name={name}
                color={color}
                accent={accent}
                counterColor={counterColor}
                videoUrl={videoUrl}
                headerLogoUrl={headerLogoUrl}
                lighting={lighting}
                placedImages={placedImages}
                placingImageUrl={placingImageUrl}
                onSurfaceClick={handleSurfaceClick}
                selectedImageId={selectedImageId}
                onSelectImage={setSelectedImageId}
                onDragImage={handleDragImage}
                brochureUrl={brochureUrl}
                priceListUrl={priceListUrl}
                siteMapUrl={siteMapFields.siteMapUrl}
                siteMapGallery={siteMapFields.siteMapGallery}
                hostessQuickReplies={hostessQuickReplies}
              />
            )}
          </div>

          {/* Properties panel */}
          <div className="w-80 shrink-0 border-l border-white/[0.06] bg-[#0d0d14] overflow-y-auto">
            <div className="p-5 space-y-4">
              {tab === 'layout' && <LayoutTab px={px} setPx={setPx} py={py} setPy={setPy} pz={pz} setPz={setPz} rxDeg={rxDeg} setRxDeg={setRxDeg} ryDeg={ryDeg} setRyDeg={setRyDeg} rzDeg={rzDeg} setRzDeg={setRzDeg} sx={sx} setSx={setSx} sy={sy} setSy={setSy} sz={sz} setSz={setSz} />}
              {tab === 'branding' && (
                <BrandingTab
                  name={name}
                  setName={setName}
                  color={color}
                  setColor={setColor}
                  accent={accent}
                  setAccent={setAccent}
                  counterColor={counterColor}
                  setCounterColor={setCounterColor}
                  videoUrl={videoUrl}
                  setVideoUrl={setVideoUrl}
                  headerLogoUrl={headerLogoUrl}
                  setHeaderLogoUrl={setHeaderLogoUrl}
                  description={description}
                  setDescription={setDescription}
                  hostessQuickReplies={hostessQuickReplies}
                  setHostessQuickReplies={setHostessQuickReplies}
                />
              )}
              {tab === 'images' && <ImagesTab placedImages={placedImages} placingImageUrl={placingImageUrl} setPlacingImageUrl={setPlacingImageUrl} setPlacingLabel={setPlacingLabel} selectedImageId={selectedImageId} setSelectedImageId={setSelectedImageId} removePlacedImage={removePlacedImage} updatePlacedImage={updatePlacedImage} />}
              {tab === 'media' && (
                <MediaTab
                  media={media}
                  addMediaItem={addMediaItem}
                  removeMediaItem={removeMediaItem}
                  brochureUrl={brochureUrl}
                  setBrochureUrl={setBrochureUrl}
                  siteMapSlides={siteMapSlides}
                  setSiteMapSlides={setSiteMapSlides}
                  persistSiteMapSlides={persistSiteMapSlides}
                  priceListUrl={priceListUrl}
                  setPriceListUrl={setPriceListUrl}
                  persistDocumentField={persistDocumentField}
                  onUseBundledSiteMapPath={switchSiteMapToBundledPublicPath}
                />
              )}
              {tab === 'company' && <CompanyTab company={company} setCompany={setCompany} />}
              {tab === 'lighting' && <LightingTab lighting={lighting} setLighting={setLighting} />}
              {tab === 'scene' && <CmsScenePanel />}
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] rounded-xl border border-[#d4af37]/30 bg-[#1a1a22]/95 px-5 py-2.5 text-xs font-medium text-[#d4af37] shadow-2xl backdrop-blur-lg animate-[fadeInUp_0.3s_ease]">
          {toast}
        </div>
      )}

      {ctaResourcePopup && (
        <CtaResourcePopupView
          popup={ctaResourcePopup}
          onClose={() => setCtaResourcePopup(null)}
          overlayClassName="fixed inset-0 z-[220] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm pointer-events-auto"
        />
      )}
    </div>
  );
}

/* ─── Sub-panels ─── */

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[11px] font-bold uppercase tracking-widest text-white/30 mb-2">{children}</h3>;
}

function CmsField({ label, value, onChange, type = 'text', placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] uppercase tracking-wide text-white/35">{label}</label>
      <input
        type={type}
        className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-white outline-none focus:border-[#d4af37]/40 transition-colors placeholder-white/20"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
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

function UploadButton({ label, accept, onFile }: { label: string; accept: string; onFile: (f: File) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-white/[0.12] bg-white/[0.02] px-3 py-3 text-[11px] text-white/40 hover:border-[#d4af37]/30 hover:text-white/60 transition-colors">
      <span className="text-base">+</span> {label}
      <input type="file" accept={accept} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
    </label>
  );
}

function UploadFilesButton({ label, accept, onFiles }: { label: string; accept: string; onFiles: (files: File[]) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-white/[0.12] bg-white/[0.02] px-3 py-3 text-[11px] text-white/40 hover:border-[#d4af37]/30 hover:text-white/60 transition-colors">
      <span className="text-base">+</span> {label}
      <input
        type="file"
        accept={accept}
        multiple
        className="hidden"
        onChange={(e) => {
          const files = [...(e.target.files || [])];
          if (files.length) onFiles(files);
          e.target.value = '';
        }}
      />
    </label>
  );
}

/* ─── LAYOUT TAB ─── */
function LayoutTab({ px, setPx, py, setPy, pz, setPz, rxDeg, setRxDeg, ryDeg, setRyDeg, rzDeg, setRzDeg, sx, setSx, sy, setSy, sz, setSz }: {
  px: string; setPx: (v: string) => void; py: string; setPy: (v: string) => void; pz: string; setPz: (v: string) => void;
  rxDeg: string; setRxDeg: (v: string) => void; ryDeg: string; setRyDeg: (v: string) => void; rzDeg: string; setRzDeg: (v: string) => void;
  sx: string; setSx: (v: string) => void; sy: string; setSy: (v: string) => void; sz: string; setSz: (v: string) => void;
}) {
  return (
    <>
      <SectionTitle>Position</SectionTitle>
      <div className="grid grid-cols-3 gap-2">
        <CmsField label="X" value={px} onChange={setPx} />
        <CmsField label="Y" value={py} onChange={setPy} />
        <CmsField label="Z" value={pz} onChange={setPz} />
      </div>
      <SectionTitle>Rotation (degrees)</SectionTitle>
      <div className="grid grid-cols-3 gap-2">
        <CmsField label="X°" value={rxDeg} onChange={setRxDeg} />
        <CmsField label="Y°" value={ryDeg} onChange={setRyDeg} />
        <CmsField label="Z°" value={rzDeg} onChange={setRzDeg} />
      </div>
      <SectionTitle>Scale</SectionTitle>
      <div className="grid grid-cols-3 gap-2">
        <CmsField label="X" value={sx} onChange={setSx} />
        <CmsField label="Y" value={sy} onChange={setSy} />
        <CmsField label="Z" value={sz} onChange={setSz} />
      </div>
    </>
  );
}

/* ─── HOSTESS QUICK REPLIES (Branding tab) ─── */
function HostessQuickRepliesEditor({
  items,
  setItems,
}: {
  items: HostessQuickReply[];
  setItems: (next: HostessQuickReply[]) => void;
}) {
  const add = () => setItems([...items, { id: `hq-${Date.now()}`, label: '', response: '' }]);
  const remove = (id: string) => setItems(items.filter((x) => x.id !== id));
  const patchRow = (id: string, field: 'label' | 'response', v: string) =>
    setItems(items.map((x) => (x.id === id ? { ...x, [field]: v } : x)));
  const setAskAi = (id: string, enabled: boolean) =>
    setItems(
      items.map((x) =>
        x.id === id
          ? enabled
            ? { ...x, action: 'askAi' as const }
            : { ...x, action: undefined }
          : x,
      ),
    );

  return (
    <>
      <SectionTitle>Hostess quick replies</SectionTitle>
      <p className="mb-2 text-[9px] leading-relaxed text-white/35">
        When a visitor stands near the booth hostess, they see these chips after “How can I help you?”. Each row needs a chip label; add an answer, or enable “Ask AI” to open the AI chat instead of a fixed reply. Use <span className="text-[#d4af37]/80">Apply Changes</span> to save.
      </p>
      <ul className="max-h-56 space-y-2 overflow-y-auto pr-0.5">
        {items.map((row) => (
          <li key={row.id} className="space-y-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] p-2">
            <CmsField label="Chip label" value={row.label} onChange={(v) => patchRow(row.id, 'label', v)} placeholder="e.g. Pricing" />
            <label className="flex cursor-pointer items-center gap-2 text-[10px] text-white/55">
              <input
                type="checkbox"
                className="accent-[#d4af37]"
                checked={row.action === 'askAi'}
                onChange={(e) => setAskAi(row.id, e.target.checked)}
              />
              Opens Ask AI chat (no fixed answer / voice)
            </label>
            <div className={row.action === 'askAi' ? 'pointer-events-none opacity-40' : ''}>
              <label className="mb-0.5 block text-[10px] uppercase tracking-wide text-white/35">Answer (spoken + shown)</label>
              <textarea
                className="w-full resize-none rounded-lg border border-white/[0.08] bg-white/[0.04] px-2 py-1.5 text-[11px] text-white outline-none focus:border-[#d4af37]/40 h-16"
                value={row.response}
                onChange={(e) => patchRow(row.id, 'response', e.target.value)}
                placeholder="Short reply the hostess says…"
                disabled={row.action === 'askAi'}
              />
            </div>
            <button type="button" className="text-[10px] text-red-400/70 hover:text-red-400" onClick={() => remove(row.id)}>
              Remove
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="mt-2 w-full rounded-lg border border-white/15 py-2 text-[11px] text-white/50 hover:bg-white/[0.04]" onClick={add}>
        + Add option
      </button>
    </>
  );
}

/* ─── BRANDING TAB ─── */
function BrandingTab({
  name, setName, color, setColor, accent, setAccent, counterColor, setCounterColor, videoUrl, setVideoUrl, headerLogoUrl, setHeaderLogoUrl, description, setDescription,
  hostessQuickReplies, setHostessQuickReplies,
}: {
  name: string; setName: (v: string) => void; color: string; setColor: (v: string) => void; accent: string; setAccent: (v: string) => void;
  counterColor: string; setCounterColor: (v: string) => void; videoUrl: string; setVideoUrl: (v: string) => void;
  headerLogoUrl: string; setHeaderLogoUrl: (v: string) => void; description: string; setDescription: (v: string) => void;
  hostessQuickReplies: HostessQuickReply[];
  setHostessQuickReplies: (next: HostessQuickReply[]) => void;
}) {
  return (
    <>
      <SectionTitle>Identity</SectionTitle>
      <CmsField label="Booth Name" value={name} onChange={setName} />
      <div>
        <label className="mb-1 block text-[10px] uppercase tracking-wide text-white/35">Description</label>
        <textarea className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-white outline-none focus:border-[#d4af37]/40 resize-none h-20" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <HostessQuickRepliesEditor items={hostessQuickReplies} setItems={setHostessQuickReplies} />
      <SectionTitle>Colors</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <CmsColor label="Wall" value={color} onChange={setColor} />
        <CmsColor label="Accent" value={accent} onChange={setAccent} />
        <CmsColor label="Counter" value={counterColor} onChange={setCounterColor} />
      </div>
      <SectionTitle>Screen Content</SectionTitle>
      <CmsField label="LED Screen URL (video/image)" value={videoUrl} onChange={setVideoUrl} />
      <UploadButton label="Upload screen image" accept="image/*" onFile={async (f) => setVideoUrl(await readFile(f))} />
      <SectionTitle>Header Logo</SectionTitle>
      <CmsField label="Logo URL" value={headerLogoUrl} onChange={setHeaderLogoUrl} placeholder="/assets/logo.png" />
      <UploadButton label="Upload logo" accept="image/*" onFile={async (f) => setHeaderLogoUrl(await readFile(f))} />
      {headerLogoUrl && (
        <div className="mt-2 rounded-lg border border-white/[0.08] bg-white/[0.04] p-2">
          <img src={headerLogoUrl} alt="logo" className="mx-auto max-h-16 object-contain" />
        </div>
      )}
    </>
  );
}

/** Right-column thumbnail in Media → Documents (site map / price list images; PDF hint for brochure). */
function CmsMediaPreviewThumb({ url }: { url: string }) {
  const [rasterError, setRasterError] = useState(false);
  const u = url.trim();

  useLayoutEffect(() => {
    setRasterError(false);
  }, [u]);

  if (!u) {
    return (
      <div className="flex h-[5.5rem] w-[5.5rem] flex-col items-center justify-center rounded-lg border border-dashed border-white/10 bg-white/[0.02] px-1 text-center">
        <span className="text-[9px] uppercase tracking-wide text-white/25">Empty</span>
      </div>
    );
  }

  const lower = u.toLowerCase();
  const isPdf = /\.pdf(\?|#|$)/i.test(u) || lower.startsWith('data:application/pdf');
  if (isPdf) {
    return (
      <div className="flex h-[5.5rem] w-[5.5rem] flex-col items-center justify-center rounded-lg border border-white/10 bg-black/45 text-center">
        <span className="text-[11px] font-bold text-red-300/90">PDF</span>
        <span className="mt-1 px-1 text-[8px] leading-snug text-white/35">Opens in new tab from kiosk</span>
      </div>
    );
  }

  const isSvg = /\.svg(\?|#|$)/i.test(u) || /^data:image\/svg\+xml/i.test(u);
  const remote = /^https?:\/\//i.test(u);

  if (isSvg) {
    return (
      <div className="flex h-[5.5rem] w-[5.5rem] items-center justify-center overflow-hidden rounded-lg border border-white/[0.08] bg-black/50">
        <object type="image/svg+xml" data={u} title="Preview" className="max-h-full max-w-full" />
      </div>
    );
  }

  if (rasterError) {
    return (
      <div className="flex h-[5.5rem] w-[5.5rem] flex-col items-center justify-center rounded-lg border border-amber-500/20 bg-amber-500/5 px-1 text-center">
        <span className="text-[8px] leading-snug text-amber-200/80">Could not load preview</span>
      </div>
    );
  }

  return (
    <div className="flex h-[5.5rem] w-[5.5rem] items-center justify-center overflow-hidden rounded-lg border border-white/[0.08] bg-black/50">
      <img
        src={u}
        alt=""
        className="max-h-full max-w-full object-contain"
        referrerPolicy={remote ? 'no-referrer' : undefined}
        onError={() => setRasterError(true)}
      />
    </div>
  );
}

function CmsDocFieldWithPreview({
  label, value, onChange, placeholder, uploadLabel, uploadAccept, onUploadFile, previewColumnTitle = 'View image',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  uploadLabel: string;
  uploadAccept: string;
  onUploadFile: (f: File) => void;
  /** Shown above the thumbnail column (e.g. "Preview" for PDF brochure). */
  previewColumnTitle?: string;
}) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="flex gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <CmsField label={label} value={value} onChange={onChange} placeholder={placeholder} />
          <UploadButton label={uploadLabel} accept={uploadAccept} onFile={onUploadFile} />
        </div>
        <div className="flex shrink-0 flex-col items-center border-l border-white/[0.06] pl-3">
          <span className="mb-1.5 whitespace-nowrap text-[9px] font-semibold uppercase tracking-wider text-[#d4af37]/80">{previewColumnTitle}</span>
          <CmsMediaPreviewThumb url={value} />
        </div>
      </div>
    </div>
  );
}

function MediaGalleryThumb({ m, onOpen }: { m: MediaItem; onOpen: () => void }) {
  const remote = /^https?:\/\//i.test(m.url.trim());
  if (m.type === 'image') {
    const isSvg = /\.svg(\?|#|$)/i.test(m.url) || /^data:image\/svg\+xml/i.test(m.url);
    return (
      <button
        type="button"
        onClick={onOpen}
        className="group relative h-11 w-11 shrink-0 overflow-hidden rounded-md border border-white/10 bg-black/50 outline-none transition ring-[#d4af37]/0 hover:ring-2 hover:ring-[#d4af37]/40 focus-visible:ring-2 focus-visible:ring-[#d4af37]/50"
        title="View larger"
      >
        {isSvg ? (
          <object type="image/svg+xml" data={m.url} className="pointer-events-none h-full w-full" aria-hidden />
        ) : (
          <img src={m.url} alt="" className="h-full w-full object-cover" referrerPolicy={remote ? 'no-referrer' : undefined} />
        )}
        <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/70 py-0.5 text-[7px] font-semibold uppercase text-[#d4af37] opacity-0 transition group-hover:opacity-100">View</span>
      </button>
    );
  }
  if (m.type === 'video') {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="group relative h-11 w-14 shrink-0 overflow-hidden rounded-md border border-white/10 bg-black outline-none transition hover:ring-2 hover:ring-[#d4af37]/40 focus-visible:ring-2 focus-visible:ring-[#d4af37]/50"
        title="View larger"
      >
        <video src={m.url} muted playsInline preload="metadata" className="pointer-events-none h-full w-full object-cover" />
        <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/70 py-0.5 text-[7px] font-semibold uppercase text-[#d4af37] opacity-0 transition group-hover:opacity-100">View</span>
      </button>
    );
  }
  if (m.type === 'pdf') {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-md border border-white/10 bg-red-950/35 text-[8px] font-bold uppercase text-red-200/90 outline-none transition hover:ring-2 hover:ring-[#d4af37]/40"
        title="Open preview"
      >
        PDF
      </button>
    );
  }
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-white/10 bg-emerald-950/30 text-[8px] font-bold leading-tight text-emerald-200/90 text-center px-0.5" title="3D model (preview in GLB viewer separately)">
      3D
    </div>
  );
}

/* ─── MEDIA TAB ─── */
function MediaTab({ media, addMediaItem, removeMediaItem, brochureUrl, setBrochureUrl, siteMapSlides, setSiteMapSlides, persistSiteMapSlides, priceListUrl, setPriceListUrl, persistDocumentField, onUseBundledSiteMapPath }: {
  media: MediaItem[]; addMediaItem: (f: File, t: MediaItem['type']) => void; removeMediaItem: (id: string) => void;
  brochureUrl: string; setBrochureUrl: (v: string) => void;
  siteMapSlides: string[];
  setSiteMapSlides: (v: string[] | ((prev: string[]) => string[])) => void;
  persistSiteMapSlides: (urls: string[]) => Promise<void>;
  priceListUrl: string; setPriceListUrl: (v: string) => void;
  persistDocumentField: (field: 'brochureUrl' | 'priceListUrl', url: string, label: string) => Promise<void>;
  onUseBundledSiteMapPath: () => void;
}) {
  const [galleryPreview, setGalleryPreview] = useState<MediaItem | null>(null);
  const remotePreview = galleryPreview ? /^https?:\/\//i.test(galleryPreview.url.trim()) : false;
  const galleryDataUrlChars = useMemo(
    () => media.reduce((acc, m) => acc + (/^data:/i.test(m.url) ? m.url.length : 0), 0),
    [media],
  );
  const siteMapHasHeavyDataUrl = useMemo(
    () => siteMapSlides.some((u) => /^data:image\//i.test(u.trim()) && u.length > 20_000),
    [siteMapSlides],
  );

  return (
    <>
      <SectionTitle>Media Gallery</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        <UploadButton label="Image" accept="image/*" onFile={(f) => addMediaItem(f, 'image')} />
        <UploadButton label="Video" accept="video/*" onFile={(f) => addMediaItem(f, 'video')} />
        <UploadButton label="PDF" accept=".pdf" onFile={(f) => addMediaItem(f, 'pdf')} />
        <UploadButton label="3D Model" accept=".glb,.gltf" onFile={(f) => addMediaItem(f, 'model')} />
      </div>
      {media.length > 0 && (
        <div className="mt-3 overflow-hidden rounded-lg border border-white/[0.06]">
          <div className="grid grid-cols-[auto_minmax(0,1fr)_3.25rem_auto] items-center gap-2 border-b border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-[9px] font-semibold uppercase tracking-wider text-white/35">
            <span>Type</span>
            <span>Uploaded file</span>
            <span className="text-center">View</span>
            <span className="w-6" />
          </div>
          <ul className="divide-y divide-white/[0.06]">
            {media.map((m) => (
              <li key={m.id} className="grid grid-cols-[auto_minmax(0,1fr)_3.25rem_auto] items-center gap-2 bg-white/[0.02] px-3 py-2">
                <span className={`justify-self-start text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${m.type === 'image' ? 'bg-blue-500/20 text-blue-300' : m.type === 'video' ? 'bg-purple-500/20 text-purple-300' : m.type === 'pdf' ? 'bg-red-500/20 text-red-300' : 'bg-green-500/20 text-green-300'}`}>{m.type}</span>
                <span className="min-w-0 truncate text-[11px] text-white/55" title={m.label}>{m.label}</span>
                <div className="flex justify-center">
                  <MediaGalleryThumb m={m} onOpen={() => setGalleryPreview(m)} />
                </div>
                <button type="button" className="justify-self-end text-[10px] text-red-400/50 hover:text-red-400" onClick={() => removeMediaItem(m.id)} aria-label="Remove">✕</button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {galleryDataUrlChars > 150_000 && (
        <p className="mt-2 rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-[10px] leading-relaxed text-amber-100/90">
          Media gallery holds large embedded files (~{Math.round(galleryDataUrlChars / 1024)} KB of data URLs). They share the same browser storage limit as documents. Remove rows you do not need (✕), then Apply Changes.
        </p>
      )}

      {galleryPreview && (
        <div
          role="presentation"
          className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setGalleryPreview(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Preview ${galleryPreview.label}`}
            className="relative max-h-[90vh] max-w-[min(96vw,900px)] overflow-hidden rounded-xl border border-[#d4af37]/35 bg-[#0a0a10] p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="absolute right-3 top-3 z-10 rounded p-1 text-white/50 hover:bg-white/10 hover:text-white"
              onClick={() => setGalleryPreview(null)}
              aria-label="Close preview"
            >
              ✕
            </button>
            <p className="mb-3 truncate pr-10 text-xs font-medium text-[#d4af37]">{galleryPreview.label}</p>
            <div className="max-h-[min(78vh,720px)] overflow-auto rounded-lg border border-white/10 bg-black/40">
              {galleryPreview.type === 'image' && (
                /\.svg(\?|#|$)/i.test(galleryPreview.url) || /^data:image\/svg\+xml/i.test(galleryPreview.url) ? (
                  <object type="image/svg+xml" data={galleryPreview.url} title={galleryPreview.label} className="mx-auto block max-h-[72vh] w-full max-w-full" />
                ) : (
                  <img
                    src={galleryPreview.url}
                    alt={galleryPreview.label}
                    className="mx-auto block max-h-[72vh] w-auto max-w-full object-contain"
                    referrerPolicy={remotePreview ? 'no-referrer' : undefined}
                  />
                )
              )}
              {galleryPreview.type === 'video' && (
                <video src={galleryPreview.url} controls playsInline className="mx-auto block max-h-[72vh] w-full max-w-full" />
              )}
              {galleryPreview.type === 'pdf' && (
                <iframe title={galleryPreview.label} src={galleryPreview.url} className="h-[min(72vh,640px)] w-full min-w-[min(90vw,720px)] rounded bg-white" />
              )}
              {galleryPreview.type === 'model' && (
                <p className="p-8 text-center text-sm text-white/50">GLB / GLTF preview is not embedded here. Download from your files or open the asset URL in a 3D viewer.</p>
              )}
            </div>
          </div>
        </div>
      )}
      <SectionTitle>Documents</SectionTitle>
      <p className="mb-2 text-[10px] leading-relaxed text-white/35">
        Site map: add multiple images (carousel at the kiosk). Put files in <span className="font-mono text-white/45">public/maps/</span> and use paths like <span className="font-mono text-white/45">/maps/a.png</span>. If <span className="font-mono text-white/45">localStorage</span> is full, booth data uses <span className="font-mono text-white/45">IndexedDB</span>. Uploads save immediately; other tabs need <span className="text-[#d4af37]/80">Apply Changes</span>.
      </p>
      <div className="space-y-3">
        <CmsDocFieldWithPreview
          label="Brochure URL"
          value={brochureUrl}
          onChange={setBrochureUrl}
          placeholder="/assets/brochure.pdf"
          uploadLabel="Upload brochure"
          uploadAccept=".pdf"
          onUploadFile={async (f) => {
            const url = await readFile(f);
            setBrochureUrl(url);
            await persistDocumentField('brochureUrl', url, 'Brochure');
          }}
          previewColumnTitle="Preview"
        />
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
          <div className="mb-2">
            <span className="mb-0.5 block text-[10px] uppercase tracking-wide text-white/45">Site map images</span>
            <p className="text-[9px] leading-relaxed text-white/30">Order = carousel order. Use <span className="font-mono text-white/40">Add image(s)</span> for multi-upload, or paste paths; click <span className="font-mono text-white/40">Apply Changes</span> after editing URLs.</p>
          </div>
          {siteMapSlides.length === 0 ? (
            <p className="mb-2 text-[10px] text-white/35">No images yet — add one or use the bundled SVG.</p>
          ) : (
            <ul className="max-h-64 space-y-2 overflow-y-auto pr-0.5">
              {siteMapSlides.map((url, i) => (
                <li key={`sm-${i}`} className="flex gap-2 rounded-md border border-white/[0.06] bg-black/25 p-2">
                  <div className="shrink-0 pt-0.5">
                    <CmsMediaPreviewThumb url={url} />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <CmsField
                      label={`Slide ${i + 1}`}
                      value={url}
                      onChange={(v) => setSiteMapSlides((prev) => { const n = [...prev]; n[i] = v; return n; })}
                      placeholder="/maps/floor-1.png"
                    />
                    <button
                      type="button"
                      className="text-[9px] text-red-400/70 hover:text-red-400"
                      onClick={() => void persistSiteMapSlides(siteMapSlides.filter((_, j) => j !== i))}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <UploadFilesButton
              label="Add image(s)"
              accept="image/*"
              onFiles={async (files) => {
                const urls = await Promise.all(files.map((f) => readFile(f)));
                await persistSiteMapSlides([...siteMapSlides, ...urls]);
              }}
            />
            <button
              type="button"
              className="rounded-lg border border-white/15 px-3 py-2.5 text-[11px] text-white/45 hover:bg-white/[0.04]"
              onClick={() => setSiteMapSlides((prev) => [...prev, ''])}
            >
              + URL row
            </button>
          </div>
        </div>
        {siteMapHasHeavyDataUrl && (
          <div className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2.5">
            <p className="mb-2 text-[10px] leading-relaxed text-amber-100/95">
              Long data URLs can fill browser storage. Prefer files under <span className="font-mono text-amber-200/95">public/maps/</span> with short paths.
            </p>
            <button
              type="button"
              className="rounded-lg bg-amber-500/25 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber-100 ring-1 ring-amber-400/40 hover:bg-amber-500/35"
              onClick={() => void onUseBundledSiteMapPath()}
            >
              Use bundled /maps/site-map.svg
            </button>
          </div>
        )}
        <CmsDocFieldWithPreview
          label="Price List URL"
          value={priceListUrl}
          onChange={setPriceListUrl}
          placeholder="/assets/pricelist.png"
          uploadLabel="Upload price list"
          uploadAccept="image/*"
          onUploadFile={async (f) => {
            const url = await readFile(f);
            setPriceListUrl(url);
            await persistDocumentField('priceListUrl', url, 'Price list');
          }}
        />
      </div>
    </>
  );
}

/* ─── COMPANY TAB ─── */
function CompanyTab({ company, setCompany }: { company: CompanyProfile; setCompany: (c: CompanyProfile) => void }) {
  const upd = (k: keyof CompanyProfile, v: string) => setCompany({ ...company, [k]: v });
  return (
    <>
      <SectionTitle>Company Info</SectionTitle>
      <CmsField label="Company Name" value={company.companyName} onChange={(v) => upd('companyName', v)} />
      <CmsField label="Tagline" value={company.tagline} onChange={(v) => upd('tagline', v)} />
      <CmsField label="Website" value={company.website} onChange={(v) => upd('website', v)} placeholder="https://" />
      <CmsField label="Phone" value={company.phone} onChange={(v) => upd('phone', v)} placeholder="+91 …" />
      <CmsField label="Email" value={company.email} onChange={(v) => upd('email', v)} />
      <SectionTitle>Social Links</SectionTitle>
      <CmsField label="WhatsApp" value={company.whatsapp} onChange={(v) => upd('whatsapp', v)} placeholder="+91 …" />
      <CmsField label="Facebook" value={company.facebook} onChange={(v) => upd('facebook', v)} placeholder="https://facebook.com/…" />
      <CmsField label="Instagram" value={company.instagram} onChange={(v) => upd('instagram', v)} placeholder="https://instagram.com/…" />
      <CmsField label="Twitter / X" value={company.twitter} onChange={(v) => upd('twitter', v)} placeholder="https://x.com/…" />
      <SectionTitle>Brand Colors</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <CmsColor label="Primary" value={company.brandPrimary} onChange={(v) => upd('brandPrimary', v)} />
        <CmsColor label="Secondary" value={company.brandSecondary} onChange={(v) => upd('brandSecondary', v)} />
      </div>
    </>
  );
}

/* ─── IMAGES TAB (click-to-place) ─── */
function ImagesTab({
  placedImages, placingImageUrl, setPlacingImageUrl, setPlacingLabel,
  selectedImageId, setSelectedImageId, removePlacedImage, updatePlacedImage,
}: {
  placedImages: PlacedImage[];
  placingImageUrl: string | null;
  setPlacingImageUrl: (url: string | null) => void;
  setPlacingLabel: (l: string) => void;
  selectedImageId: string | null;
  setSelectedImageId: (id: string | null) => void;
  removePlacedImage: (id: string) => void;
  updatePlacedImage: (id: string, patch: Partial<PlacedImage>) => void;
}) {
  const selectedImg = placedImages.find((p) => p.id === selectedImageId);

  return (
    <>
      <SectionTitle>Place Image on Booth</SectionTitle>
      <p className="text-[10px] text-white/35 leading-relaxed mb-3">
        Upload an image, then <strong className="text-white/50">click on any booth surface</strong> in the 3D preview to place it. Drag to reposition.
      </p>
      {placingImageUrl ? (
        <div className="rounded-lg border border-[#d4af37]/30 bg-[#d4af37]/5 p-3 mb-3">
          <p className="text-[11px] text-[#d4af37] font-semibold mb-2 animate-pulse">Click a surface in the 3D view to place</p>
          <img src={placingImageUrl} alt="placing" className="mx-auto max-h-20 rounded border border-white/10 object-contain mb-2" />
          <button className="w-full rounded border border-white/10 px-2 py-1 text-[10px] text-white/40 hover:bg-white/5" onClick={() => setPlacingImageUrl(null)}>
            Cancel
          </button>
        </div>
      ) : (
        <UploadButton label="Upload image to place" accept="image/*" onFile={async (f) => {
          const url = await readFile(f);
          setPlacingImageUrl(url);
          setPlacingLabel(f.name);
        }} />
      )}

      <SectionTitle>Placed Images ({placedImages.length})</SectionTitle>
      {placedImages.length === 0 && (
        <p className="text-[10px] text-white/25 italic">No images placed yet</p>
      )}
      <div className="space-y-2">
        {placedImages.map((img) => (
          <div
            key={img.id}
            className={`rounded-lg border p-2.5 cursor-pointer transition-all ${img.id === selectedImageId ? 'border-[#d4af37]/50 bg-[#d4af37]/10' : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]'}`}
            onClick={() => setSelectedImageId(img.id === selectedImageId ? null : img.id)}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <img src={img.url} alt={img.label} className="h-8 w-8 rounded border border-white/10 object-cover shrink-0" />
              <span className="flex-1 truncate text-[11px] text-white/60">{img.label}</span>
              <button className="text-[10px] text-red-400/50 hover:text-red-400 shrink-0" onClick={(e) => { e.stopPropagation(); removePlacedImage(img.id); }}>✕</button>
            </div>
            {img.id === selectedImageId && (
              <div className="space-y-2 pt-1.5 border-t border-white/[0.06]">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-0.5 block text-[9px] uppercase text-white/30">Width (m)</label>
                    <input className="w-full rounded border border-white/[0.08] bg-white/[0.04] px-2 py-1 text-[11px] text-white outline-none" value={img.size[0]} onChange={(e) => { const v = parseFloat(e.target.value); if (Number.isFinite(v) && v > 0) updatePlacedImage(img.id, { size: [v, img.size[1]] }); }} />
                  </div>
                  <div>
                    <label className="mb-0.5 block text-[9px] uppercase text-white/30">Height (m)</label>
                    <input className="w-full rounded border border-white/[0.08] bg-white/[0.04] px-2 py-1 text-[11px] text-white outline-none" value={img.size[1]} onChange={(e) => { const v = parseFloat(e.target.value); if (Number.isFinite(v) && v > 0) updatePlacedImage(img.id, { size: [img.size[0], v] }); }} />
                  </div>
                </div>
                <p className="text-[9px] text-white/20 font-mono">
                  pos: [{img.position.map((v) => v.toFixed(2)).join(', ')}]
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

/* ─── LIGHTING TAB ─── */
function LightingTab({ lighting, setLighting }: { lighting: BoothLighting; setLighting: (l: BoothLighting) => void }) {
  const upd = (k: keyof BoothLighting, v: number | string) => setLighting({ ...lighting, [k]: v });
  return (
    <>
      <SectionTitle>Spotlight</SectionTitle>
      <CmsSlider label="Intensity" value={lighting.spotlightIntensity} onChange={(v) => upd('spotlightIntensity', v)} min={0} max={200} step={1} />
      <CmsColor label="Spotlight Color" value={lighting.spotlightColor} onChange={(v) => upd('spotlightColor', v)} />
      <SectionTitle>LED Strip</SectionTitle>
      <CmsColor label="LED Color" value={lighting.ledStripColor} onChange={(v) => upd('ledStripColor', v)} />
      <CmsSlider label="LED Intensity" value={lighting.ledStripIntensity} onChange={(v) => upd('ledStripIntensity', v)} min={0} max={10} step={0.1} />
      <SectionTitle>Glow & Ambient</SectionTitle>
      <CmsSlider label="Emissive Glow" value={lighting.emissiveGlow} onChange={(v) => upd('emissiveGlow', v)} min={0} max={2} />
      <CmsSlider label="Ambient Intensity" value={lighting.ambientIntensity} onChange={(v) => upd('ambientIntensity', v)} min={0} max={2} />
    </>
  );
}
