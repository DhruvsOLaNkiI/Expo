import { normalizeVisitorId, type VisitorProfile } from '@/features/visitor/visitorProfile';

/** Built-in admin visitors — extend via VITE_EXPO_ADMIN_VISITOR_IDS (comma-separated). */
const DEFAULT_ADMIN_VISITOR_IDS = ['VX-1BVJQ9CZ'];

export function getAdminVisitorIds(): string[] {
  const fromEnv = import.meta.env.VITE_EXPO_ADMIN_VISITOR_IDS?.trim();
  if (!fromEnv) return [...DEFAULT_ADMIN_VISITOR_IDS];
  const fromList = fromEnv.split(',').map((id) => normalizeVisitorId(id)).filter(Boolean);
  return fromList.length > 0 ? fromList : [...DEFAULT_ADMIN_VISITOR_IDS];
}

export function isAdminVisitorId(visitorId: string | null | undefined): boolean {
  if (!visitorId) return false;
  return getAdminVisitorIds().includes(normalizeVisitorId(visitorId));
}

export function isVisitorAssignedAdmin(profile: VisitorProfile | null | undefined): boolean {
  return profile ? isAdminVisitorId(profile.id) : false;
}
