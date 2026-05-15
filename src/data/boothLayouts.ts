/**
 * Booth CMS data model — edit defaults here or override via:
 * - `public/booth-cms.json` → `{ "booths": { "<booth-id>": { ...partial } }, "scene": { ... } }`
 * - In-app CMS dashboard at `/cms` (persisted to localStorage)
 */

export type MediaItem = {
  id: string;
  type: 'image' | 'video' | 'pdf' | 'model';
  url: string;
  label: string;
};

/** An image placed on a booth surface via the CMS drag-and-drop editor */
export type PlacedImage = {
  id: string;
  url: string;
  label: string;
  /** Position in booth local space */
  position: [number, number, number];
  /** Euler rotation in radians */
  rotation: [number, number, number];
  /** Width × height in meters */
  size: [number, number];
};

export type CompanyProfile = {
  companyName: string;
  tagline: string;
  website: string;
  phone: string;
  email: string;
  whatsapp: string;
  facebook: string;
  instagram: string;
  twitter: string;
  brandPrimary: string;
  brandSecondary: string;
};

export type BoothLighting = {
  spotlightIntensity: number;
  spotlightColor: string;
  ledStripColor: string;
  ledStripIntensity: number;
  emissiveGlow: number;
  ambientIntensity: number;
};

/** Visitor quick-pick under the hostess “How can I help you?” (CMS per booth). */
export type HostessQuickReply = {
  id: string;
  /** Short chip shown to the visitor */
  label: string;
  /** Answer text + optional voice (speech synthesis). Ignored when {@link action} is `askAi`. */
  response: string;
  /** Opens the Ask AI chat panel instead of showing / speaking a canned reply. */
  action?: 'askAi';
};

export type BoothLayoutConfig = {
  id: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  name: string;
  color: string;
  accent: string;
  counterColor: string;
  /** Main + counter LED: video or still image URL (or data:image/…) */
  videoUrl: string;
  headerLogoUrl?: string;
  /** Per-booth media gallery */
  media: MediaItem[];
  /** Images placed on booth surfaces via the visual editor */
  placedImages: PlacedImage[];
  company: CompanyProfile;
  lighting: BoothLighting;
  /** Extra description shown in booth info overlay */
  description: string;
  /** Brochure download URL */
  brochureUrl: string;
  /** Site map image URL (first slide); additional slides in siteMapGallery */
  siteMapUrl: string;
  /** Extra site map images shown after siteMapUrl in the kiosk carousel */
  siteMapGallery?: string[];
  /** Price list image URL */
  priceListUrl: string;
  /** Quick-reply options when the visitor stands near the booth hostess */
  hostessQuickReplies?: HostessQuickReply[];
};

/** Ordered URLs for the site map lightbox (primary + gallery). */
export function siteMapUrlsFromConfig(b: Pick<BoothLayoutConfig, 'siteMapUrl' | 'siteMapGallery'>): string[] {
  const first = (b.siteMapUrl ?? '').trim();
  const extra = (b.siteMapGallery ?? []).map((u) => String(u).trim()).filter(Boolean);
  if (extra.length > 0) return first ? [first, ...extra] : extra;
  return first ? [first] : [];
}

export function siteMapToStorageFields(urls: string[]): { siteMapUrl: string; siteMapGallery: string[] } {
  const clean = urls.map((u) => String(u).trim()).filter(Boolean);
  return { siteMapUrl: clean[0] ?? '', siteMapGallery: clean.slice(1) };
}

export type HallLayoutConfig = {
  /** Added to default entrance lobby anchor `[0, 0, entranceZ]`. */
  entranceLobbyOffset: [number, number, number];
  /** Added to default banner anchor `[0, 6, -4.5]` inside the lobby group. */
  receptionBannerOffset: [number, number, number];
  /** Four decorative tree world positions. */
  plantPositions: [
    [number, number, number],
    [number, number, number],
    [number, number, number],
    [number, number, number],
  ];
  plantScales: [number, number, number, number];
};

/** Half-width of the 90m expo hall (must match `ExpoHall` / `Player` bounds). */
export const HALL_HALF_EXTENT = 45;

export function defaultEntranceLobbyZ(): number {
  return HALL_HALF_EXTENT - 2;
}

export const DEFAULT_HALL_LAYOUT: HallLayoutConfig = {
  entranceLobbyOffset: [0, 0, 0],
  receptionBannerOffset: [0, 0, 0],
  plantPositions: [
    [-5, 0, 15],
    [5, 0, 15],
    [-5, 0, 30],
    [5, 0, 30],
  ],
  plantScales: [1.08, 1.08, 0.92, 0.92],
};

export function mergeHallLayout(overrides?: Partial<HallLayoutConfig>): HallLayoutConfig {
  if (!overrides) return { ...DEFAULT_HALL_LAYOUT };
  return {
    ...DEFAULT_HALL_LAYOUT,
    ...overrides,
    plantPositions: overrides.plantPositions ?? DEFAULT_HALL_LAYOUT.plantPositions,
    plantScales: overrides.plantScales ?? DEFAULT_HALL_LAYOUT.plantScales,
  };
}

/** User-imported GLB in the registration lounge (Edit layout → Import GLB). */
export type RegistrationImportedModel = {
  id: string;
  label: string;
  /** `/assets/foo.glb` or a blob URL from a local file pick. */
  url: string;
  offset: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
};

/** Movable registration lobby props (Edit layout in arrival lobby). */
export type RegistrationLayoutConfig = {
  /** World offset added to default reception anchor `[0, 0, REG_RECEPTION_Z]`. */
  receptionOffset: [number, number, number];
  /** Local offset for registration counter group. */
  deskOffset: [number, number, number];
  /** Local offset for LED backdrop wall group. */
  backdropOffset: [number, number, number];
  /** Local offset for queue lanes group. */
  queueOffset: [number, number, number];
  /** Local offset for info totems group. */
  totemsOffset: [number, number, number];
  /** Lounge carpet zone (local to reg-reception-root). */
  loungeOffset: [number, number, number];
  sectionalOffset: [number, number, number];
  chairLeftOffset: [number, number, number];
  chairRightOffset: [number, number, number];
  coffeeTableOffset: [number, number, number];
  lampLeftOffset: [number, number, number];
  lampRightOffset: [number, number, number];
  loungePlantOffsets: [
    [number, number, number],
    [number, number, number],
    [number, number, number],
    [number, number, number],
  ];
  /** Euler radians for lounge gizmo targets (`reg-lobby-*`, `reg-imported-*`). */
  loungeRotations: Record<string, [number, number, number]>;
  importedModels: RegistrationImportedModel[];
};

export const DEFAULT_REGISTRATION_LAYOUT: RegistrationLayoutConfig = {
  receptionOffset: [0, 0, 0],
  deskOffset: [0, 0, 0],
  backdropOffset: [0, 0, 0],
  queueOffset: [0, 0, 0],
  totemsOffset: [0, 0, 0],
  loungeOffset: [0, 0, 10],
  sectionalOffset: [0, 0, -1.5],
  chairLeftOffset: [-4, 0, 2.5],
  chairRightOffset: [4, 0, 2.5],
  coffeeTableOffset: [0, 0, 1],
  lampLeftOffset: [-5.6, 0, -1.5],
  lampRightOffset: [5.6, 0, -1.5],
  loungePlantOffsets: [
    [-6, 0, -2],
    [6, 0, -2],
    [-6.2, 0, 3.5],
    [6.2, 0, 3.5],
  ],
  loungeRotations: {
    'reg-lobby-chair-left': [0, 0.4, 0],
    'reg-lobby-chair-right': [0, -0.4, 0],
  },
  importedModels: [],
};

export function mergeRegistrationLayout(
  overrides?: Partial<RegistrationLayoutConfig>,
): RegistrationLayoutConfig {
  if (!overrides) return { ...DEFAULT_REGISTRATION_LAYOUT };
  return {
    ...DEFAULT_REGISTRATION_LAYOUT,
    ...overrides,
    loungePlantOffsets: overrides.loungePlantOffsets ?? DEFAULT_REGISTRATION_LAYOUT.loungePlantOffsets,
    loungeRotations: { ...DEFAULT_REGISTRATION_LAYOUT.loungeRotations, ...overrides.loungeRotations },
    importedModels: overrides.importedModels ?? DEFAULT_REGISTRATION_LAYOUT.importedModels,
  };
}

/** Persisted scene slice (localStorage / booth-cms.json) — `hallLayout` fields may be partial. */
export type SceneOverridesInput = Omit<Partial<SceneConfig>, 'hallLayout'> & {
  hallLayout?: Partial<HallLayoutConfig>;
  registrationLayout?: Partial<RegistrationLayoutConfig>;
};

export function mergeSceneConfig(overrides: SceneOverridesInput): SceneConfig {
  const { hallLayout, ...rest } = overrides;
  return {
    ...DEFAULT_SCENE_CONFIG,
    ...rest,
    hallLayout: mergeHallLayout(
      hallLayout !== undefined ? { ...DEFAULT_HALL_LAYOUT, ...hallLayout } : undefined,
    ),
  };
}

export type SceneConfig = {
  hallAmbientIntensity: number;
  hallAmbientColor: string;
  ceilingLightIntensity: number;
  ceilingLightColor: string;
  fogNear: number;
  fogFar: number;
  fogColor: string;
  bloomIntensity: number;
  bloomThreshold: number;
  vignetteIntensity: number;
  bgColor: string;
  /** When false, hide standard white builder stalls (keeps Vertex Elite + help desk). Improves FPS. */
  showStandardBooths: boolean;
  /** Full-screen bloom / tone-map / vignette — expensive on integrated GPUs. */
  postProcessing: boolean;
  /** Show ballroom with conference chairs (expensive). */
  showBallroom: boolean;
  /** Show roaming executive animated model. */
  showRoamingExecutive: boolean;
  /** Show video planes (expensive video decoding). */
  showVideos: boolean;
  /** Google Gemini API key for Ask AI chatbox. */
  aiApiKey?: string;
  /**
   * Facts for a single showcase “deck” / project. When non-empty, Ask AI answers only from this text
   * (plus brief pleasantries). Override with `VITE_AI_DECK_CONTEXT` in .env for deployments.
   */
  aiDeckContext?: string;
  /**
   * Gemini model id for `generateContent` (e.g. gemini-3.1-flash-lite-preview). Override with `VITE_GEMINI_MODEL` in .env.
   */
  aiGeminiModel?: string;
  /** Hall props: entrance, banner, trees — edited in-expo and merged from overrides. */
  hallLayout: HallLayoutConfig;
};

export const DEFAULT_SCENE_CONFIG: SceneConfig = {
  hallAmbientIntensity: 0.48,
  hallAmbientColor: '#fff8ef',
  ceilingLightIntensity: 280,
  ceilingLightColor: '#ffffff',
  fogNear: 25,
  fogFar: 120,
  fogColor: '#fdfbf2',
  bloomIntensity: 0.26,
  bloomThreshold: 1.72,
  vignetteIntensity: 0.42,
  bgColor: '#fdfbf2',
  showStandardBooths: false,
  postProcessing: false,
  showBallroom: false,
  showRoamingExecutive: false,
  showVideos: false,
  aiApiKey: '',
  aiDeckContext: '',
  aiGeminiModel: 'gemini-3.1-flash-lite-preview',
  hallLayout: DEFAULT_HALL_LAYOUT,
};

export const PROJECT_VIDEOS = [
  '/13391496_3840_2160_60fps.mp4',
  '/13391496_3840_2160_60fps.mp4',
  '/13391496_3840_2160_60fps.mp4',
  '/13391496_3840_2160_60fps.mp4',
  '/13391496_3840_2160_60fps.mp4',
  '/13391496_3840_2160_60fps.mp4',
];

const DEFAULT_COMPANY: CompanyProfile = {
  companyName: '',
  tagline: '',
  website: '',
  phone: '',
  email: '',
  whatsapp: '',
  facebook: '',
  instagram: '',
  twitter: '',
  brandPrimary: '#d4af37',
  brandSecondary: '#1a1a1a',
};

const DEFAULT_LIGHTING: BoothLighting = {
  spotlightIntensity: 55,
  spotlightColor: '#ffe7bf',
  ledStripColor: '#d4af37',
  ledStripIntensity: 2,
  emissiveGlow: 0.15,
  ambientIntensity: 0.35,
};

function makeDefaultBooth(
  id: string,
  name: string,
  position: [number, number, number],
  rotation: [number, number, number],
  color: string,
  videoUrl: string,
  headerLogoUrl?: string,
): BoothLayoutConfig {
  return {
    id,
    position,
    rotation,
    scale: [1, 1, 1],
    name,
    color,
    accent: '#d4af37',
    counterColor: '#ffffff',
    videoUrl,
    headerLogoUrl,
    media: [],
    placedImages: [],
    company: { ...DEFAULT_COMPANY },
    lighting: { ...DEFAULT_LIGHTING },
    description: '',
    brochureUrl: '',
    siteMapUrl: '',
    siteMapGallery: [],
    priceListUrl: '',
    hostessQuickReplies: [],
  };
}

export function buildDefaultBoothLayoutList(): BoothLayoutConfig[] {
  const vertex = makeDefaultBooth('vertex-elite', 'VERTEX ELITE', [-21.5, 0, 19], [0, Math.PI / 2 + 0.06, 0], '#fcfaf5', PROJECT_VIDEOS[2]);
  return [
    makeDefaultBooth('builder-1', 'LUXE TOWERS', [-20, 0, -15], [0, Math.PI / 2 - 0.16, 0], '#fcfaf5', PROJECT_VIDEOS[0]),
    makeDefaultBooth('builder-2', 'AURUM RESIDENCES', [-20, 0, 5], [0, Math.PI / 2, 0], '#fcf9f2', PROJECT_VIDEOS[1]),
    {
      ...vertex,
      brochureUrl: vertex.brochureUrl || 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      priceListUrl: vertex.priceListUrl || 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      siteMapUrl: vertex.siteMapUrl || '/maps/site-map.svg',
      hostessQuickReplies: [
        { id: 'vertex-hq-1', label: 'Project timeline', response: 'We are targeting completion in late twenty twenty-six. I can walk you through the milestones.' },
        { id: 'vertex-hq-ai', label: 'Ask AI', response: '', action: 'askAi' },
      ],
    },
    makeDefaultBooth('builder-4', 'CROWN ESTATES', [20, 0, -15], [0, -Math.PI / 2 + 0.16, 0], '#fcfaf5', PROJECT_VIDEOS[3]),
    makeDefaultBooth('builder-5', 'THE MONARCH', [20, 0, 5], [0, -Math.PI / 2, 0], '#fcf9f2', PROJECT_VIDEOS[4]),
    makeDefaultBooth('builder-6', 'HORIZON VISTAS', [20, 0, 25], [0, -Math.PI / 2 - 0.16, 0], '#fdfbf5', PROJECT_VIDEOS[5]),
  ];
}

export type BoothLayoutPatch = Partial<Omit<BoothLayoutConfig, 'id'>>;

/** Old CMS / localStorage still had “How to book a visit”; map to Ask AI so the expo updates without manual reset. */
function migrateLegacyHostessQuickReplies(replies: HostessQuickReply[] | undefined): HostessQuickReply[] {
  if (!replies?.length) return replies ?? [];
  const mapped = replies.map((r) => {
    const labelNorm = r.label.trim().replace(/\s+/g, ' ').toLowerCase();
    const legacy =
      r.id === 'vertex-hq-2' ||
      labelNorm === 'how to book a visit' ||
      labelNorm === 'how to book a visit?';
    if (legacy && r.action !== 'askAi') {
      return { id: 'vertex-hq-ai', label: 'Ask AI', response: '', action: 'askAi' as const };
    }
    return r;
  });
  let keptAskAi = false;
  return mapped.filter((r) => {
    if (r.action === 'askAi') {
      if (keptAskAi) return false;
      keptAskAi = true;
    }
    return true;
  });
}

export function applyBoothOverrides(
  defaults: BoothLayoutConfig[],
  overrides: Record<string, BoothLayoutPatch>
): BoothLayoutConfig[] {
  return defaults.map((b) => {
    const o = overrides[b.id];
    if (!o) return b;
    return {
      ...b,
      ...o,
      media: o.media ?? b.media,
      placedImages: o.placedImages ?? b.placedImages,
      siteMapGallery: o.siteMapGallery ?? b.siteMapGallery,
      hostessQuickReplies: migrateLegacyHostessQuickReplies(
        o.hostessQuickReplies !== undefined ? o.hostessQuickReplies : b.hostessQuickReplies,
      ),
      company: o.company ? { ...b.company, ...o.company } : b.company,
      lighting: o.lighting ? { ...b.lighting, ...o.lighting } : b.lighting,
    };
  });
}

export function deg3ToRad3(rxDeg: number, ryDeg: number, rzDeg: number): [number, number, number] {
  const d2r = Math.PI / 180;
  return [rxDeg * d2r, ryDeg * d2r, rzDeg * d2r];
}

export function rad3ToDeg3(rx: number, ry: number, rz: number): [number, number, number] {
  const r2d = 180 / Math.PI;
  return [rx * r2d, ry * r2d, rz * r2d];
}
