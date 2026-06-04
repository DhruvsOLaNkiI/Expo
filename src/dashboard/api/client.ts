import { analyticsApiUrl } from '../config';
import type { AnalyticsDashboardData } from '../types';

export type { AnalyticsDashboardData };

export type AnalyticsEventInput = {
  type:
    | 'session_start'
    | 'heartbeat'
    | 'zone_dwell'
    | 'doc_open'
    | 'doc_close'
    | 'doc_heartbeat'
    | 'booth_enter'
    | 'booth_exit'
    | 'cta_engagement';
  zone?: string;
  boothId?: string;
  docTitle?: string;
  docUrl?: string;
  docVariant?: string;
  engagementAction?: string;
  engagementPoints?: number;
  dwellMs?: number;
  visitId?: string;
};

const SESSION_KEY = 'vr-expo-analytics-session';

export function getAnalyticsSessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return `sess_${Date.now()}`;
  }
}

const queue: AnalyticsEventInput[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

export function trackAnalytics(
  event: AnalyticsEventInput,
  meta?: { visitorId?: string; visitorName?: string },
): void {
  queue.push(event);
  if (queue.length >= 8) {
    void flushAnalytics(meta);
    return;
  }
  if (!flushTimer) {
    flushTimer = setTimeout(() => {
      flushTimer = null;
      void flushAnalytics(meta);
    }, 4000);
  }
}

export async function flushAnalytics(meta?: {
  visitorId?: string;
  visitorName?: string;
}): Promise<void> {
  if (queue.length === 0) return;
  const events = queue.splice(0, queue.length);
  try {
    await fetch(analyticsApiUrl('/api/analytics/track'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: getAnalyticsSessionId(),
        visitorId: meta?.visitorId,
        visitorName: meta?.visitorName,
        events,
      }),
    });
  } catch {
    // Best-effort telemetry
  }
}

export type BoothDocumentStatRow = {
  docUrl: string;
  docTitle?: string;
  opens: number;
  closes: number;
  totalDwellMs: number;
  avgDwellMs: number;
};

export type BoothVisitorStats = {
  uniqueVisitorsTotal: number;
  uniqueVisitorsLast7Days: number;
  uniqueVisitorsGrowthPct: number;
  liveVisitorsNow: number;
  totalBoothVisits: number;
  totalBoothVisitsLast7Days: number;
  totalBoothVisitsGrowthPct: number;
  avgDwellMsInBooth: number;
  visitTrend: { slot: string; label: string; visitors: number }[];
  visitTrendEventDay?: string;
  visitTrendStartHour?: number;
  visitTrendSpanHours?: number;
  mongoConnected: boolean;
};

export type BoothVisitorStatsTrendParams = {
  trendStartHour?: number;
  trendSpanHours?: number;
};

export type QuestionnairePossibilityStats = {
  high: number;
  medium: number;
  low: number;
  total: number;
  avgScore: number;
  mongoConnected: boolean;
};

export async function fetchBoothVisitorStats(
  boothId: string,
  trend?: BoothVisitorStatsTrendParams,
): Promise<BoothVisitorStats | null> {
  try {
    const qs = new URLSearchParams({ boothId });
    if (trend?.trendStartHour != null) qs.set('trendStartHour', String(trend.trendStartHour));
    if (trend?.trendSpanHours != null) qs.set('trendSpanHours', String(trend.trendSpanHours));
    const res = await fetch(analyticsApiUrl(`/api/analytics/booth-visitors?${qs}`));
    const json = (await res.json()) as { ok: boolean; stats?: BoothVisitorStats };
    if (!res.ok || !json.ok || !json.stats) return null;
    return json.stats;
  } catch {
    return null;
  }
}

export async function fetchQuestionnairePossibilityStats(): Promise<QuestionnairePossibilityStats | null> {
  try {
    const res = await fetch(analyticsApiUrl('/api/analytics/questionnaire-possibility'));
    const json = (await res.json()) as { ok: boolean; stats?: QuestionnairePossibilityStats };
    if (!res.ok || !json.ok || !json.stats) return null;
    return json.stats;
  } catch {
    return null;
  }
}

export async function fetchBoothEngagementActionStats(
  boothId: string,
): Promise<import('../engagementLeadScore').BoothEngagementActionStats | null> {
  try {
    const res = await fetch(
      analyticsApiUrl(
        `/api/analytics/booth-engagement-actions?boothId=${encodeURIComponent(boothId)}`,
      ),
    );
    const json = (await res.json()) as {
      ok: boolean;
      stats?: import('../engagementLeadScore').BoothEngagementActionStats;
    };
    if (!res.ok || !json.ok || !json.stats) return null;
    return json.stats;
  } catch {
    return null;
  }
}

export async function fetchBoothVisitorEngagementScores(
  boothId: string,
): Promise<import('../engagementLeadScore').VisitorEngagementScoreRow[]> {
  try {
    const res = await fetch(
      analyticsApiUrl(
        `/api/analytics/booth-visitor-engagement?boothId=${encodeURIComponent(boothId)}`,
      ),
    );
    const json = (await res.json()) as {
      ok: boolean;
      scores?: import('../engagementLeadScore').VisitorEngagementScoreRow[];
    };
    if (!res.ok || !json.ok || !Array.isArray(json.scores)) return [];
    return json.scores;
  } catch {
    return [];
  }
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

export async function fetchBoothVisitSessions(
  boothId: string,
): Promise<BoothVisitSessionRow[]> {
  try {
    const res = await fetch(
      analyticsApiUrl(`/api/analytics/booth-visits?boothId=${encodeURIComponent(boothId)}`),
    );
    const json = (await res.json()) as { ok: boolean; sessions?: BoothVisitSessionRow[] };
    if (!res.ok || !json.ok || !json.sessions) return [];
    return json.sessions;
  } catch {
    return [];
  }
}

export type FaqAnswerEntry = {
  questionId: string;
  questionText: string;
  optionId: string;
  optionText: string;
  optionLabel: string;
};

export type FaqSubmissionRow = {
  id: string;
  boothId: string;
  sessionId: string;
  visitorId?: string;
  visitorName?: string;
  submittedAt: string;
  answers: FaqAnswerEntry[];
};

export async function submitFaqResponses(payload: {
  boothId: string;
  sessionId: string;
  visitorId?: string;
  visitorName?: string;
  answers: FaqAnswerEntry[];
}): Promise<FaqSubmissionRow | null> {
  const submittedAt = new Date().toISOString();
  const localRow: FaqSubmissionRow = {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    boothId: payload.boothId,
    sessionId: payload.sessionId,
    visitorId: payload.visitorId,
    visitorName: payload.visitorName,
    submittedAt,
    answers: payload.answers,
  };

  try {
    const res = await fetch(analyticsApiUrl('/api/analytics/faq-submit'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = (await res.json()) as {
      ok: boolean;
      submission?: FaqSubmissionRow;
      stored?: boolean;
    };
    if (res.ok && json.ok && json.submission) {
      const { appendLocalFaqSubmission } = await import('../faqResponseLocal');
      appendLocalFaqSubmission(json.submission);
      return json.submission;
    }
  } catch {
    /* fall through to local */
  }

  const { appendLocalFaqSubmission } = await import('../faqResponseLocal');
  appendLocalFaqSubmission(localRow);
  return localRow;
}

export async function fetchBoothFaqSubmissions(boothId: string): Promise<FaqSubmissionRow[]> {
  let fromApi: FaqSubmissionRow[] = [];
  try {
    const res = await fetch(
      analyticsApiUrl(`/api/analytics/booth-faq-responses?boothId=${encodeURIComponent(boothId)}`),
    );
    const json = (await res.json()) as { ok: boolean; submissions?: FaqSubmissionRow[] };
    if (res.ok && json.ok && json.submissions) fromApi = json.submissions;
  } catch {
    /* use local only */
  }

  const { readLocalFaqSubmissions } = await import('../faqResponseLocal');
  const fromLocal = readLocalFaqSubmissions(boothId);
  const seen = new Set(fromApi.map((r) => r.id));
  const merged = [...fromApi];
  for (const row of fromLocal) {
    if (!seen.has(row.id)) merged.push(row);
  }
  return merged.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
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

function salesChatMessageKey(m: SalesChatMessageRow): string {
  return `${m.threadId}|${m.from}|${m.text}|${m.at.slice(0, 19)}`;
}

function mergeSalesChatMessages(
  fromApi: SalesChatMessageRow[],
  fromLocal: SalesChatMessageRow[],
): SalesChatMessageRow[] {
  const seenIds = new Set(fromApi.map((m) => m.id));
  const seenKeys = new Set(fromApi.map(salesChatMessageKey));
  const merged = [...fromApi];
  for (const row of fromLocal) {
    if (seenIds.has(row.id)) continue;
    const key = salesChatMessageKey(row);
    if (seenKeys.has(key)) continue;
    merged.push(row);
    seenKeys.add(key);
  }
  return merged.sort((a, b) => a.at.localeCompare(b.at));
}

export async function postSalesChatMessage(payload: {
  boothId: string;
  threadId: string;
  from: 'visitor' | 'sales';
  text: string;
  visitorId?: string;
  visitorName?: string;
  autoReply?: boolean;
}): Promise<SalesChatMessageRow | null> {
  const { createSalesChatMessage, appendSalesChatMessage } = await import('../salesChatLocal');
  const localRow = createSalesChatMessage(payload);

  try {
    const res = await fetch(analyticsApiUrl('/api/analytics/sales-chat'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = (await res.json()) as {
      ok: boolean;
      message?: SalesChatMessageRow;
      stored?: boolean;
    };
    if (res.ok && json.ok && json.message) {
      appendSalesChatMessage(json.message);
      return json.message;
    }
  } catch {
    /* fall through to local */
  }

  appendSalesChatMessage(localRow);
  return localRow;
}

export async function fetchBoothSalesChatMessages(
  boothId: string,
  threadId?: string,
): Promise<SalesChatMessageRow[]> {
  let fromApi: SalesChatMessageRow[] = [];
  try {
    const qs = new URLSearchParams({ boothId });
    if (threadId?.trim()) qs.set('threadId', threadId.trim());
    const res = await fetch(analyticsApiUrl(`/api/analytics/booth-sales-chat?${qs}`));
    const json = (await res.json()) as { ok: boolean; messages?: SalesChatMessageRow[] };
    if (res.ok && json.ok && json.messages) fromApi = json.messages;
  } catch {
    /* use local only */
  }

  const { readSalesChatMessages } = await import('../salesChatLocal');
  const fromLocal = readSalesChatMessages(boothId, threadId);
  return mergeSalesChatMessages(fromApi, fromLocal);
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

function aiChatMessageKey(m: AiChatMessageRow): string {
  return `${m.threadId}|${m.role}|${m.text}|${m.at.slice(0, 19)}`;
}

function mergeAiChatMessages(fromApi: AiChatMessageRow[], fromLocal: AiChatMessageRow[]): AiChatMessageRow[] {
  const seenIds = new Set(fromApi.map((m) => m.id));
  const seenKeys = new Set(fromApi.map(aiChatMessageKey));
  const merged = [...fromApi];
  for (const row of fromLocal) {
    if (seenIds.has(row.id)) continue;
    const key = aiChatMessageKey(row);
    if (seenKeys.has(key)) continue;
    merged.push(row);
    seenKeys.add(key);
  }
  return merged.sort((a, b) => a.at.localeCompare(b.at));
}

export async function postAiChatMessage(payload: {
  boothId: string;
  threadId: string;
  role: 'user' | 'assistant';
  text: string;
  visitorId?: string;
  visitorName?: string;
}): Promise<AiChatMessageRow | null> {
  const { createAiChatMessage, appendAiChatMessage } = await import('../aiChatLocal');
  const localRow = createAiChatMessage(payload);

  try {
    const res = await fetch(analyticsApiUrl('/api/analytics/ai-chat'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = (await res.json()) as {
      ok: boolean;
      message?: AiChatMessageRow;
      stored?: boolean;
    };
    if (res.ok && json.ok && json.message) {
      appendAiChatMessage(json.message);
      return json.message;
    }
  } catch {
    /* fall through to local */
  }

  appendAiChatMessage(localRow);
  return localRow;
}

export async function fetchBoothAiChatMessages(
  boothId: string,
  threadId?: string,
): Promise<AiChatMessageRow[]> {
  let fromApi: AiChatMessageRow[] = [];
  try {
    const qs = new URLSearchParams({ boothId });
    if (threadId?.trim()) qs.set('threadId', threadId.trim());
    const res = await fetch(analyticsApiUrl(`/api/analytics/booth-ai-chat?${qs}`));
    const json = (await res.json()) as { ok: boolean; messages?: AiChatMessageRow[] };
    if (res.ok && json.ok && json.messages) fromApi = json.messages;
  } catch {
    /* use local only */
  }

  const { readAiChatMessages } = await import('../aiChatLocal');
  const fromLocal = readAiChatMessages(boothId, threadId);
  return mergeAiChatMessages(fromApi, fromLocal);
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

export async function pingBoothPresence(payload: {
  boothId: string;
  sessionId: string;
  visitorId?: string;
  visitorName?: string;
}): Promise<void> {
  try {
    await fetch(analyticsApiUrl('/api/analytics/booth-presence'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    /* best-effort */
  }
}

export async function clearBoothPresence(payload: {
  boothId: string;
  sessionId: string;
  visitorId?: string;
}): Promise<void> {
  try {
    await fetch(analyticsApiUrl('/api/analytics/booth-presence'), {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    /* best-effort */
  }
}

export async function fetchBoothLivePresence(boothId: string): Promise<BoothLivePresence> {
  const empty: BoothLivePresence = { count: 0, visitors: [], mongoConnected: false };
  try {
    const res = await fetch(
      analyticsApiUrl(`/api/analytics/booth-live-presence?boothId=${encodeURIComponent(boothId)}`),
    );
    const json = (await res.json()) as { ok: boolean; presence?: BoothLivePresence };
    if (!res.ok || !json.ok || !json.presence) return empty;
    return json.presence;
  } catch {
    return empty;
  }
}

export async function fetchBoothDocumentStats(
  boothId: string,
): Promise<BoothDocumentStatRow[]> {
  try {
    const res = await fetch(
      analyticsApiUrl(`/api/analytics/booth-documents?boothId=${encodeURIComponent(boothId)}`),
    );
    const json = (await res.json()) as { ok: boolean; stats?: BoothDocumentStatRow[] };
    if (!res.ok || !json.ok || !json.stats) return [];
    return json.stats;
  } catch {
    return [];
  }
}

export type VisitorDocumentSessionRow = {
  docTitle: string;
  docUrl: string;
  openedAt: string;
  closedAt?: string;
  dwellMs?: number;
  stillOpen: boolean;
};

export type VisitorTimelineEventRow = {
  id: string;
  type: 'booth_enter' | 'booth_exit' | 'doc_open' | 'doc_close' | 'faq_answer';
  label: string;
  detail?: string;
  at: string;
};

export type BoothVisitorProfileRow = {
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
  documentSessions: VisitorDocumentSessionRow[];
  timeline: VisitorTimelineEventRow[];
};

export async function fetchBoothVisitorProfile(
  boothId: string,
  params: {
    visitorId?: string;
    sessionId?: string;
    visitorName?: string;
    email?: string;
    phone?: string;
  },
): Promise<BoothVisitorProfileRow | null> {
  try {
    const qs = new URLSearchParams({ boothId });
    if (params.visitorId) qs.set('visitorId', params.visitorId);
    if (params.sessionId) qs.set('sessionId', params.sessionId);
    if (params.visitorName) qs.set('visitorName', params.visitorName);
    if (params.email) qs.set('email', params.email);
    if (params.phone) qs.set('phone', params.phone);
    const res = await fetch(analyticsApiUrl(`/api/analytics/booth-visitor-profile?${qs}`));
    const json = (await res.json()) as { ok: boolean; profile?: BoothVisitorProfileRow };
    if (!res.ok || !json.ok || !json.profile) return null;
    return json.profile;
  } catch {
    return null;
  }
}

export async function fetchAnalyticsDashboard(): Promise<AnalyticsDashboardData | null> {
  try {
    const res = await fetch(analyticsApiUrl('/api/analytics/dashboard'));
    const json = (await res.json()) as {
      ok: boolean;
      data?: AnalyticsDashboardData;
      error?: string;
    };
    if (!res.ok || !json.ok || !json.data) {
      console.warn('[dashboard]', json.error || res.statusText);
      return null;
    }
    return json.data;
  } catch (e) {
    console.warn('[dashboard] fetch failed', e);
    return null;
  }
}
