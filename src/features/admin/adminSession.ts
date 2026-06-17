import { normalizeVisitorId, readVisitorProfile, type VisitorProfile } from '@/features/visitor/visitorProfile';
import { getAdminVisitorIds } from './adminVisitors';

const ADMIN_SESSION_FLAG = 'virtual-expo-admin-session';
const ADMIN_KEY_STORAGE = 'virtual-expo-admin-key';

/** Dev default — override in production with VITE_EXPO_ADMIN_KEY in .env */
export function getAdminKeyFromEnv(): string {
  const fromEnv = import.meta.env.VITE_EXPO_ADMIN_KEY?.trim();
  return fromEnv || 'expo-admin-dev';
}

/** Key-based admin session OR assigned visitor ID. */
export function computeIsAdmin(profile: VisitorProfile | null | undefined): boolean {
  if (profile && getAdminVisitorIds().includes(normalizeVisitorId(profile.id))) return true;
  return readAdminSession();
}

export function validateAdminKey(key: string): boolean {
  const entered = key.trim();
  if (!entered) return false;
  return entered === getAdminKeyFromEnv();
}

export function readAdminSession(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(ADMIN_SESSION_FLAG) === '1';
  } catch {
    return false;
  }
}

export function persistAdminSession(active: boolean, adminKey?: string): void {
  if (typeof window === 'undefined') return;
  try {
    if (active) {
      sessionStorage.setItem(ADMIN_SESSION_FLAG, '1');
      if (adminKey?.trim()) sessionStorage.setItem(ADMIN_KEY_STORAGE, adminKey.trim());
    } else {
      sessionStorage.removeItem(ADMIN_SESSION_FLAG);
      sessionStorage.removeItem(ADMIN_KEY_STORAGE);
    }
  } catch {
    /* */
  }
}

/** Sent on CMS / scene write APIs so the dev server can reject non-admin saves. */
export function getAdminApiHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const headers: Record<string, string> = {};
    const key = sessionStorage.getItem(ADMIN_KEY_STORAGE);
    if (key) headers['X-Expo-Admin-Key'] = key;
    const profile = readVisitorProfile();
    if (profile && getAdminVisitorIds().includes(normalizeVisitorId(profile.id))) {
      headers['X-Expo-Admin-Visitor-Id'] = normalizeVisitorId(profile.id);
    }
    return headers;
  } catch {
    return {};
  }
}
