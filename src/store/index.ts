import { create } from 'zustand';
import type {
  BoothLayoutPatch,
  SceneConfig,
  CompanyProfile,
  MediaItem,
  PlacedImage,
  SceneOverridesInput,
} from '@/features/shared/data/boothLayouts';
import { mergeSceneConfig, mergeSceneOverridesInput } from '@/features/shared/data/boothLayouts';
import { getBootstrapSceneForDevice } from '@/utils/devicePerformance';
import { persistBoothOverridesWithFallback, readPersistedBoothOverrides } from '@/store/persist/boothCms';
import {
  applyR2PublicBaseFromCmsFile,
  loadR2DocumentDefaults,
  resolveBoothOverridesForR2,
} from '@/store/persist/r2Documents';
import { mergeSharedBoothDocs } from '@/api/boothCmsServer';
import { getR2PublicBase } from '@/config/r2Public';
import { commitHallLayoutTransform } from '@/store/persist/hallLayout';
import { REG_MAIN_EXPO_SPAWN, REG_SPAWN } from '@/features/shared/data/registrationHall';
import {
  CAMERA_MODE_ORDER,
  type CameraMode,
} from '@/features/expo/camera/cameraModes';
import {
  clearVisitorProfile as clearVisitorProfileStorage,
  DEFAULT_AVATAR,
  generateVisitorId,
  persistVisitorProfile,
  readVisitorProfile,
  type VisitorAvatar,
  type VisitorProfile,
} from '@/features/visitor/visitorProfile';

const SCENE_CMS_LS_KEY = 'virtual-expo-scene-config';

/** Removed booth IDs — strip from persisted overrides so duplicates never reappear. */
const REMOVED_BOOTH_IDS = ['builder-7', 'side-west-luxe'] as const;
const INTRO_DISMISSED_LS_KEY = 'virtual-expo-intro-dismissed';
const REG_PASS_LS_KEY = 'virtual-expo-registration-pass';
const CAMERA_MODE_LS_KEY = 'virtual-expo-camera-mode';

function readCameraMode(): CameraMode {
  if (typeof window === 'undefined') return 'head';
  try {
    const raw = localStorage.getItem(CAMERA_MODE_LS_KEY);
    if (raw && (CAMERA_MODE_ORDER as string[]).includes(raw)) return raw as CameraMode;
  } catch {
    /* */
  }
  return 'head';
}

function persistCameraMode(mode: CameraMode) {
  try {
    localStorage.setItem(CAMERA_MODE_LS_KEY, mode);
  } catch {
    /* */
  }
}

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
  /** `image` = gallery; `document` = PDF / link; `video` = embedded walkthrough. */
  variant?: 'document' | 'image' | 'video';
  /** Full site map carousel (includes first URL). When length > 1, lightbox shows prev/next. */
  imageGallery?: string[];
};

/** Payload for the screen-fixed booth HUD (not world-space HTML). */
export type VertexEliteHudContext = {
  boothId: string;
  glow: string;
  brochureUrl: string;
  priceListUrl: string;
  unitLayoutUrl: string;
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
  /** When set, Ask AI uses expo-wide live stats (Help Desk / registration hostess). */
  aiChatContext: 'expo-concierge' | null;
  setAiChatOpen: (open: boolean) => void;
  openAiChat: (context?: 'expo-concierge') => void;
  /** Smart Help Desk concierge panel (center lobby). */
  helpDeskOpen: boolean;
  setHelpDeskOpen: (open: boolean) => void;
  /** 0–1 fade for Vertex Elite screen HUD (driven by distance to booth entrance). */
  vertexEliteHudAlpha: number;
  setVertexEliteHudAlpha: (alpha: number) => void;
  vertexEliteHudContext: VertexEliteHudContext | null;
  setVertexEliteHudContext: (ctx: VertexEliteHudContext | null) => void;
  /** Per-booth proximity reports; nearest / strongest wins for HUD. */
  reportBoothHudProximity: (boothId: string, alpha: number, ctx: VertexEliteHudContext | null) => void;
  _boothHudReports: Record<string, { alpha: number; ctx: VertexEliteHudContext }>;
  playerPosition: [number, number, number] | null;
  /** Increments on every fast-travel / floor click teleport so Player always applies the move. */
  teleportNonce: number;
  teleportTarget: [number, number, number] | null;
  setPlayerPosition: (pos: [number, number, number] | null) => void;
  joystickData: { x: number; y: number };
  setJoystickData: (data: { x: number; y: number }) => void;
  strafeHold: { left: boolean; right: boolean };
  setStrafeHold: (hold: { left: boolean; right: boolean }) => void;

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
  /** Move, rotate, or scale in layout editor gizmo. */
  hallLayoutGizmoMode: 'translate' | 'rotate' | 'scale';
  setHallLayoutGizmoMode: (mode: 'translate' | 'rotate' | 'scale') => void;
  /** Locked rotation axis; `E` = free view rotation, `null` = click a ring on the gizmo. */
  hallLayoutRotationAxis: 'X' | 'Y' | 'Z' | 'E' | null;
  setHallLayoutRotationAxis: (axis: 'X' | 'Y' | 'Z' | 'E' | null) => void;

  /** First-time visitor profile (name, temp ID, avatar colors). Null until onboarding completes. */
  visitorProfile: VisitorProfile | null;
  completeVisitorOnboarding: (input: {
    id: string;
    displayName: string;
    avatar: VisitorAvatar;
  }) => void;
  clearVisitorProfile: () => void;

  /** `registration` = arrival lobby; `expo` = main 90×90 hall. */
  expoPhase: 'registration' | 'expo';
  registrationUi: 'none' | 'register' | 'granted';
  registrationPass: boolean;
  openRegistrationPopup: () => void;
  closeRegistrationUi: () => void;
  confirmRegistration: (input: {
    displayName: string;
    email: string;
    phone: string;
  }) => void;
  enterMainExpo: () => void;
  /** Guest profile + local pass — no MongoDB / registration API. */
  skipToMainExpo: () => void;
  enterRegistrationLobby: () => void;
  /** Instant move (expo or lobby); releases pointer lock for UI safety. */
  teleportPlayer: (position: [number, number, number]) => void;

  /** Head POV, full-body third person, or wide-angle first person. */
  cameraMode: CameraMode;
  setCameraMode: (mode: CameraMode) => void;
  cycleCameraMode: () => void;
  /** Horizontal facing for third-person avatar (radians). */
  playerFacingYaw: number;
  setPlayerFacingYaw: (yaw: number) => void;
  /** Current walking speed magnitude (m/s) for animation. */
  playerSpeed: number;
  setPlayerSpeed: (speed: number) => void;
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
  aiChatContext: null,
  setAiChatOpen: (open) =>
    set(open ? { aiChatOpen: true } : { aiChatOpen: false, aiChatContext: null }),
  openAiChat: (context) =>
    set({
      aiChatOpen: true,
      aiChatContext: context === 'expo-concierge' ? 'expo-concierge' : null,
    }),
  helpDeskOpen: false,
  setHelpDeskOpen: (open) => {
    if (open && typeof document !== 'undefined' && document.pointerLockElement) {
      document.exitPointerLock();
    }
    set({ helpDeskOpen: open });
  },
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
  _boothHudReports: {},
  reportBoothHudProximity: (boothId, alpha, ctx) => {
    const reports = { ...get()._boothHudReports };
    if (!ctx || alpha < 0.001) {
      delete reports[boothId];
    } else {
      reports[boothId] = { alpha, ctx };
    }
    let bestAlpha = 0;
    let bestCtx: VertexEliteHudContext | null = null;
    for (const r of Object.values(reports)) {
      if (r.alpha > bestAlpha) {
        bestAlpha = r.alpha;
        bestCtx = r.ctx;
      }
    }
    const prev = get().vertexEliteHudAlpha;
    const snapLow = prev > 0.06 && bestAlpha <= 0.02;
    const snapHigh = prev < 0.94 && bestAlpha >= 0.98;
    const alphaChanged = snapLow || snapHigh || Math.abs(bestAlpha - prev) >= 0.028;
    const ctxChanged = get().vertexEliteHudContext?.boothId !== bestCtx?.boothId;
    if (alphaChanged || ctxChanged) {
      set({ _boothHudReports: reports, vertexEliteHudAlpha: bestAlpha, vertexEliteHudContext: bestCtx });
    } else {
      set({ _boothHudReports: reports });
    }
  },
  playerPosition: null,
  teleportNonce: 0,
  teleportTarget: null,
  setPlayerPosition: (pos) => {
    if (pos === null) {
      set({ playerPosition: null, teleportTarget: null });
      return;
    }
    const next: [number, number, number] = [pos[0], pos[1], pos[2]];
    set({
      playerPosition: next,
      teleportTarget: next,
      teleportNonce: get().teleportNonce + 1,
    });
  },
  joystickData: { x: 0, y: 0 },
  setJoystickData: (data) => set({ joystickData: data }),
  strafeHold: { left: false, right: false },
  setStrafeHold: (hold) => set({ strafeHold: hold }),

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

  visitorProfile: readVisitorProfile(),
  completeVisitorOnboarding: (input) => {
    const profile: VisitorProfile = {
      id: input.id,
      displayName: input.displayName,
      avatar: input.avatar,
      createdAt: Date.now(),
    };
    persistVisitorProfile(profile);
    set({
      visitorProfile: profile,
      expoPhase: 'registration',
      registrationUi: 'none',
      showInstructions: true,
    });
    get().teleportPlayer(REG_SPAWN);
  },
  clearVisitorProfile: () => {
    clearVisitorProfileStorage();
    set({ visitorProfile: null });
  },

  registrationUi: 'none',
  registrationPass: readRegistrationPass(),
  expoPhase: readVisitorProfile()
    ? readRegistrationPass()
      ? 'expo'
      : 'registration'
    : 'registration',
  openRegistrationPopup: () => {
    if (typeof document !== 'undefined' && document.pointerLockElement) {
      document.exitPointerLock();
    }
    set({ registrationUi: 'register' });
  },
  closeRegistrationUi: () => set({ registrationUi: 'none' }),
  confirmRegistration: (input) => {
    const profile = get().visitorProfile;
    if (profile) {
      const updated: VisitorProfile = {
        ...profile,
        displayName: input.displayName.trim(),
        email: input.email.trim(),
        phone: input.phone.trim(),
      };
      persistVisitorProfile(updated);
      set({ visitorProfile: updated });
    }
    try {
      localStorage.setItem(REG_PASS_LS_KEY, '1');
    } catch {
      /* */
    }
    set({ registrationUi: 'granted', registrationPass: true });
  },
  teleportPlayer: (position) => {
    if (get().hallLayoutEditMode) return;
    if (typeof document !== 'undefined' && document.pointerLockElement) {
      document.exitPointerLock();
    }
    const next: [number, number, number] = [position[0], position[1], position[2]];
    set({
      playerPosition: next,
      teleportTarget: next,
      teleportNonce: get().teleportNonce + 1,
      registrationUi: 'none',
    });
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
  skipToMainExpo: () => {
    let profile = get().visitorProfile;
    if (!profile) {
      profile = {
        id: generateVisitorId(),
        displayName: 'Guest',
        avatar: { ...DEFAULT_AVATAR },
        createdAt: Date.now(),
      };
      persistVisitorProfile(profile);
    }
    try {
      localStorage.setItem(REG_PASS_LS_KEY, '1');
    } catch {
      /* */
    }
    if (typeof document !== 'undefined' && document.pointerLockElement) {
      document.exitPointerLock();
    }
    set({
      visitorProfile: profile,
      registrationPass: true,
      registrationUi: 'none',
      expoPhase: 'expo',
      showInstructions: false,
    });
    get().teleportPlayer(REG_MAIN_EXPO_SPAWN);
  },
  enterRegistrationLobby: () => {
    set({ expoPhase: 'registration', registrationUi: 'none' });
    get().teleportPlayer(REG_SPAWN);
  },

  cameraMode: readCameraMode(),
  setCameraMode: (mode) => {
    persistCameraMode(mode);
    set({ cameraMode: mode });
  },
  cycleCameraMode: () => {
    const i = CAMERA_MODE_ORDER.indexOf(get().cameraMode);
    const next = CAMERA_MODE_ORDER[(i + 1) % CAMERA_MODE_ORDER.length];
    persistCameraMode(next);
    set({ cameraMode: next });
  },
  playerFacingYaw: 0,
  setPlayerFacingYaw: (yaw) => set({ playerFacingYaw: yaw }),
  playerSpeed: 0,
  setPlayerSpeed: (speed) => set({ playerSpeed: speed }),

  initBoothCms: async () => {
    if (get()._boothCmsHydrated) return;
    const { publicBase: r2BaseFromManifest, defaults: fromR2Documents } = await loadR2DocumentDefaults();

    let fromFile: Record<string, BoothLayoutPatch> = {};
    let sceneFromFile: SceneOverridesInput = {};
    let r2PublicBase = r2BaseFromManifest;
    try {
      const res = await fetch('/booth-cms.json', { cache: 'no-store' });
      if (res.ok) {
        const j = await res.json();
        if (j?.booths && typeof j.booths === 'object') fromFile = j.booths;
        if (j?.overrides && typeof j.overrides === 'object') fromFile = j.overrides;
        if (j?.scene && typeof j.scene === 'object') sceneFromFile = j.scene;
        const fromCms = applyR2PublicBaseFromCmsFile(j?.r2PublicBase);
        if (fromCms) r2PublicBase = fromCms;
      }
    } catch { /* */ }

    if (!r2PublicBase) {
      r2PublicBase = getR2PublicBase();
    }

    const fromBrowser = await readPersistedBoothOverrides();

    let sceneFromLs: SceneOverridesInput = {};
    try {
      const raw = localStorage.getItem(SCENE_CMS_LS_KEY);
      if (raw) sceneFromLs = JSON.parse(raw);
    } catch { sceneFromLs = {}; }

    const ids = new Set([
      ...Object.keys(fromR2Documents),
      ...Object.keys(fromFile),
      ...Object.keys(fromBrowser),
    ]);
    const merged: Record<string, BoothLayoutPatch> = {};
    for (const id of ids) {
      merged[id] = {
        ...(fromR2Documents[id] || {}),
        ...(fromBrowser[id] || {}),
        ...(fromFile[id] || {}),
        ...mergeSharedBoothDocs(fromFile[id], fromBrowser[id]),
      };
    }
    const resolvedMerged = resolveBoothOverridesForR2(merged, r2PublicBase);
    for (const id of Object.keys(resolvedMerged)) {
      merged[id] = resolvedMerged[id];
    }
    for (const id of REMOVED_BOOTH_IDS) {
      delete merged[id];
    }
    let sceneMerged = mergeSceneOverridesInput(
      getBootstrapSceneForDevice(),
      sceneFromFile,
      sceneFromLs,
    );
    if (sceneMerged.showVideos !== true && sceneFromFile.showVideos === true) {
      sceneMerged = { ...sceneMerged, showVideos: true };
    }
    if (sceneMerged.showBallroom !== true && sceneFromFile.showBallroom === true) {
      sceneMerged = { ...sceneMerged, showBallroom: true };
    }
    if (sceneMerged.showStandardBooths === false && sceneFromFile.showStandardBooths === true) {
      sceneMerged = { ...sceneMerged, showStandardBooths: true };
    }
    if (sceneMerged.showHallAisleStandees !== true && sceneFromFile.showHallAisleStandees === true) {
      sceneMerged = { ...sceneMerged, showHallAisleStandees: true };
    }
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
