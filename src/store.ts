import { create } from 'zustand';
import type { BoothLayoutPatch, SceneConfig } from './data/boothLayouts';
import { DEFAULT_SCENE_CONFIG } from './data/boothLayouts';

const BOOTH_CMS_LS_KEY = 'virtual-expo-booth-cms-overrides';
const SCENE_CMS_LS_KEY = 'virtual-expo-scene-config';
const INTRO_DISMISSED_LS_KEY = 'virtual-expo-intro-dismissed';

function readIntroDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(INTRO_DISMISSED_LS_KEY) === '1';
  } catch {
    return false;
  }
}

function persistBoothOverrides(overrides: Record<string, BoothLayoutPatch>) {
  try { localStorage.setItem(BOOTH_CMS_LS_KEY, JSON.stringify(overrides)); } catch { /* */ }
}

function persistSceneConfig(config: Partial<SceneConfig>) {
  try { localStorage.setItem(SCENE_CMS_LS_KEY, JSON.stringify(config)); } catch { /* */ }
}

/** Shown when the Vertex Elite CTA kiosk opens brochure / price list / site map. */
export type CtaResourcePopup = {
  title: string;
  url: string;
  /** `image` = embedded preview (site map); `document` = link-style panel (brochure / PDF). */
  variant?: 'document' | 'image';
};

interface AppState {
  showInstructions: boolean;
  setShowInstructions: (show: boolean) => void;
  activeBooth: string | null;
  activeBoothPosition: [number, number, number] | null;
  setActiveBooth: (booth: string | null, position?: [number, number, number]) => void;
  ctaResourcePopup: CtaResourcePopup | null;
  setCtaResourcePopup: (popup: CtaResourcePopup | null) => void;
  playerPosition: [number, number, number] | null;
  setPlayerPosition: (pos: [number, number, number] | null) => void;
  joystickData: { x: number; y: number };
  setJoystickData: (data: { x: number; y: number }) => void;

  boothCmsOpen: boolean;
  setBoothCmsOpen: (open: boolean) => void;
  cmsPage: 'expo' | 'cms';
  setCmsPage: (page: 'expo' | 'cms') => void;

  boothOverrides: Record<string, BoothLayoutPatch>;
  sceneOverrides: Partial<SceneConfig>;
  _boothCmsHydrated: boolean;
  initBoothCms: () => Promise<void>;
  patchBoothOverride: (id: string, patch: BoothLayoutPatch) => void;
  resetBoothOverride: (id: string) => void;
  resetAllBoothOverrides: () => void;
  deleteBoothOverride: (id: string) => void;
  duplicateBoothOverride: (fromId: string, newId: string) => void;
  patchSceneOverride: (patch: Partial<SceneConfig>) => void;
  resetSceneOverrides: () => void;
  getSceneConfig: () => SceneConfig;
}

export const useStore = create<AppState>((set, get) => ({
  showInstructions: !readIntroDismissed(),
  setShowInstructions: (show) => {
    if (!show) {
      try { localStorage.setItem(INTRO_DISMISSED_LS_KEY, '1'); } catch { /* */ }
    }
    set({ showInstructions: show });
  },
  activeBooth: null,
  activeBoothPosition: null,
  setActiveBooth: (booth, position) => set({ activeBooth: booth, activeBoothPosition: position || null }),
  ctaResourcePopup: null,
  setCtaResourcePopup: (popup) => set({ ctaResourcePopup: popup }),
  playerPosition: null,
  setPlayerPosition: (pos) => set({ playerPosition: pos }),
  joystickData: { x: 0, y: 0 },
  setJoystickData: (data) => set({ joystickData: data }),

  boothCmsOpen: false,
  setBoothCmsOpen: (open) => set({ boothCmsOpen: open }),
  cmsPage: 'expo',
  setCmsPage: (page) => set({ cmsPage: page }),

  boothOverrides: {},
  sceneOverrides: {},
  _boothCmsHydrated: false,

  initBoothCms: async () => {
    if (get()._boothCmsHydrated) return;
    let fromFile: Record<string, BoothLayoutPatch> = {};
    let sceneFromFile: Partial<SceneConfig> = {};
    try {
      const res = await fetch('/booth-cms.json', { cache: 'no-store' });
      if (res.ok) {
        const j = await res.json();
        if (j?.booths && typeof j.booths === 'object') fromFile = j.booths;
        if (j?.overrides && typeof j.overrides === 'object') fromFile = j.overrides;
        if (j?.scene && typeof j.scene === 'object') sceneFromFile = j.scene;
      }
    } catch { /* */ }

    let fromLs: Record<string, BoothLayoutPatch> = {};
    try {
      const raw = localStorage.getItem(BOOTH_CMS_LS_KEY);
      if (raw) fromLs = JSON.parse(raw);
    } catch { fromLs = {}; }

    let sceneFromLs: Partial<SceneConfig> = {};
    try {
      const raw = localStorage.getItem(SCENE_CMS_LS_KEY);
      if (raw) sceneFromLs = JSON.parse(raw);
    } catch { sceneFromLs = {}; }

    const ids = new Set([...Object.keys(fromFile), ...Object.keys(fromLs)]);
    const merged: Record<string, BoothLayoutPatch> = {};
    for (const id of ids) {
      merged[id] = { ...(fromFile[id] || {}), ...(fromLs[id] || {}) };
    }
    const sceneMerged = { ...sceneFromFile, ...sceneFromLs };
    set({ boothOverrides: merged, sceneOverrides: sceneMerged, _boothCmsHydrated: true });
  },

  patchBoothOverride: (id, patch) => {
    const prev = get().boothOverrides[id] || {};
    const definedPatch = Object.fromEntries(
      Object.entries(patch).filter(([, v]) => v !== undefined)
    ) as BoothLayoutPatch;
    const nextEntry = { ...prev, ...definedPatch };
    const nextAll = { ...get().boothOverrides, [id]: nextEntry };
    persistBoothOverrides(nextAll);
    set({ boothOverrides: nextAll });
  },

  resetBoothOverride: (id) => {
    const { [id]: _, ...rest } = get().boothOverrides;
    persistBoothOverrides(rest);
    set({ boothOverrides: rest });
  },

  deleteBoothOverride: (id) => {
    const { [id]: _, ...rest } = get().boothOverrides;
    persistBoothOverrides(rest);
    set({ boothOverrides: rest });
  },

  duplicateBoothOverride: (fromId, newId) => {
    const source = get().boothOverrides[fromId];
    if (!source) return;
    const clone = JSON.parse(JSON.stringify(source)) as BoothLayoutPatch;
    if (clone.position) clone.position = [clone.position[0] + 5, clone.position[1], clone.position[2]];
    const nextAll = { ...get().boothOverrides, [newId]: clone };
    persistBoothOverrides(nextAll);
    set({ boothOverrides: nextAll });
  },

  resetAllBoothOverrides: () => {
    persistBoothOverrides({});
    set({ boothOverrides: {} });
  },

  patchSceneOverride: (patch) => {
    const next = { ...get().sceneOverrides, ...patch };
    persistSceneConfig(next);
    set({ sceneOverrides: next });
  },

  resetSceneOverrides: () => {
    persistSceneConfig({});
    set({ sceneOverrides: {} });
  },

  getSceneConfig: () => ({ ...DEFAULT_SCENE_CONFIG, ...get().sceneOverrides }),
}));
