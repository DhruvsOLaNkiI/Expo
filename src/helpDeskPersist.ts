import type { DeveloperListMode, PropertyTypeChoice } from './data/helpDeskCatalog';

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

function read(): HelpDeskSearchMemory {
  if (typeof window === 'undefined') return { ...DEFAULT };
  try {
    const raw = localStorage.getItem(LS_KEY);
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

function write(data: HelpDeskSearchMemory) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ ...data, updatedAt: Date.now() }));
  } catch {
    /* ignore quota */
  }
}

export function loadHelpDeskMemory(): HelpDeskSearchMemory {
  return read();
}

export function saveHelpDeskPreferences(input: {
  propertyType?: PropertyTypeChoice;
  listMode?: DeveloperListMode;
  lastBoothIds?: string[];
}) {
  const cur = read();
  write({
    ...cur,
    propertyType: input.propertyType ?? cur.propertyType,
    listMode: input.listMode ?? cur.listMode,
    lastBoothIds: input.lastBoothIds ?? cur.lastBoothIds,
  });
}

export function pushRecentDeveloper(boothId: string) {
  const cur = read();
  const recent = [boothId, ...cur.recentBoothIds.filter((id) => id !== boothId)].slice(0, 8);
  write({ ...cur, recentBoothIds: recent });
}

export function toggleSavedDeveloper(boothId: string): boolean {
  const cur = read();
  const saved = new Set(cur.savedBoothIds);
  if (saved.has(boothId)) {
    saved.delete(boothId);
  } else {
    saved.add(boothId);
  }
  write({ ...cur, savedBoothIds: [...saved] });
  return saved.has(boothId);
}

export function isDeveloperSaved(boothId: string): boolean {
  return read().savedBoothIds.includes(boothId);
}
