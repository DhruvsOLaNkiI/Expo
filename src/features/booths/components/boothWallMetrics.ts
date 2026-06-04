/** Shared booth side-wall / entrance-wing dimensions (StandardLuxury + EcoEden). */
export const BOOTH_WALL = {
  sideCenterX: 5.75,
  sideThickness: 0.5,
  sideHeight: 6,
  mainDepth: 4,
  mainCenterZ: -2,
  wingDepth: 1.25,
  wingCenterZ: 0.625,
  /** Wall mesh center Y (sideHeight / 2). */
  wallCenterY: 3,
  /** Inner booth face x=±5.5 */
  innerFaceX: 5.499,
  /** Outer aisle face x=±6.0 — nudged 6 mm outward so posters sit on the wall, not inside it */
  outerFaceX: 6.006,
  innerPosterY: 3,
  innerPosterZ: 0.625,
  innerPosterMaxW: 1.05,
  innerPosterMaxH: 2.6,
  exteriorPosterY: 3,
  exteriorPosterZ: -2,
  exteriorPosterMaxW: 2.3,
  exteriorPosterMaxH: 3.2,
} as const;

export function boothSideWallMainArgs(): [number, number, number] {
  return [BOOTH_WALL.sideThickness, BOOTH_WALL.sideHeight, BOOTH_WALL.mainDepth];
}

export function boothSideWallWingArgs(): [number, number, number] {
  return [BOOTH_WALL.sideThickness, BOOTH_WALL.sideHeight, BOOTH_WALL.wingDepth];
}

export type BoothPlacementSlot =
  | 'exteriorLeft'
  | 'exteriorRight'
  | 'interiorLeft'
  | 'interiorRight'
  | 'counterFront';

export const BOOTH_PLACEMENT_SLOT_LABELS: Record<BoothPlacementSlot, string> = {
  exteriorLeft: 'Left wall · outside',
  exteriorRight: 'Right wall · outside',
  interiorLeft: 'Left wall · inside',
  interiorRight: 'Right wall · inside',
  counterFront: 'Counter front',
};

export type BoothPlacementAdjust = {
  /** Slide left/right on the wall face (metres). */
  offsetX?: number;
  /** Slide up/down on the wall face (metres). */
  offsetY?: number;
  /** Size multiplier (0.5–1.5). */
  scale?: number;
};

export type BoothWallPlacementAdjustments = Partial<Record<BoothPlacementSlot, BoothPlacementAdjust>>;

export const PLACEMENT_ADJUST_LIMITS = {
  offsetX: { min: -1.2, max: 1.2, step: 0.05 },
  offsetY: { min: -1.5, max: 1.5, step: 0.05 },
  scale: { min: 0.5, max: 3, step: 0.05 },
} as const;

export function normalizePlacementAdjust(adjust?: BoothPlacementAdjust) {
  return {
    offsetX: adjust?.offsetX ?? 0,
    offsetY: adjust?.offsetY ?? 0,
    scale: adjust?.scale ?? 1,
  };
}

export function compactWallPlacementAdjustments(
  adjustments: BoothWallPlacementAdjustments,
): BoothWallPlacementAdjustments | undefined {
  const out: BoothWallPlacementAdjustments = {};
  for (const slot of Object.keys(adjustments) as BoothPlacementSlot[]) {
    const raw = adjustments[slot];
    if (!raw) continue;
    const { offsetX, offsetY, scale } = normalizePlacementAdjust(raw);
    if (offsetX === 0 && offsetY === 0 && scale === 1) continue;
    out[slot] = {
      ...(offsetX !== 0 ? { offsetX } : {}),
      ...(offsetY !== 0 ? { offsetY } : {}),
      ...(scale !== 1 ? { scale } : {}),
    };
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export type BoothWallPlacementInput = {
  sideWallLeftImageUrl?: string;
  sideWallRightImageUrl?: string;
  exteriorWallLeftImageUrl?: string;
  exteriorWallRightImageUrl?: string;
  counterFrontImageUrl?: string;
  wallPlacementAdjustments?: BoothWallPlacementAdjustments;
};

/** Map stored booth fields to inside vs outside wall slots. */
export function resolveBoothWallPlacementUrls(input: BoothWallPlacementInput) {
  return {
    interiorLeft: input.sideWallLeftImageUrl,
    interiorRight: input.sideWallRightImageUrl,
    exteriorLeft: input.exteriorWallLeftImageUrl,
    exteriorRight: input.exteriorWallRightImageUrl,
    counterFront: input.counterFrontImageUrl,
  };
}
