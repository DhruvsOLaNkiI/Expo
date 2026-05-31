export type VisitorCategory = 'HOT' | 'WARM' | 'VIP' | 'COLD';
export type QuestionnaireStatus = 'Completed' | 'In Progress' | 'Not Invited';

export type VisitorInsightRow = {
  id: string;
  name: string;
  company: string;
  role: string;
  email?: string;
  phone?: string;
  avatarHue: number;
  leadScore: number;
  scoreLabel: string;
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
  | 'category'
  | 'enteredAt'
  | 'exitedAt'
  | 'stillInside'
  | 'visitorId'
  | 'sessionId'
  | 'visitId'
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

/** Overlay live MongoDB visit sessions onto CRM rows (by visitor name). */
export function mergeVisitSessions(
  rows: VisitorInsightRow[],
  sessions: BoothVisitSessionRow[],
  boothCompany: string,
): VisitorInsightRow[] {
  if (sessions.length === 0) return rows;

  const usedKeys = new Set<string>();
  const merged = rows.map((row) => {
    const session = sessions.find((s) => {
      const key = s.visitId ?? `${s.sessionId}-${s.enteredAt}`;
      if (usedKeys.has(key)) return false;
      const name = s.visitorName?.trim().toLowerCase();
      return name ? name === row.name.toLowerCase() : false;
    });
    if (!session) return row;

    usedKeys.add(session.visitId ?? `${session.sessionId}-${session.enteredAt}`);
    return {
      ...row,
      enteredAt: session.enteredAt,
      exitedAt: session.exitedAt,
      stillInside: session.stillInside,
      atYourBooth: session.stillInside || row.atYourBooth,
      visitorId: session.visitorId ?? row.visitorId,
      sessionId: session.sessionId ?? row.sessionId,
      visitId: session.visitId ?? row.visitId,
      email: session.email ?? row.email,
      phone: session.phone ?? row.phone,
    };
  });

  for (const session of sessions) {
    const key = session.visitId ?? `${session.sessionId}-${session.enteredAt}`;
    if (usedKeys.has(key)) continue;
    usedKeys.add(key);
    merged.unshift({
      id: `live-${key}`,
      name: session.visitorName?.trim() || 'Guest visitor',
      company: '—',
      role: '—',
      email: session.email,
      phone: session.phone,
      avatarHue: 210,
      leadScore: 0,
      scoreLabel: '—',
      category: 'WARM',
      hall: 'Your hall',
      booth: 'Your booth',
      boothCompany,
      atYourBooth: true,
      questionnaire: 'Not Invited',
      enteredAt: session.enteredAt,
      exitedAt: session.exitedAt,
      stillInside: session.stillInside,
      visitorId: session.visitorId,
      sessionId: session.sessionId,
      visitId: session.visitId,
    });
  }

  return merged;
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
    'Category',
    'Hall',
    'Booth',
    'Booth Company',
    'Entry',
    'Exit',
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
      r.category,
      r.hall,
      r.booth,
      r.boothCompany,
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
