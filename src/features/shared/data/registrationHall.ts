import { HALL_HALF_DEPTH } from './boothLayouts';

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

export const REG_MAIN_EXPO_SPAWN: [number, number, number] = [0, 1.7, HALL_HALF_DEPTH - 2];

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
