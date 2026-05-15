import { useCallback, useEffect, useMemo, useState } from 'react';
import { BoothCmsPreview } from './BoothCmsPreview';
import { useStore } from '../store';
import {
  applyBoothOverrides,
  buildDefaultBoothLayoutList,
  deg3ToRad3,
  rad3ToDeg3,
  type BoothLayoutConfig,
  type BoothLayoutPatch,
} from '../data/boothLayouts';

function num(v: string, fallback: number): number {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

function readImageFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export function BoothCmsPanel() {
  const open = useStore((s) => s.boothCmsOpen);
  const setOpen = useStore((s) => s.setBoothCmsOpen);
  const overrides = useStore((s) => s.boothOverrides);
  const patch = useStore((s) => s.patchBoothOverride);
  const resetBooth = useStore((s) => s.resetBoothOverride);
  const resetAll = useStore((s) => s.resetAllBoothOverrides);

  const defaults = useMemo(() => buildDefaultBoothLayoutList(), []);
  const mergedList = useMemo(
    () => applyBoothOverrides(defaults, overrides),
    [defaults, overrides]
  );

  const [selectedId, setSelectedId] = useState(defaults[0]?.id ?? 'vertex-elite');
  const [px, setPx] = useState('0');
  const [py, setPy] = useState('0');
  const [pz, setPz] = useState('0');
  const [rxDeg, setRxDeg] = useState('0');
  const [ryDeg, setRyDeg] = useState('0');
  const [rzDeg, setRzDeg] = useState('0');
  const [name, setName] = useState('');
  const [color, setColor] = useState('');
  const [accent, setAccent] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [headerLogoUrl, setHeaderLogoUrl] = useState('');

  const loadFormFromMerged = useCallback((b: BoothLayoutConfig) => {
    setPx(String(b.position[0]));
    setPy(String(b.position[1]));
    setPz(String(b.position[2]));
    const [dx, dy, dz] = rad3ToDeg3(b.rotation[0], b.rotation[1], b.rotation[2]);
    setRxDeg(dx.toFixed(2));
    setRyDeg(dy.toFixed(2));
    setRzDeg(dz.toFixed(2));
    setName(b.name);
    setColor(b.color);
    setAccent(b.accent);
    setVideoUrl(b.videoUrl);
    setHeaderLogoUrl(b.headerLogoUrl ?? '');
  }, []);

  useEffect(() => {
    const b = mergedList.find((x) => x.id === selectedId);
    if (b) loadFormFromMerged(b);
  }, [selectedId, mergedList, loadFormFromMerged]);

  const handleApply = async () => {
    const rot = deg3ToRad3(num(rxDeg, 0), num(ryDeg, 0), num(rzDeg, 0));
    await patch(selectedId, {
      position: [num(px, 0), num(py, 0), num(pz, 0)],
      rotation: rot,
      name: name.trim() || undefined,
      color: color.trim() || undefined,
      accent: accent.trim() || undefined,
      videoUrl: videoUrl.trim() || undefined,
      headerLogoUrl: headerLogoUrl.trim() ? headerLogoUrl.trim() : null,
    });
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify({ overrides }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'booth-cms-export.json';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      void (async () => {
        try {
          const j = JSON.parse(String(reader.result)) as { overrides?: Record<string, unknown> };
          if (!j?.overrides || typeof j.overrides !== 'object') return;
          for (const [id, p] of Object.entries(j.overrides)) {
            if (p && typeof p === 'object') await patch(id, p as BoothLayoutPatch);
          }
        } catch {
          /* invalid json */
        }
      })();
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  if (!open) return null;

  return (
    <div className="fixed top-3 right-3 z-[60] w-[min(34rem,calc(100vw-1.5rem))] max-h-[calc(100vh-1.5rem)] overflow-y-auto rounded-xl border border-black/15 bg-white/95 p-4 text-sm text-black shadow-xl backdrop-blur-md pointer-events-auto">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-xs font-bold uppercase tracking-widest text-[#b08d29]">Booth CMS</h2>
        <button
          type="button"
          className="rounded border border-black/15 px-2 py-0.5 text-xs hover:bg-black/5"
          onClick={() => setOpen(false)}
        >
          Close
        </button>
      </div>
      <p className="mb-3 text-[11px] leading-snug text-gray-600">
        Edits merge on top of defaults and persist in this browser. Optional deploy file:{' '}
        <code className="rounded bg-black/5 px-1">public/booth-cms.json</code>
      </p>

      <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        Booth
      </label>
      <select
        className="mb-2 w-full rounded border border-black/15 bg-white px-2 py-1.5 text-xs"
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value)}
      >
        {defaults.map((b) => (
          <option key={b.id} value={b.id}>
            {b.id} — {b.name}
          </option>
        ))}
      </select>

      <BoothCmsPreview boothId={selectedId} name={name} color={color} accent={accent} videoUrl={videoUrl} headerLogoUrl={headerLogoUrl} />
      <p className="mb-3 text-[10px] leading-snug text-gray-500">
        Live preview uses the fields below. Use a path under <code className="rounded bg-black/5 px-0.5">public/</code> for
        deployable assets; large uploads are stored in this browser (localStorage or IndexedDB).
      </p>

      <div className="mb-2 grid grid-cols-3 gap-2">
        <Field label="pos X" value={px} onChange={setPx} />
        <Field label="pos Y" value={py} onChange={setPy} />
        <Field label="pos Z" value={pz} onChange={setPz} />
      </div>
      <div className="mb-2 grid grid-cols-3 gap-2">
        <Field label="rot X°" value={rxDeg} onChange={setRxDeg} />
        <Field label="rot Y°" value={ryDeg} onChange={setRyDeg} />
        <Field label="rot Z°" value={rzDeg} onChange={setRzDeg} />
      </div>

      <label className="mb-0.5 block text-[11px] text-gray-500">Name</label>
      <input className="mb-2 w-full rounded border border-black/15 px-2 py-1 text-xs" value={name} onChange={(e) => setName(e.target.value)} />

      <div className="mb-2 grid grid-cols-2 gap-2">
        <div>
          <label className="mb-0.5 block text-[11px] text-gray-500">Wall color</label>
          <input className="w-full rounded border border-black/15 px-2 py-1 text-xs" value={color} onChange={(e) => setColor(e.target.value)} />
        </div>
        <div>
          <label className="mb-0.5 block text-[11px] text-gray-500">Accent</label>
          <input className="w-full rounded border border-black/15 px-2 py-1 text-xs" value={accent} onChange={(e) => setAccent(e.target.value)} />
        </div>
      </div>

      <label className="mb-0.5 block text-[11px] text-gray-500">Main + counter screen (video or image URL)</label>
      <input className="mb-1 w-full rounded border border-black/15 px-2 py-1 text-xs" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} />
      <label className="mb-2 inline-flex cursor-pointer items-center gap-2 rounded border border-black/15 bg-black/[0.03] px-2 py-1 text-[11px] hover:bg-black/[0.06]">
        <span className="font-medium text-gray-700">Upload image → screen</span>
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              setVideoUrl(await readImageFileAsDataUrl(f));
            } catch {
              /* ignore */
            }
            e.target.value = '';
          }}
        />
      </label>

      <label className="mb-0.5 mt-2 block text-[11px] text-gray-500">Header logo URL (empty = default / none)</label>
      <input
        className="mb-1 w-full rounded border border-black/15 px-2 py-1 text-xs"
        value={headerLogoUrl}
        onChange={(e) => setHeaderLogoUrl(e.target.value)}
        placeholder="/assets/…"
      />
      <label className="mb-3 inline-flex cursor-pointer items-center gap-2 rounded border border-black/15 bg-black/[0.03] px-2 py-1 text-[11px] hover:bg-black/[0.06]">
        <span className="font-medium text-gray-700">Upload image → header</span>
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              setHeaderLogoUrl(await readImageFileAsDataUrl(f));
            } catch {
              /* ignore */
            }
            e.target.value = '';
          }}
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="rounded bg-[#d4af37] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#b08d29]" onClick={() => void handleApply()}>
          Apply
        </button>
        <button type="button" className="rounded border border-black/15 px-3 py-1.5 text-xs hover:bg-black/5" onClick={() => void resetBooth(selectedId)}>
          Reset booth
        </button>
        <button type="button" className="rounded border border-black/15 px-3 py-1.5 text-xs hover:bg-black/5" onClick={() => void resetAll()}>
          Reset all
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-black/10 pt-3">
        <button type="button" className="rounded border border-black/15 px-2 py-1 text-[11px] hover:bg-black/5" onClick={handleExport}>
          Export JSON
        </button>
        <label className="cursor-pointer rounded border border-black/15 px-2 py-1 text-[11px] hover:bg-black/5">
          Import
          <input type="file" accept="application/json,.json" className="hidden" onChange={handleImportFile} />
        </label>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-0.5 block text-[10px] text-gray-500">{label}</label>
      <input className="w-full rounded border border-black/15 px-1 py-1 text-xs" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
