import type { BoothLayoutPatch } from './data/boothLayouts';

const BOOTH_CMS_LS_KEY = 'virtual-expo-booth-cms-overrides';
const IDB_NAME = 'virtual-expo-cms';
const IDB_STORE = 'kv';
const IDB_BOOTH_KEY = 'booth-overrides';

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

async function idbPutJson(json: string): Promise<boolean> {
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
        tx.objectStore(IDB_STORE).put(json, IDB_BOOTH_KEY);
      } catch {
        db.close();
        resolve(false);
      }
    });
  } catch {
    return false;
  }
}

async function idbGetJson(): Promise<string | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const rq = tx.objectStore(IDB_STORE).get(IDB_BOOTH_KEY);
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

async function idbDeleteJson(): Promise<void> {
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
        tx.objectStore(IDB_STORE).delete(IDB_BOOTH_KEY);
      } catch {
        db.close();
        resolve();
      }
    });
  } catch {
    /* */
  }
}

/** Try localStorage; on quota error persist full JSON to IndexedDB instead. */
export async function persistBoothOverridesWithFallback(overrides: Record<string, BoothLayoutPatch>): Promise<boolean> {
  const json = JSON.stringify(overrides);
  try {
    localStorage.setItem(BOOTH_CMS_LS_KEY, json);
    void idbDeleteJson();
    return true;
  } catch (e) {
    if (import.meta.env.DEV) console.warn('[virtual-expo] booth CMS: localStorage full, using IndexedDB', e);
    return idbPutJson(json);
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

/** Merge localStorage + IndexedDB booth patches (IDB field values win per booth). */
export async function readPersistedBoothOverrides(): Promise<Record<string, BoothLayoutPatch>> {
  let fromLs: Record<string, BoothLayoutPatch> = {};
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(BOOTH_CMS_LS_KEY);
      if (raw) fromLs = parseOverrides(raw);
    }
  } catch {
    fromLs = {};
  }

  const idbRaw = await idbGetJson();
  const fromIdb = parseOverrides(idbRaw);

  const ids = new Set([...Object.keys(fromLs), ...Object.keys(fromIdb)]);
  const merged: Record<string, BoothLayoutPatch> = {};
  for (const id of ids) {
    merged[id] = { ...(fromLs[id] || {}), ...(fromIdb[id] || {}) };
  }
  return merged;
}
