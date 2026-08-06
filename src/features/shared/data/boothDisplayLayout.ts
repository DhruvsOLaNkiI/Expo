/** Per-booth LED / standee / kiosk transforms (Edit layout → Displays). */
export type BoothDisplaySlot = 'main' | 'counter' | 'standee' | 'signage' | 'kiosk' | 'ceilingBoard';

export type BoothDisplayTransform = {
  position: [number, number, number];
  rotation: [number, number, number];
  scale?: [number, number, number];
};

export type BoothDisplayLayout = Partial<Record<BoothDisplaySlot, BoothDisplayTransform>>;

export const BOOTH_DISPLAY_SLOT_LABELS: Record<BoothDisplaySlot, string> = {
  main: 'Main LED wall',
  counter: 'Counter tablet',
  standee: 'Roll-up standee',
  signage: 'Signage board',
  kiosk: 'CTA kiosk',
  ceilingBoard: 'Ceiling hanging board',
};

export function boothDisplayObjectName(boothId: string, slot: BoothDisplaySlot): string {
  return `booth-display-${boothId}__${slot}`;
}

export function parseBoothDisplayObjectName(
  name: string,
): { boothId: string; slot: BoothDisplaySlot } | null {
  if (!name.startsWith('booth-display-')) return null;
  const body = name.slice('booth-display-'.length);
  const sep = body.indexOf('__');
  if (sep <= 0) return null;
  const boothId = body.slice(0, sep);
  const slot = body.slice(sep + 2) as BoothDisplaySlot;
  if (!BOOTH_DISPLAY_SLOT_LABELS[slot]) return null;
  return { boothId, slot };
}

export function mergeBoothDisplaySlot(
  layout: BoothDisplayLayout | undefined,
  slot: BoothDisplaySlot,
  defaults: BoothDisplayTransform,
): BoothDisplayTransform {
  const o = layout?.[slot];
  return {
    position: o?.position ?? defaults.position,
    rotation: o?.rotation ?? defaults.rotation,
    scale: o?.scale ?? defaults.scale,
  };
}

export function mergeBoothDisplayLayout(
  base: BoothDisplayLayout | undefined,
  patch: BoothDisplayLayout | undefined,
): BoothDisplayLayout | undefined {
  if (!patch) return base;
  if (!base) return patch;
  const slots = new Set([...Object.keys(base), ...Object.keys(patch)]) as Set<BoothDisplaySlot>;
  const out: BoothDisplayLayout = { ...base };
  for (const slot of slots) {
    const b = base[slot];
    const p = patch[slot];
    if (p) out[slot] = { ...b, ...p };
  }
  return out;
}

/** Standard luxury booth defaults (Luxe, Aurum, Crown, etc.). */
export const LUXURY_BOOTH_DISPLAY_DEFAULTS = {
  main: {
    position: [0, 3, -3.8] as [number, number, number],
    rotation: [0, 0, 0] as [number, number, number],
  },
  counter: {
    position: [1.2, 0.8, -0.2] as [number, number, number],
    rotation: [-0.2, -0.3, 0] as [number, number, number],
  },
  standee: {
    position: [2.76, 0, 3.4] as [number, number, number],
    rotation: [0, 0, 0] as [number, number, number],
  },
  signage: {
    position: [4.5, 0, 1.5] as [number, number, number],
    rotation: [0, -Math.PI / 6, 0] as [number, number, number],
  },
  ceilingBoard: {
    position: [0, 9.35, -2.75] as [number, number, number],
    rotation: [0, 0, 0] as [number, number, number],
  },
} satisfies Record<'main' | 'counter' | 'standee' | 'signage' | 'ceilingBoard', BoothDisplayTransform>;

export const VERTEX_ELITE_DISPLAY_DEFAULTS = {
  main: {
    position: [0, 3.2, -4.25] as [number, number, number],
    rotation: [0, 0, 0] as [number, number, number],
  },
  /** Local to floating desk group — right edge of counter, flush on gold trim. */
  counter: {
    position: [1.35, 1.02, -0.06] as [number, number, number],
    rotation: [-0.32, -0.18, 0] as [number, number, number],
  },
  kiosk: {
    position: [4.48, 0.03, 2.02] as [number, number, number],
    rotation: [0, 0.13, 0] as [number, number, number],
  },
} satisfies Record<'main' | 'counter' | 'kiosk', BoothDisplayTransform>;
