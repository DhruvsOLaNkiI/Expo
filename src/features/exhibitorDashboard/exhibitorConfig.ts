export const DEFAULT_EXHIBITOR_BOOTH_ID = 'vertex-elite';

export const EXHIBITOR_NAV = [
  { id: 'overview', label: 'Overview' },
  { id: 'setup', label: 'Booth Setup' },
  { id: 'documents', label: 'Documents & Brochures' },
  { id: 'uploads', label: 'Upload Documents' },
  { id: 'faq', label: 'FAQ' },
  { id: 'salesChat', label: 'Sales Chat' },
  { id: 'live', label: 'Live Visitors', badge: '23' },
  { id: 'engagement', label: 'Engagement' },
  { id: 'leads', label: 'Leads & Enquiries' },
  { id: 'ratings', label: 'Ratings & Feedback' },
  { id: 'insights', label: 'Visitor Insights' },
  { id: 'assistance', label: 'Assistance History' },
  { id: 'reports', label: 'Reports' },
] as const;

export type ExhibitorNavId = (typeof EXHIBITOR_NAV)[number]['id'];

export const STORAGE_LIMIT_GB = 10;

export function resolveExhibitorBoothId(): string {
  if (typeof window === 'undefined') return DEFAULT_EXHIBITOR_BOOTH_ID;
  const fromQuery = new URLSearchParams(window.location.search).get('booth')?.trim();
  return fromQuery || DEFAULT_EXHIBITOR_BOOTH_ID;
}

export function boothDisplayCode(boothId: string): string {
  const map: Record<string, string> = {
    'vertex-elite': 'B-09',
    'builder-1': 'B-01',
    'builder-8': 'B-08',
  };
  return map[boothId] ?? boothId.slice(0, 8).toUpperCase();
}
