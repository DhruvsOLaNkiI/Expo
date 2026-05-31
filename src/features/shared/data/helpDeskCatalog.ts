import {
  applyBoothOverrides,
  buildDefaultBoothLayoutList,
  type BoothLayoutPatch,
} from './boothLayouts';

export type PropertyTypeChoice = 'residential' | 'commercial';

export type DeveloperListMode =
  | 'all'
  | 'top5'
  | 'luxury'
  | 'budget'
  | 'new_launch';

export type ProjectFilterTag =
  | 'luxury'
  | 'affordable'
  | 'villas'
  | 'apartments'
  | 'office'
  | 'retail'
  | 'ready'
  | 'under_construction';

export type ProjectUnitCategory = 'apartment' | 'villa' | 'office' | 'retail';

export type ExpoProject = {
  id: string;
  name: string;
  thumbnailGradient: string;
  category: ProjectUnitCategory;
  priceRange: string;
  location: string;
  configuration: string;
  status: 'ready' | 'under_construction' | 'new_launch';
  tags: ProjectFilterTag[];
};

export type ExpoDeveloper = {
  boothId: string;
  name: string;
  tagline: string;
  logoInitials: string;
  previewGradient: string;
  propertyTypes: PropertyTypeChoice[];
  categoryLabel: string;
  isLuxury: boolean;
  isBudgetFriendly: boolean;
  isNewLaunch: boolean;
  isTrending: boolean;
  isFeatured: boolean;
  rankScore: number;
  projects: ExpoProject[];
};

const DEVELOPER_META: Record<
  string,
  Omit<ExpoDeveloper, 'boothId' | 'name'> & { displayName?: string }
> = {
  'vertex-elite': {
    tagline: 'Ultra-luxury sky residences on the expressway',
    logoInitials: 'VE',
    previewGradient: 'linear-gradient(135deg,#1a1520 0%,#d4af37 100%)',
    propertyTypes: ['residential'],
    categoryLabel: 'Luxury Apartments',
    isLuxury: true,
    isBudgetFriendly: false,
    isNewLaunch: true,
    isTrending: true,
    isFeatured: true,
    rankScore: 98,
    projects: [
      {
        id: 've-skyline',
        name: 'Vertex Skyline Residences',
        thumbnailGradient: 'linear-gradient(160deg,#0f1a3d,#c9a227)',
        category: 'apartment',
        priceRange: '₹1.2 Cr – ₹3.8 Cr',
        location: 'Sector 150, Noida',
        configuration: '2 / 3 / 4 BHK',
        status: 'new_launch',
        tags: ['luxury', 'apartments', 'under_construction'],
      },
      {
        id: 've-crest',
        name: 'Vertex Crest Villas',
        thumbnailGradient: 'linear-gradient(160deg,#230a0d,#e0ceaa)',
        category: 'villa',
        priceRange: '₹4.5 Cr – ₹8 Cr',
        location: 'Yamuna Expressway',
        configuration: '4 / 5 BHK Villas',
        status: 'under_construction',
        tags: ['luxury', 'villas', 'under_construction'],
      },
    ],
  },
  'builder-1': {
    displayName: 'Luxe Towers',
    tagline: 'Premium high-rise living with skyline views',
    logoInitials: 'LT',
    previewGradient: 'linear-gradient(135deg,#111827 0%,#d4af37 55%,#f5ecd4 100%)',
    propertyTypes: ['residential'],
    categoryLabel: 'Luxury Apartments',
    isLuxury: true,
    isBudgetFriendly: false,
    isNewLaunch: false,
    isTrending: true,
    isFeatured: true,
    rankScore: 92,
    projects: [
      {
        id: 'lt-aura',
        name: 'Luxe Aura Residences',
        thumbnailGradient: 'linear-gradient(160deg,#1c1917,#ca8a04)',
        category: 'apartment',
        priceRange: '₹95 L – ₹2.1 Cr',
        location: 'Noida Extension',
        configuration: '2 / 3 BHK',
        status: 'ready',
        tags: ['luxury', 'apartments', 'ready'],
      },
    ],
  },
  'builder-8': {
    displayName: 'Luxe Gardens',
    tagline: 'Premium high-rise living with skyline views',
    logoInitials: 'LG',
    previewGradient: 'linear-gradient(135deg,#111827 0%,#d4af37 55%,#f5ecd4 100%)',
    propertyTypes: ['residential'],
    categoryLabel: 'Luxury Apartments',
    isLuxury: true,
    isBudgetFriendly: false,
    isNewLaunch: true,
    isTrending: true,
    isFeatured: false,
    rankScore: 88,
    projects: [
      {
        id: 'lg-grove',
        name: 'Luxe Garden Residences',
        thumbnailGradient: 'linear-gradient(160deg,#1c1917,#ca8a04)',
        category: 'apartment',
        priceRange: '₹1.1 Cr – ₹2.4 Cr',
        location: 'Noida Extension',
        configuration: '3 / 4 BHK',
        status: 'new_launch',
        tags: ['luxury', 'apartments', 'new_launch'],
      },
    ],
  },
  'builder-9': {
    displayName: 'Luxe Skyline',
    tagline: 'Sky-high luxury with panoramic city views',
    logoInitials: 'LS',
    previewGradient: 'linear-gradient(135deg,#111827 0%,#d4af37 55%,#f5ecd4 100%)',
    propertyTypes: ['residential'],
    categoryLabel: 'Luxury Apartments',
    isLuxury: true,
    isBudgetFriendly: false,
    isNewLaunch: true,
    isTrending: true,
    isFeatured: false,
    rankScore: 87,
    projects: [
      {
        id: 'ls-heights',
        name: 'Luxe Skyline Heights',
        thumbnailGradient: 'linear-gradient(160deg,#1c1917,#ca8a04)',
        category: 'apartment',
        priceRange: '₹1.2 Cr – ₹2.6 Cr',
        location: 'Noida Extension',
        configuration: '3 / 4 BHK',
        status: 'new_launch',
        tags: ['luxury', 'apartments', 'new_launch'],
      },
    ],
  },
  'builder-2': {
    displayName: 'Aurum Residences',
    tagline: 'Gold-standard homes for modern families',
    logoInitials: 'AR',
    previewGradient: 'linear-gradient(135deg,#292524 0%,#eab308 100%)',
    propertyTypes: ['residential'],
    categoryLabel: 'Mid-Premium Homes',
    isLuxury: false,
    isBudgetFriendly: false,
    isNewLaunch: true,
    isTrending: true,
    isFeatured: false,
    rankScore: 85,
    projects: [
      {
        id: 'ar-grove',
        name: 'Aurum Grove',
        thumbnailGradient: 'linear-gradient(160deg,#44403c,#fbbf24)',
        category: 'apartment',
        priceRange: '₹65 L – ₹1.4 Cr',
        location: 'Greater Noida West',
        configuration: '2 / 3 BHK',
        status: 'new_launch',
        tags: ['apartments', 'under_construction'],
      },
      {
        id: 'ar-meadow',
        name: 'Aurum Meadow Villas',
        thumbnailGradient: 'linear-gradient(160deg,#365314,#a3e635)',
        category: 'villa',
        priceRange: '₹1.8 Cr – ₹3.2 Cr',
        location: 'YEIDA',
        configuration: '3 / 4 BHK Villas',
        status: 'under_construction',
        tags: ['villas', 'under_construction'],
      },
    ],
  },
  'builder-4': {
    displayName: 'Crown Estates',
    tagline: 'Grade-A commercial & mixed-use destinations',
    logoInitials: 'CE',
    previewGradient: 'linear-gradient(135deg,#1e1b4b 0%,#818cf8 100%)',
    propertyTypes: ['commercial', 'residential'],
    categoryLabel: 'Commercial & Office',
    isLuxury: true,
    isBudgetFriendly: false,
    isNewLaunch: false,
    isTrending: false,
    isFeatured: true,
    rankScore: 88,
    projects: [
      {
        id: 'ce-crown-one',
        name: 'Crown One Business Park',
        thumbnailGradient: 'linear-gradient(160deg,#312e81,#6366f1)',
        category: 'office',
        priceRange: '₹85 L – ₹2.5 Cr',
        location: 'Sector 62, Noida',
        configuration: 'Office 500–5000 sq.ft',
        status: 'ready',
        tags: ['office', 'luxury', 'ready'],
      },
      {
        id: 'ce-retail',
        name: 'Crown Retail Boulevard',
        thumbnailGradient: 'linear-gradient(160deg,#4c1d95,#a78bfa)',
        category: 'retail',
        priceRange: '₹45 L – ₹1.2 Cr',
        location: 'Noida Expressway',
        configuration: 'Retail 200–1500 sq.ft',
        status: 'under_construction',
        tags: ['retail', 'under_construction'],
      },
    ],
  },
  'builder-5': {
    displayName: 'The Monarch',
    tagline: 'Regal residences with champagne-gold finishes',
    logoInitials: 'TM',
    previewGradient: 'linear-gradient(135deg,#3c1015 0%,#e0ceaa 100%)',
    propertyTypes: ['residential'],
    categoryLabel: 'Ultra-Luxury',
    isLuxury: true,
    isBudgetFriendly: false,
    isNewLaunch: true,
    isTrending: true,
    isFeatured: true,
    rankScore: 95,
    projects: [
      {
        id: 'tm-palace',
        name: 'Monarch Palace Suites',
        thumbnailGradient: 'linear-gradient(160deg,#230a0d,#d4af37)',
        category: 'apartment',
        priceRange: '₹2.5 Cr – ₹6 Cr',
        location: 'Sector 128, Noida',
        configuration: '3 / 4 / 5 BHK',
        status: 'new_launch',
        tags: ['luxury', 'apartments', 'under_construction'],
      },
    ],
  },
  'builder-6': {
    displayName: 'Horizon Vistas',
    tagline: 'Smart affordable homes with expressway connectivity',
    logoInitials: 'HV',
    previewGradient: 'linear-gradient(135deg,#0c4a6e 0%,#38bdf8 100%)',
    propertyTypes: ['residential'],
    categoryLabel: 'Affordable Housing',
    isLuxury: false,
    isBudgetFriendly: true,
    isNewLaunch: true,
    isTrending: false,
    isFeatured: false,
    rankScore: 78,
    projects: [
      {
        id: 'hv-smart',
        name: 'Horizon Smart Living',
        thumbnailGradient: 'linear-gradient(160deg,#0369a1,#7dd3fc)',
        category: 'apartment',
        priceRange: '₹35 L – ₹75 L',
        location: 'Yamuna Expressway',
        configuration: '1 / 2 BHK',
        status: 'new_launch',
        tags: ['affordable', 'apartments', 'under_construction'],
      },
    ],
  },
};

export const DEVELOPER_LIST_MODES: { id: DeveloperListMode; label: string; description: string }[] = [
  { id: 'all', label: 'Show All Developers', description: 'Browse every exhibitor' },
  { id: 'top5', label: 'Top 5 Developers', description: 'Highest-rated booths' },
  { id: 'luxury', label: 'Luxury Developers', description: 'Premium & ultra-luxury brands' },
  { id: 'budget', label: 'Budget Friendly', description: 'Value-focused projects' },
  { id: 'new_launch', label: 'New Launch Projects', description: 'Fresh inventory & pre-launch' },
];

export const PROJECT_FILTERS: { id: ProjectFilterTag; label: string }[] = [
  { id: 'luxury', label: 'Luxury' },
  { id: 'affordable', label: 'Affordable' },
  { id: 'villas', label: 'Villas' },
  { id: 'apartments', label: 'Apartments' },
  { id: 'office', label: 'Office Spaces' },
  { id: 'retail', label: 'Retail Shops' },
  { id: 'ready', label: 'Ready to Move' },
  { id: 'under_construction', label: 'Under Construction' },
];

export function buildExpoDeveloperCatalog(
  boothOverrides: Record<string, BoothLayoutPatch> = {},
): ExpoDeveloper[] {
  const layouts = applyBoothOverrides(buildDefaultBoothLayoutList(), boothOverrides);
  const boothIds = [
    'vertex-elite',
    'builder-1',
    'builder-8',
    'builder-9',
    'builder-2',
    'builder-4',
    'builder-5',
    'builder-6',
  ];

  return boothIds
    .map((boothId) => {
      const booth = layouts.find((b) => b.id === boothId);
      const meta = DEVELOPER_META[boothId];
      if (!booth || !meta) return null;
      return {
        boothId,
        name: meta.displayName ?? booth.name,
        tagline: booth.company.tagline?.trim() || meta.tagline,
        logoInitials: meta.logoInitials,
        previewGradient: meta.previewGradient,
        propertyTypes: meta.propertyTypes,
        categoryLabel: meta.categoryLabel,
        isLuxury: meta.isLuxury,
        isBudgetFriendly: meta.isBudgetFriendly,
        isNewLaunch: meta.isNewLaunch,
        isTrending: meta.isTrending,
        isFeatured: meta.isFeatured,
        rankScore: meta.rankScore,
        projects: meta.projects,
      } satisfies ExpoDeveloper;
    })
    .filter((d): d is ExpoDeveloper => d != null);
}

export function filterDevelopersByMode(
  developers: ExpoDeveloper[],
  mode: DeveloperListMode,
  propertyType: PropertyTypeChoice,
): ExpoDeveloper[] {
  let list = developers.filter((d) => d.propertyTypes.includes(propertyType));
  switch (mode) {
    case 'top5':
      list = [...list].sort((a, b) => b.rankScore - a.rankScore).slice(0, 5);
      break;
    case 'luxury':
      list = list.filter((d) => d.isLuxury);
      break;
    case 'budget':
      list = list.filter((d) => d.isBudgetFriendly);
      break;
    case 'new_launch':
      list = list.filter((d) => d.isNewLaunch);
      break;
    default:
      break;
  }
  return list.sort((a, b) => b.rankScore - a.rankScore);
}

export function filterProjects(
  projects: ExpoProject[],
  activeFilters: Set<ProjectFilterTag>,
): ExpoProject[] {
  if (activeFilters.size === 0) return projects;
  return projects.filter((p) => [...activeFilters].every((f) => p.tags.includes(f)));
}

export function getAiSuggestion(
  propertyType: PropertyTypeChoice,
  mode: DeveloperListMode | null,
  filters: Set<ProjectFilterTag>,
): string {
  if (propertyType === 'commercial') {
    return 'If you are searching for commercial office spaces, Crown Estates has available projects with ready-to-move office suites and retail boulevard units.';
  }
  if (filters.has('luxury') || mode === 'luxury') {
    return 'If you are looking for luxury apartments, Vertex Elite and Luxe Towers are highly recommended — both feature premium sky residences with expressway access.';
  }
  if (filters.has('affordable') || mode === 'budget') {
    return 'Horizon Vistas offers smart affordable homes starting from ₹35 L — ideal for first-time buyers on the Yamuna Expressway corridor.';
  }
  if (filters.has('villas')) {
    return 'For villa living, explore Vertex Crest Villas and Aurum Meadow Villas — spacious layouts with premium amenities.';
  }
  if (mode === 'new_launch') {
    return 'New launch highlights: Vertex Skyline, The Monarch Palace Suites, and Horizon Smart Living — book early for launch pricing.';
  }
  return 'Based on your interest, we recommend starting with Vertex Elite for luxury, Aurum Residences for family homes, or Crown Estates if you need commercial space.';
}

export function getTrendingDevelopers(developers: ExpoDeveloper[]): ExpoDeveloper[] {
  return developers.filter((d) => d.isTrending).sort((a, b) => b.rankScore - a.rankScore);
}

export function getFeaturedDevelopers(developers: ExpoDeveloper[]): ExpoDeveloper[] {
  return developers.filter((d) => d.isFeatured).sort((a, b) => b.rankScore - a.rankScore);
}

export function getBoothDirectionHint(
  playerPos: [number, number, number] | null,
  boothPosition: [number, number, number],
): string {
  if (!playerPos) return 'Head toward the booth aisle from the center plaza.';
  const dx = boothPosition[0] - playerPos[0];
  const dz = boothPosition[2] - playerPos[2];
  const parts: string[] = [];
  if (Math.abs(dx) > 4) parts.push(dx > 0 ? 'east' : 'west');
  if (Math.abs(dz) > 4) parts.push(dz > 0 ? 'south' : 'north');
  if (parts.length === 0) return 'You are very close — the booth is just ahead.';
  return `Walk ${parts.join(' and ')} from your current position toward the booth entrance.`;
}
