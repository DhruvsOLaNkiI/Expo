/** Per-visitor browser scope — keeps chats, analytics, and prefs isolated between users. */

const ANON_SCOPE_KEY = 'vr-expo-anonymous-browser-scope';

/** Stable anonymous scope for this browser tab (before registration). */
export function getAnonymousBrowserScope(): string {
  if (typeof window === 'undefined') return 'anon_server';
  try {
    let id = sessionStorage.getItem(ANON_SCOPE_KEY);
    if (!id) {
      id = `anon_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(ANON_SCOPE_KEY, id);
    }
    return id;
  } catch {
    return `anon_${Date.now()}`;
  }
}

/** Call when logging out so the next guest on this device gets a fresh scope. */
export function resetAnonymousBrowserScope(): void {
  try {
    sessionStorage.removeItem(ANON_SCOPE_KEY);
  } catch {
    /* */
  }
}

/** Registered visitor id, or anonymous tab scope. */
export function getVisitorStorageScope(visitorId?: string | null): string {
  const id = visitorId?.trim();
  return id ? `v:${id}` : getAnonymousBrowserScope();
}

export function scopedStorageKey(baseKey: string, visitorId?: string | null): string {
  return `${baseKey}:${getVisitorStorageScope(visitorId)}`;
}
