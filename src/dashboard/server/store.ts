import { connectToDatabase, getVisitorRegistrationStats, type VisitorRegistration } from '../../server/mongodb';
import type { AnalyticsDashboardData } from '../types';
import {
  engagementActionFromLabel,
  isEngagementAction,
  buildEngagementActionRows,
  summarizeEngagementActions,
  convertingTierFromScore,
  clampEngagementPoints,
  ENGAGEMENT_ACTION_POINTS,
  emptyConversionStats,
  type EngagementAction,
  type BoothEngagementActionStats,
  type BoothConversionStats,
  visitorEngagementFromPoints,
  type VisitorEngagementScoreRow,
} from '../engagementLeadScore';

export type AnalyticsEventType =
  | 'session_start'
  | 'heartbeat'
  | 'zone_dwell'
  | 'doc_open'
  | 'doc_close'
  | 'doc_heartbeat'
  | 'booth_enter'
  | 'booth_exit'
  | 'cta_engagement';

export interface ExpoAnalyticsEvent {
  _id?: string;
  sessionId: string;
  visitorId?: string;
  visitorName?: string;
  visitId?: string;
  type: AnalyticsEventType;
  zone?: string;
  boothId?: string;
  docTitle?: string;
  docUrl?: string;
  docVariant?: string;
  engagementAction?: string;
  engagementPoints?: number;
  dwellMs?: number;
  createdAt: Date;
}

export interface AnalyticsTrackPayload {
  sessionId: string;
  visitorId?: string;
  visitorName?: string;
  events: Array<{
    type: AnalyticsEventType;
    zone?: string;
    boothId?: string;
    docTitle?: string;
    docUrl?: string;
    docVariant?: string;
    engagementAction?: string;
    engagementPoints?: number;
    dwellMs?: number;
    visitId?: string;
    at?: string;
  }>;
}

export type { AnalyticsDashboardData };

async function analyticsCollection() {
  const db = await connectToDatabase();
  const col = db.collection<ExpoAnalyticsEvent>('expoAnalyticsEvents');
  await col.createIndex({ createdAt: -1 });
  await col.createIndex({ sessionId: 1 });
  await col.createIndex({ type: 1, createdAt: -1 });
  await col.createIndex({ boothId: 1, type: 1, createdAt: -1 });
  return col;
}

/** Registered visitor id, else one count per browser session. */
const VISITOR_KEY_EXPR = {
  $cond: {
    if: {
      $and: [{ $ne: ['$visitorId', null] }, { $ne: ['$visitorId', ''] }],
    },
    then: '$visitorId',
    else: '$sessionId',
  },
} as const;

export type BoothVisitorStats = {
  /** Unique people who entered this booth (all time). */
  uniqueVisitorsTotal: number;
  /** Unique people in the last 7 days. */
  uniqueVisitorsLast7Days: number;
  /** % change vs the previous 7 days (unique visitors). */
  uniqueVisitorsGrowthPct: number;
  /** Sessions with a recent heartbeat in this booth zone. */
  liveVisitorsNow: number;
  /** Total booth_enter events (includes repeat visits). */
  totalBoothVisits: number;
  totalBoothVisitsLast7Days: number;
  totalBoothVisitsGrowthPct: number;
  avgDwellMsInBooth: number;
  visitTrend: { slot: string; label: string; visitors: number }[];
  /** Calendar day used for hourly trend (YYYY-MM-DD, local). */
  visitTrendEventDay?: string;
  visitTrendStartHour: number;
  visitTrendSpanHours: number;
  mongoConnected: boolean;
};

export type BoothVisitorStatsTrendOptions = {
  trendStartHour?: number;
  trendSpanHours?: number;
};

const DEFAULT_TREND_START_HOUR = 9;
const DEFAULT_TREND_SPAN_HOURS = 8;

function formatHourLabel(hour: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12} ${period}`;
}

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function hourSlotLabels(
  eventDay: Date,
  startHour: number,
  spanHours: number,
): { slot: string; label: string }[] {
  const dayKey = localDateKey(eventDay);
  const out: { slot: string; label: string }[] = [];
  for (let i = 0; i < spanHours; i++) {
    const hour = startHour + i;
    out.push({
      slot: `${dayKey}T${String(hour).padStart(2, '0')}`,
      label: formatHourLabel(hour),
    });
  }
  return out;
}

async function resolveVisitTrendEventDay(
  col: Awaited<ReturnType<typeof analyticsCollection>>,
  boothId: string,
): Promise<Date> {
  const latest = await col.findOne(
    { type: 'booth_enter', boothId },
    { sort: { createdAt: -1 }, projection: { createdAt: 1 } },
  );
  const d = latest?.createdAt ? new Date(latest.createdAt) : new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function growthPct(current: number, previous: number): number {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export async function getBoothVisitorStats(
  boothId: string,
  trendOptions: BoothVisitorStatsTrendOptions = {},
): Promise<BoothVisitorStats> {
  const trendStartHour = trendOptions.trendStartHour ?? DEFAULT_TREND_START_HOUR;
  const trendSpanHours = trendOptions.trendSpanHours ?? DEFAULT_TREND_SPAN_HOURS;
  const eventDay = new Date();
  eventDay.setHours(0, 0, 0, 0);
  const emptyTrend = hourSlotLabels(eventDay, trendStartHour, trendSpanHours).map(
    ({ slot, label }) => ({ slot, label, visitors: 0 }),
  );
  const empty: BoothVisitorStats = {
    uniqueVisitorsTotal: 0,
    uniqueVisitorsLast7Days: 0,
    uniqueVisitorsGrowthPct: 0,
    liveVisitorsNow: 0,
    totalBoothVisits: 0,
    totalBoothVisitsLast7Days: 0,
    totalBoothVisitsGrowthPct: 0,
    avgDwellMsInBooth: 0,
    visitTrend: emptyTrend,
    visitTrendEventDay: localDateKey(eventDay),
    visitTrendStartHour: trendStartHour,
    visitTrendSpanHours: trendSpanHours,
    mongoConnected: Boolean(process.env.MONGODB_URI?.trim()),
  };

  if (!process.env.MONGODB_URI?.trim()) return empty;

  const col = await analyticsCollection();
  const now = Date.now();
  const msDay = 24 * 60 * 60 * 1000;
  const since7 = new Date(now - 7 * msDay);
  const since14 = new Date(now - 14 * msDay);
  const boothZone = `booth:${boothId}`;

  const [
    uniqueTotalAgg,
    uniqueLast7Agg,
    uniquePrev7Agg,
    visitsTotalAgg,
    visitsLast7Agg,
    visitsPrev7Agg,
    livePresence,
    dwellAgg,
  ] = await Promise.all([
    col
      .aggregate([
        { $match: { type: 'booth_enter', boothId } },
        { $group: { _id: VISITOR_KEY_EXPR } },
        { $count: 'n' },
      ])
      .toArray(),
    col
      .aggregate([
        { $match: { type: 'booth_enter', boothId, createdAt: { $gte: since7 } } },
        { $group: { _id: VISITOR_KEY_EXPR } },
        { $count: 'n' },
      ])
      .toArray(),
    col
      .aggregate([
        {
          $match: {
            type: 'booth_enter',
            boothId,
            createdAt: { $gte: since14, $lt: since7 },
          },
        },
        { $group: { _id: VISITOR_KEY_EXPR } },
        { $count: 'n' },
      ])
      .toArray(),
    col
      .aggregate([
        { $match: { type: 'booth_enter', boothId } },
        { $count: 'n' },
      ])
      .toArray(),
    col
      .aggregate([
        { $match: { type: 'booth_enter', boothId, createdAt: { $gte: since7 } } },
        { $count: 'n' },
      ])
      .toArray(),
    col
      .aggregate([
        {
          $match: {
            type: 'booth_enter',
            boothId,
            createdAt: { $gte: since14, $lt: since7 },
          },
        },
        { $count: 'n' },
      ])
      .toArray(),
    getBoothLivePresence(boothId),
    col
      .aggregate([
        {
          $match: {
            type: 'zone_dwell',
            zone: boothZone,
            dwellMs: { $gt: 0 },
          },
        },
        {
          $group: {
            _id: null,
            totalDwell: { $sum: '$dwellMs' },
            samples: { $sum: 1 },
          },
        },
      ])
      .toArray(),
  ]);

  const trendEventDay = await resolveVisitTrendEventDay(col, boothId);
  const trendDayStart = new Date(trendEventDay);
  trendDayStart.setHours(trendStartHour, 0, 0, 0);
  const trendDayEnd = new Date(trendDayStart);
  trendDayEnd.setHours(trendStartHour + trendSpanHours, 0, 0, 0);

  const enterEvents = await col
    .find({
      type: 'booth_enter',
      boothId,
      createdAt: { $gte: trendDayStart, $lt: trendDayEnd },
    })
    .project({ createdAt: 1, visitorId: 1, sessionId: 1 })
    .limit(5000)
    .toArray();

  const uniqueBySlot = new Map<string, Set<string>>();
  for (const e of enterEvents) {
    const at = new Date(e.createdAt);
    const slot = `${localDateKey(at)}T${String(at.getHours()).padStart(2, '0')}`;
    const key =
      e.visitorId?.trim() ||
      e.sessionId?.trim() ||
      `anon-${e._id.toString()}`;
    const set = uniqueBySlot.get(slot) ?? new Set<string>();
    set.add(key);
    uniqueBySlot.set(slot, set);
  }
  const trendAgg = [...uniqueBySlot.entries()].map(([slot, set]) => ({
    _id: slot,
    visitors: set.size,
  }));

  const uniqueTotal = (uniqueTotalAgg[0] as { n?: number } | undefined)?.n ?? 0;
  const uniqueLast7 = (uniqueLast7Agg[0] as { n?: number } | undefined)?.n ?? 0;
  const uniquePrev7 = (uniquePrev7Agg[0] as { n?: number } | undefined)?.n ?? 0;
  const visitsTotal = (visitsTotalAgg[0] as { n?: number } | undefined)?.n ?? 0;
  const visitsLast7 = (visitsLast7Agg[0] as { n?: number } | undefined)?.n ?? 0;
  const visitsPrev7 = (visitsPrev7Agg[0] as { n?: number } | undefined)?.n ?? 0;
  const liveNow = livePresence.count;

  const dwellRow = dwellAgg[0] as { totalDwell?: number; samples?: number } | undefined;
  const avgDwellMsInBooth =
    dwellRow?.samples && dwellRow.samples > 0
      ? Math.round((dwellRow.totalDwell ?? 0) / dwellRow.samples)
      : 0;

  const byHour = new Map(
    (trendAgg as Array<{ _id: string; visitors: number }>).map((r) => [r._id, r.visitors]),
  );
  const visitTrend = hourSlotLabels(trendEventDay, trendStartHour, trendSpanHours).map(
    ({ slot, label }) => ({
      slot,
      label,
      visitors: byHour.get(slot) ?? 0,
    }),
  );

  return {
    uniqueVisitorsTotal: uniqueTotal,
    uniqueVisitorsLast7Days: uniqueLast7,
    uniqueVisitorsGrowthPct: growthPct(uniqueLast7, uniquePrev7),
    liveVisitorsNow: liveNow,
    totalBoothVisits: visitsTotal,
    totalBoothVisitsLast7Days: visitsLast7,
    totalBoothVisitsGrowthPct: growthPct(visitsLast7, visitsPrev7),
    avgDwellMsInBooth,
    visitTrend,
    visitTrendEventDay: localDateKey(trendEventDay),
    visitTrendStartHour: trendStartHour,
    visitTrendSpanHours: trendSpanHours,
    mongoConnected: true,
  };
}

export type BoothDocumentStat = {
  docUrl: string;
  docTitle?: string;
  opens: number;
  closes: number;
  totalDwellMs: number;
  avgDwellMs: number;
};

export async function getBoothDocumentStats(boothId: string): Promise<BoothDocumentStat[]> {
  const col = await analyticsCollection();
  const [opensAgg, dwellAgg] = await Promise.all([
    col
      .aggregate([
        { $match: { boothId, type: 'doc_open', docUrl: { $exists: true, $ne: '' } } },
        {
          $group: {
            _id: '$docUrl',
            docTitle: { $last: '$docTitle' },
            opens: { $sum: 1 },
          },
        },
      ])
      .toArray(),
    col
      .aggregate([
        { $match: { boothId, type: 'doc_close', dwellMs: { $gt: 0 } } },
        {
          $group: {
            _id: '$docUrl',
            docTitle: { $last: '$docTitle' },
            closes: { $sum: 1 },
            totalDwellMs: { $sum: '$dwellMs' },
          },
        },
      ])
      .toArray(),
  ]);

  const byUrl = new Map<string, BoothDocumentStat>();

  for (const row of opensAgg as Array<{ _id: string; docTitle?: string; opens: number }>) {
    const url = String(row._id || '').trim();
    if (!url) continue;
    byUrl.set(url, {
      docUrl: url,
      docTitle: row.docTitle,
      opens: row.opens,
      closes: 0,
      totalDwellMs: 0,
      avgDwellMs: 0,
    });
  }

  for (const row of dwellAgg as Array<{
    _id: string;
    docTitle?: string;
    closes: number;
    totalDwellMs: number;
  }>) {
    const url = String(row._id || '').trim();
    if (!url) continue;
    const prev = byUrl.get(url) ?? {
      docUrl: url,
      docTitle: row.docTitle,
      opens: 0,
      closes: 0,
      totalDwellMs: 0,
      avgDwellMs: 0,
    };
    prev.closes = row.closes;
    prev.totalDwellMs = row.totalDwellMs;
    prev.avgDwellMs = row.closes > 0 ? Math.round(row.totalDwellMs / row.closes) : 0;
    if (row.docTitle) prev.docTitle = row.docTitle;
    byUrl.set(url, prev);
  }

  return [...byUrl.values()].sort((a, b) => b.opens - a.opens);
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

async function enrichSessionsWithVisitorContact(
  sessions: BoothVisitSessionRow[],
): Promise<BoothVisitSessionRow[]> {
  const ids = [...new Set(sessions.map((s) => s.visitorId?.trim()).filter(Boolean))] as string[];
  if (ids.length === 0) return sessions;

  const db = await connectToDatabase();
  const visitors = await db
    .collection<VisitorRegistration>('visitors')
    .find({ visitorId: { $in: ids } })
    .project({ visitorId: 1, displayName: 1, email: 1, phone: 1 })
    .toArray();
  const byId = new Map(visitors.map((v) => [v.visitorId, v]));

  return sessions.map((s) => {
    const reg = s.visitorId ? byId.get(s.visitorId) : undefined;
    if (!reg) return s;
    return {
      ...s,
      visitorName: s.visitorName?.trim() || reg.displayName,
      email: reg.email?.trim() || s.email,
      phone: reg.phone?.trim() || s.phone,
    };
  });
}

async function lookupVisitorContact(params: {
  visitorId?: string;
  visitorName?: string;
}): Promise<{ email?: string; phone?: string; visitorName?: string }> {
  const id = params.visitorId?.trim();
  if (!id) return {};
  const db = await connectToDatabase();
  const reg = await db
    .collection<VisitorRegistration>('visitors')
    .findOne({ visitorId: id }, { projection: { email: 1, phone: 1, displayName: 1 } });
  if (!reg) return {};
  return {
    email: reg.email?.trim(),
    phone: reg.phone?.trim(),
    visitorName: reg.displayName?.trim() || params.visitorName,
  };
}

function visitorKeyFromEvent(e: Pick<ExpoAnalyticsEvent, 'visitorId' | 'sessionId'>): string {
  const id = e.visitorId?.trim();
  return id || e.sessionId;
}

/** Pair booth_enter with booth_exit (or legacy zone_dwell) for exhibitor CRM. */
export async function getBoothVisitSessions(
  boothId: string,
  limit = 100,
): Promise<BoothVisitSessionRow[]> {
  if (!process.env.MONGODB_URI?.trim()) return [];

  const col = await analyticsCollection();
  const boothZone = `booth:${boothId}`;

  const events = await col
    .find({
      $or: [
        { boothId, type: { $in: ['booth_enter', 'booth_exit'] } },
        { zone: boothZone, type: 'zone_dwell', dwellMs: { $gt: 0 } },
      ],
    })
    .sort({ createdAt: 1 })
    .limit(800)
    .toArray();

  const openByVisitId = new Map<string, BoothVisitSessionRow>();
  const openByVisitor = new Map<string, BoothVisitSessionRow[]>();
  const completed: BoothVisitSessionRow[] = [];

  const pushOpen = (row: BoothVisitSessionRow) => {
    if (row.visitId) openByVisitId.set(row.visitId, row);
    const key = row.visitorId || row.sessionId;
    const list = openByVisitor.get(key) ?? [];
    list.push(row);
    openByVisitor.set(key, list);
  };

  const closeRow = (row: BoothVisitSessionRow, exitedAt: Date, dwellMs?: number) => {
    row.exitedAt = exitedAt.toISOString();
    row.dwellMs = dwellMs;
    row.stillInside = false;
    completed.push(row);
    if (row.visitId) openByVisitId.delete(row.visitId);
    const key = row.visitorId || row.sessionId;
    const list = openByVisitor.get(key);
    if (list) {
      const idx = list.indexOf(row);
      if (idx >= 0) list.splice(idx, 1);
    }
  };

  for (const e of events) {
    if (e.type === 'booth_enter' && e.boothId === boothId) {
      const row: BoothVisitSessionRow = {
        visitId: e.visitId,
        visitorId: e.visitorId,
        visitorName: e.visitorName,
        sessionId: e.sessionId,
        enteredAt: e.createdAt.toISOString(),
        stillInside: true,
      };
      pushOpen(row);
      continue;
    }

    if (e.type === 'booth_exit' && e.boothId === boothId) {
      let row: BoothVisitSessionRow | undefined;
      if (e.visitId) row = openByVisitId.get(e.visitId);
      if (!row) {
        const key = visitorKeyFromEvent(e);
        const list = openByVisitor.get(key);
        row = list?.[list.length - 1];
      }
      if (row) closeRow(row, e.createdAt, e.dwellMs);
      continue;
    }

    if (e.type === 'zone_dwell' && e.zone === boothZone) {
      const key = visitorKeyFromEvent(e);
      const list = openByVisitor.get(key);
      const row = list?.[list.length - 1];
      if (row?.stillInside) {
        closeRow(row, e.createdAt, e.dwellMs);
      }
    }
  }

  for (const list of openByVisitor.values()) {
    for (const row of list) {
      if (row.stillInside) completed.push(row);
    }
  }

  const sorted = completed
    .sort((a, b) => b.enteredAt.localeCompare(a.enteredAt))
    .slice(0, limit);
  return enrichSessionsWithVisitorContact(sorted);
}

export async function insertAnalyticsEvents(payload: AnalyticsTrackPayload): Promise<number> {
  const col = await analyticsCollection();
  if (!payload.events.length) return 0;
  const now = new Date();
  const docs = payload.events.map((e) => ({
    sessionId: payload.sessionId,
    visitorId: payload.visitorId,
    visitorName: payload.visitorName,
    type: e.type,
    zone: e.zone,
    boothId: e.boothId,
    docTitle: e.docTitle,
    docUrl: e.docUrl,
    docVariant: e.docVariant,
    engagementAction: e.engagementAction,
    engagementPoints: e.engagementPoints,
    dwellMs: e.dwellMs,
    visitId: e.visitId,
    createdAt: e.at ? new Date(e.at) : now,
  }));
  const result = await col.insertMany(docs);
  return result.insertedCount;
}

export type FaqAnswerEntry = {
  questionId: string;
  questionText: string;
  optionId: string;
  optionText: string;
  optionLabel: string;
};

export interface ExpoFaqSubmission {
  _id?: string;
  boothId: string;
  sessionId: string;
  visitorId?: string;
  visitorName?: string;
  answers: FaqAnswerEntry[];
  submittedAt: Date;
}

export type FaqSubmissionRow = {
  id: string;
  boothId: string;
  sessionId: string;
  visitorId?: string;
  visitorName?: string;
  submittedAt: string;
  answers: FaqAnswerEntry[];
};

async function faqSubmissionsCollection() {
  const db = await connectToDatabase();
  const col = db.collection<ExpoFaqSubmission>('expoFaqSubmissions');
  await col.createIndex({ boothId: 1, submittedAt: -1 });
  return col;
}

export async function insertFaqSubmission(payload: {
  boothId: string;
  sessionId: string;
  visitorId?: string;
  visitorName?: string;
  answers: FaqAnswerEntry[];
}): Promise<string | null> {
  if (!process.env.MONGODB_URI?.trim()) return null;
  if (!payload.boothId?.trim() || !payload.sessionId?.trim() || payload.answers.length === 0) {
    return null;
  }

  const col = await faqSubmissionsCollection();
  const doc: ExpoFaqSubmission = {
    boothId: payload.boothId.trim(),
    sessionId: payload.sessionId.trim(),
    visitorId: payload.visitorId?.trim() || undefined,
    visitorName: payload.visitorName?.trim() || undefined,
    answers: payload.answers,
    submittedAt: new Date(),
  };
  const result = await col.insertOne(doc);
  return result.insertedId?.toString() ?? null;
}

export async function getBoothFaqSubmissions(
  boothId: string,
  limit = 100,
): Promise<FaqSubmissionRow[]> {
  if (!process.env.MONGODB_URI?.trim()) return [];

  const col = await faqSubmissionsCollection();
  const docs = await col
    .find({ boothId })
    .sort({ submittedAt: -1 })
    .limit(limit)
    .toArray();

  return docs.map((d) => ({
    id: d._id?.toString() ?? `${d.sessionId}-${d.submittedAt.toISOString()}`,
    boothId: d.boothId,
    sessionId: d.sessionId,
    visitorId: d.visitorId,
    visitorName: d.visitorName,
    submittedAt: d.submittedAt.toISOString(),
    answers: d.answers,
  }));
}

export type SalesChatMessageRow = {
  id: string;
  boothId: string;
  threadId: string;
  from: 'visitor' | 'sales';
  text: string;
  at: string;
  visitorId?: string;
  visitorName?: string;
  autoReply?: boolean;
};

export interface ExpoSalesChatMessage {
  _id?: string;
  boothId: string;
  threadId: string;
  from: 'visitor' | 'sales';
  text: string;
  visitorId?: string;
  visitorName?: string;
  autoReply?: boolean;
  createdAt: Date;
}

async function salesChatCollection() {
  const db = await connectToDatabase();
  const col = db.collection<ExpoSalesChatMessage>('expoSalesChatMessages');
  await col.createIndex({ boothId: 1, createdAt: -1 });
  await col.createIndex({ boothId: 1, threadId: 1, createdAt: 1 });
  return col;
}

export async function insertSalesChatMessage(payload: {
  boothId: string;
  threadId: string;
  from: 'visitor' | 'sales';
  text: string;
  visitorId?: string;
  visitorName?: string;
  autoReply?: boolean;
}): Promise<SalesChatMessageRow | null> {
  if (!process.env.MONGODB_URI?.trim()) return null;
  if (!payload.boothId?.trim() || !payload.threadId?.trim() || !payload.text?.trim()) {
    return null;
  }

  const col = await salesChatCollection();
  const createdAt = new Date();
  const doc: ExpoSalesChatMessage = {
    boothId: payload.boothId.trim(),
    threadId: payload.threadId.trim(),
    from: payload.from,
    text: payload.text.trim(),
    visitorId: payload.visitorId?.trim() || undefined,
    visitorName: payload.visitorName?.trim() || undefined,
    autoReply: payload.autoReply ?? false,
    createdAt,
  };
  const result = await col.insertOne(doc);
  const id = result.insertedId?.toString() ?? `mongo-${Date.now()}`;
  return {
    id,
    boothId: doc.boothId,
    threadId: doc.threadId,
    from: doc.from,
    text: doc.text,
    at: createdAt.toISOString(),
    visitorId: doc.visitorId,
    visitorName: doc.visitorName,
    autoReply: doc.autoReply,
  };
}

export async function getBoothSalesChatMessages(
  boothId: string,
  opts?: { threadId?: string; limit?: number },
): Promise<SalesChatMessageRow[]> {
  if (!process.env.MONGODB_URI?.trim()) return [];

  const col = await salesChatCollection();
  const filter: Record<string, unknown> = { boothId };
  if (opts?.threadId?.trim()) filter.threadId = opts.threadId.trim();

  const docs = await col
    .find(filter)
    .sort({ createdAt: 1 })
    .limit(opts?.limit ?? 500)
    .toArray();

  return docs.map((d) => ({
    id: d._id?.toString() ?? `mongo-${d.createdAt.toISOString()}`,
    boothId: d.boothId,
    threadId: d.threadId,
    from: d.from,
    text: d.text,
    at: d.createdAt.toISOString(),
    visitorId: d.visitorId,
    visitorName: d.visitorName,
    autoReply: d.autoReply,
  }));
}

export type AiChatMessageRow = {
  id: string;
  boothId: string;
  threadId: string;
  role: 'user' | 'assistant';
  text: string;
  at: string;
  visitorId?: string;
  visitorName?: string;
};

export interface ExpoAiChatMessage {
  _id?: string;
  boothId: string;
  threadId: string;
  role: 'user' | 'assistant';
  text: string;
  visitorId?: string;
  visitorName?: string;
  createdAt: Date;
}

async function aiChatCollection() {
  const db = await connectToDatabase();
  const col = db.collection<ExpoAiChatMessage>('expoAiChatMessages');
  await col.createIndex({ boothId: 1, createdAt: -1 });
  await col.createIndex({ boothId: 1, threadId: 1, createdAt: 1 });
  return col;
}

export async function insertAiChatMessage(payload: {
  boothId: string;
  threadId: string;
  role: 'user' | 'assistant';
  text: string;
  visitorId?: string;
  visitorName?: string;
}): Promise<AiChatMessageRow | null> {
  if (!process.env.MONGODB_URI?.trim()) return null;
  if (!payload.boothId?.trim() || !payload.threadId?.trim() || !payload.text?.trim()) {
    return null;
  }
  if (payload.role !== 'user' && payload.role !== 'assistant') return null;

  const col = await aiChatCollection();
  const createdAt = new Date();
  const doc: ExpoAiChatMessage = {
    boothId: payload.boothId.trim(),
    threadId: payload.threadId.trim(),
    role: payload.role,
    text: payload.text.trim(),
    visitorId: payload.visitorId?.trim() || undefined,
    visitorName: payload.visitorName?.trim() || undefined,
    createdAt,
  };
  const result = await col.insertOne(doc);
  const id = result.insertedId?.toString() ?? `mongo-${Date.now()}`;
  return {
    id,
    boothId: doc.boothId,
    threadId: doc.threadId,
    role: doc.role,
    text: doc.text,
    at: createdAt.toISOString(),
    visitorId: doc.visitorId,
    visitorName: doc.visitorName,
  };
}

export async function getBoothAiChatMessages(
  boothId: string,
  opts?: { threadId?: string; limit?: number },
): Promise<AiChatMessageRow[]> {
  if (!process.env.MONGODB_URI?.trim()) return [];

  const col = await aiChatCollection();
  const filter: Record<string, unknown> = { boothId };
  if (opts?.threadId?.trim()) filter.threadId = opts.threadId.trim();

  const docs = await col
    .find(filter)
    .sort({ createdAt: 1 })
    .limit(opts?.limit ?? 1000)
    .toArray();

  return docs.map((d) => ({
    id: d._id?.toString() ?? `mongo-${d.createdAt.toISOString()}`,
    boothId: d.boothId,
    threadId: d.threadId,
    role: d.role,
    text: d.text,
    at: d.createdAt.toISOString(),
    visitorId: d.visitorId,
    visitorName: d.visitorName,
  }));
}

/** Presence is stale if no ping within this window (client pings every 5s). */
export const BOOTH_PRESENCE_STALE_MS = 12_000;

export interface ExpoBoothPresence {
  _id?: string;
  boothId: string;
  visitorKey: string;
  sessionId: string;
  visitorId?: string;
  visitorName?: string;
  enteredAt: Date;
  lastSeen: Date;
}

async function presenceCollection() {
  const db = await connectToDatabase();
  const col = db.collection<ExpoBoothPresence>('expoBoothPresence');
  await col.createIndex({ boothId: 1, visitorKey: 1 }, { unique: true });
  await col.createIndex({ boothId: 1, lastSeen: -1 });
  await col.createIndex({ lastSeen: 1 }, { expireAfterSeconds: 45 });
  return col;
}

function presenceVisitorKey(sessionId: string, visitorId?: string): string {
  const id = visitorId?.trim();
  return id || sessionId.trim();
}

export async function upsertBoothPresence(payload: {
  boothId: string;
  sessionId: string;
  visitorId?: string;
  visitorName?: string;
}): Promise<boolean> {
  if (!process.env.MONGODB_URI?.trim()) return false;
  if (!payload.boothId?.trim() || !payload.sessionId?.trim()) return false;

  const col = await presenceCollection();
  const now = new Date();
  const visitorKey = presenceVisitorKey(payload.sessionId, payload.visitorId);
  await col.updateOne(
    { boothId: payload.boothId.trim(), visitorKey },
    {
      $set: {
        boothId: payload.boothId.trim(),
        visitorKey,
        sessionId: payload.sessionId.trim(),
        visitorId: payload.visitorId?.trim() || undefined,
        visitorName: payload.visitorName?.trim() || undefined,
        lastSeen: now,
      },
      $setOnInsert: { enteredAt: now },
    },
    { upsert: true },
  );
  return true;
}

export async function removeBoothPresence(payload: {
  boothId: string;
  sessionId: string;
  visitorId?: string;
}): Promise<boolean> {
  if (!process.env.MONGODB_URI?.trim()) return false;
  if (!payload.boothId?.trim() || !payload.sessionId?.trim()) return false;

  const col = await presenceCollection();
  const visitorKey = presenceVisitorKey(payload.sessionId, payload.visitorId);
  await col.deleteOne({ boothId: payload.boothId.trim(), visitorKey });
  return true;
}

export type BoothLivePresenceRow = {
  visitorKey: string;
  visitorId?: string;
  visitorName?: string;
  sessionId: string;
  enteredAt: string;
  lastSeen: string;
};

export type BoothLivePresence = {
  count: number;
  visitors: BoothLivePresenceRow[];
  mongoConnected: boolean;
};

export async function getBoothLivePresence(boothId: string): Promise<BoothLivePresence> {
  const empty: BoothLivePresence = { count: 0, visitors: [], mongoConnected: false };
  if (!process.env.MONGODB_URI?.trim()) return empty;

  const col = await presenceCollection();
  const staleBefore = new Date(Date.now() - BOOTH_PRESENCE_STALE_MS);
  const docs = await col
    .find({ boothId, lastSeen: { $gte: staleBefore } })
    .sort({ lastSeen: -1 })
    .limit(50)
    .toArray();

  return {
    count: docs.length,
    visitors: docs.map((d) => ({
      visitorKey: d.visitorKey,
      visitorId: d.visitorId,
      visitorName: d.visitorName,
      sessionId: d.sessionId,
      enteredAt: d.enteredAt.toISOString(),
      lastSeen: d.lastSeen.toISOString(),
    })),
    mongoConnected: true,
  };
}

export type VisitorDocumentSession = {
  docTitle: string;
  docUrl: string;
  openedAt: string;
  closedAt?: string;
  dwellMs?: number;
  stillOpen: boolean;
};

export type VisitorTimelineEvent = {
  id: string;
  type: 'booth_enter' | 'booth_exit' | 'doc_open' | 'doc_close' | 'faq_answer';
  label: string;
  detail?: string;
  at: string;
};

export type BoothVisitorProfile = {
  visitorId?: string;
  visitorName?: string;
  email?: string;
  phone?: string;
  sessionId?: string;
  boothId: string;
  totalVisits: number;
  totalDwellMs: number;
  documentsOpened: number;
  faqAnswers: number;
  boothVisits: BoothVisitSessionRow[];
  documentSessions: VisitorDocumentSession[];
  timeline: VisitorTimelineEvent[];
};

function normalizeVisitorPhone(phone?: string): string {
  return phone?.replace(/\D/g, '') ?? '';
}

function isGenericVisitorName(name?: string): boolean {
  const n = name?.trim().toLowerCase();
  return !n || n === 'guest' || n === 'guest visitor';
}

function sessionMatchesProfile(
  session: BoothVisitSessionRow,
  params: {
    visitorId?: string;
    sessionId?: string;
    visitorName?: string;
    email?: string;
    phone?: string;
  },
): boolean {
  if (params.visitorId?.trim() && session.visitorId === params.visitorId.trim()) return true;
  if (params.sessionId?.trim() && session.sessionId === params.sessionId.trim()) return true;
  const email = params.email?.trim().toLowerCase();
  if (email && session.email?.trim().toLowerCase() === email) return true;
  const phone = normalizeVisitorPhone(params.phone);
  if (phone && normalizeVisitorPhone(session.phone) === phone) return true;
  const name = params.visitorName?.trim();
  if (
    name &&
    !isGenericVisitorName(name) &&
    session.visitorName?.toLowerCase() === name.toLowerCase()
  ) {
    return true;
  }
  return false;
}

function visitorEventMatch(params: {
  visitorId?: string;
  sessionId?: string;
  visitorName?: string;
  extraVisitorIds?: string[];
  extraSessionIds?: string[];
}): Record<string, unknown> | null {
  const or: Record<string, unknown>[] = [];
  const ids = new Set<string>();
  const sids = new Set<string>();
  if (params.visitorId?.trim()) ids.add(params.visitorId.trim());
  for (const id of params.extraVisitorIds ?? []) if (id?.trim()) ids.add(id.trim());
  if (params.sessionId?.trim()) sids.add(params.sessionId.trim());
  for (const sid of params.extraSessionIds ?? []) if (sid?.trim()) sids.add(sid.trim());
  const name = params.visitorName?.trim();
  if (name && !isGenericVisitorName(name)) or.push({ visitorName: name });
  for (const id of ids) or.push({ visitorId: id });
  for (const sid of sids) or.push({ sessionId: sid });
  if (or.length === 0) return null;
  return { $or: or };
}

function pairDocumentSessions(
  events: ExpoAnalyticsEvent[],
): VisitorDocumentSession[] {
  const openByUrl = new Map<string, { docTitle: string; docUrl: string; openedAt: Date }[]>();
  const completed: VisitorDocumentSession[] = [];

  for (const e of events) {
    if (e.type === 'doc_open' && e.docUrl) {
      const url = e.docUrl.trim();
      const list = openByUrl.get(url) ?? [];
      list.push({
        docTitle: e.docTitle?.trim() || 'Document',
        docUrl: url,
        openedAt: e.createdAt,
      });
      openByUrl.set(url, list);
      continue;
    }
    if (e.type === 'doc_close' && e.docUrl) {
      const url = e.docUrl.trim();
      const list = openByUrl.get(url);
      const open = list?.shift();
      if (open) {
        completed.push({
          docTitle: open.docTitle,
          docUrl: url,
          openedAt: open.openedAt.toISOString(),
          closedAt: e.createdAt.toISOString(),
          dwellMs: e.dwellMs,
          stillOpen: false,
        });
      }
    }
  }

  for (const [, list] of openByUrl) {
    for (const open of list) {
      completed.push({
        docTitle: open.docTitle,
        docUrl: open.docUrl,
        openedAt: open.openedAt.toISOString(),
        stillOpen: true,
      });
    }
  }

  return completed.sort((a, b) => b.openedAt.localeCompare(a.openedAt));
}

/** Full activity profile for one visitor at an exhibitor booth. */
export async function getBoothVisitorProfile(
  boothId: string,
  params: {
    visitorId?: string;
    sessionId?: string;
    visitorName?: string;
    email?: string;
    phone?: string;
  },
): Promise<BoothVisitorProfile | null> {
  const empty: BoothVisitorProfile = {
    visitorId: params.visitorId,
    visitorName: params.visitorName,
    email: params.email,
    phone: params.phone,
    sessionId: params.sessionId,
    boothId,
    totalVisits: 0,
    totalDwellMs: 0,
    documentsOpened: 0,
    faqAnswers: 0,
    boothVisits: [],
    documentSessions: [],
    timeline: [],
  };

  if (!process.env.MONGODB_URI?.trim()) return empty;

  const allSessions = await getBoothVisitSessions(boothId, 200);
  const boothVisits = allSessions
    .filter((s) => sessionMatchesProfile(s, params))
    .sort((a, b) => b.enteredAt.localeCompare(a.enteredAt));

  const hasIdentity =
    Boolean(params.visitorId?.trim()) ||
    Boolean(params.sessionId?.trim()) ||
    Boolean(params.email?.trim()) ||
    Boolean(params.phone?.trim()) ||
    Boolean(params.visitorName?.trim() && !isGenericVisitorName(params.visitorName));

  if (!hasIdentity && boothVisits.length === 0) return empty;

  const extraVisitorIds = boothVisits.map((v) => v.visitorId).filter(Boolean) as string[];
  const extraSessionIds = boothVisits.map((v) => v.sessionId).filter(Boolean) as string[];

  const match = visitorEventMatch({
    visitorId: params.visitorId,
    sessionId: params.sessionId,
    visitorName: params.visitorName,
    extraVisitorIds,
    extraSessionIds,
  });

  const col = await analyticsCollection();

  const events = match
    ? await col
        .find({
          $and: [
            match,
            { boothId },
            { type: { $in: ['doc_open', 'doc_close'] } },
          ],
        })
        .sort({ createdAt: 1 })
        .limit(500)
        .toArray()
    : [];

  const knownVisitorIds = new Set(
    [...boothVisits.map((v) => v.visitorId), params.visitorId].filter(Boolean) as string[],
  );
  const knownSessionIds = new Set(
    [...boothVisits.map((v) => v.sessionId), params.sessionId].filter(Boolean) as string[],
  );

  const faqAll = await getBoothFaqSubmissions(boothId, 200);
  const faqSubs = faqAll.filter((s) => {
    if (s.visitorId && knownVisitorIds.has(s.visitorId)) return true;
    if (s.sessionId && knownSessionIds.has(s.sessionId)) return true;
    const name = params.visitorName?.trim();
    if (
      name &&
      !isGenericVisitorName(name) &&
      s.visitorName?.toLowerCase() === name.toLowerCase()
    ) {
      return true;
    }
    return false;
  });

  const docEvents = events.filter(
    (e) =>
      (e.type === 'doc_open' || e.type === 'doc_close') && e.boothId === boothId,
  );
  const documentSessions = pairDocumentSessions(docEvents);

  const timeline: VisitorTimelineEvent[] = [];

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
        detail: v.dwellMs ? `${Math.round(v.dwellMs / 1000)}s in booth` : undefined,
        at: v.exitedAt,
      });
    }
  }

  for (const d of documentSessions) {
    timeline.push({
      id: `open-${d.openedAt}-${d.docUrl}`,
      type: 'doc_open',
      label: `Opened ${d.docTitle}`,
      detail: d.docUrl,
      at: d.openedAt,
    });
    if (d.closedAt) {
      timeline.push({
        id: `close-${d.closedAt}-${d.docUrl}`,
        type: 'doc_close',
        label: `Closed ${d.docTitle}`,
        detail: d.dwellMs ? `Read for ${Math.round((d.dwellMs ?? 0) / 1000)}s` : undefined,
        at: d.closedAt,
      });
    }
  }

  for (const sub of faqSubs) {
    for (const a of sub.answers) {
      timeline.push({
        id: `faq-${sub.submittedAt}-${a.questionId}`,
        type: 'faq_answer',
        label: a.questionText,
        detail: `${a.optionLabel}: ${a.optionText}`,
        at: sub.submittedAt,
      });
    }
  }

  timeline.sort((a, b) => b.at.localeCompare(a.at));

  const totalDwellMs = boothVisits.reduce((n, v) => n + (v.dwellMs ?? 0), 0);
  let faqAnswers = 0;
  for (const s of faqSubs) faqAnswers += s.answers.length;

  const resolvedName =
    params.visitorName ||
    boothVisits[0]?.visitorName ||
    faqSubs[0]?.visitorName ||
    events.find((e) => e.visitorName)?.visitorName;

  const resolvedVisitorId =
    params.visitorId || boothVisits[0]?.visitorId || faqSubs[0]?.visitorId;
  const contact = resolvedVisitorId
    ? await lookupVisitorContact({ visitorId: resolvedVisitorId, visitorName: resolvedName })
    : {};

  return {
    visitorId: resolvedVisitorId,
    visitorName: contact.visitorName || resolvedName,
    email: params.email || boothVisits.find((v) => v.email)?.email || contact.email,
    phone: params.phone || boothVisits.find((v) => v.phone)?.phone || contact.phone,
    sessionId: params.sessionId || boothVisits[0]?.sessionId || faqSubs[0]?.sessionId,
    boothId,
    totalVisits: boothVisits.length,
    totalDwellMs,
    documentsOpened: documentSessions.length,
    faqAnswers,
    boothVisits,
    documentSessions,
    timeline,
  };
}

export async function getAnalyticsDashboard(): Promise<AnalyticsDashboardData> {
  const db = await connectToDatabase();
  const col = await analyticsCollection();
  const asOf = new Date().toISOString();
  const activeSince = new Date(Date.now() - 2 * 60 * 1000);

  const [
    visitorStats,
    recentVisitors,
    questionnaireAgg,
    recentQuestionnaires,
    docAgg,
    docDwellAgg,
    zoneAgg,
    sessionStats,
    recentEvents,
  ] = await Promise.all([
    getVisitorRegistrationStats(),
    db
      .collection<VisitorRegistration>('visitors')
      .find({})
      .sort({ createdAt: -1 })
      .limit(12)
      .toArray(),
    db
      .collection('buyerQuestionnaires')
      .aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            avgScore: { $avg: '$totalScore' },
            hot: { $sum: { $cond: [{ $eq: ['$category', 'hot'] }, 1, 0] } },
            warm: { $sum: { $cond: [{ $eq: ['$category', 'warm'] }, 1, 0] } },
            cold: { $sum: { $cond: [{ $eq: ['$category', 'cold'] }, 1, 0] } },
          },
        },
      ])
      .toArray(),
    db
      .collection('buyerQuestionnaires')
      .find({})
      .sort({ createdAt: -1 })
      .limit(8)
      .toArray(),
    col
      .aggregate([
        { $match: { type: 'doc_open' } },
        {
          $group: {
            _id: { title: '$docTitle', variant: '$docVariant' },
            opens: { $sum: 1 },
          },
        },
        { $sort: { opens: -1 } },
        { $limit: 12 },
      ])
      .toArray(),
    col
      .aggregate([
        { $match: { type: 'doc_close', dwellMs: { $gt: 0 } } },
        {
          $group: {
            _id: { title: '$docTitle', variant: '$docVariant' },
            totalDwellMs: { $sum: '$dwellMs' },
            closes: { $sum: 1 },
          },
        },
      ])
      .toArray(),
    col
      .aggregate([
        { $match: { type: 'zone_dwell', zone: { $exists: true, $ne: '' } } },
        {
          $group: {
            _id: '$zone',
            totalDwellMs: { $sum: { $ifNull: ['$dwellMs', 0] } },
            visits: { $sum: 1 },
          },
        },
        { $sort: { totalDwellMs: -1 } },
        { $limit: 10 },
      ])
      .toArray(),
    col
      .aggregate([
        {
          $facet: {
            totalSessions: [{ $group: { _id: '$sessionId' } }, { $count: 'n' }],
            activeNow: [
              { $match: { type: 'heartbeat', createdAt: { $gte: activeSince } } },
              { $group: { _id: '$sessionId' } },
              { $count: 'n' },
            ],
          },
        },
      ])
      .toArray(),
    col.find({}).sort({ createdAt: -1 }).limit(20).toArray(),
  ]);

  const qRow = questionnaireAgg[0] as
    | { total: number; avgScore: number; hot: number; warm: number; cold: number }
    | undefined;

  const sessFacet = sessionStats[0] as {
    totalSessions: Array<{ n: number }>;
    activeNow: Array<{ n: number }>;
  };

  const totalOpens = docAgg.reduce((n, d) => n + (d.opens as number), 0);

  const dwellByKey = new Map<string, { totalDwellMs: number; closes: number }>();
  for (const row of docDwellAgg as Array<{
    _id: { title?: string; variant?: string };
    totalDwellMs: number;
    closes: number;
  }>) {
    const title = row._id?.title || 'Untitled';
    const variant = row._id?.variant ?? '';
    dwellByKey.set(`${title}\0${variant}`, {
      totalDwellMs: row.totalDwellMs,
      closes: row.closes,
    });
  }

  return {
    asOf,
    mongoConnected: true,
    visitors: {
      total: visitorStats.visitorsTotal,
      registeredToday: visitorStats.visitorsRegisteredToday,
      checkedInToday: visitorStats.visitorsCheckedInToday,
    },
    questionnaires: {
      total: qRow?.total ?? 0,
      avgScore: Math.round((qRow?.avgScore ?? 0) * 10) / 10,
      byCategory: {
        hot: qRow?.hot ?? 0,
        warm: qRow?.warm ?? 0,
        cold: qRow?.cold ?? 0,
      },
      recent: recentQuestionnaires.map((q) => ({
        visitorName: (q.visitorName as string) || 'Anonymous',
        visitorEmail: q.visitorEmail as string | undefined,
        totalScore: q.totalScore as number,
        category: q.category as string,
        categoryLabel: (q.categoryLabel as string) || (q.category as string),
        submittedAt: (q.submittedAt as string) || new Date(q.createdAt as Date).toISOString(),
      })),
    },
    documents: {
      totalOpens,
      uniqueDocs: docAgg.length,
      topDocuments: docAgg.map((d) => {
        const title = (d._id as { title?: string })?.title || 'Untitled';
        const variant = (d._id as { variant?: string })?.variant;
        const dwell = dwellByKey.get(`${title}\0${variant ?? ''}`);
        const closes = dwell?.closes ?? 0;
        const avgDwellMs = closes > 0 ? Math.round((dwell?.totalDwellMs ?? 0) / closes) : 0;
        return {
          title,
          variant,
          opens: d.opens as number,
          avgDwellMs,
          totalDwellMs: dwell?.totalDwellMs ?? 0,
        };
      }),
    },
    zones: {
      topZones: zoneAgg.map((z) => ({
        zone: z._id as string,
        totalDwellMs: z.totalDwellMs as number,
        visits: z.visits as number,
      })),
    },
    sessions: {
      activeNow: sessFacet?.activeNow?.[0]?.n ?? 0,
      totalSessions: sessFacet?.totalSessions?.[0]?.n ?? 0,
    },
    recentVisitors: recentVisitors.map((v) => ({
      visitorId: v.visitorId,
      displayName: v.displayName,
      email: v.email,
      createdAt: v.createdAt.toISOString(),
      lobbyCheckInAt: v.lobbyCheckInAt?.toISOString(),
    })),
    recentActivity: recentEvents.map((e) => ({
      at: e.createdAt.toISOString(),
      type: e.type,
      visitorId: e.visitorId,
      label: formatActivityLabel(e),
    })),
  };
}

function formatActivityLabel(e: ExpoAnalyticsEvent): string {
  switch (e.type) {
    case 'doc_open':
      return `Opened “${e.docTitle || 'document'}”${e.boothId ? ` @ ${e.boothId}` : ''}`;
    case 'doc_close':
      return `Closed “${e.docTitle || 'document'}” after ${Math.round((e.dwellMs ?? 0) / 1000)}s`;
    case 'doc_heartbeat':
      return `Reading “${e.docTitle || 'document'}” (+${Math.round((e.dwellMs ?? 0) / 1000)}s)`;
    case 'booth_enter':
      return `Entered booth ${e.boothId || e.zone || '—'}`;
    case 'booth_exit':
      return `Left booth ${e.boothId || e.zone || '—'} (${Math.round((e.dwellMs ?? 0) / 1000)}s)`;
    case 'zone_dwell':
      return `Stayed in ${formatZoneLabel(e.zone)} (${Math.round((e.dwellMs ?? 0) / 1000)}s)`;
    case 'session_start':
      return 'Started session';
    case 'heartbeat':
      return `Active in ${formatZoneLabel(e.zone)}`;
    default:
      return e.type;
  }
}

function formatZoneLabel(zone?: string): string {
  if (!zone) return 'platform';
  if (zone === 'registration_lobby') return 'Registration';
  if (zone === 'expo_hall') return 'Main hall';
  if (zone === 'help_desk') return 'Help Desk';
  if (zone === 'ai_chat') return 'AI chat';
  if (zone.startsWith('booth:')) return zone.replace('booth:', '').replace(/-/g, ' ');
  return zone;
}

export type QuestionnairePossibilityStats = {
  high: number;
  medium: number;
  low: number;
  total: number;
  avgScore: number;
  mongoConnected: boolean;
};

/** Aggregate buyer questionnaire submissions into high / medium / low possibility buckets. */
export async function getQuestionnairePossibilityStats(): Promise<QuestionnairePossibilityStats> {
  if (!process.env.MONGODB_URI?.trim()) {
    return { high: 0, medium: 0, low: 0, total: 0, avgScore: 0, mongoConnected: false };
  }

  const db = await connectToDatabase();
  const agg = await db
    .collection('buyerQuestionnaires')
    .aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          avgScore: { $avg: '$totalScore' },
          high: { $sum: { $cond: [{ $eq: ['$category', 'hot'] }, 1, 0] } },
          medium: { $sum: { $cond: [{ $eq: ['$category', 'warm'] }, 1, 0] } },
          low: { $sum: { $cond: [{ $eq: ['$category', 'cold'] }, 1, 0] } },
        },
      },
    ])
    .toArray();

  const row = agg[0] as
    | { total?: number; avgScore?: number; high?: number; medium?: number; low?: number }
    | undefined;

  return {
    total: row?.total ?? 0,
    avgScore: Math.round(row?.avgScore ?? 0),
    high: row?.high ?? 0,
    medium: row?.medium ?? 0,
    low: row?.low ?? 0,
    mongoConnected: true,
  };
}

export type BoothEngagementLeadStats = QuestionnairePossibilityStats;

/** Booth menu clicks grouped by action (points chart — not questionnaire lead tiers). */
export async function getBoothEngagementActionStats(
  boothId: string,
): Promise<BoothEngagementActionStats> {
  const emptyRows = buildEngagementActionRows({});
  const empty: BoothEngagementActionStats = {
    ...summarizeEngagementActions(emptyRows),
    uniqueVisitors: 0,
    avgPointsPerVisitor: 0,
    conversion: emptyConversionStats(),
    mongoConnected: Boolean(process.env.MONGODB_URI?.trim()),
  };
  if (!process.env.MONGODB_URI?.trim()) return empty;

  const col = await analyticsCollection();
  const events = await col
    .find({
      boothId,
      type: { $in: ['cta_engagement', 'doc_open'] },
    })
    .project({
      type: 1,
      sessionId: 1,
      visitorId: 1,
      docTitle: 1,
      engagementAction: 1,
      engagementPoints: 1,
    })
    .toArray();

  const clickCounts: Partial<Record<EngagementAction, number>> = {};
  const visitorPoints = new Map<string, number>();

  for (const e of events) {
    let action: EngagementAction | null = null;
    if (e.type === 'cta_engagement' && e.engagementAction && isEngagementAction(e.engagementAction)) {
      action = e.engagementAction;
    } else if (e.type === 'doc_open' && e.docTitle) {
      action = engagementActionFromLabel(e.docTitle);
    }
    if (!action) continue;

    const points =
      e.type === 'cta_engagement' && typeof e.engagementPoints === 'number'
        ? e.engagementPoints
        : ENGAGEMENT_ACTION_POINTS[action];

    clickCounts[action] = (clickCounts[action] ?? 0) + 1;

    const visitorKey =
      e.visitorId && String(e.visitorId).trim() !== '' ? String(e.visitorId) : e.sessionId;
    visitorPoints.set(visitorKey, (visitorPoints.get(visitorKey) ?? 0) + points);
  }

  const rows = buildEngagementActionRows(clickCounts);
  const summary = summarizeEngagementActions(rows);
  const uniqueVisitors = visitorPoints.size;

  const conversionCounts = { high: 0, medium: 0, low: 0 };
  let conversionScoreSum = 0;
  let conversionVisitors = 0;

  for (const score of visitorPoints.values()) {
    const capped = clampEngagementPoints(score);
    const tier = convertingTierFromScore(capped);
    if (!tier) continue;
    conversionCounts[tier] += 1;
    conversionScoreSum += capped;
    conversionVisitors += 1;
  }

  const conversion: BoothConversionStats = {
    ...conversionCounts,
    total: conversionVisitors,
    avgScore:
      conversionVisitors > 0 ? Math.round((conversionScoreSum / conversionVisitors) * 10) / 10 : 0,
  };

  return {
    ...summary,
    uniqueVisitors,
    avgPointsPerVisitor:
      uniqueVisitors > 0 ? Math.round(summary.totalPoints / uniqueVisitors) : 0,
    conversion,
    mongoConnected: true,
  };
}

export async function getBoothVisitorEngagementScores(
  boothId: string,
): Promise<VisitorEngagementScoreRow[]> {
  if (!process.env.MONGODB_URI?.trim()) return [];

  const col = await analyticsCollection();
  const events = await col
    .find({
      boothId,
      type: { $in: ['cta_engagement', 'doc_open'] },
    })
    .project({
      visitorId: 1,
      sessionId: 1,
      visitorName: 1,
      type: 1,
      docTitle: 1,
      engagementAction: 1,
      engagementPoints: 1,
    })
    .toArray();

  type VisitorAgg = {
    visitorId?: string;
    sessionId?: string;
    visitorName?: string;
    points: number;
  };

  const byKey = new Map<string, VisitorAgg>();

  for (const e of events) {
    let action: EngagementAction | null = null;
    if (e.type === 'cta_engagement' && e.engagementAction && isEngagementAction(e.engagementAction)) {
      action = e.engagementAction;
    } else if (e.type === 'doc_open' && e.docTitle) {
      action = engagementActionFromLabel(e.docTitle);
    }
    if (!action) continue;

    const points =
      e.type === 'cta_engagement' && typeof e.engagementPoints === 'number'
        ? e.engagementPoints
        : ENGAGEMENT_ACTION_POINTS[action];

    const visitorKey =
      e.visitorId && String(e.visitorId).trim() !== ''
        ? String(e.visitorId)
        : e.sessionId ?? 'unknown';

    const existing = byKey.get(visitorKey);
    if (existing) {
      existing.points += points;
      existing.visitorName = existing.visitorName ?? e.visitorName;
      existing.visitorId = existing.visitorId ?? e.visitorId;
      existing.sessionId = existing.sessionId ?? e.sessionId;
    } else {
      byKey.set(visitorKey, {
        visitorId: e.visitorId,
        sessionId: e.sessionId,
        visitorName: e.visitorName,
        points,
      });
    }
  }

  return [...byKey.values()]
    .map((row) =>
      visitorEngagementFromPoints(row.points, {
        visitorId: row.visitorId,
        sessionId: row.sessionId,
        visitorName: row.visitorName,
      }),
    )
    .sort((a, b) => b.points - a.points);
}
