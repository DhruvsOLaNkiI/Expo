import { create } from 'zustand';
import type {
  BoothLayoutPatch,
  SceneConfig,
  CompanyProfile,
  CustomFaqQuestion,
  MediaItem,
  PlacedImage,
  SceneOverridesInput,
  UnitLayoutItem,
} from '@/features/shared/data/boothLayouts';
import { mergeSceneConfig, mergeSceneOverridesInput } from '@/features/shared/data/boothLayouts';
import { getBootstrapSceneForDevice } from '@/utils/devicePerformance';
import { setR2PublicBase, getR2PublicBase } from '@/config/r2Public';
import { commitHallLayoutTransform } from '@/store/persist/hallLayout';
import {
  persistBoothOverridesWithFallback,
  readPersistedBoothOverrides,
} from '@/store/persist/boothCms';
import { mergeHallLayout } from '@/features/shared/data/boothLayouts';
import { REG_SPAWN, resolveMainExpoSpawn } from '@/features/shared/data/registrationHall';
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

function readPersistedSceneConfig(): SceneOverridesInput {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(SCENE_CMS_LS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as SceneOverridesInput)
      : {};
  } catch {
    return {};
  }
}


/** Shown when the Vertex Elite CTA kiosk opens brochure / price list / site map. */
export type CtaResourcePopup = {
  title: string;
  url: string;
  /** `image` = gallery; `document` = PDF / link; `video` = embedded walkthrough; `customFaq` = exhibitor Q&A. */
  variant?: 'document' | 'image' | 'video' | 'customFaq';
  /** Full site map carousel (includes first URL). When length > 1, lightbox shows prev/next. */
  imageGallery?: string[];
  /** Booth-specific multiple-choice FAQ (exhibitor dashboard). */
  customFaqQuestions?: CustomFaqQuestion[];
  /** Booth that owns this FAQ quiz (for analytics). */
  boothId?: string;
};

/** Payload for the screen-fixed booth HUD (not world-space HTML). */
export type VertexEliteHudContext = {
  boothId: string;
  glow: string;
  brochureUrl: string;
  priceListUrl: string;
  unitLayoutUrl: string;
  unitLayouts?: UnitLayoutItem[];
  floorPlanUrl: string;
  floorPlans?: UnitLayoutItem[];
  faqUrl: string;
  customFaqQuestions?: CustomFaqQuestion[];
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
  /** Booth pinned when visitor opens chat from booth HUD (Chat button). */
  aiChatBoothId: string | null;
  /** When set, Ask AI uses expo-wide live stats (Help Desk / registration hostess). */
  aiChatContext: 'expo-concierge' | null;
  setAiChatOpen: (open: boolean, boothId?: string | null) => void;
  openAiChat: (context?: 'expo-concierge', boothId?: string | null) => void;
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
  cmsPage: 'expo' | 'cms' | 'pageindex' | 'analytics';
  setCmsPage: (page: 'expo' | 'cms' | 'pageindex' | 'analytics') => void;

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
  /** Merge latest local/IDB booth CMS patches into memory (e.g. after exhibitor save). */
  syncBoothOverridesFromPersistence: () => Promise<void>;
  /** Merge latest scene overrides from localStorage (cross-tab CMS sync). */
  syncSceneOverridesFromPersistence: () => void;

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
  aiChatBoothId: null,
  aiChatContext: null,
  setAiChatOpen: (open, boothId) =>
    set(
      open
        ? {
            aiChatOpen: true,
            aiChatBoothId: boothId ?? get().vertexEliteHudContext?.boothId ?? null,
          }
        : { aiChatOpen: false, aiChatContext: null, aiChatBoothId: null },
    ),
  openAiChat: (context, boothId) =>
    set({
      aiChatOpen: true,
      aiChatBoothId: boothId ?? get().vertexEliteHudContext?.boothId ?? null,
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
    get().teleportPlayer(
      resolveMainExpoSpawn(mergeHallLayout(get().sceneOverrides.hallLayout)),
    );
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
    get().teleportPlayer(
      resolveMainExpoSpawn(mergeHallLayout(get().sceneOverrides.hallLayout)),
    );
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

    // Local-first: apply saved overrides (colors, logos, images) from this browser
    // IMMEDIATELY so the booth renders the user's theme without waiting on the network.
    // The MongoDB API can be slow/unreachable; we must not block the visible scene on it.
    const localBooths = await readPersistedBoothOverrides();
    if (Object.keys(localBooths).length > 0) {
      const current = get().boothOverrides;
      const seeded: Record<string, BoothLayoutPatch> = { ...current };
      for (const id of new Set([...Object.keys(current), ...Object.keys(localBooths)])) {
        seeded[id] = { ...(current[id] || {}), ...(localBooths[id] || {}) };
      }
      set({ boothOverrides: seeded });
    }

    let booths: Record<string, BoothLayoutPatch> = {};
    let sceneFromApi: SceneOverridesInput = {};
    let r2PublicBase = '';

    // Primary: fetch from MongoDB API
    try {
      const res = await fetch('/api/expo/config', { cache: 'no-store' });
      if (res.ok) {
        const j = await res.json();
        if (j?.booths && typeof j.booths === 'object') booths = j.booths;
        if (j?.scene && typeof j.scene === 'object') sceneFromApi = j.scene;
        if (typeof j?.r2PublicBase === 'string' && j.r2PublicBase) r2PublicBase = j.r2PublicBase;
      }
    } catch { /* API unavailable — try fallback */ }

    // Fallback: read-only seed from booth-cms.json if API returned nothing
    if (Object.keys(booths).length === 0) {
      try {
        const res = await fetch('/booth-cms.json', { cache: 'no-store' });
        if (res.ok) {
          const j = await res.json();
          if (j?.booths && typeof j.booths === 'object') booths = j.booths;
          if (j?.overrides && typeof j.overrides === 'object') booths = j.overrides;
          if (j?.scene && typeof j.scene === 'object') sceneFromApi = j.scene;
          if (typeof j?.r2PublicBase === 'string' && j.r2PublicBase) r2PublicBase = j.r2PublicBase;
        }
      } catch { /* */ }
    }

    if (!r2PublicBase) r2PublicBase = getR2PublicBase();
    if (r2PublicBase) setR2PublicBase(r2PublicBase);

    for (const id of REMOVED_BOOTH_IDS) delete booths[id];

    // Server data is the base; local overrides (latest user edits) always win per field.
    for (const id of new Set([...Object.keys(booths), ...Object.keys(localBooths)])) {
      booths[id] = { ...(booths[id] || {}), ...(localBooths[id] || {}) };
    }

    // Device-specific scene baseline, then layer API scene on top
    const sceneFromLs: SceneOverridesInput = (() => {
      try {
        const raw = localStorage.getItem(SCENE_CMS_LS_KEY);
        return raw ? JSON.parse(raw) : {};
      } catch { return {}; }
    })();

    let sceneMerged = mergeSceneOverridesInput(
      getBootstrapSceneForDevice(),
      sceneFromApi,
      sceneFromLs,
    );
    const boolSceneKeys = [
      'showVideos', 'showBallroom', 'showStandardBooths',
      'showHallAisleStandees', 'showBoothHostess',
    ] as const;
    for (const k of boolSceneKeys) {
      if (sceneFromApi[k] === true && sceneMerged[k] !== true) {
        sceneMerged = { ...sceneMerged, [k]: true };
      }
    }

    set({ boothOverrides: booths, sceneOverrides: sceneMerged, _boothCmsHydrated: true });
  },

  syncBoothOverridesFromPersistence: async () => {
    const local = await readPersistedBoothOverrides();
    const current = get().boothOverrides;
    const ids = new Set([...Object.keys(current), ...Object.keys(local)]);
    if (ids.size === 0) return;
    const merged: Record<string, BoothLayoutPatch> = { ...current };
    for (const id of ids) {
      merged[id] = { ...(current[id] || {}), ...(local[id] || {}) };
    }
    set({ boothOverrides: merged });
  },

  syncSceneOverridesFromPersistence: () => {
    const local = readPersistedSceneConfig();
    const current = get().sceneOverrides;
    const merged = mergeSceneOverridesInput({}, current, local);
    set({ sceneOverrides: merged });
  },

  patchBoothOverride: async (id, patch) => {
    const prev = get().boothOverrides[id] || {};
    const nextEntry = { ...prev } as BoothLayoutPatch;
    const definedPatch: BoothLayoutPatch = {};
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) continue;
      if (value === null) {
        delete (nextEntry as Record<string, unknown>)[key];
        definedPatch[key as keyof BoothLayoutPatch] = null as never;
      } else {
        (nextEntry as Record<string, unknown>)[key] = value;
        (definedPatch as Record<string, unknown>)[key] = value;
      }
    }
    const nextAll = { ...get().boothOverrides, [id]: nextEntry };
    set({ boothOverrides: nextAll });
    const localOk = await persistBoothOverridesWithFallback(nextAll);

    let remoteOk = false;
    try {
      const res = await fetch('/api/booth-cms/patch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boothId: id, patch: definedPatch }),
      });
      const data = await res.json();
      remoteOk = !!data?.ok;
    } catch {
      remoteOk = false;
    }
    // Colors/images live in browser storage — local save must succeed for the expo to show them.
    return localOk || remoteOk;
  },

  resetBoothOverride: async (id) => {
    const { [id]: _, ...rest } = get().boothOverrides;
    set({ boothOverrides: rest });
    try { await fetch(`/api/booth-cms/${encodeURIComponent(id)}`, { method: 'DELETE' }); } catch { /* */ }
  },

  deleteBoothOverride: async (id) => {
    const { [id]: _, ...rest } = get().boothOverrides;
    set({ boothOverrides: rest });
    try { await fetch(`/api/booth-cms/${encodeURIComponent(id)}`, { method: 'DELETE' }); } catch { /* */ }
  },

  duplicateBoothOverride: async (fromId, newId) => {
    const source = get().boothOverrides[fromId];
    if (!source) return;
    const clone = JSON.parse(JSON.stringify(source)) as BoothLayoutPatch;
    if (clone.position) clone.position = [clone.position[0] + 5, clone.position[1], clone.position[2]];
    const nextAll = { ...get().boothOverrides, [newId]: clone };
    set({ boothOverrides: nextAll });
    try {
      await fetch('/api/booth-cms/patch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boothId: newId, patch: clone }),
      });
    } catch { /* */ }
  },

  resetAllBoothOverrides: async () => {
    set({ boothOverrides: {} });
    try {
      await fetch('/api/booth-cms/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booths: {}, scene: {} }),
      });
    } catch { /* */ }
  },

  patchSceneOverride: (patch) => {
    const cur = get().sceneOverrides;
    const next: SceneOverridesInput = { ...cur, ...patch };

    if (patch.hallLayout !== undefined) {
      next.hallLayout = { ...(cur.hallLayout || {}), ...patch.hallLayout };
    }

    if (patch.registrationLayout !== undefined) {
      const prevReg = cur.registrationLayout || {};
      const incomingReg = patch.registrationLayout;

      next.registrationLayout = {
        ...prevReg,
        ...incomingReg,
        loungeRotations: incomingReg.loungeRotations
          ? { ...(prevReg.loungeRotations || {}), ...incomingReg.loungeRotations }
          : prevReg.loungeRotations,
        loungePlantOffsets: incomingReg.loungePlantOffsets ?? prevReg.loungePlantOffsets,
        importedModels: incomingReg.importedModels ?? prevReg.importedModels,
      };
    }

    persistSceneConfig(next);
    set({ sceneOverrides: next });

    // Fire-and-forget: persist to MongoDB so all visitors see updated scene
    void fetch('/api/scene/patch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patch: next }),
    }).catch(() => { /* API may be unavailable */ });
  },

  resetSceneOverrides: () => {
    persistSceneConfig({});
    set({ sceneOverrides: {} });
    void fetch('/api/scene', { method: 'DELETE' }).catch(() => {});
  },

  getSceneConfig: () => mergeSceneConfig(get().sceneOverrides),
}));
