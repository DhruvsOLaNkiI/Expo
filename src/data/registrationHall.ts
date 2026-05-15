/** Registration lobby world (separate from main 90×90 expo hall). */

export const REG_HALL = {
  halfW: 24,
  halfD: 28,
  height: 12,
  /** World-space center of the lobby volume */
  centerZ: -82,
} as const;

export const REG_SPAWN: [number, number, number] = [0, 1.7, -58];
export const REG_MAIN_EXPO_SPAWN: [number, number, number] = [0, 1.7, 38];

/** Default world Z anchor for the movable reception zone (north end of lobby). */
export const REG_RECEPTION_Z = REG_HALL.centerZ - 18;

export function regBounds() {
  const { halfW, halfD, centerZ } = REG_HALL;
  return {
    minX: -halfW + 2,
    maxX: halfW - 2,
    minZ: centerZ - halfD + 2,
    maxZ: centerZ + halfD - 2,
  };
}
