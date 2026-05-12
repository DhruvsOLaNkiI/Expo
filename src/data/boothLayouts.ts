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
  /** Site map image URL */
  siteMapUrl: string;
  /** Price list image URL */
  priceListUrl: string;
};

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
    priceListUrl: '',
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
      siteMapUrl: vertex.siteMapUrl || '/vertex-site-map-demo.svg',
    },
    makeDefaultBooth('builder-4', 'CROWN ESTATES', [20, 0, -15], [0, -Math.PI / 2 + 0.16, 0], '#fcfaf5', PROJECT_VIDEOS[3]),
    makeDefaultBooth('builder-5', 'THE MONARCH', [20, 0, 5], [0, -Math.PI / 2, 0], '#fcf9f2', PROJECT_VIDEOS[4]),
    makeDefaultBooth('builder-6', 'HORIZON VISTAS', [20, 0, 25], [0, -Math.PI / 2 - 0.16, 0], '#fdfbf5', PROJECT_VIDEOS[5]),
  ];
}

export type BoothLayoutPatch = Partial<Omit<BoothLayoutConfig, 'id'>>;

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
