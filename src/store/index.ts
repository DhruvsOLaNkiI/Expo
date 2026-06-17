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
import {
  extractBoothLayoutPatchesFromOverrides,
  extractHallSceneLayoutPatch,
  extractSingleBoothLayoutPatch,
  mergeLayoutIntoBoothOverrides,
  type BoothLayoutOnlyPatch,
} from '@/features/shared/data/expoHallLayout';
import { getBootstrapSceneForDevice } from '@/utils/devicePerformance';
import { setR2PublicBase, getR2PublicBase } from '@/config/r2Public';
import { commitHallLayoutTransform } from '@/store/persist/hallLayout';
import {
  mergeBoothLayoutPatch,
  persistBoothOverridesWithFallback,
  readPersistedBoothOverrides,
} from '@/store/persist/boothCms';
import { mergeHallLayout } from '@/features/shared/data/boothLayouts';
import { REG_SPAWN, resolveMainExpoSpawn } from '@/features/shared/data/registrationHall';
import {
  DEFAULT_EXPO_HALL_ID,
  DEFAULT_EXPO_HALLS,
  dedupeExpoHalls,
  getExpoHallMeta,
  normalizeHallId,
  type ExpoHallMeta,
} from '@/features/shared/data/expoHalls';
import {
  CAMERA_MODE_ORDER,
  type CameraMode,
} from '@/features/expo/camera/cameraModes';
import { fetchReturningVisitor } from '@/api/visitorMongo';
import {
  computeIsAdmin,
  getAdminApiHeaders,
  persistAdminSession,
  validateAdminKey,
} from '@/features/admin/adminSession';
import {
  clearVisitorProfile as clearVisitorProfileStorage,
  DEFAULT_AVATAR,
  generateVisitorId,
  isValidVisitorId,
  normalizeVisitorId,
  persistVisitorProfile,
  readVisitorProfile,
  type VisitorAvatar,
  type VisitorProfile,
} from '@/features/visitor/visitorProfile';
import { resetAnonymousBrowserScope } from '@/features/visitor/visitorBrowserSession';

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

function mergeHallBoothPatches(
  apiBooths: Record<string, BoothLayoutPatch>,
  localBooths: Record<string, BoothLayoutPatch>,
): Record<string, BoothLayoutPatch> {
  const booths: Record<string, BoothLayoutPatch> = { ...apiBooths };
  for (const id of REMOVED_BOOTH_IDS) delete booths[id];
  for (const id of new Set([...Object.keys(booths), ...Object.keys(localBooths)])) {
    booths[id] = mergeBoothLayoutPatch(booths[id], localBooths[id]);
  }
  return booths;
}

/** Latest saved + in-memory overrides for a hall (used before copying layout). */
async function resolveHallOverridesForLayoutCopy(
  hallId: string,
  get: () => AppState,
): Promise<Record<string, BoothLayoutPatch>> {
  const hid = normalizeHallId(hallId);
  const fromLocal = await readPersistedBoothOverrides(hid);
  const fromCache = get().overridesByHall[hid] ?? {};
  let merged = mergeHallBoothPatches(fromCache, fromLocal);
  if (normalizeHallId(get().activeHallId) === hid) {
    merged = mergeHallBoothPatches(merged, get().boothOverrides);
  }
  return merged;
}

function mergeHallSceneConfig(
  sceneFromApi: SceneOverridesInput,
  sceneFromLs: SceneOverridesInput,
): SceneOverridesInput {
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
  return sceneMerged;
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
  helpDeskOpenPane: 'welcome' | 'halls';
  setHelpDeskOpen: (open: boolean, options?: { pane?: 'welcome' | 'halls' }) => void;
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

  /** Admin can edit global environment (CMS, scene, booths, layout). */
  isAdmin: boolean;
  adminLoginOpen: boolean;
  setAdminLoginOpen: (open: boolean) => void;
  loginAdmin: (key: string) => boolean;
  logoutAdmin: () => void;

  activeHallId: string;
  expoHalls: ExpoHallMeta[];
  /** CMS cache: booth overrides per hall (slotId → patch). */
  overridesByHall: Record<string, Record<string, BoothLayoutPatch>>;
  sceneOverridesByHall: Record<string, SceneOverridesInput>;
  boothOverrides: Record<string, BoothLayoutPatch>;
  sceneOverrides: SceneOverridesInput;
  _boothCmsHydrated: boolean;
  initBoothCms: () => Promise<void>;
  loadCmsExpoOverview: () => Promise<void>;
  /** Copy booth positions/rotation/scale (+ hall entry spawn) from source hall to other halls. */
  applyExpoHallLayoutFrom: (
    sourceHallId: string,
    targetHallIds?: string[],
  ) => Promise<{ ok: boolean; applied: string[] }>;
  /** Copy one booth slot layout from a source hall to target hall(s). */
  applyBoothSlotLayoutFromHall: (
    slotId: string,
    sourceHallId: string,
    targetHallIds?: string[],
  ) => Promise<{ ok: boolean; applied: string[] }>;
  /** Copy multiple booth slots from a source hall to target hall(s). */
  applyBoothSlotsLayoutFromHall: (
    slotIds: string[],
    sourceHallId: string,
    targetHallIds?: string[],
  ) => Promise<{ ok: boolean; applied: string[] }>;
  setActiveHall: (hallId: string, options?: { teleport?: boolean }) => Promise<void>;
  patchBoothOverride: (id: string, patch: BoothLayoutPatch, hallId?: string) => Promise<boolean>;
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
  /** Restore a returning visitor by Visitor ID (MongoDB lookup + local session). */
  loginReturningVisitor: (
    visitorId: string,
  ) => Promise<{ ok: boolean; error?: string; enteredExpo?: boolean }>;

  /** `registration` = arrival lobby; `expo` = main 90×90 hall. */
  expoPhase: 'registration' | 'expo';
  registrationUi: 'none' | 'register' | 'login' | 'granted';
  registrationPass: boolean;
  openRegistrationPopup: () => void;
  openLoginPopup: () => void;
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
  helpDeskOpenPane: 'welcome',
  setHelpDeskOpen: (open, options) => {
    if (open && typeof document !== 'undefined' && document.pointerLockElement) {
      document.exitPointerLock();
    }
    set({
      helpDeskOpen: open,
      helpDeskOpenPane: open ? (options?.pane ?? 'welcome') : 'welcome',
    });
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
  setCmsPage: (page) => {
    if (page !== 'expo' && !get().isAdmin) {
      set({ adminLoginOpen: true });
      return;
    }
    set({ cmsPage: page });
  },

  isAdmin: computeIsAdmin(readVisitorProfile()),
  adminLoginOpen: false,
  setAdminLoginOpen: (open) => set({ adminLoginOpen: open }),
  loginAdmin: (key) => {
    if (!validateAdminKey(key)) return false;
    persistAdminSession(true, key);
    set({ isAdmin: true, adminLoginOpen: false });
    return true;
  },
  logoutAdmin: () => {
    persistAdminSession(false);
    const profile = get().visitorProfile;
    const stillAdmin = computeIsAdmin(profile);
    set({
      isAdmin: stillAdmin,
      hallLayoutEditMode: false,
      cmsPage: stillAdmin ? get().cmsPage : 'expo',
    });
  },

  activeHallId: DEFAULT_EXPO_HALL_ID,
  expoHalls: [...DEFAULT_EXPO_HALLS],
  overridesByHall: {},
  sceneOverridesByHall: {},
  boothOverrides: {},
  sceneOverrides: {},
  _boothCmsHydrated: false,

  hallLayoutEditMode: false,
  setHallLayoutEditMode: (on) => {
    if (on && !get().isAdmin) {
      set({ adminLoginOpen: true });
      return;
    }
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
      isAdmin: computeIsAdmin(profile),
      expoPhase: 'registration',
      registrationUi: 'none',
      showInstructions: true,
    });
    get().teleportPlayer(REG_SPAWN);
  },
  clearVisitorProfile: () => {
    clearVisitorProfileStorage();
    resetAnonymousBrowserScope();
    set({ visitorProfile: null, isAdmin: computeIsAdmin(null) });
  },

  loginReturningVisitor: async (visitorId) => {
    const id = normalizeVisitorId(visitorId);
    if (!isValidVisitorId(id)) {
      return { ok: false, error: 'Enter a valid Visitor ID (e.g. VX-ABC12).' };
    }

    const restoreSession = (profile: VisitorProfile, hasPass: boolean, enteredExpo: boolean) => {
      persistVisitorProfile(profile);
      if (hasPass) {
        try {
          localStorage.setItem(REG_PASS_LS_KEY, '1');
        } catch {
          /* */
        }
      }
      if (typeof document !== 'undefined' && document.pointerLockElement) {
        document.exitPointerLock();
      }
      if (enteredExpo) {
        set({
          visitorProfile: profile,
          isAdmin: computeIsAdmin(profile),
          registrationPass: true,
          registrationUi: 'none',
          expoPhase: 'expo',
          showInstructions: true,
        });
        get().teleportPlayer(
          resolveMainExpoSpawn(mergeHallLayout(get().sceneOverrides.hallLayout)),
        );
        return { ok: true, enteredExpo: true };
      }
      set({
        visitorProfile: profile,
        isAdmin: computeIsAdmin(profile),
        registrationPass: hasPass,
        registrationUi: hasPass ? 'granted' : 'none',
        expoPhase: 'registration',
        showInstructions: false,
      });
      get().teleportPlayer(REG_SPAWN);
      return { ok: true, enteredExpo: false };
    };

    const local = readVisitorProfile();
    if (local?.id === id) {
      const hasPass = readRegistrationPass();
      return restoreSession(local, hasPass, hasPass);
    }

    const remote = await fetchReturningVisitor(id);
    if (!remote.ok) {
      return { ok: false, error: remote.error };
    }

    const v = remote.visitor;
    const profile: VisitorProfile = {
      id: v.visitorId,
      displayName: v.displayName,
      avatar: v.avatar ?? { ...DEFAULT_AVATAR },
      email: v.email,
      phone: v.phone,
      createdAt: v.createdAt ?? Date.now(),
    };
    const hasPass = !!v.lobbyCheckInAt || !!(v.email?.trim() && v.phone?.trim());
    return restoreSession(profile, hasPass, !!v.lobbyCheckInAt);
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
  openLoginPopup: () => {
    if (typeof document !== 'undefined' && document.pointerLockElement) {
      document.exitPointerLock();
    }
    set({ registrationUi: 'login' });
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
      set({ visitorProfile: updated, isAdmin: computeIsAdmin(updated) });
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
      isAdmin: computeIsAdmin(profile),
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

    const hallId = normalizeHallId(get().activeHallId);
    const localBooths = await readPersistedBoothOverrides(hallId);
    if (Object.keys(localBooths).length > 0) {
      set({ boothOverrides: mergeHallBoothPatches(get().boothOverrides, localBooths) });
    }

    let halls = [...DEFAULT_EXPO_HALLS];
    try {
      const hres = await fetch('/api/expo/halls', { cache: 'no-store' });
      if (hres.ok) {
        const hj = await hres.json();
        if (Array.isArray(hj?.halls) && hj.halls.length > 0) halls = dedupeExpoHalls(hj.halls);
      }
    } catch { /* */ }

    let booths: Record<string, BoothLayoutPatch> = {};
    let sceneFromApi: SceneOverridesInput = {};
    let r2PublicBase = '';

    try {
      const res = await fetch(`/api/expo/config?hallId=${encodeURIComponent(hallId)}`, { cache: 'no-store' });
      if (res.ok) {
        const j = await res.json();
        if (j?.booths && typeof j.booths === 'object') booths = j.booths;
        if (j?.scene && typeof j.scene === 'object') sceneFromApi = j.scene;
        if (typeof j?.r2PublicBase === 'string' && j.r2PublicBase) r2PublicBase = j.r2PublicBase;
      }
    } catch { /* */ }

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

    const sceneFromLs: SceneOverridesInput = (() => {
      try {
        const raw = localStorage.getItem(SCENE_CMS_LS_KEY);
        return raw ? JSON.parse(raw) : {};
      } catch { return {}; }
    })();

    const mergedBooths = mergeHallBoothPatches(booths, localBooths);
    const sceneMerged = mergeHallSceneConfig(sceneFromApi, sceneFromLs);

    set({
      expoHalls: halls,
      activeHallId: hallId,
      boothOverrides: mergedBooths,
      sceneOverrides: sceneMerged,
      overridesByHall: { ...get().overridesByHall, [hallId]: mergedBooths },
      sceneOverridesByHall: { ...get().sceneOverridesByHall, [hallId]: sceneMerged },
      _boothCmsHydrated: true,
    });
  },

  loadCmsExpoOverview: async () => {
    const localByHall: Record<string, Record<string, BoothLayoutPatch>> = {};
    for (const h of get().expoHalls) {
      localByHall[h.hallId] = await readPersistedBoothOverrides(h.hallId);
    }

    let halls = get().expoHalls;
    let r2PublicBase = '';
    const overridesByHall: Record<string, Record<string, BoothLayoutPatch>> = { ...get().overridesByHall };
    const sceneOverridesByHall: Record<string, SceneOverridesInput> = { ...get().sceneOverridesByHall };

    try {
      const res = await fetch('/api/expo/cms-overview', { cache: 'no-store' });
      if (res.ok) {
        const j = await res.json();
        if (Array.isArray(j?.halls) && j.halls.length > 0) halls = dedupeExpoHalls(j.halls);
        if (typeof j?.r2PublicBase === 'string' && j.r2PublicBase) r2PublicBase = j.r2PublicBase;
        const byHall = j?.byHall as Record<string, { booths?: Record<string, BoothLayoutPatch>; scene?: SceneOverridesInput }> | undefined;
        if (byHall && typeof byHall === 'object') {
          for (const [hid, cfg] of Object.entries(byHall)) {
            const apiBooths = cfg?.booths ?? {};
            overridesByHall[hid] = mergeHallBoothPatches(apiBooths, localByHall[hid] ?? {});
            if (cfg?.scene) sceneOverridesByHall[hid] = mergeHallSceneConfig(cfg.scene, {});
          }
        }
      }
    } catch { /* */ }

    if (!r2PublicBase) r2PublicBase = getR2PublicBase();
    if (r2PublicBase) setR2PublicBase(r2PublicBase);

    for (const h of halls) {
      if (!overridesByHall[h.hallId]) {
        overridesByHall[h.hallId] = mergeHallBoothPatches({}, localByHall[h.hallId] ?? {});
      }
    }

    const activeHallId = normalizeHallId(get().activeHallId);
    set({
      expoHalls: halls,
      overridesByHall,
      sceneOverridesByHall,
      boothOverrides: overridesByHall[activeHallId] ?? get().boothOverrides,
      sceneOverrides: sceneOverridesByHall[activeHallId] ?? get().sceneOverrides,
    });
  },

  applyExpoHallLayoutFrom: async (sourceHallId, targetHallIds) => {
    const source = normalizeHallId(sourceHallId);
    const sourceOverrides = await resolveHallOverridesForLayoutCopy(source, get);
    const layoutBySlot = extractBoothLayoutPatchesFromOverrides(sourceOverrides);
    const sourceScene = get().sceneOverridesByHall[source] ?? get().sceneOverrides;
    const hallLayoutScenePatch = extractHallSceneLayoutPatch(sourceScene);

    const targets = (targetHallIds?.length
      ? targetHallIds.map(normalizeHallId)
      : get().expoHalls.map((h) => h.hallId).filter((id) => id !== source)
    ).filter((id) => id !== source);

    if (targets.length === 0) return { ok: false, applied: [] };

    const overridesByHall = { ...get().overridesByHall };
    const sceneOverridesByHall = { ...get().sceneOverridesByHall };
    let remoteOk = true;

    for (const target of targets) {
      const existing = overridesByHall[target] ?? {};
      const nextBooths = mergeLayoutIntoBoothOverrides(existing, layoutBySlot);
      overridesByHall[target] = nextBooths;

      const prevScene = sceneOverridesByHall[target] ?? {};
      const nextScene: SceneOverridesInput = hallLayoutScenePatch
        ? {
            ...prevScene,
            hallLayout: {
              ...(prevScene.hallLayout ?? {}),
              ...hallLayoutScenePatch.hallLayout,
            },
          }
        : prevScene;
      sceneOverridesByHall[target] = nextScene;

      const localOk = await persistBoothOverridesWithFallback(nextBooths, target);
      if (!localOk) remoteOk = false;

      try {
        const res = await fetch('/api/booth-cms/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hallId: target, booths: nextBooths, scene: nextScene }),
        });
        const data = await res.json();
        if (!data?.ok) remoteOk = false;
      } catch {
        remoteOk = false;
      }
    }

    const activeHallId = normalizeHallId(get().activeHallId);
    const patchState: Partial<AppState> = { overridesByHall, sceneOverridesByHall };
    if (targets.includes(activeHallId)) {
      patchState.boothOverrides = overridesByHall[activeHallId];
      patchState.sceneOverrides = sceneOverridesByHall[activeHallId] ?? get().sceneOverrides;
    }
    set(patchState);

    return { ok: remoteOk, applied: targets };
  },

  applyBoothSlotLayoutFromHall: async (slotId, sourceHallIdArg, targetHallIds) => {
    const source = normalizeHallId(sourceHallIdArg);
    const slot = slotId.trim();
    if (!slot) return { ok: false, applied: [] };

    const sourceOverrides = await resolveHallOverridesForLayoutCopy(source, get);
    const layout = extractSingleBoothLayoutPatch(slot, sourceOverrides);
    if (!layout) return { ok: false, applied: [] };

    const targets = (targetHallIds?.length
      ? targetHallIds.map(normalizeHallId)
      : get().expoHalls.map((h) => h.hallId).filter((id) => id !== source)
    ).filter((id) => id !== source);

    const uniqueTargets = [...new Set(targets)];
    if (uniqueTargets.length === 0) return { ok: false, applied: [] };

    const overridesByHall = { ...get().overridesByHall };
    let remoteOk = true;

    for (const target of uniqueTargets) {
      const existing = overridesByHall[target] ?? {};
      const nextBooths = mergeLayoutIntoBoothOverrides(existing, { [slot]: layout });
      overridesByHall[target] = nextBooths;

      const localOk = await persistBoothOverridesWithFallback(nextBooths, target);
      if (!localOk) remoteOk = false;

      try {
        const res = await fetch('/api/booth-cms/copy-booth-layout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceHallId: source,
            targetHallId: target,
            slotId: slot,
          }),
        });
        const data = (await res.json()) as { ok?: boolean };
        if (!data?.ok) remoteOk = false;
      } catch {
        remoteOk = false;
      }
    }

    const activeHallId = normalizeHallId(get().activeHallId);
    const patchState: Partial<AppState> = { overridesByHall };
    if (uniqueTargets.includes(activeHallId)) {
      patchState.boothOverrides = overridesByHall[activeHallId];
    }
    set(patchState);

    return { ok: remoteOk, applied: uniqueTargets };
  },

  applyBoothSlotsLayoutFromHall: async (slotIdsArg, sourceHallIdArg, targetHallIds) => {
    const slots = [...new Set(slotIdsArg.map((s) => s.trim()).filter(Boolean))];
    if (slots.length === 0) return { ok: false, applied: [] };

    const source = normalizeHallId(sourceHallIdArg);
    const sourceOverrides = await resolveHallOverridesForLayoutCopy(source, get);
    const layoutBySlot: Record<string, BoothLayoutOnlyPatch> = {};
    for (const slot of slots) {
      const layout = extractSingleBoothLayoutPatch(slot, sourceOverrides);
      if (layout) layoutBySlot[slot] = layout;
    }
    if (Object.keys(layoutBySlot).length === 0) return { ok: false, applied: [] };

    const targets = (targetHallIds?.length
      ? targetHallIds.map(normalizeHallId)
      : get().expoHalls.map((h) => h.hallId).filter((id) => id !== source)
    ).filter((id) => id !== source);

    const uniqueTargets = [...new Set(targets)];
    if (uniqueTargets.length === 0) return { ok: false, applied: [] };

    const overridesByHall = { ...get().overridesByHall };
    let remoteOk = true;

    for (const target of uniqueTargets) {
      const existing = overridesByHall[target] ?? {};
      const nextBooths = mergeLayoutIntoBoothOverrides(existing, layoutBySlot);
      overridesByHall[target] = nextBooths;

      const localOk = await persistBoothOverridesWithFallback(nextBooths, target);
      if (!localOk) remoteOk = false;

      for (const slot of Object.keys(layoutBySlot)) {
        const layout = layoutBySlot[slot];
        if (!layout) continue;
        try {
          const res = await fetch('/api/booth-cms/copy-booth-layout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sourceHallId: source,
              targetHallId: target,
              slotId: slot,
            }),
          });
          const data = (await res.json()) as { ok?: boolean };
          if (!data?.ok) remoteOk = false;
        } catch {
          remoteOk = false;
        }
      }
    }

    const activeHallId = normalizeHallId(get().activeHallId);
    const patchState: Partial<AppState> = { overridesByHall };
    if (uniqueTargets.includes(activeHallId)) {
      patchState.boothOverrides = overridesByHall[activeHallId];
    }
    set(patchState);

    return { ok: remoteOk, applied: uniqueTargets };
  },

  setActiveHall: async (hallId, options) => {
    const nextHall = normalizeHallId(hallId);
    const prevHall = normalizeHallId(get().activeHallId);

    if (prevHall !== nextHall) {
      const overridesByHall = {
        ...get().overridesByHall,
        [prevHall]: { ...get().boothOverrides },
      };
      const sceneOverridesByHall = {
        ...get().sceneOverridesByHall,
        [prevHall]: { ...get().sceneOverrides },
      };
      await persistBoothOverridesWithFallback(overridesByHall[prevHall], prevHall);

      let booths = overridesByHall[nextHall];
      let scene = sceneOverridesByHall[nextHall];

      if (!booths) {
        const local = await readPersistedBoothOverrides(nextHall);
        let apiBooths: Record<string, BoothLayoutPatch> = {};
        let sceneFromApi: SceneOverridesInput = {};
        try {
          const res = await fetch(`/api/expo/config?hallId=${encodeURIComponent(nextHall)}`, { cache: 'no-store' });
          if (res.ok) {
            const j = await res.json();
            if (j?.booths && typeof j.booths === 'object') apiBooths = j.booths;
            if (j?.scene && typeof j.scene === 'object') sceneFromApi = j.scene;
          }
        } catch { /* */ }
        booths = mergeHallBoothPatches(apiBooths, local);
        scene = mergeHallSceneConfig(sceneFromApi, {});
        overridesByHall[nextHall] = booths;
        sceneOverridesByHall[nextHall] = scene;
      }

      set({
        activeHallId: nextHall,
        overridesByHall,
        sceneOverridesByHall,
        boothOverrides: booths,
        sceneOverrides: scene ?? {},
      });
    } else {
      set({ activeHallId: nextHall });
    }

    if (options?.teleport !== false && get().expoPhase === 'expo') {
      const meta = getExpoHallMeta(nextHall) ?? get().expoHalls.find((h) => h.hallId === nextHall);
      const spawn = meta?.spawn ?? resolveMainExpoSpawn(mergeHallLayout(get().sceneOverrides.hallLayout));
      get().teleportPlayer(spawn);
    }
  },

  syncBoothOverridesFromPersistence: async () => {
    const hallId = normalizeHallId(get().activeHallId);
    const local = await readPersistedBoothOverrides(hallId);
    const current = get().boothOverrides;
    const ids = new Set([...Object.keys(current), ...Object.keys(local)]);
    if (ids.size === 0) return;
    const merged: Record<string, BoothLayoutPatch> = { ...current };
    for (const id of ids) {
      merged[id] = mergeBoothLayoutPatch(current[id], local[id]);
    }
    set({
      boothOverrides: merged,
      overridesByHall: { ...get().overridesByHall, [hallId]: merged },
    });
  },

  syncSceneOverridesFromPersistence: () => {
    const local = readPersistedSceneConfig();
    const current = get().sceneOverrides;
    const merged = mergeSceneOverridesInput({}, current, local);
    set({ sceneOverrides: merged });
  },

  patchBoothOverride: async (id, patch, hallIdArg) => {
    if (!get().isAdmin) {
      set({ adminLoginOpen: true });
      return false;
    }
    const hallId = normalizeHallId(hallIdArg ?? get().activeHallId);
    const prev = get().boothOverrides[id] || {};
    const nextEntry = { ...prev } as BoothLayoutPatch;
    const definedPatch: BoothLayoutPatch = {};
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) continue;
      if (value === null) {
        delete (nextEntry as Record<string, unknown>)[key];
        definedPatch[key as keyof BoothLayoutPatch] = null as never;
      } else if (key === 'headerBranding' && value && typeof value === 'object') {
        const mergedHb = { ...(prev.headerBranding ?? {}), ...(value as BoothLayoutPatch['headerBranding']) };
        nextEntry.headerBranding = mergedHb;
        definedPatch.headerBranding = mergedHb;
      } else if (key === 'company' && value && typeof value === 'object') {
        const mergedCo = { ...(prev.company ?? {}), ...(value as BoothLayoutPatch['company']) };
        nextEntry.company = mergedCo;
        definedPatch.company = mergedCo;
      } else if (key === 'lighting' && value && typeof value === 'object') {
        const mergedLi = { ...(prev.lighting ?? {}), ...(value as BoothLayoutPatch['lighting']) };
        nextEntry.lighting = mergedLi;
        definedPatch.lighting = mergedLi;
      } else {
        (nextEntry as Record<string, unknown>)[key] = value;
        (definedPatch as Record<string, unknown>)[key] = value;
      }
    }
    const nextAll = { ...get().boothOverrides, [id]: nextEntry };
    set({
      boothOverrides: nextAll,
      overridesByHall: { ...get().overridesByHall, [hallId]: nextAll },
    });
    const localOk = await persistBoothOverridesWithFallback(nextAll, hallId);

    let remoteOk = false;
    try {
      const res = await fetch('/api/booth-cms/patch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAdminApiHeaders() },
        body: JSON.stringify({ hallId, slotId: id, boothId: id, patch: definedPatch }),
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
    if (!get().isAdmin) {
      set({ adminLoginOpen: true });
      return;
    }
    const hallId = normalizeHallId(get().activeHallId);
    const { [id]: _, ...rest } = get().boothOverrides;
    set({ boothOverrides: rest, overridesByHall: { ...get().overridesByHall, [hallId]: rest } });
    try {
      await fetch(`/api/booth-cms/${encodeURIComponent(hallId)}/${encodeURIComponent(id)}`, { method: 'DELETE' });
    } catch { /* */ }
  },

  deleteBoothOverride: async (id) => {
    if (!get().isAdmin) {
      set({ adminLoginOpen: true });
      return;
    }
    const hallId = normalizeHallId(get().activeHallId);
    const { [id]: _, ...rest } = get().boothOverrides;
    set({ boothOverrides: rest, overridesByHall: { ...get().overridesByHall, [hallId]: rest } });
    try {
      await fetch(`/api/booth-cms/${encodeURIComponent(hallId)}/${encodeURIComponent(id)}`, { method: 'DELETE' });
    } catch { /* */ }
  },

  duplicateBoothOverride: async (fromId, newId) => {
    if (!get().isAdmin) {
      set({ adminLoginOpen: true });
      return;
    }
    const hallId = normalizeHallId(get().activeHallId);
    const source = get().boothOverrides[fromId];
    if (!source) return;
    const clone = JSON.parse(JSON.stringify(source)) as BoothLayoutPatch;
    if (clone.position) clone.position = [clone.position[0] + 5, clone.position[1], clone.position[2]];
    const nextAll = { ...get().boothOverrides, [newId]: clone };
    set({ boothOverrides: nextAll, overridesByHall: { ...get().overridesByHall, [hallId]: nextAll } });
    try {
      await fetch('/api/booth-cms/patch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hallId, slotId: newId, boothId: newId, patch: clone }),
      });
    } catch { /* */ }
  },

  resetAllBoothOverrides: async () => {
    if (!get().isAdmin) {
      set({ adminLoginOpen: true });
      return;
    }
    const hallId = normalizeHallId(get().activeHallId);
    set({
      boothOverrides: {},
      overridesByHall: { ...get().overridesByHall, [hallId]: {} },
    });
    try {
      await fetch('/api/booth-cms/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hallId, booths: {}, scene: {} }),
      });
    } catch { /* */ }
  },

  patchSceneOverride: (patch) => {
    if (!get().isAdmin) {
      set({ adminLoginOpen: true });
      return;
    }
    const hallId = normalizeHallId(get().activeHallId);
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
        cornerPlantTransforms: incomingReg.cornerPlantTransforms
          ? { ...(prevReg.cornerPlantTransforms || {}), ...incomingReg.cornerPlantTransforms }
          : prevReg.cornerPlantTransforms,
      };
    }

    persistSceneConfig(next);
    set({
      sceneOverrides: next,
      sceneOverridesByHall: { ...get().sceneOverridesByHall, [hallId]: next },
    });

    void fetch('/api/scene/patch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAdminApiHeaders() },
      body: JSON.stringify({ hallId, patch: next }),
    }).catch(() => { /* API may be unavailable */ });
  },

  resetSceneOverrides: () => {
    if (!get().isAdmin) {
      set({ adminLoginOpen: true });
      return;
    }
    persistSceneConfig({});
    set({ sceneOverrides: {} });
    void fetch('/api/scene', { method: 'DELETE' }).catch(() => {});
  },

  getSceneConfig: () => mergeSceneConfig(get().sceneOverrides),
}));
