export const DEFAULT_EXHIBITOR_BOOTH_ID = 'vertex-elite';

export type ExhibitorBoothOption = {
  id: string;
  label: string;
  code: string;
};

export const EXHIBITOR_NAV = [
  { id: 'overview', label: 'Overview' },
  { id: 'setup', label: 'Booth Setup' },
  { id: 'documents', label: 'Documents & Brochures' },
  { id: 'uploads', label: 'Upload Documents' },
  { id: 'faq', label: 'FAQ' },
  { id: 'salesChat', label: 'Sales Chat' },
  { id: 'live', label: 'Live Visitors', badge: '23' },
  { id: 'engagement', label: 'Engagement' },
  { id: 'insights', label: 'Visitor Insights' },
  { id: 'assistance', label: 'Assistance History' },
  { id: 'reports', label: 'Reports' },
] as const;

export type ExhibitorNavId = (typeof EXHIBITOR_NAV)[number]['id'];

export const STORAGE_LIMIT_GB = 10;

/** Booth visit trend chart: one bar per hour for this many hours. */
export const EVENT_TREND_SPAN_HOURS = 8;

/** Default first hour on the chart (local time, 0–23). */
export const DEFAULT_EVENT_TREND_START_HOUR = 9;

export type EventTrendHourPreset = {
  id: string;
  startHour: number;
  label: string;
};

/** Presets for the overview “Booth Visit Trend” hour-range filter. */
export const EVENT_TREND_HOUR_PRESETS: EventTrendHourPreset[] = [
  { id: '8-16', startHour: 8, label: '8 AM – 4 PM' },
  { id: '9-17', startHour: 9, label: '9 AM – 5 PM' },
  { id: '10-18', startHour: 10, label: '10 AM – 6 PM' },
  { id: '11-19', startHour: 11, label: '11 AM – 7 PM' },
  { id: '12-20', startHour: 12, label: '12 PM – 8 PM' },
  { id: '13-21', startHour: 13, label: '1 PM – 9 PM' },
];

export function formatHourRangeLabel(startHour: number, spanHours = EVENT_TREND_SPAN_HOURS): string {
  const fmt = (h: number) => {
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    return `${hour12} ${period}`;
  };
  const end = startHour + spanHours;
  return `${fmt(startHour)} – ${fmt(end)}`;
}

/** Booth Setup image uploads skip R2 — stored as data URLs in booth config for local testing. */
export const EXHIBITOR_SETUP_LOCAL_STORAGE = true;

export function resolveExhibitorBoothId(): string {
  if (typeof window === 'undefined') return DEFAULT_EXHIBITOR_BOOTH_ID;
  const fromQuery = new URLSearchParams(window.location.search).get('booth')?.trim();
  return fromQuery || DEFAULT_EXHIBITOR_BOOTH_ID;
}

export function boothDisplayCode(boothId: string): string {
  const map: Record<string, string> = {
    'vertex-elite': 'VE-09',
    'builder-1': 'B-01',
    'builder-2': 'B-02',
    'builder-4': 'B-04',
    'builder-5': 'B-05',
    'builder-6': 'B-06',
    'builder-8': 'B-08',
    'builder-9': 'B-09',
  };
  return map[boothId] ?? boothId.replace(/^builder-/, 'B-').toUpperCase();
}

/** All booths available in the exhibitor multi-booth dashboard switcher. */
export function listExhibitorBoothOptions(
  layouts: Array<{ id: string; company?: { companyName?: string } }>,
): ExhibitorBoothOption[] {
  return layouts.map((b) => ({
    id: b.id,
    label: b.company?.companyName?.trim() || b.id,
    code: boothDisplayCode(b.id),
  }));
}
