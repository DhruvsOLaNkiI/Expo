import type { RenderQuality } from './renderQuality';
import {
  mergeBoothDisplayLayout,
  type BoothDisplayLayout,
  type BoothDisplayTransform,
} from './boothDisplayLayout';

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

/** Named floor-plan slide (exhibitor uploads multiple unit types). */
export type UnitLayoutItem = {
  id: string;
  name: string;
  imageUrl: string;
};

/** Sales rep assigned to this booth for visitor chat. */
export type AssignedSalesPerson = {
  name: string;
  email: string;
  phone: string;
  photoUrl?: string;
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
  /** Answer text + optional voice (speech synthesis). Ignored when {@link action} is `askAi`, `helpDesk`, or `teleport`. */
  response: string;
  /** Opens the Ask AI chat panel instead of showing / speaking a canned reply. */
  action?: 'askAi' | 'teleport' | 'helpDesk';
  /** When {@link action} is `helpDesk`, open Smart Concierge on this pane. */
  helpDeskPane?: 'welcome' | 'halls';
  /** When {@link action} is `teleport`, id from {@link buildExpoTeleportDestinations} or registration lobby. */
  teleportId?: string;
};

/** Multiple-choice option for an exhibitor-defined FAQ question. */
export type CustomFaqOption = {
  id: string;
  text: string;
};

/** Exhibitor-authored FAQ question with answer options (shown in dashboard + visitor flows). */
export type CustomFaqQuestion = {
  id: string;
  question: string;
  options: CustomFaqOption[];
};

/** Fixed zones on the booth header fascia — developer logo (left), project name (center), project logo (right). */
export type BoothHeaderBranding = {
  /** Center fascia title — defaults to booth name */
  projectName?: string;
  /** Line under project name — defaults to company tagline */
  projectSubtitle?: string;
  /** RERA registration shown on the right of the fascia when no project logo is set */
  reraNumber?: string;
  /** Header logo size on the top fascia (0.5 = small, 1 = default, 2.5 = large). */
  logoScale?: number;
  /** Hide center project name + subtitle on the fascia beam. */
  hideCenterText?: boolean;
  /** Hide only the subtitle line under the project name (e.g. “LUXURY RESIDENCES”). */
  hideSubtitle?: boolean;
  /** Move header logo from the left slot to the center (implies hideCenterText). */
  centerHeaderLogo?: boolean;
  /** Hide the RERA block on the right of the header beam. */
  hideRera?: boolean;
};

export function resolveFasciaLayout(headerBranding?: BoothHeaderBranding): {
  centerLogo: boolean;
  hideCenterText: boolean;
  showRera: boolean;
} {
  const centerLogo = headerBranding?.centerHeaderLogo === true;
  const hideCenterText = centerLogo || headerBranding?.hideCenterText === true;
  const hasRera = Boolean(headerBranding?.reraNumber?.trim());
  const showRera =
    headerBranding?.hideRera !== true &&
    (!centerLogo || hasRera);
  return { centerLogo, hideCenterText, showRera };
}

const HEADER_LOGO_SCALE_MIN = 0.5;
const HEADER_LOGO_SCALE_MAX = 2.5;
const HEADER_LOGO_SCALE_DEFAULT = 1.5;

export function resolveHeaderLogoScale(headerBranding?: BoothHeaderBranding): number {
  const raw = headerBranding?.logoScale;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.min(HEADER_LOGO_SCALE_MAX, Math.max(HEADER_LOGO_SCALE_MIN, raw));
  }
  return HEADER_LOGO_SCALE_DEFAULT;
}

export function resolveBoothHeaderBranding(params: {
  name: string;
  headerBranding?: BoothHeaderBranding;
  companyTagline?: string;
}): { projectName: string; projectSubtitle: string; reraNumber: string } {
  const hb = params.headerBranding;
  // Explicit empty subtitle (or hideSubtitle) must stay empty — do not fall back to "LUXURY RESIDENCES".
  let projectSubtitle = '';
  if (hb?.hideSubtitle === true) {
    projectSubtitle = '';
  } else if (hb?.projectSubtitle !== undefined) {
    projectSubtitle = hb.projectSubtitle.trim();
  } else {
    projectSubtitle = params.companyTagline?.trim() || '';
  }
  return {
    projectName: hb?.projectName?.trim() || params.name,
    projectSubtitle,
    reraNumber: hb?.reraNumber?.trim() || '',
  };
}

/** CMS managed header (B-04 / Crown Estates) — never falls back to booth name when center text is hidden. */
export function resolveManagedHeaderCopy(params: {
  headerBranding?: BoothHeaderBranding;
  companyTagline?: string;
}): {
  showTitle: boolean;
  showSubtitle: boolean;
  title: string;
  subtitle: string;
  reraNumber: string;
} {
  const { hideCenterText, showRera } = resolveFasciaLayout(params.headerBranding);
  const reraNumber = params.headerBranding?.reraNumber?.trim() || '';
  if (hideCenterText) {
    return { showTitle: false, showSubtitle: false, title: '', subtitle: '', reraNumber };
  }
  const title = params.headerBranding?.projectName?.trim() || '';
  const subtitle =
    params.headerBranding?.hideSubtitle === true
      ? ''
      : params.headerBranding?.projectSubtitle !== undefined
        ? params.headerBranding.projectSubtitle.trim()
        : params.companyTagline?.trim() || '';
  return {
    showTitle: Boolean(title),
    showSubtitle: Boolean(subtitle),
    title,
    subtitle,
    reraNumber: showRera ? reraNumber : '',
  };
}

/** Booth IDs that use {@link BoothManagedHeader} instead of legacy fascia text defaults. */
/** B-04 Crown Estates only — dedicated CMS header (see BoothManagedHeader). */
export const MANAGED_HEADER_BOOTH_IDS = new Set(['builder-4']);

export type BoothLayoutConfig = {
  id: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  name: string;
  color: string;
  accent: string;
  counterColor: string;
  /** Walkthrough booth button + legacy LED fallback when {@link stageScreenUrl} is empty */
  videoUrl: string;
  /** Main stage screen (large back-wall LED) — image or video URL */
  stageScreenUrl?: string;
  headerLogoUrl?: string;
  /** Right fascia slot — project / secondary logo (left of RERA when both set). */
  projectLogoUrl?: string;
  /** Back-wall logos flanking the main LED screen */
  wallLogoLeftUrl?: string;
  wallLogoRightUrl?: string;
  /** Inside booth — entrance wing walls */
  sideWallLeftImageUrl?: string;
  sideWallRightImageUrl?: string;
  /** Outside booth — aisle-facing side walls */
  exteriorWallLeftImageUrl?: string;
  exteriorWallRightImageUrl?: string;
  counterFrontImageUrl?: string;
  /** Roll-up standee poster beside the desk — replaces the printed booth name when set. */
  standeeImageUrl?: string;
  /** When true, sideWall* = inside and exteriorWall* = outside (legacy configs omit this). */
  wallPlacementV2?: boolean;
  /** Per-slot shift / scale for wall poster images (exhibitor Booth Setup). */
  wallPlacementAdjustments?: import('@/features/booths/components/boothWallMetrics').BoothWallPlacementAdjustments;
  /** Header fascia: logo slot, project name, RERA — configured in exhibitor Booth Setup */
  headerBranding?: BoothHeaderBranding;
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
  /** Unit layout PDF or image (booth “Unit layout” button) */
  unitLayoutUrl: string;
  /** Multiple named unit layouts (Name → image/PDF URL); first entry mirrors {@link unitLayoutUrl}. */
  unitLayouts?: UnitLayoutItem[];
  /** Floor plan PDF or image (booth “Floor plan” button) */
  floorPlanUrl: string;
  /** Multiple named floor plans; first entry mirrors {@link floorPlanUrl}. */
  floorPlans?: UnitLayoutItem[];
  /** FAQ document (PDF) for AI / visitor help */
  faqUrl?: string;
  /** Custom multiple-choice FAQ questions configured by the exhibitor */
  customFaqQuestions?: CustomFaqQuestion[];
  /** Assigned sales contact shown in exhibitor chat */
  assignedSalesPerson?: AssignedSalesPerson;
  /** Custom signage board image (e.g. for EcoEden digital board) */
  signageImageUrl?: string;
  /** CMS: auto-run PageIndex when uploading brochure PDF */
  pageIndexBrochure?: boolean;
  /** CMS: auto-run PageIndex when uploading price list PDF */
  pageIndexPriceList?: boolean;
  /** Quick-reply options when the visitor stands near the booth hostess */
  hostessQuickReplies?: HostessQuickReply[];
  /** Edit layout → per-display position / rotation / scale (main LED, counter, standee, …) */
  displayLayout?: BoothDisplayLayout;
  /** Builder-8 (Eco / Eldeco): main rear wall behind the TV. */
  backWallColor?: string;
  /** Builder-8: panel behind / around the main LED screen. */
  tvWallColor?: string;
  /** Builder-8: header fascia panel background. */
  headerFasciaColor?: string;
  /** Builder-8: reception desk top trim bar. */
  counterTopColor?: string;
};

/** Resolved surface colors for EcoEden / builder-8 booths. */
export function resolveEcoBoothSurfaceColors(
  b: Pick<
    BoothLayoutConfig,
    | 'color'
    | 'accent'
    | 'counterColor'
    | 'backWallColor'
    | 'tvWallColor'
    | 'headerFasciaColor'
    | 'counterTopColor'
  >,
) {
  const accent = b.accent?.trim() || '#164e2f';
  const backWall = b.backWallColor?.trim() || '#e4e8e5';
  return {
    wallColor: b.color?.trim() || '#ffffff',
    backWallColor: backWall,
    tvWallColor: b.tvWallColor?.trim() || backWall,
    headerFasciaColor: b.headerFasciaColor?.trim() || '#fcfcfc',
    counterTopColor: b.counterTopColor?.trim() || accent,
    accent,
    counterColor: b.counterColor?.trim() || '#ffffff',
  };
}

/** Main back-wall LED content — prefers dedicated stage URL, falls back to videoUrl. */
export function boothStageScreenUrl(b: Pick<BoothLayoutConfig, 'stageScreenUrl' | 'videoUrl'>): string {
  const stage = (b.stageScreenUrl ?? '').trim();
  if (stage) return stage;
  return (b.videoUrl ?? '').trim();
}

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

/** Ordered unit layout entries; falls back to legacy single {@link unitLayoutUrl}. */
export function unitLayoutsFromConfig(
  b: Pick<BoothLayoutConfig, 'unitLayouts' | 'unitLayoutUrl'>,
): UnitLayoutItem[] {
  const fromList = (b.unitLayouts ?? []).filter((u) => u.imageUrl?.trim());
  if (fromList.length > 0) return fromList;
  const legacy = (b.unitLayoutUrl ?? '').trim();
  if (!legacy) return [];
  return [{ id: 'legacy-unit-layout', name: 'Unit layout', imageUrl: legacy }];
}

/** Keep legacy booth button URL in sync with the first named layout. */
export function unitLayoutsToStorageFields(
  layouts: UnitLayoutItem[],
): { unitLayouts: UnitLayoutItem[]; unitLayoutUrl: string } {
  const clean = layouts
    .map((u) => ({ ...u, name: u.name.trim(), imageUrl: u.imageUrl.trim() }))
    .filter((u) => u.imageUrl);
  return {
    unitLayouts: clean,
    unitLayoutUrl: clean[0]?.imageUrl ?? '',
  };
}

/** Ordered floor plan entries; falls back to legacy single {@link floorPlanUrl}. */
export function floorPlansFromConfig(
  b: Pick<BoothLayoutConfig, 'floorPlans' | 'floorPlanUrl'>,
): UnitLayoutItem[] {
  const fromList = (b.floorPlans ?? []).filter((u) => u.imageUrl?.trim());
  if (fromList.length > 0) return fromList;
  const legacy = (b.floorPlanUrl ?? '').trim();
  if (!legacy) return [];
  return [{ id: 'legacy-floor-plan', name: 'Floor plan', imageUrl: legacy }];
}

export function floorPlansToStorageFields(
  layouts: UnitLayoutItem[],
): { floorPlans: UnitLayoutItem[]; floorPlanUrl: string } {
  const clean = layouts
    .map((u) => ({ ...u, name: u.name.trim(), imageUrl: u.imageUrl.trim() }))
    .filter((u) => u.imageUrl);
  return {
    floorPlans: clean,
    floorPlanUrl: clean[0]?.imageUrl ?? '',
  };
}

export type HallLayoutConfig = {
  /** Added to default entrance lobby anchor `[0, 0, entranceZ]`. */
  entranceLobbyOffset: [number, number, number];
  /** Added to default banner anchor `[0, 6, -4.5]` inside the lobby group. */
  receptionBannerOffset: [number, number, number];
  /** Decorative tree world positions (up to four in Edit layout). */
  plantPositions: [number, number, number][];
  plantScales: number[];
  /** Sketchfab aisle standees between booth pairs — keyed by standee id. */
  aisleStandeeTransforms: Record<string, BoothDisplayTransform>;
  /** World position where visitors enter the main hall `[x, eyeY, z]`. */
  mainExpoSpawn?: [number, number, number];
  /** Camera yaw (radians) at entry — 0 faces toward the center plaza (−Z). */
  mainExpoSpawnYaw?: number;
};

/** Main expo hall footprint (meters) — width × depth × height. */
export const HALL_WIDTH = 65;
export const HALL_DEPTH = 30;
export const HALL_HEIGHT = 12;

export const HALL_HALF_WIDTH = HALL_WIDTH / 2;
export const HALL_HALF_DEPTH = HALL_DEPTH / 2;

/** Legacy square bound helper — use {@link HALL_HALF_WIDTH} / {@link HALL_HALF_DEPTH} for clamps. */
export const HALL_HALF_EXTENT = Math.max(HALL_HALF_WIDTH, HALL_HALF_DEPTH);

/** Circular help desk at center plaza — outer ring diameter. */
export const HELP_DESK_RADIUS = 2.75;
export const HELP_DESK_DIAMETER = HELP_DESK_RADIUS * 2;
/** Standing counter height (m) — top of the white ring. */
export const HELP_DESK_COUNTER_HEIGHT = 1.15;

/**
 * World X for main booth row — inset from walls so booths sit on the red carpet, not past the perimeter.
 * StandardLuxuryBooth back wall is ~4m behind the group origin along local −Z.
 */
/**
 * Booth row X — close enough to the center that both rows are visible from the aisle.
 * Hall is 65 m wide (±32.5). Putting rows at ±14 gives a ~28 m aisle — expo hall feel.
 * Each booth is ~13 m wide so the back wall sits at ~±18 — well inside the red carpet.
 */
export const BOOTH_ROW_X_WEST = -14;
export const BOOTH_ROW_X_EAST = 14;
/** Extra north bay on each wall (between gold pillars). */
export const BOOTH_ROW_Z_NORTH_EXTRA = -12;
/** Slot south of north-extra on the east wall (right of Luxe Gardens when facing the row). */
export const BOOTH_ROW_Z_EAST_LUXE_PAIR = -4.5;
/** Three booth slots along the 30 m depth — mirrored on west and east rows. */
export const BOOTH_ROW_Z = [-9, 0, 9] as const;
/** West row faces east (+X); east row faces west (−X). */
export const BOOTH_YAW_WEST = Math.PI / 2;
export const BOOTH_YAW_EAST = -Math.PI / 2;

/** Aisle centre-line between the two booth rows. */
export const EXPO_AISLE_WEST_X = BOOTH_ROW_X_WEST + 6;
export const EXPO_AISLE_EAST_X = BOOTH_ROW_X_EAST - 6;

/**
 * Default world scale for main-row booths (65×30 m hall, 12 m ceiling).
 * Walls are ~6 m tall at scale 1 — this reads better against the hall height.
 */
export const DEFAULT_MAIN_BOOTH_SCALE: [number, number, number] = [1.22, 1.48, 1.22];
/** LUXE TOWERS — slightly larger footprint so it matches Monarch / Vertex presence. */
export const LUXE_TOWERS_BOOTH_SCALE: [number, number, number] = [1.3, 1.58, 1.3];

/** Keep booth origins on the hall floor (65×30 m), including saved CMS overrides. */
export function clampBoothInsideHall(position: [number, number, number]): [number, number, number] {
  const maxX = HALL_HALF_WIDTH - 5;
  const maxZ = HALL_HALF_DEPTH - 7;
  return [
    Math.min(maxX, Math.max(-maxX, position[0])),
    position[1],
    Math.min(maxZ, Math.max(-maxZ, position[2])),
  ];
}

/** Side-aisle duplicate booth IDs (optional extras; hidden by default). */
export const DEFAULT_HIDDEN_SIDE_BOOTH_IDS = [
  'side-west-aurum',
  'side-west-crown',
  'side-east-monarch',
  'side-east-horizon',
  'side-east-aurum',
] as const;

export function defaultEntranceLobbyZ(): number {
  return HALL_HALF_DEPTH - 2;
}

export const DEFAULT_HALL_LAYOUT: HallLayoutConfig = {
  entranceLobbyOffset: [0, 0, 0],
  receptionBannerOffset: [0, 0, 0],
  plantPositions: [],
  plantScales: [],
  aisleStandeeTransforms: {},
  mainExpoSpawn: [BOOTH_ROW_X_WEST, 1.7, (BOOTH_ROW_Z[0] + BOOTH_ROW_Z[1]) / 2],
  mainExpoSpawnYaw: Math.atan2(-BOOTH_ROW_X_WEST, (BOOTH_ROW_Z[0] + BOOTH_ROW_Z[1]) / 2),
};

export function mergeHallLayout(overrides?: Partial<HallLayoutConfig>): HallLayoutConfig {
  if (!overrides) return { ...DEFAULT_HALL_LAYOUT };
  return {
    ...DEFAULT_HALL_LAYOUT,
    ...overrides,
    plantPositions: overrides.plantPositions ?? DEFAULT_HALL_LAYOUT.plantPositions,
    plantScales: overrides.plantScales ?? DEFAULT_HALL_LAYOUT.plantScales,
    aisleStandeeTransforms: {
      ...DEFAULT_HALL_LAYOUT.aisleStandeeTransforms,
      ...overrides.aisleStandeeTransforms,
    },
    mainExpoSpawn: overrides.mainExpoSpawn ?? DEFAULT_HALL_LAYOUT.mainExpoSpawn,
    mainExpoSpawnYaw: overrides.mainExpoSpawnYaw ?? DEFAULT_HALL_LAYOUT.mainExpoSpawnYaw,
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
  /** World transforms for hall corner plants (`reg-corner-nw`, etc.). */
  cornerPlantTransforms: Record<
    string,
    { position: [number, number, number]; rotation: [number, number, number] }
  >;
  /** Media on north lobby wall screens (`reg-north-screen-left` / `reg-north-screen-right`). */
  northWallScreenLeftUrl: string;
  northWallScreenRightUrl: string;
  /** World transforms for north wall flank screens (`left` / `right` keys). */
  northWallScreenTransforms: Record<
    string,
    { position: [number, number, number]; rotation: [number, number, number] }
  >;
  importedModels: RegistrationImportedModel[];
};

export const DEFAULT_REGISTRATION_LAYOUT: RegistrationLayoutConfig = {
  receptionOffset: [0, 0, 0],
  deskOffset: [0, 0, 0],
  backdropOffset: [0, 0, 0],
  queueOffset: [0, 0, 0],
  totemsOffset: [0, 0, 0],
  loungeOffset: [0, 0, 5.5],
  sectionalOffset: [0, 0, -1.2],
  chairLeftOffset: [-2.8, 0, 1.6],
  chairRightOffset: [2.8, 0, 1.6],
  coffeeTableOffset: [0, 0, 0.6],
  lampLeftOffset: [-4.2, 0, -1.1],
  lampRightOffset: [4.2, 0, -1.1],
  loungePlantOffsets: [
    [-4.5, 0, -1.4],
    [4.5, 0, -1.4],
    [-4.6, 0, 2.2],
    [4.6, 0, 2.2],
  ],
  loungeRotations: {
    'reg-lobby-chair-left': [0, 0.4, 0],
    'reg-lobby-chair-right': [0, -0.4, 0],
  },
  cornerPlantTransforms: {},
  northWallScreenLeftUrl: '/images/first-ever-virtual-property-expo.png',
  northWallScreenRightUrl: '/images/first ever expo.jpg',
  northWallScreenTransforms: {},
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
    cornerPlantTransforms: {
      ...DEFAULT_REGISTRATION_LAYOUT.cornerPlantTransforms,
      ...overrides.cornerPlantTransforms,
    },
    northWallScreenTransforms: {
      ...DEFAULT_REGISTRATION_LAYOUT.northWallScreenTransforms,
      ...overrides.northWallScreenTransforms,
    },
    importedModels: overrides.importedModels ?? DEFAULT_REGISTRATION_LAYOUT.importedModels,
  };
}

/** Persisted scene slice (localStorage / booth-cms.json) — `hallLayout` fields may be partial. */
export type SceneOverridesInput = Omit<Partial<SceneConfig>, 'hallLayout'> & {
  hallLayout?: Partial<HallLayoutConfig>;
  registrationLayout?: Partial<RegistrationLayoutConfig>;
};

/**
 * Merge bootstrap + `booth-cms.json` + browser storage without dropping
 * registration imported GLBs when localStorage only has partial layout edits.
 */
export function mergeSceneOverridesInput(
  bootstrap: SceneOverridesInput,
  fromFile: SceneOverridesInput,
  fromBrowser: SceneOverridesInput,
): SceneOverridesInput {
  const { hallLayout: hallFile, registrationLayout: regFile, ...restFile } = fromFile;
  const { hallLayout: hallBrowser, registrationLayout: regBrowser, ...restBrowser } = fromBrowser;

  const merged: SceneOverridesInput = {
    ...bootstrap,
    ...restFile,
    ...restBrowser,
  };

  merged.hallLayout = mergeHallLayout({
    ...DEFAULT_HALL_LAYOUT,
    ...hallFile,
    ...hallBrowser,
    plantPositions: hallBrowser?.plantPositions ?? hallFile?.plantPositions,
    plantScales: hallBrowser?.plantScales ?? hallFile?.plantScales,
    aisleStandeeTransforms: {
      ...hallFile?.aisleStandeeTransforms,
      ...hallBrowser?.aisleStandeeTransforms,
    },
  });

  const regCombined: Partial<RegistrationLayoutConfig> = {
    ...regFile,
    ...regBrowser,
    loungeRotations: {
      ...regFile?.loungeRotations,
      ...regBrowser?.loungeRotations,
    },
    loungePlantOffsets: regBrowser?.loungePlantOffsets ?? regFile?.loungePlantOffsets,
  };
  const browserModels = regBrowser?.importedModels;
  const fileModels = regFile?.importedModels;
  if (browserModels && browserModels.length > 0) {
    regCombined.importedModels = browserModels;
  } else if (fileModels && fileModels.length > 0) {
    regCombined.importedModels = fileModels;
  }

  merged.registrationLayout = mergeRegistrationLayout(regCombined);
  return merged;
}

/** Old CMS defaults painted a light fog slab that shifted with camera movement. */
function sanitizeSceneFog(rest: Omit<SceneOverridesInput, 'hallLayout'>): Omit<SceneOverridesInput, 'hallLayout'> {
  if (rest.fogEnabled !== true) return rest;
  const far = rest.fogFar ?? DEFAULT_SCENE_CONFIG.fogFar;
  const color = (rest.fogColor ?? '').toLowerCase();
  const legacyLightFog =
    far <= 48 && (color === '#d8d4cc' || color === '#fdfbf2' || color === '#ffffff' || color === '');
  if (legacyLightFog) {
    return { ...rest, fogEnabled: false };
  }
  return {
    ...rest,
    fogNear: Math.max(rest.fogNear ?? DEFAULT_SCENE_CONFIG.fogNear, 8),
    fogFar: Math.min(Math.max(far, 32), 75),
    fogColor: rest.fogColor && color !== '#d8d4cc' ? rest.fogColor : DEFAULT_SCENE_CONFIG.fogColor,
  };
}

export function mergeSceneConfig(overrides: SceneOverridesInput): SceneConfig {
  const { hallLayout, ...rest } = overrides;
  const scene = sanitizeSceneFog(rest);
  return {
    ...DEFAULT_SCENE_CONFIG,
    ...scene,
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
/** Distance fog — hides far hall geometry and lowers effective draw distance for FPS. */
  fogEnabled: boolean;
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
  /** Show ballroom stage, screen, and podium on the east wall. */
  showBallroom: boolean;
  /** Ballroom east-wall stage LED — MP4/WebM or image (PNG/JPG). Empty = default expo video. */
  ballroomStageScreenUrl?: string;
  /** Center suspended LED ring (help desk canopy) — MP4/WebM or image. Empty = default expo video. */
  hallCanopyScreenUrl?: string;
  /** Show roaming executive animated model. */
  showRoamingExecutive: boolean;
  /** Show video planes (expensive video decoding). */
  showVideos: boolean;
  /** Suspended hall LED ring above help desk — heavy (8 screens + ticker). */
  showHallCanopy: boolean;
  /** Four `tree.glb` path plants — heavy on integrated GPUs; off by default. */
  showHallPlants: boolean;
  /** Vertex Elite tall CTA kiosk (brochure / site map stand by the help-desk path). */
  showVertexEliteCtaKiosk: boolean;
  /** Sketchfab digital standees between booth rows (`digital_display_standee_sketchfab_export.glb`). */
  showHallAisleStandees: boolean;
  /** Small roll-up name stand beside each luxury booth counter. */
  showBoothStandee: boolean;
  /** 3D hostess GLB at booth counters and help desk. */
  showBoothHostess: boolean;
  /** Array of booth IDs to hide (for selective performance tuning). */
  hiddenBooths: string[];
  /**
   * Runtime GLB compression — decimates triangles, simplifies materials, disables model shadows.
   * Use `30fps` for integrated GPUs / mobile; `off` keeps full mesh detail.
   */
  modelCompression: 'off' | '30fps';
  /**
   * Master performance boost. When true: hostess animation is distance-gated, global
   * directional lights are reduced, extra shadow casters are dropped, GLB textures are
   * capped to 1024px, and geometry decimation only touches heavy meshes. Turn off to
   * compare raw vs optimized FPS. Default on.
   */
  performanceBoost: boolean;
  /** Render tier: resolution (DPR) + bundled performance settings. */
  renderQuality: RenderQuality;
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
  /** Off by default — light fog at low fogFar looks like a white wall that moves with the camera */
  fogEnabled: false,
  fogNear: 14,
  fogFar: 55,
  fogColor: '#f0ebe4',
  bloomIntensity: 0.26,
  bloomThreshold: 1.72,
  vignetteIntensity: 0.42,
  bgColor: '#f5f2ec',
  showStandardBooths: true,
  postProcessing: false,
  showBallroom: true,
  ballroomStageScreenUrl: '',
  hallCanopyScreenUrl: '',
  showRoamingExecutive: false,
  showVideos: true,
  showHallCanopy: true,
  showHallPlants: false,
  showVertexEliteCtaKiosk: false,
  showHallAisleStandees: false,
  showBoothStandee: true,
  showBoothHostess: true,
  hiddenBooths: [...DEFAULT_HIDDEN_SIDE_BOOTH_IDS],
  modelCompression: '30fps',
  performanceBoost: true,
  renderQuality: 'hd',
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

/** Quick-apply booth color themes (exhibitor dashboard + CMS). */
export type BoothColorPreset = {
  id: string;
  label: string;
  color: string;
  accent: string;
  counterColor: string;
  backWallColor?: string;
  tvWallColor?: string;
  headerFasciaColor?: string;
  counterTopColor?: string;
};

export const BOOTH_COLOR_PRESETS: BoothColorPreset[] = [
  {
    id: 'luxe-gold',
    label: 'Luxe Gold',
    color: '#fcfaf5',
    accent: '#d4af37',
    counterColor: '#ffffff',
  },
  {
    id: 'eco-green',
    label: 'Eco Green',
    color: '#ffffff',
    accent: '#164e2f',
    counterColor: '#ffffff',
    backWallColor: '#e4e8e5',
    tvWallColor: '#e8ebe8',
    headerFasciaColor: '#fcfcfc',
    counterTopColor: '#164e2f',
  },
  {
    id: 'crimson',
    label: 'Crimson Hall',
    color: '#fcf9f2',
    accent: '#7a1228',
    counterColor: '#ffffff',
  },
  {
    id: 'slate',
    label: 'Slate Premium',
    color: '#f0f2f5',
    accent: '#334155',
    counterColor: '#e8eaed',
  },
  {
    id: 'ocean',
    label: 'Ocean Blue',
    color: '#f8fafc',
    accent: '#1e5a8a',
    counterColor: '#ffffff',
  },
];

/** Luxe Gardens (builder-8) — white + forest green eco palette. */
export const BUILDER_8_GREEN_THEME = {
  color: '#ffffff',
  accent: '#164e2f',
  counterColor: '#ffffff',
  backWallColor: '#e4e8e5',
  tvWallColor: '#e8ebe8',
  headerFasciaColor: '#fcfcfc',
  counterTopColor: '#164e2f',
  lighting: {
    spotlightIntensity: 55,
    spotlightColor: '#fff8ef',
    ledStripColor: '#fff4d6',
    ledStripIntensity: 2.2,
    emissiveGlow: 0.12,
    ambientIntensity: 0.38,
  } satisfies BoothLighting,
  company: {
    brandPrimary: '#3d9a5a',
    brandSecondary: '#164e2f',
    tagline: 'LUXURY RESIDENCES',
  },
} as const;

function makeDefaultBooth(
  id: string,
  name: string,
  position: [number, number, number],
  rotation: [number, number, number],
  color: string,
  videoUrl: string,
  headerLogoUrl?: string,
  scale: [number, number, number] = DEFAULT_MAIN_BOOTH_SCALE,
): BoothLayoutConfig {
  return {
    id,
    position,
    rotation,
    scale,
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
    unitLayoutUrl: '',
    unitLayouts: [],
    floorPlanUrl: '',
    floorPlans: [],
    faqUrl: '',
    customFaqQuestions: [],
    assignedSalesPerson: { name: '', email: '', phone: '', photoUrl: '' },
    stageScreenUrl: '',
    signageImageUrl: '',
    pageIndexBrochure: true,
    pageIndexPriceList: true,
    hostessQuickReplies: [],
  };
}

export function buildDefaultBoothLayoutList(): BoothLayoutConfig[] {
  const [zNorth, zCenter, zSouth] = BOOTH_ROW_Z;
  const vertex = makeDefaultBooth(
    'vertex-elite',
    'VERTEX ELITE',
    [BOOTH_ROW_X_WEST, 0, zSouth],
    [0, BOOTH_YAW_WEST, 0],
    '#fcfaf5',
    PROJECT_VIDEOS[2],
  );
  return [
    {
      ...makeDefaultBooth(
        'builder-1',
        'LUXE TOWERS',
        [BOOTH_ROW_X_WEST, 0, zNorth],
        [0, BOOTH_YAW_WEST, 0],
        '#fcfaf5',
        PROJECT_VIDEOS[0],
        undefined,
        LUXE_TOWERS_BOOTH_SCALE,
      ),
    },
    makeDefaultBooth('builder-2', 'AURUM RESIDENCES', [BOOTH_ROW_X_WEST, 0, zCenter], [0, BOOTH_YAW_WEST, 0], '#fcf9f2', PROJECT_VIDEOS[1]),
    {
      ...vertex,
      position: [BOOTH_ROW_X_WEST, 0, zSouth],
      siteMapUrl: vertex.siteMapUrl || '/maps/site-map.svg',
      company: {
        ...vertex.company,
        companyName: vertex.company.companyName || 'Vertex Elite',
        email: vertex.company.email || 'sales@vertexelite.example',
        phone: vertex.company.phone || '+91 98765 43210',
      },
      hostessQuickReplies: [
        { id: 'vertex-hq-1', label: 'Project timeline', response: 'We are targeting completion in late twenty twenty-six. I can walk you through the milestones.' },
        { id: 'vertex-hq-ai', label: 'Ask AI', response: '', action: 'askAi' },
      ],
    },
    makeDefaultBooth('builder-4', 'CROWN ESTATES', [BOOTH_ROW_X_EAST, 0, zNorth], [0, BOOTH_YAW_EAST, 0], '#fcfaf5', PROJECT_VIDEOS[3]),
    makeDefaultBooth('builder-5', 'THE MONARCH', [BOOTH_ROW_X_EAST, 0, zCenter], [0, BOOTH_YAW_EAST, 0], '#fcf9f2', PROJECT_VIDEOS[4]),
    makeDefaultBooth('builder-6', 'HORIZON VISTAS', [BOOTH_ROW_X_EAST, 0, zSouth], [0, BOOTH_YAW_EAST, 0], '#fdfbf5', PROJECT_VIDEOS[5]),
    {
      ...makeDefaultBooth(
        'builder-8',
        'LUXE GARDENS',
        [BOOTH_ROW_X_EAST, 0, BOOTH_ROW_Z_NORTH_EXTRA],
        [0, BOOTH_YAW_EAST, 0],
        BUILDER_8_GREEN_THEME.color,
        PROJECT_VIDEOS[0],
        undefined,
        LUXE_TOWERS_BOOTH_SCALE,
      ),
      accent: BUILDER_8_GREEN_THEME.accent,
      counterColor: BUILDER_8_GREEN_THEME.counterColor,
      backWallColor: BUILDER_8_GREEN_THEME.backWallColor,
      tvWallColor: BUILDER_8_GREEN_THEME.tvWallColor,
      headerFasciaColor: BUILDER_8_GREEN_THEME.headerFasciaColor,
      counterTopColor: BUILDER_8_GREEN_THEME.counterTopColor,
      lighting: { ...BUILDER_8_GREEN_THEME.lighting },
      company: {
        ...DEFAULT_COMPANY,
        companyName: 'Luxe Gardens',
        ...BUILDER_8_GREEN_THEME.company,
      },
    },
    makeDefaultBooth(
      'builder-9',
      'LUXE SKYLINE',
      [BOOTH_ROW_X_EAST, 0, BOOTH_ROW_Z_EAST_LUXE_PAIR],
      [0, BOOTH_YAW_EAST, 0],
      '#fcfaf5',
      PROJECT_VIDEOS[0],
      undefined,
      LUXE_TOWERS_BOOTH_SCALE,
    ),
  ];
}

/** `null` on a field removes it from saved overrides (revert to booth default). */
export type BoothLayoutPatch = Partial<{
  [K in keyof Omit<BoothLayoutConfig, 'id'>]: Omit<BoothLayoutConfig, 'id'>[K] | null;
}>;

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

/** Old configs stored aisle posters on sideWall* — move to exteriorWall* once so inside/outside stay separate. */
export function migrateLegacyWallPlacementFields<
  T extends Pick<
    BoothLayoutConfig,
    | 'sideWallLeftImageUrl'
    | 'sideWallRightImageUrl'
    | 'exteriorWallLeftImageUrl'
    | 'exteriorWallRightImageUrl'
    | 'wallPlacementV2'
  >,
>(config: T): T {
  if (config.wallPlacementV2) return config;

  const hasExterior = Boolean(
    config.exteriorWallLeftImageUrl?.trim() || config.exteriorWallRightImageUrl?.trim(),
  );
  if (hasExterior) {
    return { ...config, wallPlacementV2: true };
  }

  const sideL = config.sideWallLeftImageUrl?.trim();
  const sideR = config.sideWallRightImageUrl?.trim();
  if (!sideL && !sideR) return config;

  return {
    ...config,
    exteriorWallLeftImageUrl: sideL || config.exteriorWallLeftImageUrl,
    exteriorWallRightImageUrl: sideR || config.exteriorWallRightImageUrl,
    sideWallLeftImageUrl: undefined,
    sideWallRightImageUrl: undefined,
    wallPlacementV2: true,
  };
}

export function applyBoothOverrides(
  defaults: BoothLayoutConfig[],
  overrides: Record<string, BoothLayoutPatch>
): BoothLayoutConfig[] {
  return defaults.map((b) => {
    const raw = overrides[b.id];
    const o = raw
      ? (Object.fromEntries(
          Object.entries(raw).filter(([, v]) => v !== null),
        ) as BoothLayoutPatch)
      : undefined;
    const merged = o
      ? {
          ...b,
          ...o,
          media: o.media ?? b.media,
          placedImages: o.placedImages ?? b.placedImages,
          siteMapGallery: o.siteMapGallery ?? b.siteMapGallery,
          unitLayouts: o.unitLayouts ?? b.unitLayouts,
          floorPlans: o.floorPlans ?? b.floorPlans,
          assignedSalesPerson: o.assignedSalesPerson
            ? { ...(b.assignedSalesPerson ?? { name: '', email: '', phone: '' }), ...o.assignedSalesPerson }
            : b.assignedSalesPerson,
          hostessQuickReplies: migrateLegacyHostessQuickReplies(
            o.hostessQuickReplies !== undefined ? o.hostessQuickReplies : b.hostessQuickReplies,
          ),
          customFaqQuestions:
            o.customFaqQuestions !== undefined ? o.customFaqQuestions : b.customFaqQuestions,
          company: o.company ? { ...b.company, ...o.company } : b.company,
          headerBranding: o.headerBranding
            ? { ...(b.headerBranding ?? {}), ...o.headerBranding }
            : b.headerBranding,
          lighting: o.lighting ? { ...b.lighting, ...o.lighting } : b.lighting,
          displayLayout: mergeBoothDisplayLayout(b.displayLayout, o.displayLayout),
        }
      : b;
    return migrateLegacyWallPlacementFields({
      ...merged,
      position: clampBoothInsideHall(merged.position),
    });
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
