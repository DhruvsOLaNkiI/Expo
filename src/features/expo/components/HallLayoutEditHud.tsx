import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '@/store';
import {
  applyBoothOverrides,
  buildDefaultBoothLayoutList,
  mergeRegistrationLayout,
  type RegistrationImportedModel,
} from '@/features/shared/data/boothLayouts';
import { commitHallLayoutTransform, findLayoutObject, persistHallLayoutTransform } from '@/store/persist/hallLayout';

const HALL_OPTIONS: { id: string; label: string }[] = [
  { id: 'hall-entrance-lobby', label: 'Entrance lobby (desk + zone)' },
  { id: 'hall-reception-banner', label: 'Large LED wall' },
  { id: 'hall-plant-0', label: 'Tree 1' },
  { id: 'hall-plant-1', label: 'Tree 2' },
  { id: 'hall-plant-2', label: 'Tree 3' },
  { id: 'hall-plant-3', label: 'Tree 4' },
];

const REGISTRATION_OPTIONS: { id: string; label: string }[] = [
  { id: 'reg-reception-root', label: 'Entire reception zone' },
  { id: 'reg-registration-desk', label: 'Registration counter' },
  { id: 'reg-expo-backdrop', label: 'LED backdrop wall' },
  { id: 'reg-queue-lanes', label: 'Queue lanes' },
  { id: 'reg-event-totems', label: 'Info totems & signage' },
];

/** Overlay to move hall props / booths with TransformControls; saves to browser (scene + booth overrides). */
export function HallLayoutEditHud() {
  const edit = useStore((s) => s.hallLayoutEditMode);
  const setEdit = useStore((s) => s.setHallLayoutEditMode);
  const sel = useStore((s) => s.hallLayoutSelection);
  const setSel = useStore((s) => s.setHallLayoutSelection);
  const gizmoMode = useStore((s) => s.hallLayoutGizmoMode);
  const setGizmoMode = useStore((s) => s.setHallLayoutGizmoMode);
  const rotationAxis = useStore((s) => s.hallLayoutRotationAxis);
  const setRotationAxis = useStore((s) => s.setHallLayoutRotationAxis);
  const patchSceneOverride = useStore((s) => s.patchSceneOverride);
  const boothOverrides = useStore((s) => s.boothOverrides);
  const patchBoothOverride = useStore((s) => s.patchBoothOverride);
  const regOverrides = useStore((s) => s.sceneOverrides.registrationLayout);
  const [boothWidth, setBoothWidth] = useState('1');
  const [boothHeight, setBoothHeight] = useState('1');
  const [boothDepth, setBoothDepth] = useState('1');
  const inRegistration = useStore((s) => s.expoPhase) === 'registration';
  const [glbUrlInput, setGlbUrlInput] = useState('');
  const [saveHint, setSaveHint] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const saveHintTimer = useRef<any>(null);

  const flashSaveHint = (msg: string) => {
    setSaveHint(msg);
    if (saveHintTimer.current) clearTimeout(saveHintTimer.current);
    saveHintTimer.current = setTimeout(() => setSaveHint(null), 2000);
  };

  const saveAndStay = () => {
    if (!sel) {
      flashSaveHint('Pick an object or click it in the 3D scene');
      return;
    }
    const obj = findLayoutObject(sel);
    if (!obj) {
      flashSaveHint(`Not found in scene: ${sel}`);
      return;
    }
    const ok = persistHallLayoutTransform(sel, obj);
    flashSaveHint(ok ? `✓ Saved` : `Failed to save ${sel}`);
  };

  const finishEdit = () => {
    setEdit(false);
    setSel(null);
  };

  const regLayout = useMemo(() => mergeRegistrationLayout(regOverrides), [regOverrides]);

  const registrationOptions = useMemo(() => {
    const imported = regLayout.importedModels.map((m) => ({
      id: `reg-imported-${m.id}`,
      label: `GLB: ${m.label}`,
    }));
    return [...REGISTRATION_OPTIONS, ...imported];
  }, [regLayout.importedModels]);

  const boothLayouts = useMemo(
    () => applyBoothOverrides(buildDefaultBoothLayoutList(), boothOverrides),
    [boothOverrides],
  );

  const boothOptions = useMemo(
    () =>
      boothLayouts.map((b) => ({
        id: `booth-root-${b.id}`,
        label: `Booth: ${b.name}`,
      })),
    [boothLayouts],
  );

  const selectedBoothId = sel?.startsWith('booth-root-') ? sel.slice('booth-root-'.length) : null;

  useEffect(() => {
    if (!selectedBoothId) return;
    const obj = findLayoutObject(`booth-root-${selectedBoothId}`);
    if (obj) {
      setBoothWidth(obj.scale.x.toFixed(2));
      setBoothHeight(obj.scale.y.toFixed(2));
      setBoothDepth(obj.scale.z.toFixed(2));
      return;
    }
    const b = boothLayouts.find((x) => x.id === selectedBoothId);
    if (b) {
      setBoothWidth(String(b.scale[0]));
      setBoothHeight(String(b.scale[1]));
      setBoothDepth(String(b.scale[2]));
    }
  }, [selectedBoothId, boothLayouts, sel]);

  const applyBoothSize = () => {
    if (!selectedBoothId) return;
    const parse = (v: string, fallback: number) => {
      const n = parseFloat(v);
      return Number.isFinite(n) && n > 0 ? n : fallback;
    };
    const scale: [number, number, number] = [
      parse(boothWidth, 1),
      parse(boothHeight, 1),
      parse(boothDepth, 1),
    ];
    const obj = findLayoutObject(`booth-root-${selectedBoothId}`);
    if (obj) {
      obj.scale.set(scale[0], scale[1], scale[2]);
      obj.updateMatrixWorld(true);
      persistHallLayoutTransform(`booth-root-${selectedBoothId}`, obj);
      flashSaveHint('✓ Booth size saved');
      return;
    }
    void patchBoothOverride(selectedBoothId, { scale });
    flashSaveHint('✓ Booth size saved');
  };

  const addImportedModel = (url: string, label: string) => {
    const trimmed = url.trim();
    if (!trimmed) return;
    const id = `model-${Date.now()}`;
    const entry: RegistrationImportedModel = {
      id,
      label,
      url: trimmed,
      offset: [0, 0, 2],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    };
    patchSceneOverride({
      registrationLayout: {
        importedModels: [...regLayout.importedModels, entry],
      },
    });
    setSel(`reg-imported-${id}`);
    setGlbUrlInput('');
  };

  const removeSelectedImport = () => {
    if (!sel?.startsWith('reg-imported-')) return;
    const id = sel.slice('reg-imported-'.length);
    patchSceneOverride({
      registrationLayout: {
        importedModels: regLayout.importedModels.filter((m) => m.id !== id),
      },
    });
    setSel(null);
  };

  useEffect(() => {
    if (!edit) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        finishEdit();
      }
      if (e.key === 'g' || e.key === 'G') setGizmoMode('translate');
      if (e.key === 'r' || e.key === 'R') setGizmoMode('rotate');
      if (e.key === 's' || e.key === 'S') setGizmoMode('scale');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [edit, setEdit, setSel, setGizmoMode]);

  if (!edit) return null;

  return (
    <div className="pointer-events-auto fixed left-1/2 top-4 z-[60] w-[min(92vw,400px)] -translate-x-1/2 rounded-xl border border-[#d4af37]/30 bg-black/80 px-4 py-3 text-xs text-white/90 shadow-2xl backdrop-blur-md">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#d4af37]">
            {inRegistration ? 'Edit registration layout' : 'Edit hall layout'}
          </div>
          <p className="mt-1 text-[10px] leading-relaxed text-white/55">
            <strong className="text-white/75">Click object</strong> to select · <strong className="text-white/75">G</strong> move · <strong className="text-white/75">R</strong> rotate · <strong className="text-white/75">S</strong> resize
          </p>
          {saveHint && (
            <p className="mt-1 text-[10px] font-semibold text-emerald-400/90">{saveHint}</p>
          )}
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            className="rounded-lg border border-emerald-500/35 bg-emerald-950/50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-100 hover:bg-emerald-900/60"
            onClick={saveAndStay}
          >
            Save
          </button>
          <button
            type="button"
            className="rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/85 hover:bg-white/15"
            onClick={finishEdit}
          >
            Done
          </button>
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className={`flex-1 rounded-lg border px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide ${
            gizmoMode === 'translate'
              ? 'border-[#d4af37]/50 bg-[#d4af37]/20 text-[#f5e6b8]'
              : 'border-white/12 bg-white/[0.06] text-white/70 hover:bg-white/10'
          }`}
          onClick={() => setGizmoMode('translate')}
        >
          Move
        </button>
        <button
          type="button"
          className={`flex-1 rounded-lg border px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide ${
            gizmoMode === 'rotate'
              ? 'border-[#d4af37]/50 bg-[#d4af37]/20 text-[#f5e6b8]'
              : 'border-white/12 bg-white/[0.06] text-white/70 hover:bg-white/10'
          }`}
          onClick={() => setGizmoMode('rotate')}
        >
          Rotate
        </button>
        <button
          type="button"
          className={`flex-1 rounded-lg border px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide ${
            gizmoMode === 'scale'
              ? 'border-[#d4af37]/50 bg-[#d4af37]/20 text-[#f5e6b8]'
              : 'border-white/12 bg-white/[0.06] text-white/70 hover:bg-white/10'
          }`}
          onClick={() => setGizmoMode('scale')}
        >
          Size
        </button>
      </div>

      {selectedBoothId && (
        <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.04] p-2.5">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-[#d4af37]">Booth width & height</div>
          <p className="mt-1 text-[10px] leading-relaxed text-white/50">
            Drag the <strong className="text-white/70">Size</strong> gizmo, or type values below (1.0 = default).
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <label className="block">
              <span className="text-[9px] uppercase text-white/40">Width</span>
              <input
                type="number"
                min={0.5}
                max={3}
                step={0.05}
                value={boothWidth}
                onChange={(e) => setBoothWidth(e.target.value)}
                className="mt-0.5 w-full rounded border border-white/12 bg-white/[0.06] px-2 py-1.5 text-[11px] text-white outline-none focus:border-[#d4af37]/45"
              />
            </label>
            <label className="block">
              <span className="text-[9px] uppercase text-white/40">Height</span>
              <input
                type="number"
                min={0.5}
                max={3}
                step={0.05}
                value={boothHeight}
                onChange={(e) => setBoothHeight(e.target.value)}
                className="mt-0.5 w-full rounded border border-white/12 bg-white/[0.06] px-2 py-1.5 text-[11px] text-white outline-none focus:border-[#d4af37]/45"
              />
            </label>
            <label className="block">
              <span className="text-[9px] uppercase text-white/40">Depth</span>
              <input
                type="number"
                min={0.5}
                max={3}
                step={0.05}
                value={boothDepth}
                onChange={(e) => setBoothDepth(e.target.value)}
                className="mt-0.5 w-full rounded border border-white/12 bg-white/[0.06] px-2 py-1.5 text-[11px] text-white outline-none focus:border-[#d4af37]/45"
              />
            </label>
          </div>
          <button
            type="button"
            className="mt-2 w-full rounded-lg border border-[#d4af37]/35 bg-[#d4af37]/15 px-2 py-1.5 text-[10px] font-semibold uppercase text-[#f5e6b8] hover:bg-[#d4af37]/25"
            onClick={applyBoothSize}
          >
            Apply size
          </button>
        </div>
      )}

      {gizmoMode === 'rotate' && (
        <div className="mt-2">
          <div className="text-[10px] uppercase tracking-wide text-white/40">Rotation axis</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {(
              [
                ['E', 'Free'],
                ['X', 'X'],
                ['Y', 'Y'],
                ['Z', 'Z'],
                [null, 'Rings'],
              ] as const
            ).map(([axis, label]) => (
              <button
                key={label}
                type="button"
                className={`rounded-md border px-2 py-1 text-[10px] font-semibold uppercase ${
                  rotationAxis === axis
                    ? 'border-[#d4af37]/50 bg-[#d4af37]/20 text-[#f5e6b8]'
                    : 'border-white/12 bg-white/[0.06] text-white/65 hover:bg-white/10'
                }`}
                onClick={() => setRotationAxis(axis)}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[10px] text-white/45">
            Choose <strong className="text-white/65">Free</strong> to rotate repeatedly without switching rings. Drag the yellow outer ring.
          </p>
        </div>
      )}

      <label className="mt-3 block text-[10px] uppercase tracking-wide text-white/40">
        Selected: <span className="text-[#d4af37]">{sel ? sel.replace(/^reg-lobby-/, '').replace(/^reg-/, '') : 'none'}</span>
      </label>
      <select
        className="mt-1 w-full rounded-lg border border-white/12 bg-white/[0.06] px-2 py-2 text-[12px] text-white outline-none focus:border-[#d4af37]/45"
        value={sel ?? ''}
        onChange={(e) => {
          const next = e.target.value || null;
          setSel(next);
        }}
      >
        <option value="">— Choose —</option>
        {inRegistration
          ? registrationOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))
          : (
              <>
                {HALL_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
                <optgroup label="Booths">
                  {boothOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </optgroup>
              </>
            )}
      </select>

      {inRegistration && (
        <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.04] p-2.5">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-[#d4af37]">Import GLB model</div>
          <p className="mt-1 text-[10px] leading-relaxed text-white/50">
            Permanent: copy your file into <span className="text-white/70">public/assets/</span>, then use{' '}
            <span className="text-white/70">/assets/your-model.glb</span>
          </p>
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              placeholder="/assets/my-chair.glb"
              value={glbUrlInput}
              onChange={(e) => setGlbUrlInput(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-white/12 bg-white/[0.06] px-2 py-1.5 text-[11px] text-white outline-none focus:border-[#d4af37]/45"
            />
            <button
              type="button"
              className="shrink-0 rounded-lg border border-[#d4af37]/35 bg-[#d4af37]/15 px-2 py-1.5 text-[10px] font-semibold uppercase text-[#f5e6b8] hover:bg-[#d4af37]/25"
              onClick={() => {
                const name = glbUrlInput.split('/').pop()?.replace(/\.glb$/i, '') || 'Model';
                addImportedModel(glbUrlInput, name);
              }}
            >
              Add
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".glb,.gltf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                addImportedModel(URL.createObjectURL(file), file.name.replace(/\.(glb|gltf)$/i, ''));
                e.target.value = '';
              }}
            />
            <button
              type="button"
              className="rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-[10px] font-semibold uppercase text-white/85 hover:bg-white/15"
              onClick={() => fileRef.current?.click()}
            >
              Pick local .glb
            </button>
            {sel?.startsWith('reg-imported-') && (
              <button
                type="button"
                className="rounded-lg border border-red-400/30 bg-red-500/10 px-2 py-1 text-[10px] font-semibold uppercase text-red-200/90 hover:bg-red-500/20"
                onClick={removeSelectedImport}
              >
                Remove GLB
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
