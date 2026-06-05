import type { BoothLayoutPatch } from '@/features/shared/data/boothLayouts';
import { mergeBoothDisplayLayout } from '@/features/shared/data/boothDisplayLayout';
import { DEFAULT_EXPO_HALL_ID, normalizeHallId } from '@/features/shared/data/expoHalls';

const BOOTH_CMS_LS_KEY = 'virtual-expo-booth-cms-overrides';
const BOOTH_CMS_LS_KEY_PREFIX = 'virtual-expo-booth-cms-overrides:';

/** Fired after booth overrides are written (expo tab can listen; `storage` only fires across tabs). */
export const BOOTH_CMS_PERSIST_EVENT = 'virtual-expo-booth-cms-updated';

function notifyBoothCmsPersisted() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(BOOTH_CMS_PERSIST_EVENT));
}

const IDB_NAME = 'virtual-expo-cms';
const IDB_STORE = 'kv';
const IDB_BOOTH_KEY = 'booth-overrides';
const IDB_BOOTH_KEY_PREFIX = 'booth-overrides:';

function boothLsKey(hallId: string): string {
  return `${BOOTH_CMS_LS_KEY_PREFIX}${normalizeHallId(hallId)}`;
}

function boothIdbKey(hallId: string): string {
  return `${IDB_BOOTH_KEY_PREFIX}${normalizeHallId(hallId)}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('indexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
    };
    req.onerror = () => reject(req.error ?? new Error('IDB open failed'));
    req.onsuccess = () => resolve(req.result);
  });
}

async function idbPutJson(json: string, key: string = IDB_BOOTH_KEY): Promise<boolean> {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.oncomplete = () => {
        db.close();
        resolve(true);
      };
      tx.onerror = () => {
        db.close();
        resolve(false);
      };
      tx.onabort = () => {
        db.close();
        resolve(false);
      };
      try {
        tx.objectStore(IDB_STORE).put(json, key);
      } catch {
        db.close();
        resolve(false);
      }
    });
  } catch {
    return false;
  }
}

async function idbGetJson(key: string = IDB_BOOTH_KEY): Promise<string | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const rq = tx.objectStore(IDB_STORE).get(key);
      rq.onsuccess = () => {
        const v = rq.result;
        db.close();
        resolve(typeof v === 'string' ? v : null);
      };
      rq.onerror = () => {
        db.close();
        resolve(null);
      };
    });
  } catch {
    return null;
  }
}

async function idbDeleteJson(key: string = IDB_BOOTH_KEY): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
      try {
        tx.objectStore(IDB_STORE).delete(key);
      } catch {
        db.close();
        resolve();
      }
    });
  } catch {
    /* */
  }
}

/** Theme fields — must survive LS/IDB merge when LS is stale but IDB has the latest save. */
const BOOTH_THEME_KEYS = [
  'color',
  'accent',
  'counterColor',
  'backWallColor',
  'tvWallColor',
  'headerFasciaColor',
  'counterTopColor',
] as const;

/** Merge two booth patches; `overlay` wins scalars. Nested objects are deep-merged. */
export function mergeBoothLayoutPatch(
  base: BoothLayoutPatch | undefined,
  overlay: BoothLayoutPatch | undefined,
): BoothLayoutPatch {
  const idb = base || {};
  const ls = overlay || {};
  const out: BoothLayoutPatch = { ...idb, ...ls };
  for (const key of BOOTH_THEME_KEYS) {
    const lsVal = ls[key];
    const idbVal = idb[key];
    const lsMissing = lsVal === undefined || lsVal === null || lsVal === '';
    if (lsMissing && idbVal !== undefined && idbVal !== null && idbVal !== '') {
      (out as Record<string, unknown>)[key] = idbVal;
    }
  }
  if (idb.headerBranding || ls.headerBranding) {
    out.headerBranding = { ...(idb.headerBranding ?? {}), ...(ls.headerBranding ?? {}) };
  }
  if (idb.company || ls.company) {
    out.company = { ...(idb.company ?? {}), ...(ls.company ?? {}) };
  }
  if (idb.lighting || ls.lighting) {
    out.lighting = { ...(idb.lighting ?? {}), ...(ls.lighting ?? {}) };
  }
  if (idb.assignedSalesPerson || ls.assignedSalesPerson) {
    out.assignedSalesPerson = {
      ...(idb.assignedSalesPerson ?? { name: '', email: '', phone: '' }),
      ...(ls.assignedSalesPerson ?? {}),
    };
  }
  if (idb.displayLayout || ls.displayLayout) {
    out.displayLayout = mergeBoothDisplayLayout(idb.displayLayout, ls.displayLayout);
  }
  return out;
}

function mergeBoothPatches(
  fromIdb: BoothLayoutPatch | undefined,
  fromLs: BoothLayoutPatch | undefined,
): BoothLayoutPatch {
  return mergeBoothLayoutPatch(fromIdb, fromLs);
}

/** Try localStorage; on quota error persist full JSON to IndexedDB instead. */
export async function persistBoothOverridesWithFallback(
  overrides: Record<string, BoothLayoutPatch>,
  hallId: string = DEFAULT_EXPO_HALL_ID,
): Promise<boolean> {
  const json = JSON.stringify(overrides);
  const lsKey = boothLsKey(hallId);
  const idbKey = boothIdbKey(hallId);
  try {
    localStorage.setItem(lsKey, json);
    if (normalizeHallId(hallId) === DEFAULT_EXPO_HALL_ID) {
      localStorage.setItem(BOOTH_CMS_LS_KEY, json);
    }
    void idbDeleteJson(idbKey);
    notifyBoothCmsPersisted();
    return true;
  } catch (e) {
    if (import.meta.env.DEV) console.warn('[virtual-expo] booth CMS: localStorage full, using IndexedDB', e);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(lsKey);
        if (normalizeHallId(hallId) === DEFAULT_EXPO_HALL_ID) {
          localStorage.removeItem(BOOTH_CMS_LS_KEY);
        }
      }
    } catch {
      /* */
    }
    const ok = await idbPutJson(json, idbKey);
    if (ok) notifyBoothCmsPersisted();
    return ok;
  }
}

function parseOverrides(raw: string | null): Record<string, BoothLayoutPatch> {
  if (!raw) return {};
  try {
    const j = JSON.parse(raw) as unknown;
    return j && typeof j === 'object' && !Array.isArray(j) ? (j as Record<string, BoothLayoutPatch>) : {};
  } catch {
    return {};
  }
}

/** Merge localStorage + IndexedDB booth patches (localStorage wins per field when both exist). */
export async function readPersistedBoothOverrides(
  hallId: string = DEFAULT_EXPO_HALL_ID,
): Promise<Record<string, BoothLayoutPatch>> {
  const h = normalizeHallId(hallId);
  const lsKey = boothLsKey(h);
  const idbKey = boothIdbKey(h);
  let fromLs: Record<string, BoothLayoutPatch> = {};
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(lsKey)
        ?? (h === DEFAULT_EXPO_HALL_ID ? localStorage.getItem(BOOTH_CMS_LS_KEY) : null);
      if (raw) fromLs = parseOverrides(raw);
    }
  } catch {
    fromLs = {};
  }

  let idbRaw = await idbGetJson(idbKey);
  if (!idbRaw && h === DEFAULT_EXPO_HALL_ID) {
    idbRaw = await idbGetJson(IDB_BOOTH_KEY);
  }
  const fromIdb = parseOverrides(idbRaw);

  const ids = new Set([...Object.keys(fromLs), ...Object.keys(fromIdb)]);
  const merged: Record<string, BoothLayoutPatch> = {};
  for (const id of ids) {
    merged[id] = mergeBoothPatches(fromIdb[id], fromLs[id]);
  }
  return merged;
}
