import {
  BOOTH_ROW_X_WEST,
  BOOTH_ROW_Z,
  type HallLayoutConfig,
} from './boothLayouts';

/** Registration lobby world (separate from main expo hall). */

/** Boutique luxury registration lobby — compact, human-scale proportions. */
export const REG_HALL = {
  halfW: 13,
  halfD: 17,
  height: 9,
  /** World-space center of the lobby volume */
  centerZ: -82,
} as const;

/** South entry — visitor approaches reception to the north. */
export const REG_SPAWN: [number, number, number] = [
  0,
  1.7,
  REG_HALL.centerZ + REG_HALL.halfD - 7,
];

/** West aisle — between north & center west-row booths (hall map entry zone). */
export const WEST_AISLE_ENTRY_Z = (BOOTH_ROW_Z[0] + BOOTH_ROW_Z[1]) / 2;

/** Default visitor entry — west side, between Vertex and Crown (as marked on hall map). */
export const DEFAULT_MAIN_EXPO_SPAWN: [number, number, number] = [
  BOOTH_ROW_X_WEST,
  1.7,
  WEST_AISLE_ENTRY_Z,
];

/** Yaw (rad) so the camera looks toward the Help Desk from west-side entry. */
export const DEFAULT_MAIN_EXPO_SPAWN_YAW = Math.atan2(-BOOTH_ROW_X_WEST, WEST_AISLE_ENTRY_Z);

export const REG_MAIN_EXPO_SPAWN = DEFAULT_MAIN_EXPO_SPAWN;

export function resolveMainExpoSpawn(
  hall?: Partial<Pick<HallLayoutConfig, 'mainExpoSpawn'>>,
): [number, number, number] {
  const s = hall?.mainExpoSpawn;
  if (s && s.length === 3 && s.every((n) => Number.isFinite(n))) {
    return [s[0], s[1], s[2]];
  }
  return DEFAULT_MAIN_EXPO_SPAWN;
}

export function resolveMainExpoSpawnYaw(
  hall?: Partial<Pick<HallLayoutConfig, 'mainExpoSpawnYaw'>>,
): number {
  const y = hall?.mainExpoSpawnYaw;
  return typeof y === 'number' && Number.isFinite(y) ? y : DEFAULT_MAIN_EXPO_SPAWN_YAW;
}

/** North end of lobby — reception desk + LED backdrop anchor. */
export const REG_RECEPTION_Z = REG_HALL.centerZ - REG_HALL.halfD + 7;

export function regBounds() {
  const { halfW, halfD, centerZ } = REG_HALL;
  return {
    minX: -halfW + 1.5,
    maxX: halfW - 1.5,
    minZ: centerZ - halfD + 1.5,
    maxZ: centerZ + halfD - 1.5,
  };
}
