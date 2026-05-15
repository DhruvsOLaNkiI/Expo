import { create } from 'zustand';
import type {
  BoothLayoutPatch,
  SceneConfig,
  CompanyProfile,
  MediaItem,
  PlacedImage,
  SceneOverridesInput,
} from './data/boothLayouts';
import { mergeSceneConfig } from './data/boothLayouts';
import { persistBoothOverridesWithFallback, readPersistedBoothOverrides } from './boothCmsPersist';
import { commitHallLayoutTransform } from './hallLayoutPersist';
import { REG_MAIN_EXPO_SPAWN, REG_SPAWN } from './data/registrationHall';

const SCENE_CMS_LS_KEY = 'virtual-expo-scene-config';
const INTRO_DISMISSED_LS_KEY = 'virtual-expo-intro-dismissed';
const REG_PASS_LS_KEY = 'virtual-expo-registration-pass';

function readIntroDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(INTRO_DISMISSED_LS_KEY) === '1';
  } catch {
    return false;
  }
}

function readRegistrationPass(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(REG_PASS_LS_KEY) === '1';
  } catch {
    return false;
  }
}

function persistSceneConfig(config: SceneOverridesInput) {
  try { localStorage.setItem(SCENE_CMS_LS_KEY, JSON.stringify(config)); } catch { /* */ }
}

/** Shown when the Vertex Elite CTA kiosk opens brochure / price list / site map. */
export type CtaResourcePopup = {
  title: string;
  url: string;
  /** `image` = embedded preview (site map); `document` = link-style panel (brochure / PDF). */
  variant?: 'document' | 'image';
  /** Full site map carousel (includes first URL). When length > 1, lightbox shows prev/next. */
  imageGallery?: string[];
};

/** Payload for the screen-fixed Vertex Elite booth HUD (not world-space HTML). */
export type VertexEliteHudContext = {
  glow: string;
  brochureUrl: string;
  priceListUrl: string;
  siteMapUrls: string[];
  videoUrl: string;
  media: MediaItem[];
  placedImages: PlacedImage[];
  company: CompanyProfile;
};

interface AppState {
  showInstructions: boolean;
  setShowInstructions: (show: boolean) => void;
  activeBooth: string | null;
  activeBoothPosition: [number, number, number] | null;
  setActiveBooth: (booth: string | null, position?: [number, number, number]) => void;
  ctaResourcePopup: CtaResourcePopup | null;
  setCtaResourcePopup: (popup: CtaResourcePopup | null) => void;
  aiChatOpen: boolean;
  setAiChatOpen: (open: boolean) => void;
  /** 0–1 fade for Vertex Elite screen HUD (driven by distance to booth entrance). */
  vertexEliteHudAlpha: number;
  setVertexEliteHudAlpha: (alpha: number) => void;
  vertexEliteHudContext: VertexEliteHudContext | null;
  setVertexEliteHudContext: (ctx: VertexEliteHudContext | null) => void;
  playerPosition: [number, number, number] | null;
  setPlayerPosition: (pos: [number, number, number] | null) => void;
  joystickData: { x: number; y: number };
  setJoystickData: (data: { x: number; y: number }) => void;

  boothCmsOpen: boolean;
  setBoothCmsOpen: (open: boolean) => void;
  cmsPage: 'expo' | 'cms' | 'pageindex';
  setCmsPage: (page: 'expo' | 'cms' | 'pageindex') => void;

  boothOverrides: Record<string, BoothLayoutPatch>;
  sceneOverrides: SceneOverridesInput;
  _boothCmsHydrated: boolean;
  initBoothCms: () => Promise<void>;
  patchBoothOverride: (id: string, patch: BoothLayoutPatch) => Promise<boolean>;
  resetBoothOverride: (id: string) => Promise<void>;
  resetAllBoothOverrides: () => Promise<void>;
  deleteBoothOverride: (id: string) => Promise<void>;
  duplicateBoothOverride: (fromId: string, newId: string) => Promise<void>;
  patchSceneOverride: (patch: SceneOverridesInput) => void;
  resetSceneOverrides: () => void;
  getSceneConfig: () => SceneConfig;

  /** In-expo hall layout editor (TransformControls + saves to scene overrides). */
  hallLayoutEditMode: boolean;
  setHallLayoutEditMode: (on: boolean) => void;
  /** Object `name` in the R3F scene, e.g. `hall-entrance-lobby`, `booth-root-vertex-elite`. */
  hallLayoutSelection: string | null;
  setHallLayoutSelection: (id: string | null) => void;
  /** Move (translate) vs Rotate in layout editor gizmo. */
  hallLayoutGizmoMode: 'translate' | 'rotate';
  setHallLayoutGizmoMode: (mode: 'translate' | 'rotate') => void;
  /** Locked rotation axis; `E` = free view rotation, `null` = click a ring on the gizmo. */
  hallLayoutRotationAxis: 'X' | 'Y' | 'Z' | 'E' | null;
  setHallLayoutRotationAxis: (axis: 'X' | 'Y' | 'Z' | 'E' | null) => void;

  /** `registration` = arrival lobby; `expo` = main 90×90 hall. */
  expoPhase: 'registration' | 'expo';
  registrationUi: 'none' | 'register' | 'granted';
  registrationPass: boolean;
  openRegistrationPopup: () => void;
  closeRegistrationUi: () => void;
  confirmRegistration: () => void;
  enterMainExpo: () => void;
  enterRegistrationLobby: () => void;
  /** Instant move (expo or lobby); releases pointer lock for UI safety. */
  teleportPlayer: (position: [number, number, number]) => void;
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
  aiChatOpen: false,
  setAiChatOpen: (open) => set({ aiChatOpen: open }),
  vertexEliteHudAlpha: 0,
  setVertexEliteHudAlpha: (alpha) => {
    const next = Math.max(0, Math.min(1, alpha));
    const prev = get().vertexEliteHudAlpha;
    const snapLow = prev > 0.06 && next <= 0.02;
    const snapHigh = prev < 0.94 && next >= 0.98;
    if (!snapLow && !snapHigh && Math.abs(next - prev) < 0.028) return;
    set({ vertexEliteHudAlpha: next });
  },
  vertexEliteHudContext: null,
  setVertexEliteHudContext: (ctx) => set({ vertexEliteHudContext: ctx }),
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

  hallLayoutEditMode: false,
  setHallLayoutEditMode: (on) => {
    if (!on && get().hallLayoutEditMode) {
      commitHallLayoutTransform();
    }
    if (typeof document !== 'undefined' && document.pointerLockElement) {
      document.exitPointerLock();
    }
    set({ hallLayoutEditMode: on });
  },
  hallLayoutSelection: null,
  setHallLayoutSelection: (id) => {
    const prev = get().hallLayoutSelection;
    if (prev && prev !== id && get().hallLayoutEditMode) {
      commitHallLayoutTransform();
    }
    set({ hallLayoutSelection: id });
  },
  hallLayoutGizmoMode: 'translate',
  setHallLayoutGizmoMode: (mode) => set({ hallLayoutGizmoMode: mode }),
  hallLayoutRotationAxis: 'E',
  setHallLayoutRotationAxis: (axis) => set({ hallLayoutRotationAxis: axis }),

  registrationUi: 'none',
  registrationPass: readRegistrationPass(),
  expoPhase: readRegistrationPass() ? 'expo' : 'registration',
  openRegistrationPopup: () => {
    if (typeof document !== 'undefined' && document.pointerLockElement) {
      document.exitPointerLock();
    }
    set({ registrationUi: 'register' });
  },
  closeRegistrationUi: () => set({ registrationUi: 'none' }),
  confirmRegistration: () => {
    try {
      localStorage.setItem(REG_PASS_LS_KEY, '1');
    } catch {
      /* */
    }
    set({ registrationUi: 'granted', registrationPass: true });
  },
  teleportPlayer: (position) => {
    if (typeof document !== 'undefined' && document.pointerLockElement) {
      document.exitPointerLock();
    }
    set({ playerPosition: position, registrationUi: 'none' });
  },
  enterMainExpo: () => {
    const { registrationPass } = get();
    if (!registrationPass) {
      get().openRegistrationPopup();
      return;
    }
    set({ expoPhase: 'expo', registrationUi: 'none' });
    get().teleportPlayer(REG_MAIN_EXPO_SPAWN);
  },
  enterRegistrationLobby: () => {
    set({ expoPhase: 'registration', registrationUi: 'none' });
    get().teleportPlayer(REG_SPAWN);
  },

  initBoothCms: async () => {
    if (get()._boothCmsHydrated) return;
    let fromFile: Record<string, BoothLayoutPatch> = {};
    let sceneFromFile: SceneOverridesInput = {};
    try {
      const res = await fetch('/booth-cms.json', { cache: 'no-store' });
      if (res.ok) {
        const j = await res.json();
        if (j?.booths && typeof j.booths === 'object') fromFile = j.booths;
        if (j?.overrides && typeof j.overrides === 'object') fromFile = j.overrides;
        if (j?.scene && typeof j.scene === 'object') sceneFromFile = j.scene;
      }
    } catch { /* */ }

    const fromBrowser = await readPersistedBoothOverrides();

    let sceneFromLs: SceneOverridesInput = {};
    try {
      const raw = localStorage.getItem(SCENE_CMS_LS_KEY);
      if (raw) sceneFromLs = JSON.parse(raw);
    } catch { sceneFromLs = {}; }

    const ids = new Set([...Object.keys(fromFile), ...Object.keys(fromBrowser)]);
    const merged: Record<string, BoothLayoutPatch> = {};
    for (const id of ids) {
      merged[id] = { ...(fromFile[id] || {}), ...(fromBrowser[id] || {}) };
    }
    const sceneMerged: SceneOverridesInput = { ...sceneFromFile, ...sceneFromLs };
    set({ boothOverrides: merged, sceneOverrides: sceneMerged, _boothCmsHydrated: true });
  },

  patchBoothOverride: async (id, patch) => {
    const prev = get().boothOverrides[id] || {};
    const definedPatch = Object.fromEntries(
      Object.entries(patch).filter(([, v]) => v !== undefined)
    ) as BoothLayoutPatch;
    const nextEntry = { ...prev, ...definedPatch };
    const nextAll = { ...get().boothOverrides, [id]: nextEntry };
    const ok = await persistBoothOverridesWithFallback(nextAll);
    set({ boothOverrides: nextAll });
    return ok;
  },

  resetBoothOverride: async (id) => {
    const { [id]: _, ...rest } = get().boothOverrides;
    await persistBoothOverridesWithFallback(rest);
    set({ boothOverrides: rest });
  },

  deleteBoothOverride: async (id) => {
    const { [id]: _, ...rest } = get().boothOverrides;
    await persistBoothOverridesWithFallback(rest);
    set({ boothOverrides: rest });
  },

  duplicateBoothOverride: async (fromId, newId) => {
    const source = get().boothOverrides[fromId];
    if (!source) return;
    const clone = JSON.parse(JSON.stringify(source)) as BoothLayoutPatch;
    if (clone.position) clone.position = [clone.position[0] + 5, clone.position[1], clone.position[2]];
    const nextAll = { ...get().boothOverrides, [newId]: clone };
    await persistBoothOverridesWithFallback(nextAll);
    set({ boothOverrides: nextAll });
  },

  resetAllBoothOverrides: async () => {
    await persistBoothOverridesWithFallback({});
    set({ boothOverrides: {} });
  },

  patchSceneOverride: (patch) => {
    const cur = get().sceneOverrides;
    const next: SceneOverridesInput = { ...cur, ...patch };
    
    // Deep merge hallLayout
    if (patch.hallLayout !== undefined) {
      next.hallLayout = { ...(cur.hallLayout || {}), ...patch.hallLayout };
    }
    
    // Deep merge registrationLayout
    if (patch.registrationLayout !== undefined) {
      const prevReg = cur.registrationLayout || {};
      const incomingReg = patch.registrationLayout;
      
      next.registrationLayout = {
        ...prevReg,
        ...incomingReg,
        // Ensure nested objects/arrays are merged or preserved
        loungeRotations: incomingReg.loungeRotations
          ? { ...(prevReg.loungeRotations || {}), ...incomingReg.loungeRotations }
          : prevReg.loungeRotations,
        loungePlantOffsets: incomingReg.loungePlantOffsets ?? prevReg.loungePlantOffsets,
        importedModels: incomingReg.importedModels ?? prevReg.importedModels,
      };
    }
    
    persistSceneConfig(next);
    set({ sceneOverrides: next });
  },

  resetSceneOverrides: () => {
    persistSceneConfig({});
    set({ sceneOverrides: {} });
  },

  getSceneConfig: () => mergeSceneConfig(get().sceneOverrides),
}));
