import {
  applyBoothOverrides,
  buildDefaultBoothLayoutList,
  type BoothLayoutConfig,
  type BoothLayoutPatch,
  type HallLayoutConfig,
  type SceneOverridesInput,
} from './boothLayouts';

/** Booth fields copied when applying layout from another hall (not branding/media). */
const BOOTH_LAYOUT_KEYS = ['position', 'rotation', 'scale', 'displayLayout'] as const;

export type BoothLayoutOnlyPatch = Pick<
  BoothLayoutPatch,
  (typeof BOOTH_LAYOUT_KEYS)[number]
>;

/** Build per-slot layout patches from resolved booth configs (defaults + overrides merged). */
export function extractBoothLayoutPatches(
  booths: BoothLayoutConfig[],
): Record<string, BoothLayoutOnlyPatch> {
  const out: Record<string, BoothLayoutOnlyPatch> = {};
  for (const b of booths) {
    const patch: BoothLayoutOnlyPatch = {
      position: [...b.position] as [number, number, number],
      rotation: [...b.rotation] as [number, number, number],
      scale: [...b.scale] as [number, number, number],
    };
    if (b.displayLayout) {
      patch.displayLayout = JSON.parse(JSON.stringify(b.displayLayout));
    }
    out[b.id] = patch;
  }
  return out;
}

export function extractBoothLayoutPatchesFromOverrides(
  overrides: Record<string, BoothLayoutPatch>,
): Record<string, BoothLayoutOnlyPatch> {
  const defaults = buildDefaultBoothLayoutList();
  const merged = applyBoothOverrides(defaults, overrides);
  return extractBoothLayoutPatches(merged);
}

/** Layout patch for one booth slot (position / rotation / scale / displayLayout). */
export function extractSingleBoothLayoutPatch(
  slotId: string,
  overrides: Record<string, BoothLayoutPatch>,
): BoothLayoutOnlyPatch | null {
  const all = extractBoothLayoutPatchesFromOverrides(overrides);
  return all[slotId] ?? null;
}

/** Hall spawn + lobby offsets copied with booth layout. */
export function extractHallSceneLayoutPatch(
  scene: SceneOverridesInput | undefined,
): Pick<SceneOverridesInput, 'hallLayout'> | null {
  const hl = scene?.hallLayout;
  if (!hl || typeof hl !== 'object') return null;
  return {
    hallLayout: JSON.parse(JSON.stringify(hl)) as Partial<HallLayoutConfig>,
  };
}

/** Merge layout-only patches into existing booth overrides (keeps logos, colors, etc.). */
export function mergeLayoutIntoBoothOverrides(
  existing: Record<string, BoothLayoutPatch>,
  layoutBySlot: Record<string, BoothLayoutOnlyPatch>,
): Record<string, BoothLayoutPatch> {
  const next: Record<string, BoothLayoutPatch> = { ...existing };
  const defaultIds = new Set(buildDefaultBoothLayoutList().map((b) => b.id));
  for (const [slotId, layout] of Object.entries(layoutBySlot)) {
    if (!defaultIds.has(slotId)) continue;
    const entry: BoothLayoutPatch = { ...(next[slotId] ?? {}) };
    entry.position = [...layout.position] as [number, number, number];
    entry.rotation = [...layout.rotation] as [number, number, number];
    entry.scale = [...layout.scale] as [number, number, number];
    if (layout.displayLayout) {
      entry.displayLayout = JSON.parse(JSON.stringify(layout.displayLayout));
    }
    next[slotId] = entry;
  }
  return next;
}
