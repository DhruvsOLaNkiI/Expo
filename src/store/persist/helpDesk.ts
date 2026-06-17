import type { DeveloperListMode, PropertyTypeChoice } from '@/features/shared/data/helpDeskCatalog';
import { scopedStorageKey } from '@/features/visitor/visitorBrowserSession';

const LS_KEY = 'virtual-expo-help-desk-memory';

export type HelpDeskSearchMemory = {
  propertyType?: PropertyTypeChoice;
  listMode?: DeveloperListMode;
  lastBoothIds: string[];
  savedBoothIds: string[];
  recentBoothIds: string[];
  updatedAt: number;
};

const DEFAULT: HelpDeskSearchMemory = {
  lastBoothIds: [],
  savedBoothIds: [],
  recentBoothIds: [],
  updatedAt: 0,
};

function read(visitorId?: string | null): HelpDeskSearchMemory {
  if (typeof window === 'undefined') return { ...DEFAULT };
  try {
    const raw = localStorage.getItem(scopedStorageKey(LS_KEY, visitorId));
    if (!raw) return { ...DEFAULT };
    const parsed = JSON.parse(raw) as Partial<HelpDeskSearchMemory>;
    return {
      ...DEFAULT,
      ...parsed,
      lastBoothIds: parsed.lastBoothIds ?? [],
      savedBoothIds: parsed.savedBoothIds ?? [],
      recentBoothIds: parsed.recentBoothIds ?? [],
    };
  } catch {
    return { ...DEFAULT };
  }
}

function write(data: HelpDeskSearchMemory, visitorId?: string | null) {
  try {
    localStorage.setItem(
      scopedStorageKey(LS_KEY, visitorId),
      JSON.stringify({ ...data, updatedAt: Date.now() }),
    );
  } catch {
    /* ignore quota */
  }
}

export function loadHelpDeskMemory(visitorId?: string | null): HelpDeskSearchMemory {
  return read(visitorId);
}

export function saveHelpDeskPreferences(
  input: {
    propertyType?: PropertyTypeChoice;
    listMode?: DeveloperListMode;
    lastBoothIds?: string[];
  },
  visitorId?: string | null,
) {
  const cur = read(visitorId);
  write(
    {
    ...cur,
    propertyType: input.propertyType ?? cur.propertyType,
    listMode: input.listMode ?? cur.listMode,
    lastBoothIds: input.lastBoothIds ?? cur.lastBoothIds,
    },
    visitorId,
  );
}

export function pushRecentDeveloper(boothId: string, visitorId?: string | null) {
  const cur = read(visitorId);
  const recent = [boothId, ...cur.recentBoothIds.filter((id) => id !== boothId)].slice(0, 8);
  write({ ...cur, recentBoothIds: recent }, visitorId);
}

export function toggleSavedDeveloper(boothId: string, visitorId?: string | null): boolean {
  const cur = read(visitorId);
  const saved = new Set(cur.savedBoothIds);
  if (saved.has(boothId)) {
    saved.delete(boothId);
  } else {
    saved.add(boothId);
  }
  write({ ...cur, savedBoothIds: [...saved] }, visitorId);
  return saved.has(boothId);
}

export function isDeveloperSaved(boothId: string, visitorId?: string | null): boolean {
  return read(visitorId).savedBoothIds.includes(boothId);
}
