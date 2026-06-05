import { DEFAULT_MAIN_EXPO_SPAWN } from './registrationHall';

export type ExpoHallMeta = {
  hallId: string;
  label: string;
  sortOrder: number;
  enabled: boolean;
  /** Visitor spawn when entering this hall (same layout template for all halls). */
  spawn: [number, number, number];
};

export const DEFAULT_EXPO_HALL_ID = 'hall-1';

/** Six identical-layout expo halls — CMS overview + Fast Travel. */
export const DEFAULT_EXPO_HALLS: ExpoHallMeta[] = [
  { hallId: 'hall-1', label: 'Expo Hall 1', sortOrder: 1, enabled: true, spawn: [...DEFAULT_MAIN_EXPO_SPAWN] },
  { hallId: 'hall-2', label: 'Expo Hall 2', sortOrder: 2, enabled: true, spawn: [...DEFAULT_MAIN_EXPO_SPAWN] },
  { hallId: 'hall-3', label: 'Expo Hall 3', sortOrder: 3, enabled: true, spawn: [...DEFAULT_MAIN_EXPO_SPAWN] },
  { hallId: 'hall-4', label: 'Expo Hall 4', sortOrder: 4, enabled: true, spawn: [...DEFAULT_MAIN_EXPO_SPAWN] },
  { hallId: 'hall-5', label: 'Expo Hall 5', sortOrder: 5, enabled: true, spawn: [...DEFAULT_MAIN_EXPO_SPAWN] },
  { hallId: 'hall-6', label: 'Expo Hall 6', sortOrder: 6, enabled: true, spawn: [...DEFAULT_MAIN_EXPO_SPAWN] },
];

export function normalizeHallId(hallId: string | undefined | null): string {
  const t = hallId?.trim();
  return t && DEFAULT_EXPO_HALLS.some((h) => h.hallId === t) ? t : DEFAULT_EXPO_HALL_ID;
}

export function getExpoHallMeta(hallId: string): ExpoHallMeta | undefined {
  return DEFAULT_EXPO_HALLS.find((h) => h.hallId === normalizeHallId(hallId));
}

/** Legacy Mongo docs used global boothId only — map to first hall. */
export const LEGACY_EXPO_HALL_ID = 'hall-1';

/** One row per hallId — fixes duplicate DB seed rows showing twice in CMS. */
export function dedupeExpoHalls(halls: ExpoHallMeta[]): ExpoHallMeta[] {
  const byId = new Map<string, ExpoHallMeta>();
  for (const h of halls) {
    if (!h?.hallId || byId.has(h.hallId)) continue;
    byId.set(h.hallId, h);
  }
  return [...byId.values()].sort((a, b) => a.sortOrder - b.sortOrder);
}
