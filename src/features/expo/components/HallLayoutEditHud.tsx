import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '@/store';
import {
  applyBoothOverrides,
  buildDefaultBoothLayoutList,
  deg3ToRad3,
  mergeHallLayout,
  mergeRegistrationLayout,
  rad3ToDeg3,
  type RegistrationImportedModel,
} from '@/features/shared/data/boothLayouts';
import { standeeGapLabel, standeePlacementsFromBooths } from '@/features/booths/components/HallAisleStandees';
import { commitHallLayoutTransform, findLayoutObject, persistHallLayoutTransform } from '@/store/persist/hallLayout';
import {
  BOOTH_DISPLAY_SLOT_LABELS,
  type BoothDisplaySlot,
} from '@/features/shared/data/boothDisplayLayout';

const HALL_OPTIONS: { id: string; label: string }[] = [
  { id: 'hall-entry-spawn', label: 'Entry spawn (visitor start)' },
  { id: 'hall-entrance-lobby', label: 'Entrance lobby (desk + zone)' },
  { id: 'hall-reception-banner', label: 'Entrance wall TV' },
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
  { id: 'reg-corner-nw', label: 'Corner plant (NW)' },
  { id: 'reg-corner-ne', label: 'Corner plant (NE)' },
  { id: 'reg-corner-sw', label: 'Corner plant (SW)' },
  { id: 'reg-corner-se', label: 'Corner plant (SE)' },
  { id: 'reg-north-screen-left', label: 'North wall screen (left)' },
  { id: 'reg-north-screen-right', label: 'North wall screen (right)' },
];

function parseCoord(v: string, fallback: number): number {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

function coordInputClassName() {
  return 'mt-0.5 w-full rounded border border-white/12 bg-white/[0.06] px-2 py-1.5 text-[11px] text-white outline-none focus:border-[#d4af37]/45';
}

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
  const sceneOverrides = useStore((s) => s.sceneOverrides);
  const patchBoothOverride = useStore((s) => s.patchBoothOverride);
  const regOverrides = useStore((s) => s.sceneOverrides.registrationLayout);
  const [posX, setPosX] = useState('');
  const [posY, setPosY] = useState('');
  const [posZ, setPosZ] = useState('');
  const [rotXDeg, setRotXDeg] = useState('');
  const [rotYDeg, setRotYDeg] = useState('');
  const [rotZDeg, setRotZDeg] = useState('');
  const [scaleX, setScaleX] = useState('');
  const [scaleY, setScaleY] = useState('');
  const [scaleZ, setScaleZ] = useState('');
  const coordTypingRef = useRef(false);
  const inRegistration = useStore((s) => s.expoPhase) === 'registration';
  const [glbUrlInput, setGlbUrlInput] = useState('');
  const [saveHint, setSaveHint] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const layoutImportRef = useRef<HTMLInputElement>(null);
  const saveHintTimer = useRef<any>(null);

  const flashSaveHint = (msg: string) => {
    setSaveHint(msg);
    if (saveHintTimer.current) clearTimeout(saveHintTimer.current);
    saveHintTimer.current = setTimeout(() => setSaveHint(null), 2000);
  };

  const captureEntryFromPlayer = () => {
    const pos = useStore.getState().playerPosition;
    const yaw = useStore.getState().playerFacingYaw;
    if (!pos) {
      flashSaveHint('Walk to the entry spot, then try again');
      return;
    }
    patchSceneOverride({
      hallLayout: {
        mainExpoSpawn: [pos[0], 1.7, pos[2]],
        mainExpoSpawnYaw: yaw,
      },
    });
    const obj = findLayoutObject('hall-entry-spawn');
    if (obj) {
      obj.position.set(pos[0], 0, pos[2]);
      obj.rotation.y = yaw;
      obj.updateMatrixWorld(true);
    }
    setSel('hall-entry-spawn');
    flashSaveHint('✓ Entry placement saved from your position');
  };

  const saveAndStay = async () => {
    if (!sel) {
      flashSaveHint('Pick an object or click it in the 3D scene');
      return;
    }
    const obj = findLayoutObject(sel);
    if (!obj) {
      flashSaveHint(`Not found in scene: ${sel}`);
      return;
    }
    const result = persistHallLayoutTransform(sel, obj);
    const ok = result instanceof Promise ? await result : result;
    flashSaveHint(ok ? '✓ Saved for all visitors' : `⚠ Server save failed for ${sel} — saved locally only`);
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

  const boothDisplayOptions = useMemo(() => {
    const slots: BoothDisplaySlot[] = ['main', 'counter', 'standee', 'signage', 'kiosk'];
    return boothLayouts.flatMap((b) =>
      slots
        // EcoEden standing board is now the standee slot (signage was legacy).
        .filter((slot) => slot !== 'signage')
        .filter((slot) => slot !== 'kiosk' || b.id === 'vertex-elite')
        .map((slot) => ({
          id: `booth-display-${b.id}__${slot}`,
          label: `${b.name} · ${
            b.id === 'builder-8' && slot === 'standee'
              ? 'Standing signage board'
              : BOOTH_DISPLAY_SLOT_LABELS[slot]
          }`,
        })),
    );
  }, [boothLayouts]);

  const aisleStandeeOptions = useMemo(() => {
    const nameById = new Map(boothLayouts.map((b) => [b.id, b.name]));
    return standeePlacementsFromBooths(boothLayouts).map((p) => ({
      id: `hall-standee-${p.id}`,
      label: standeeGapLabel(p.id, nameById),
    }));
  }, [boothLayouts]);

  const selectedBoothId = sel?.startsWith('booth-root-') ? sel.slice('booth-root-'.length) : null;

  const syncCoordsFromSelection = useCallback(() => {
    if (!sel || coordTypingRef.current) return;
    const obj = findLayoutObject(sel);
    if (!obj) return;
    obj.updateMatrixWorld(true);
    setPosX(obj.position.x.toFixed(2));
    setPosY(obj.position.y.toFixed(2));
    setPosZ(obj.position.z.toFixed(2));
    const [dx, dy, dz] = rad3ToDeg3(obj.rotation.x, obj.rotation.y, obj.rotation.z);
    setRotXDeg(dx.toFixed(1));
    setRotYDeg(dy.toFixed(1));
    setRotZDeg(dz.toFixed(1));
    setScaleX(obj.scale.x.toFixed(2));
    setScaleY(obj.scale.y.toFixed(2));
    setScaleZ(obj.scale.z.toFixed(2));
  }, [sel]);

  useEffect(() => {
    coordTypingRef.current = false;
    syncCoordsFromSelection();
  }, [sel, syncCoordsFromSelection, boothOverrides, sceneOverrides]);

  useEffect(() => {
    if (!edit || !sel) return;
    const id = window.setInterval(syncCoordsFromSelection, 350);
    return () => window.clearInterval(id);
  }, [edit, sel, syncCoordsFromSelection]);

  const applyCoordinates = async () => {
    if (!sel) return;
    const obj = findLayoutObject(sel);
    if (!obj) {
      flashSaveHint(`Not found in scene: ${sel}`);
      return;
    }
    obj.position.set(parseCoord(posX, 0), parseCoord(posY, 0), parseCoord(posZ, 0));
    const rot = deg3ToRad3(parseCoord(rotXDeg, 0), parseCoord(rotYDeg, 0), parseCoord(rotZDeg, 0));
    obj.rotation.set(rot[0], rot[1], rot[2]);
    obj.scale.set(
      Math.max(0.1, parseCoord(scaleX, 1)),
      Math.max(0.1, parseCoord(scaleY, 1)),
      Math.max(0.1, parseCoord(scaleZ, 1)),
    );
    obj.updateMatrixWorld(true);
    const result = persistHallLayoutTransform(sel, obj);
    const ok = result instanceof Promise ? await result : result;
    coordTypingRef.current = false;
    syncCoordsFromSelection();
    flashSaveHint(ok ? '✓ Saved for all visitors' : `⚠ Server save failed for ${sel} — saved locally only`);
  };

  const addImportedModel = (url: string, label: string) => {
    const trimmed = url.trim();
    if (!trimmed) return;
    if (trimmed.startsWith('blob:')) {
      flashSaveHint('Local file picked — copy GLB to public/assets/ and use /assets/… path for localhost + production');
    }
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

  const exportLayoutJson = () => {
    const payload = {
      booths: boothOverrides,
      scene: sceneOverrides,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'booth-cms-export.json';
    a.click();
    URL.revokeObjectURL(a.href);
    flashSaveHint('Exported layout JSON — import on localhost or save to public/booth-cms.json');
  };

  const importLayoutJson = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      void (async () => {
        try {
          const j = JSON.parse(String(reader.result)) as {
            booths?: Record<string, unknown>;
            overrides?: Record<string, unknown>;
            scene?: Record<string, unknown>;
          };
          const src = j.booths ?? j.overrides;
          if (src && typeof src === 'object') {
            for (const [id, patch] of Object.entries(src)) {
              if (patch && typeof patch === 'object') {
                await patchBoothOverride(id, patch as Parameters<typeof patchBoothOverride>[1]);
              }
            }
          }
          if (j.scene && typeof j.scene === 'object') {
            patchSceneOverride(j.scene as Parameters<typeof patchSceneOverride>[0]);
          }
          flashSaveHint('✓ Layout imported — refresh if models still missing');
        } catch {
          flashSaveHint('Invalid layout JSON');
        }
      })();
    };
    reader.readAsText(file);
  };

  const saveLayoutToBoothCmsFile = async () => {
    try {
      const res = await fetch('/api/booth-cms/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booths: boothOverrides, scene: sceneOverrides }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) {
        flashSaveHint(j.error ?? 'Save failed (dev server only)');
        return;
      }
      flashSaveHint('✓ Saved to public/booth-cms.json');
    } catch {
      flashSaveHint('Save failed — run npm run dev');
    }
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
    <div className="pointer-events-auto fixed left-1/2 top-4 z-[60] w-[min(92vw,440px)] -translate-x-1/2 rounded-xl border border-[#d4af37]/30 bg-black/80 px-4 py-3 text-xs text-white/90 shadow-2xl backdrop-blur-md">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#d4af37]">
            {inRegistration ? 'Edit registration layout' : 'Edit hall layout'}
          </div>
          <p className="mt-1 text-[10px] leading-relaxed text-white/55">
            <strong className="text-white/75">Click object</strong> to select · <strong className="text-white/75">G</strong> move · <strong className="text-white/75">R</strong> rotate · <strong className="text-white/75">S</strong> resize
            {inRegistration ? (
              <>
                {' '}
                · <strong className="text-white/75">WASD</strong> walk · click scene to look · desk: drag{' '}
                <strong className="text-white/75">green Y ring</strong> to spin
              </>
            ) : (
              <>
                {' '}
                · <strong className="text-white/75">Entry spawn</strong> = where visitors appear
              </>
            )}
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

      {!inRegistration && (
        <div className="mt-2">
          <button
            type="button"
            className="w-full rounded-lg border border-[#d4af37]/40 bg-[#d4af37]/10 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#f5e6b8] hover:bg-[#d4af37]/20"
            onClick={captureEntryFromPlayer}
          >
            Use my position as entry
          </button>
        </div>
      )}

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

      {sel && (
        <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.04] p-2.5">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-[#d4af37]">
            World coordinates (meters)
          </div>
          <p className="mt-1 text-[10px] leading-relaxed text-white/50">
            Live values from the selected object. Hall: X west (-) to east (+), Z north (-) to south (+), Y up.
            {selectedBoothId ? ' West booths often use Y rotation 90 degrees.' : ''}
          </p>
          <div className="mt-2 text-[9px] font-semibold uppercase tracking-wide text-white/35">Position</div>
          <div className="mt-1 grid grid-cols-3 gap-2">
            {(
              [
                ['X', posX, setPosX],
                ['Y', posY, setPosY],
                ['Z', posZ, setPosZ],
              ] as const
            ).map(([label, value, setValue]) => (
              <label key={label} className="block">
                <span className="text-[9px] uppercase text-white/40">{label}</span>
                <input
                  type="number"
                  step={0.1}
                  value={value}
                  onFocus={() => { coordTypingRef.current = true; }}
                  onBlur={() => { coordTypingRef.current = false; syncCoordsFromSelection(); }}
                  onChange={(e) => setValue(e.target.value)}
                  className={coordInputClassName()}
                />
              </label>
            ))}
          </div>
          <div className="mt-2 text-[9px] font-semibold uppercase tracking-wide text-white/35">Rotation (degrees)</div>
          <div className="mt-1 grid grid-cols-3 gap-2">
            {(
              [
                ['X', rotXDeg, setRotXDeg],
                ['Y', rotYDeg, setRotYDeg],
                ['Z', rotZDeg, setRotZDeg],
              ] as const
            ).map(([label, value, setValue]) => (
              <label key={label} className="block">
                <span className="text-[9px] uppercase text-white/40">{label}</span>
                <input
                  type="number"
                  step={0.5}
                  value={value}
                  onFocus={() => { coordTypingRef.current = true; }}
                  onBlur={() => { coordTypingRef.current = false; syncCoordsFromSelection(); }}
                  onChange={(e) => setValue(e.target.value)}
                  className={coordInputClassName()}
                />
              </label>
            ))}
          </div>
          <div className="mt-2 text-[9px] font-semibold uppercase tracking-wide text-white/35">Scale</div>
          <div className="mt-1 grid grid-cols-3 gap-2">
            {(
              [
                ['Width', scaleX, setScaleX],
                ['Height', scaleY, setScaleY],
                ['Depth', scaleZ, setScaleZ],
              ] as const
            ).map(([label, value, setValue]) => (
              <label key={label} className="block">
                <span className="text-[9px] uppercase text-white/40">{label}</span>
                <input
                  type="number"
                  min={0.1}
                  max={3}
                  step={0.05}
                  value={value}
                  onFocus={() => { coordTypingRef.current = true; }}
                  onBlur={() => { coordTypingRef.current = false; syncCoordsFromSelection(); }}
                  onChange={(e) => setValue(e.target.value)}
                  className={coordInputClassName()}
                />
              </label>
            ))}
          </div>
          <button
            type="button"
            className="mt-2 w-full rounded-lg border border-[#d4af37]/35 bg-[#d4af37]/15 px-2 py-1.5 text-[10px] font-semibold uppercase text-[#f5e6b8] hover:bg-[#d4af37]/25"
            onClick={applyCoordinates}
          >
            Apply coordinates
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
          if (next?.startsWith('reg-')) setGizmoMode('translate');
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
                {aisleStandeeOptions.length > 0 && (
                  <optgroup label="Aisle digital standees (GLB)">
                    {aisleStandeeOptions.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="Booth displays (LED / standee)">
                  {boothDisplayOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Whole booths">
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

      <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.04] p-2.5">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-[#d4af37]">Sync layout</div>
        <p className="mt-1 text-[10px] leading-relaxed text-white/50">
          Aligned models are stored in this browser until exported. On production: Export → import here, or Save to{' '}
          <span className="text-white/70">public/booth-cms.json</span> (localhost dev only).
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg border border-[#d4af37]/35 bg-[#d4af37]/15 px-2 py-1 text-[10px] font-semibold uppercase text-[#f5e6b8] hover:bg-[#d4af37]/25"
            onClick={exportLayoutJson}
          >
            Export JSON
          </button>
          <input
            ref={layoutImportRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) importLayoutJson(file);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            className="rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-[10px] font-semibold uppercase text-white/85 hover:bg-white/15"
            onClick={() => layoutImportRef.current?.click()}
          >
            Import JSON
          </button>
          {import.meta.env.DEV && (
            <button
              type="button"
              className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-2 py-1 text-[10px] font-semibold uppercase text-cyan-100 hover:bg-cyan-500/20"
              onClick={() => void saveLayoutToBoothCmsFile()}
            >
              Save booth-cms.json
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
