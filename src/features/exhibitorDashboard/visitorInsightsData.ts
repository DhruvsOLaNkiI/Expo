export type VisitorCategory = 'HOT' | 'WARM' | 'VIP' | 'COLD';
export type QuestionnaireStatus = 'Completed' | 'In Progress' | 'Not Invited';

import type { ConvertingTier } from '@/dashboard/engagementLeadScore';
import {
  convertingPctFromPoints,
  visitorEngagementFromPoints,
  type VisitorEngagementScoreRow,
} from '@/dashboard/engagementLeadScore';

export type VisitorInsightRow = {
  id: string;
  name: string;
  company: string;
  role: string;
  email?: string;
  phone?: string;
  avatarHue: number;
  /** Buyer questionnaire psychological score (0–100) — not menu clicks. */
  leadScore: number;
  scoreLabel: string;
  /** Booth HUD menu engagement points (14 = 100% converting). */
  engagementPoints?: number;
  convertingTier?: ConvertingTier | null;
  convertingPct?: number;
  category: VisitorCategory;
  hall: string;
  booth: string;
  boothCompany: string;
  atYourBooth: boolean;
  questionnaire: QuestionnaireStatus;
  scannedAt?: string;
  enteredAt?: string;
  exitedAt?: string;
  stillInside?: boolean;
  visitorId?: string;
  sessionId?: string;
  visitId?: string;
  /** Number of booth visits (aggregated row). */
  visitCount?: number;
  /** First time this visitor entered your booth. */
  firstVisitedAt?: string;
};

export type VisitorProfileTarget = Pick<
  VisitorInsightRow,
  | 'id'
  | 'name'
  | 'company'
  | 'role'
  | 'email'
  | 'phone'
  | 'avatarHue'
  | 'leadScore'
  | 'scoreLabel'
  | 'engagementPoints'
  | 'convertingTier'
  | 'convertingPct'
  | 'category'
  | 'enteredAt'
  | 'exitedAt'
  | 'stillInside'
  | 'visitorId'
  | 'sessionId'
  | 'visitId'
  | 'visitCount'
  | 'firstVisitedAt'
  | 'email'
  | 'phone'
>;

export type VisitorFilterTab = 'all' | 'hot' | 'vip' | 'recent';

export const VISITOR_FILTER_TABS: { id: VisitorFilterTab; label: string }[] = [
  { id: 'all', label: 'All Visitors' },
  { id: 'hot', label: 'Hot Leads' },
  { id: 'vip', label: 'VIPs' },
  { id: 'recent', label: 'Recent Scans' },
];

export const LEAD_VELOCITY = [
  { hour: '08:00', leads: 12 },
  { hour: '10:00', leads: 28 },
  { hour: '12:00', leads: 45 },
  { hour: '14:00', leads: 38 },
  { hour: '15:00', leads: 62 },
  { hour: '16:00', leads: 41 },
  { hour: '18:00', leads: 22 },
];

export const DEMO_VISITORS: VisitorInsightRow[] = [
  {
    id: 'v1',
    name: 'Sarah Chen',
    company: 'TechFlow Inc.',
    role: 'Chief Technology Officer',
    email: 'sarah.chen@techflow.io',
    phone: '+1 415-555-0182',
    avatarHue: 200,
    leadScore: 88,
    scoreLabel: 'Very High',
    category: 'HOT',
    hall: 'Hall B',
    booth: 'Booth 12',
    boothCompany: 'Quantum Solutions',
    atYourBooth: false,
    questionnaire: 'Completed',
  },
  {
    id: 'v2',
    name: 'Marcus Johnson',
    company: 'Global Logistics',
    role: 'Operations Director',
    email: 'marcus.j@global-logistics.com',
    phone: '+1 312-555-0147',
    avatarHue: 160,
    leadScore: 72,
    scoreLabel: 'High',
    category: 'WARM',
    hall: 'Hall A',
    booth: 'Booth 04',
    boothCompany: 'Vertex Elite',
    atYourBooth: true,
    questionnaire: 'In Progress',
    enteredAt: '2026-05-29T11:02:00',
    stillInside: true,
  },
  {
    id: 'v3',
    name: 'Elena Rodriguez',
    company: 'Stellar Ventures',
    role: 'Managing Partner',
    email: 'elena.r@stellarvc.com',
    phone: '+1 646-555-0193',
    avatarHue: 280,
    leadScore: 94,
    scoreLabel: 'Critical',
    category: 'VIP',
    hall: 'Hall C',
    booth: 'Booth 21',
    boothCompany: 'Aurum Residences',
    atYourBooth: false,
    questionnaire: 'Completed',
    scannedAt: '2026-05-29T14:22:00',
  },
  {
    id: 'v4',
    name: 'David Kim',
    company: 'NextGen Systems',
    role: 'Product Manager',
    email: 'david.kim@nextgen.io',
    phone: '+1 408-555-0164',
    avatarHue: 45,
    leadScore: 45,
    scoreLabel: 'Moderate',
    category: 'WARM',
    hall: 'Hall B',
    booth: 'Booth 09',
    boothCompany: 'Vertex Elite',
    atYourBooth: true,
    questionnaire: 'Completed',
    enteredAt: '2026-05-29T10:45:00',
    exitedAt: '2026-05-29T11:12:00',
  },
  {
    id: 'v5',
    name: 'Priya Patel',
    company: 'Horizon Capital',
    role: 'Investment Analyst',
    email: 'priya.patel@horizoncap.in',
    phone: '+91 98765 43210',
    avatarHue: 320,
    leadScore: 91,
    scoreLabel: 'Very High',
    category: 'HOT',
    hall: 'Hall A',
    booth: 'Booth 09',
    boothCompany: 'Vertex Elite',
    atYourBooth: true,
    questionnaire: 'Completed',
    scannedAt: '2026-05-29T15:10:00',
    enteredAt: '2026-05-29T14:30:00',
    stillInside: true,
  },
  {
    id: 'v6',
    name: 'James Wilson',
    company: 'Urban Developments',
    role: 'Site Engineer',
    email: 'j.wilson@urbandevelopments.co.uk',
    phone: '+44 7700 900123',
    avatarHue: 120,
    leadScore: 38,
    scoreLabel: 'Low',
    category: 'COLD',
    hall: 'Hall D',
    booth: 'Booth 03',
    boothCompany: 'Crown Estates',
    atYourBooth: false,
    questionnaire: 'Not Invited',
  },
  {
    id: 'v7',
    name: 'Neha Kapoor',
    company: 'Luxe Living Group',
    role: 'Head of Procurement',
    email: 'neha.k@luxeliving.in',
    phone: '+91 98123 45678',
    avatarHue: 260,
    leadScore: 86,
    scoreLabel: 'Very High',
    category: 'HOT',
    hall: 'Hall B',
    booth: 'Booth 09',
    boothCompany: 'Vertex Elite',
    atYourBooth: true,
    questionnaire: 'In Progress',
    scannedAt: '2026-05-29T15:35:00',
    enteredAt: '2026-05-29T15:20:00',
    exitedAt: '2026-05-29T15:48:00',
  },
  {
    id: 'v8',
    name: 'Arjun Mehta',
    company: 'Skyline Holdings',
    role: 'VP Sales',
    email: 'arjun.mehta@skylineholdings.com',
    phone: '+91 99887 76655',
    avatarHue: 30,
    leadScore: 79,
    scoreLabel: 'High',
    category: 'WARM',
    hall: 'Hall C',
    booth: 'Booth 15',
    boothCompany: 'The Monarch',
    atYourBooth: false,
    questionnaire: 'Completed',
  },
  {
    id: 'v9',
    name: 'Rohit Sharma',
    company: 'Mumbai Realty Co.',
    role: 'Buyer',
    email: 'rohit.sharma@mumbairealty.in',
    phone: '+91 98201 23456',
    avatarHue: 190,
    leadScore: 67,
    scoreLabel: 'Moderate',
    category: 'WARM',
    hall: 'Hall A',
    booth: 'Booth 09',
    boothCompany: 'Vertex Elite',
    atYourBooth: true,
    questionnaire: 'Completed',
    enteredAt: '2026-05-29T09:15:00',
    exitedAt: '2026-05-29T09:42:00',
  },
  {
    id: 'v10',
    name: 'John Smith',
    company: 'Gulf Properties LLC',
    role: 'Investor',
    email: 'john.smith@gulfproperties.ae',
    phone: '+971 50 123 4567',
    avatarHue: 210,
    leadScore: 96,
    scoreLabel: 'Critical',
    category: 'VIP',
    hall: 'Hall B',
    booth: 'Booth 12',
    boothCompany: 'Quantum Solutions',
    atYourBooth: false,
    questionnaire: 'Completed',
    scannedAt: '2026-05-29T16:02:00',
  },
  {
    id: 'v11',
    name: 'Aisha Khan',
    company: 'Greenfield Estates',
    role: 'Architect',
    email: 'aisha.khan@greenfield.ae',
    phone: '+971 55 987 6543',
    avatarHue: 140,
    leadScore: 52,
    scoreLabel: 'Moderate',
    category: 'COLD',
    hall: 'Hall D',
    booth: 'Booth 08',
    boothCompany: 'Luxe Gardens',
    atYourBooth: false,
    questionnaire: 'Not Invited',
  },
  {
    id: 'v12',
    name: 'Tom Becker',
    company: 'EuroBuild AG',
    role: 'Development Lead',
    email: 't.becker@eurobuild.de',
    phone: '+49 170 1234567',
    avatarHue: 350,
    leadScore: 83,
    scoreLabel: 'Very High',
    category: 'HOT',
    hall: 'Hall A',
    booth: 'Booth 09',
    boothCompany: 'Vertex Elite',
    atYourBooth: true,
    questionnaire: 'Completed',
    scannedAt: '2026-05-29T16:45:00',
    enteredAt: '2026-05-29T16:10:00',
    stillInside: true,
  },
];

/** Demo menu-click points per visitor (separate from questionnaire leadScore). */
const DEMO_ENGAGEMENT_POINTS: Record<string, number> = {
  v1: 14,
  v2: 9,
  v3: 14,
  v4: 5,
  v5: 14,
  v6: 2,
  v7: 11,
  v8: 4,
  v9: 7,
  v10: 14,
  v11: 1,
  v12: 12,
};

function applyEngagementFields(row: VisitorInsightRow, points: number): VisitorInsightRow {
  const engagement = visitorEngagementFromPoints(points);
  return {
    ...row,
    engagementPoints: engagement.points,
    convertingTier: engagement.convertingTier,
    convertingPct: engagement.convertingPct,
  };
}

/** Fill menu engagement columns from demo data when live analytics are empty. */
export function applyDemoEngagementScores(rows: VisitorInsightRow[]): VisitorInsightRow[] {
  return rows.map((row) => {
    const points = DEMO_ENGAGEMENT_POINTS[row.id];
    if (points === undefined) return row;
    return applyEngagementFields(row, points);
  });
}

/** Merge live booth menu scores — never overwrites leadScore or scoreLabel. */
export function mergeEngagementScores(
  rows: VisitorInsightRow[],
  scores: VisitorEngagementScoreRow[],
): VisitorInsightRow[] {
  if (scores.length === 0) return rows;

  const used = new Set<number>();
  const byVisitorId = new Map<string, VisitorEngagementScoreRow>();
  const bySessionId = new Map<string, VisitorEngagementScoreRow>();
  const byName = new Map<string, VisitorEngagementScoreRow>();

  for (const score of scores) {
    if (score.visitorId) byVisitorId.set(score.visitorId, score);
    if (score.sessionId) bySessionId.set(score.sessionId, score);
    const name = score.visitorName?.trim().toLowerCase();
    if (name) byName.set(name, score);
  }

  const pickScore = (row: VisitorInsightRow): VisitorEngagementScoreRow | undefined => {
    if (row.visitorId) {
      const match = byVisitorId.get(row.visitorId);
      if (match) return match;
    }
    if (row.sessionId) {
      const match = bySessionId.get(row.sessionId);
      if (match) return match;
    }
    const name = row.name.trim().toLowerCase();
    if (name) {
      const match = byName.get(name);
      if (match) return match;
    }
    const idx = scores.findIndex((s, i) => !used.has(i));
    if (idx >= 0) {
      used.add(idx);
      return scores[idx];
    }
    return undefined;
  };

  return rows.map((row) => {
    const match = pickScore(row);
    if (!match) return row;
    return applyEngagementFields(row, match.points);
  });
}

export type BoothVisitSessionRow = {
  visitId?: string;
  visitorId?: string;
  visitorName?: string;
  email?: string;
  phone?: string;
  sessionId: string;
  enteredAt: string;
  exitedAt?: string;
  dwellMs?: number;
  stillInside: boolean;
};

export function formatVisitTime(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function isGenericGuestName(name?: string): boolean {
  const n = name?.trim().toLowerCase();
  return !n || n === 'guest' || n === 'guest visitor';
}

/** One CRM row per person — registered id, email, phone, or browser session for anonymous guests. */
export function visitorIdentityKey(
  input: Pick<BoothVisitSessionRow, 'visitorId' | 'email' | 'phone' | 'sessionId' | 'visitorName'>,
): string {
  if (input.visitorId?.trim()) return `vid:${input.visitorId.trim()}`;
  if (input.email?.trim()) return `email:${input.email.trim().toLowerCase()}`;
  if (input.phone?.trim()) return `phone:${input.phone.replace(/\D/g, '')}`;
  if (input.sessionId?.trim()) return `sess:${input.sessionId.trim()}`;
  const name = input.visitorName?.trim().toLowerCase();
  if (name && !isGenericGuestName(name)) return `name:${name}`;
  return `sess:${input.sessionId?.trim() || 'unknown'}`;
}

function avatarHueFromKey(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h + key.charCodeAt(i) * 17) % 360;
  return h;
}

function pickDisplayIdentity(sessions: BoothVisitSessionRow[]) {
  const byRecent = [...sessions].sort((a, b) => b.enteredAt.localeCompare(a.enteredAt));
  const named = sessions.find(
    (s) => s.visitorName?.trim() && !isGenericGuestName(s.visitorName),
  );
  const name =
    named?.visitorName?.trim() ||
    byRecent.find((s) => s.visitorName?.trim())?.visitorName?.trim() ||
    'Guest visitor';
  return {
    name,
    email: sessions.find((s) => s.email?.trim())?.email?.trim(),
    phone: sessions.find((s) => s.phone?.trim())?.phone?.trim(),
    visitorId: sessions.find((s) => s.visitorId?.trim())?.visitorId?.trim(),
    sessionId: byRecent[0]?.sessionId,
    visitId: byRecent[0]?.visitId,
  };
}

function aggregateSessionsToRow(
  key: string,
  sessions: BoothVisitSessionRow[],
  boothCompany: string,
): VisitorInsightRow {
  const sorted = [...sessions].sort((a, b) => a.enteredAt.localeCompare(b.enteredAt));
  const latest = [...sessions].sort((a, b) => b.enteredAt.localeCompare(a.enteredAt))[0]!;
  const identity = pickDisplayIdentity(sessions);
  const stillInside = sessions.some((s) => s.stillInside);
  const latestClosed = [...sessions]
    .filter((s) => s.exitedAt)
    .sort((a, b) => b.exitedAt!.localeCompare(a.exitedAt!))[0];

  return {
    id: `visitor-${key}`,
    name: identity.name,
    company: '—',
    role: '—',
    email: identity.email,
    phone: identity.phone,
    avatarHue: avatarHueFromKey(key),
    leadScore: 0,
    scoreLabel: '—',
    category: 'WARM',
    hall: 'Your hall',
    booth: 'Your booth',
    boothCompany,
    atYourBooth: stillInside,
    questionnaire: 'Not Invited',
    visitCount: sessions.length,
    firstVisitedAt: sorted[0]?.enteredAt,
    enteredAt: latest.enteredAt,
    exitedAt: stillInside ? undefined : latestClosed?.exitedAt ?? latest.exitedAt,
    stillInside,
    visitorId: identity.visitorId,
    sessionId: identity.sessionId,
    visitId: identity.visitId,
  };
}

/** Build one insight row per unique visitor from live booth sessions. */
export function buildAggregatedVisitorRows(
  sessions: BoothVisitSessionRow[],
  boothCompany: string,
): VisitorInsightRow[] {
  if (sessions.length === 0) return [];

  const byKey = new Map<string, BoothVisitSessionRow[]>();
  for (const session of sessions) {
    const key = visitorIdentityKey(session);
    const list = byKey.get(key) ?? [];
    list.push(session);
    byKey.set(key, list);
  }

  return [...byKey.entries()]
    .map(([key, list]) => aggregateSessionsToRow(key, list, boothCompany))
    .sort((a, b) => (b.enteredAt ?? '').localeCompare(a.enteredAt ?? ''));
}

/** @deprecated Use {@link buildAggregatedVisitorRows}. */
export function mergeVisitSessions(
  rows: VisitorInsightRow[],
  sessions: BoothVisitSessionRow[],
  boothCompany: string,
): VisitorInsightRow[] {
  if (sessions.length === 0) return rows;
  return buildAggregatedVisitorRows(sessions, boothCompany);
}

export function filterVisitors(
  rows: VisitorInsightRow[],
  tab: VisitorFilterTab,
  query: string,
  boothCompany?: string,
): VisitorInsightRow[] {
  let list = [...rows];
  const q = query.trim().toLowerCase();

  if (tab === 'hot') list = list.filter((r) => r.category === 'HOT');
  if (tab === 'vip') list = list.filter((r) => r.category === 'VIP');
  if (tab === 'recent') {
    list = list
      .filter((r) => r.scannedAt)
      .sort((a, b) => (b.scannedAt ?? '').localeCompare(a.scannedAt ?? ''));
  }

  if (boothCompany) {
    const atBooth = list.filter((r) => r.atYourBooth);
    if (atBooth.length > 0 && tab === 'all' && !q) list = atBooth;
  }

  if (q) {
    list = list.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.company.toLowerCase().includes(q) ||
        r.role.toLowerCase().includes(q) ||
        r.boothCompany.toLowerCase().includes(q) ||
        (r.email?.toLowerCase().includes(q) ?? false) ||
        (r.phone?.replace(/\D/g, '').includes(q.replace(/\D/g, '')) ?? false),
    );
  }

  return list;
}

export function exportVisitorsCsv(rows: VisitorInsightRow[]) {
  const header = [
    'Name',
    'Email',
    'Phone',
    'Company',
    'Role',
    'Lead Score',
    'Interest Pts',
    'Converting',
    'Category',
    'Visits',
    'Last entry',
    'Last exit',
    'Questionnaire',
  ];
  const lines = rows.map((r) =>
    [
      r.name,
      r.email ?? '',
      r.phone ?? '',
      r.company,
      r.role,
      r.leadScore,
      r.engagementPoints ?? '',
      r.convertingTier
        ? `${r.convertingTier} (${r.convertingPct ?? convertingPctFromPoints(r.engagementPoints ?? 0)}%)`
        : r.engagementPoints != null && r.engagementPoints > 0
          ? 'below threshold'
          : '',
      r.category,
      String(r.visitCount ?? 1),
      formatVisitTime(r.enteredAt),
      r.stillInside ? 'In booth' : formatVisitTime(r.exitedAt),
      r.questionnaire,
    ]
      .map((c) => `"${String(c).replace(/"/g, '""')}"`)
      .join(','),
  );
  const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'visitor-intelligence.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

function formatDuration(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  const mins = Math.floor(ms / 60_000);
  const secs = Math.round((ms % 60_000) / 1000);
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

/** Demo brochure activity for CRM rows when live analytics are empty. */
export function buildDemoVisitorProfile(
  row: VisitorProfileTarget,
  boothId: string,
): import('@/dashboard/api/client').BoothVisitorProfileRow {
  const brochureTitle = 'Vertex Elite Brochure.pdf';
  const brochureUrl = '/assets/brochures/vertex-elite-brochure.pdf';
  const entry = row.enteredAt ?? '2026-05-29T10:00:00';
  const entryDate = new Date(entry);
  const openAt = new Date(entryDate.getTime() + 3 * 60_000).toISOString();
  const closeAt = row.stillInside
    ? undefined
    : new Date(entryDate.getTime() + 11 * 60_000).toISOString();
  const dwellMs = closeAt ? 8 * 60_000 : undefined;

  const boothVisits = row.enteredAt
    ? [
        {
          visitId: row.visitId,
          visitorId: row.visitorId,
          visitorName: row.name,
          sessionId: row.sessionId ?? `demo-${row.id}`,
          enteredAt: row.enteredAt,
          exitedAt: row.exitedAt,
          dwellMs: row.exitedAt
            ? new Date(row.exitedAt).getTime() - new Date(row.enteredAt).getTime()
            : undefined,
          stillInside: row.stillInside ?? false,
        },
      ]
    : [];

  const documentSessions =
    row.leadScore >= 40
      ? [
          {
            docTitle: brochureTitle,
            docUrl: brochureUrl,
            openedAt: openAt,
            closedAt: closeAt,
            dwellMs,
            stillOpen: !closeAt,
          },
        ]
      : [];

  const timeline: import('@/dashboard/api/client').VisitorTimelineEventRow[] = [];
  for (const v of boothVisits) {
    timeline.push({
      id: `enter-${v.enteredAt}`,
      type: 'booth_enter',
      label: 'Entered your booth',
      at: v.enteredAt,
    });
    if (v.exitedAt) {
      timeline.push({
        id: `exit-${v.exitedAt}`,
        type: 'booth_exit',
        label: 'Left your booth',
        detail: v.dwellMs ? `${formatDuration(v.dwellMs)} in booth` : undefined,
        at: v.exitedAt,
      });
    }
  }
  for (const d of documentSessions) {
    timeline.push({
      id: `open-${d.openedAt}`,
      type: 'doc_open',
      label: `Opened ${d.docTitle}`,
      at: d.openedAt,
    });
    if (d.closedAt) {
      timeline.push({
        id: `close-${d.closedAt}`,
        type: 'doc_close',
        label: `Closed ${d.docTitle}`,
        detail: d.dwellMs ? `Read for ${formatDuration(d.dwellMs)}` : undefined,
        at: d.closedAt,
      });
    }
  }
  timeline.sort((a, b) => b.at.localeCompare(a.at));

  const totalDwellMs = boothVisits.reduce((n, v) => n + (v.dwellMs ?? 0), 0);

  return {
    visitorId: row.visitorId,
    visitorName: row.name,
    sessionId: row.sessionId,
    boothId,
    totalVisits: boothVisits.length,
    totalDwellMs,
    documentsOpened: documentSessions.length,
    faqAnswers: row.leadScore >= 70 ? 3 : 0,
    boothVisits,
    documentSessions,
    timeline,
  };
}
