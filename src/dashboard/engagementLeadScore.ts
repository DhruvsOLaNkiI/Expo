import { trackAnalytics, flushAnalytics } from './api/client';

/** Booth HUD menu actions and points per click. */
export type EngagementAction =
  | 'brochure'
  | 'walkthrough'
  | 'images'
  | 'unit_layout'
  | 'floor_plan'
  | 'site_layout'
  | 'price_list'
  | 'faq'
  | 'ai_chat';

export const ENGAGEMENT_ACTION_POINTS: Record<EngagementAction, number> = {
  brochure: 3,
  walkthrough: 2,
  images: 2,
  unit_layout: 1,
  floor_plan: 1,
  site_layout: 4,
  price_list: 1,
  faq: 1,
  ai_chat: 2,
};

export const ENGAGEMENT_ACTION_ORDER: EngagementAction[] = [
  'site_layout',
  'brochure',
  'walkthrough',
  'images',
  'ai_chat',
  'unit_layout',
  'floor_plan',
  'price_list',
  'faq',
];

export const ENGAGEMENT_ACTION_LABELS: Record<EngagementAction, string> = {
  brochure: 'Brochure',
  walkthrough: 'Walk through',
  images: 'Images',
  unit_layout: 'Unit layout',
  floor_plan: 'Floor plan',
  site_layout: 'Site layout',
  price_list: 'Price list',
  faq: 'FAQ',
  ai_chat: 'AI chat',
};

export const ENGAGEMENT_ACTION_COLORS: Record<EngagementAction, string> = {
  site_layout: '#06b6d4',
  brochure: '#8b5cf6',
  walkthrough: '#a78bfa',
  images: '#6366f1',
  ai_chat: '#f59e0b',
  unit_layout: '#22c55e',
  floor_plan: '#10b981',
  price_list: '#3b82f6',
  faq: '#ec4899',
};

export type EngagementActionRow = {
  action: EngagementAction;
  label: string;
  clicks: number;
  pointsPerClick: number;
  totalPoints: number;
  color: string;
};

export type BoothEngagementActionStats = {
  actions: EngagementActionRow[];
  totalClicks: number;
  totalPoints: number;
  uniqueVisitors: number;
  avgPointsPerVisitor: number;
  conversion: BoothConversionStats;
  mongoConnected: boolean;
};

/** 14 menu points = 100% converting possibility (halves: 7 → 50%, 3.5 → 25%). */
export const CONVERTING_SCORE_MAX = 14;
export const CONVERTING_SCORE_HIGH = 14;
export const CONVERTING_SCORE_MEDIUM = 7;
export const CONVERTING_SCORE_LOW = 3.5;

export type ConvertingTier = 'high' | 'medium' | 'low';

export type BoothConversionStats = {
  high: number;
  medium: number;
  low: number;
  total: number;
  avgScore: number;
};

export const CONVERTING_TIER_SEGMENTS: {
  id: ConvertingTier;
  name: string;
  scoreMin: number;
  scoreMax: number;
  pctRange: string;
  color: string;
}[] = [
  {
    id: 'high',
    name: 'High Converting Possibility',
    scoreMin: CONVERTING_SCORE_HIGH,
    scoreMax: CONVERTING_SCORE_MAX,
    pctRange: '100%',
    color: '#22c55e',
  },
  {
    id: 'medium',
    name: 'Medium Converting Possibility',
    scoreMin: CONVERTING_SCORE_MEDIUM,
    scoreMax: CONVERTING_SCORE_HIGH - 0.5,
    pctRange: '50%',
    color: '#f59e0b',
  },
  {
    id: 'low',
    name: 'Low Converting Possibility',
    scoreMin: CONVERTING_SCORE_LOW,
    scoreMax: CONVERTING_SCORE_MEDIUM - 0.5,
    pctRange: '25%',
    color: '#3b82f6',
  },
];

export type ConvertingChartRow = {
  id: ConvertingTier;
  name: string;
  value: number;
  color: string;
  scoreRange: string;
  pctRange: string;
  sharePct: number;
};

export function convertingTierFromScore(score: number): ConvertingTier | null {
  if (score < CONVERTING_SCORE_LOW) return null;
  if (score >= CONVERTING_SCORE_HIGH) return 'high';
  if (score >= CONVERTING_SCORE_MEDIUM) return 'medium';
  return 'low';
}

export function buildConvertingChart(counts: Record<ConvertingTier, number>): ConvertingChartRow[] {
  const total = counts.high + counts.medium + counts.low;
  return CONVERTING_TIER_SEGMENTS.map((seg) => {
    const value = counts[seg.id];
    return {
      id: seg.id,
      name: seg.name,
      value,
      color: seg.color,
      scoreRange:
        seg.id === 'high'
          ? `${CONVERTING_SCORE_HIGH}+`
          : `${seg.scoreMin}–${Number.isInteger(seg.scoreMax) ? seg.scoreMax : seg.scoreMax.toFixed(1)}`,
      pctRange: seg.pctRange,
      sharePct: total > 0 ? Math.round((value / total) * 100) : 0,
    };
  });
}

export const DEMO_CONVERTING_COUNTS: Record<ConvertingTier, number> = {
  high: 18,
  medium: 32,
  low: 24,
};

export function buildDemoConversionStats(): BoothConversionStats {
  const high = DEMO_CONVERTING_COUNTS.high;
  const medium = DEMO_CONVERTING_COUNTS.medium;
  const low = DEMO_CONVERTING_COUNTS.low;
  const total = high + medium + low;
  const avgScore = Math.round((high * 14 + medium * 9 + low * 5) / total);
  return { high, medium, low, total, avgScore };
}

export function emptyConversionStats(): BoothConversionStats {
  return { high: 0, medium: 0, low: 0, total: 0, avgScore: 0 };
}

export function engagementActionFromLabel(label: string): EngagementAction | null {
  const t = label.toUpperCase().replace(/[\s_-]+/g, ' ').trim();
  if (t.includes('BROCHURE')) return 'brochure';
  if (t.includes('WALK')) return 'walkthrough';
  if (t.includes('IMAGE')) return 'images';
  if (t.includes('UNIT') && t.includes('LAYOUT')) return 'unit_layout';
  if (t.includes('FLOOR') && t.includes('PLAN')) return 'floor_plan';
  if (t.includes('SITE')) return 'site_layout';
  if (t.includes('PRICE')) return 'price_list';
  if (t.includes('FAQ')) return 'faq';
  if (t.includes('CHAT')) return 'ai_chat';
  return null;
}

export function isEngagementAction(value: string): value is EngagementAction {
  return value in ENGAGEMENT_ACTION_POINTS;
}

export function buildEngagementActionRows(
  clickCounts: Partial<Record<EngagementAction, number>>,
): EngagementActionRow[] {
  return ENGAGEMENT_ACTION_ORDER.map((action) => {
    const clicks = clickCounts[action] ?? 0;
    const pointsPerClick = ENGAGEMENT_ACTION_POINTS[action];
    return {
      action,
      label: ENGAGEMENT_ACTION_LABELS[action],
      clicks,
      pointsPerClick,
      totalPoints: clicks * pointsPerClick,
      color: ENGAGEMENT_ACTION_COLORS[action],
    };
  });
}

export function summarizeEngagementActions(rows: EngagementActionRow[]): Omit<
  BoothEngagementActionStats,
  'mongoConnected' | 'conversion'
> {
  const totalClicks = rows.reduce((sum, row) => sum + row.clicks, 0);
  const totalPoints = rows.reduce((sum, row) => sum + row.totalPoints, 0);
  return {
    actions: rows,
    totalClicks,
    totalPoints,
    uniqueVisitors: 0,
    avgPointsPerVisitor: 0,
  };
}

export const CONVERTING_TIER_REFERENCE: {
  tier: string;
  points: string;
  pct: string;
  color: string;
}[] = [
  { tier: 'High', points: '14', pct: '100%', color: '#22c55e' },
  { tier: 'Medium', points: '7 – 13.5', pct: '50%', color: '#f59e0b' },
  { tier: 'Low', points: '3.5 – 6.5', pct: '25%', color: '#3b82f6' },
];

export function clampEngagementPoints(points: number): number {
  if (points <= 0) return 0;
  return Math.min(CONVERTING_SCORE_MAX, points);
}

export function convertingPctFromPoints(points: number): number {
  const capped = clampEngagementPoints(points);
  if (capped <= 0) return 0;
  return Math.round((capped / CONVERTING_SCORE_MAX) * 100);
}

export function convertingTierShortLabel(tier: ConvertingTier): string {
  if (tier === 'high') return 'High';
  if (tier === 'medium') return 'Medium';
  return 'Low';
}

export function convertingTierBadgeLabel(
  tier: ConvertingTier | null,
  points: number,
): string {
  if (!tier) return 'Below threshold';
  const pct = CONVERTING_TIER_SEGMENTS.find((s) => s.id === tier)?.pctRange ?? '';
  return `${convertingTierShortLabel(tier)} · ${pct} (${points} pts)`;
}

export type VisitorEngagementScoreRow = {
  visitorId?: string;
  sessionId?: string;
  visitorName?: string;
  points: number;
  convertingTier: ConvertingTier | null;
  convertingPct: number;
};

export function visitorEngagementFromPoints(
  points: number,
  meta?: Pick<VisitorEngagementScoreRow, 'visitorId' | 'sessionId' | 'visitorName'>,
): VisitorEngagementScoreRow {
  const capped = clampEngagementPoints(points);
  const convertingTier = convertingTierFromScore(capped);
  return {
    ...meta,
    points: capped,
    convertingTier,
    convertingPct: convertingPctFromPoints(capped),
  };
}

/** Sample booth menu interest when no live clicks yet. */
export const DEMO_ENGAGEMENT_CLICK_COUNTS: Partial<Record<EngagementAction, number>> = {
  brochure: 28,
  walkthrough: 19,
  images: 14,
  unit_layout: 22,
  floor_plan: 17,
  site_layout: 31,
  price_list: 24,
  faq: 11,
  ai_chat: 16,
};

export function buildDemoEngagementActionStats(): BoothEngagementActionStats {
  const rows = buildEngagementActionRows(DEMO_ENGAGEMENT_CLICK_COUNTS);
  const summary = summarizeEngagementActions(rows);
  return {
    ...summary,
    uniqueVisitors: 74,
    avgPointsPerVisitor: Math.round(summary.totalPoints / 74),
    conversion: buildDemoConversionStats(),
    mongoConnected: false,
  };
}

export function trackEngagementClick(
  action: EngagementAction,
  boothId: string,
  meta?: { visitorId?: string; visitorName?: string },
): void {
  trackAnalytics(
    {
      type: 'cta_engagement',
      boothId,
      zone: `booth:${boothId}`,
      engagementAction: action,
      engagementPoints: ENGAGEMENT_ACTION_POINTS[action],
    },
    meta,
  );
  void flushAnalytics(meta);
}
