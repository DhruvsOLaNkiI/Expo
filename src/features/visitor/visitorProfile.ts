export type VisitorAvatar = {
  outfitColor: string;
  skinTone: string;
  hairColor: string;
};

export type VisitorProfile = {
  id: string;
  displayName: string;
  avatar: VisitorAvatar;
  createdAt: number;
  email?: string;
  phone?: string;
};

const VISITOR_LS_KEY = 'virtual-expo-visitor-profile';

export const DEFAULT_AVATAR: VisitorAvatar = {
  outfitColor: '#1a2744',
  skinTone: '#c68642',
  hairColor: '#2c1810',
};

export const OUTFIT_SWATCHES = ['#1a2744', '#2d4a3e', '#3d2b1f', '#4a4a52', '#5c4033'] as const;
export const SKIN_SWATCHES = ['#f1c27d', '#c68642', '#8d5524'] as const;
export const HAIR_SWATCHES = ['#2c1810', '#4a3728', '#6b5344', '#1a1a1a', '#8b6914'] as const;

export function generateVisitorId(): string {
  const t = Date.now().toString(36).toUpperCase().slice(-4);
  const r = Math.random().toString(36).toUpperCase().slice(2, 6);
  return `VX-${t}${r}`;
}

/** Normalize visitor-entered IDs (e.g. vx-abc12 → VX-ABC12). */
export function normalizeVisitorId(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

export function isValidVisitorId(id: string): boolean {
  const n = normalizeVisitorId(id);
  return /^[A-Z0-9][A-Z0-9-]{3,23}$/.test(n);
}

export function readVisitorProfile(): VisitorProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(VISITOR_LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as VisitorProfile;
    if (!parsed?.id || !parsed?.displayName || !parsed?.avatar) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function persistVisitorProfile(profile: VisitorProfile): void {
  try {
    localStorage.setItem(VISITOR_LS_KEY, JSON.stringify(profile));
  } catch {
    /* */
  }
}

export function clearVisitorProfile(): void {
  try {
    localStorage.removeItem(VISITOR_LS_KEY);
  } catch {
    /* */
  }
}
