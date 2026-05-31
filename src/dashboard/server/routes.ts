import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  getAnalyticsDashboard,
  getBoothDocumentStats,
  getBoothFaqSubmissions,
  getBoothVisitSessions,
  getBoothVisitorProfile,
  getBoothVisitorStats,
  insertAnalyticsEvents,
  insertFaqSubmission,
  insertSalesChatMessage,
  getBoothSalesChatMessages,
  upsertBoothPresence,
  removeBoothPresence,
  getBoothLivePresence,
  type AnalyticsTrackPayload,
} from './store';

export function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

export function readJsonBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c as Buffer));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

export async function handleAnalyticsTrack(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (!process.env.MONGODB_URI?.trim()) {
    sendJson(res, 200, { ok: true, stored: false, reason: 'No MongoDB' });
    return;
  }
  const raw = await readJsonBody(req);
  let body: AnalyticsTrackPayload;
  try {
    body = JSON.parse(raw) as AnalyticsTrackPayload;
  } catch {
    sendJson(res, 400, { ok: false, error: 'Invalid JSON' });
    return;
  }
  if (!body.sessionId?.trim() || !Array.isArray(body.events)) {
    sendJson(res, 400, { ok: false, error: 'sessionId and events required' });
    return;
  }
  try {
    const count = await insertAnalyticsEvents(body);
    sendJson(res, 200, { ok: true, stored: count });
  } catch (e: unknown) {
    sendJson(res, 500, {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

export async function handleBoothDocumentStatsGet(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const boothId = url.searchParams.get('boothId')?.trim();
  if (!boothId) {
    sendJson(res, 400, { ok: false, error: 'boothId query required' });
    return;
  }
  if (!process.env.MONGODB_URI?.trim()) {
    sendJson(res, 200, { ok: true, stats: [] });
    return;
  }
  try {
    const stats = await getBoothDocumentStats(boothId);
    sendJson(res, 200, { ok: true, stats });
  } catch (e: unknown) {
    sendJson(res, 500, {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

export async function handleBoothVisitorStatsGet(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const boothId = url.searchParams.get('boothId')?.trim();
  if (!boothId) {
    sendJson(res, 400, { ok: false, error: 'boothId query required' });
    return;
  }
  try {
    const stats = await getBoothVisitorStats(boothId);
    sendJson(res, 200, { ok: true, stats });
  } catch (e: unknown) {
    sendJson(res, 500, {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

export async function handleBoothVisitSessionsGet(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const boothId = url.searchParams.get('boothId')?.trim();
  if (!boothId) {
    sendJson(res, 400, { ok: false, error: 'boothId query required' });
    return;
  }
  if (!process.env.MONGODB_URI?.trim()) {
    sendJson(res, 200, { ok: true, sessions: [] });
    return;
  }
  try {
    const sessions = await getBoothVisitSessions(boothId);
    sendJson(res, 200, { ok: true, sessions });
  } catch (e: unknown) {
    sendJson(res, 500, {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

export async function handleFaqSubmitPost(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const raw = await readJsonBody(req);
  let body: {
    boothId?: string;
    sessionId?: string;
    visitorId?: string;
    visitorName?: string;
    answers?: import('./store').FaqAnswerEntry[];
  };
  try {
    body = JSON.parse(raw);
  } catch {
    sendJson(res, 400, { ok: false, error: 'Invalid JSON' });
    return;
  }

  if (!body.boothId?.trim() || !body.sessionId?.trim() || !Array.isArray(body.answers) || body.answers.length === 0) {
    sendJson(res, 400, { ok: false, error: 'boothId, sessionId, and answers required' });
    return;
  }

  if (!process.env.MONGODB_URI?.trim()) {
    sendJson(res, 200, { ok: true, stored: false });
    return;
  }

  try {
    const id = await insertFaqSubmission({
      boothId: body.boothId,
      sessionId: body.sessionId,
      visitorId: body.visitorId,
      visitorName: body.visitorName,
      answers: body.answers,
    });
    if (!id) {
      sendJson(res, 500, { ok: false, error: 'Failed to store submission' });
      return;
    }
    sendJson(res, 200, {
      ok: true,
      stored: true,
      submission: {
        id,
        boothId: body.boothId.trim(),
        sessionId: body.sessionId.trim(),
        visitorId: body.visitorId?.trim() || undefined,
        visitorName: body.visitorName?.trim() || undefined,
        submittedAt: new Date().toISOString(),
        answers: body.answers,
      },
    });
  } catch (e: unknown) {
    sendJson(res, 500, {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

export async function handleBoothFaqResponsesGet(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const boothId = url.searchParams.get('boothId')?.trim();
  if (!boothId) {
    sendJson(res, 400, { ok: false, error: 'boothId query required' });
    return;
  }
  if (!process.env.MONGODB_URI?.trim()) {
    sendJson(res, 200, { ok: true, submissions: [] });
    return;
  }
  try {
    const submissions = await getBoothFaqSubmissions(boothId);
    sendJson(res, 200, { ok: true, submissions });
  } catch (e: unknown) {
    sendJson(res, 500, {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

export async function handleBoothVisitorProfileGet(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const boothId = url.searchParams.get('boothId')?.trim();
  const visitorId = url.searchParams.get('visitorId')?.trim();
  const sessionId = url.searchParams.get('sessionId')?.trim();
  const visitorName = url.searchParams.get('visitorName')?.trim();
  if (!boothId) {
    sendJson(res, 400, { ok: false, error: 'boothId query required' });
    return;
  }
  if (!visitorId && !sessionId && !visitorName) {
    sendJson(res, 400, { ok: false, error: 'visitorId, sessionId, or visitorName required' });
    return;
  }
  try {
    const profile = await getBoothVisitorProfile(boothId, {
      visitorId,
      sessionId,
      visitorName,
    });
    sendJson(res, 200, { ok: true, profile });
  } catch (e: unknown) {
    sendJson(res, 500, {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

export async function handleSalesChatPost(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const raw = await readJsonBody(req);
  let body: {
    boothId?: string;
    threadId?: string;
    from?: 'visitor' | 'sales';
    text?: string;
    visitorId?: string;
    visitorName?: string;
    autoReply?: boolean;
  };
  try {
    body = JSON.parse(raw);
  } catch {
    sendJson(res, 400, { ok: false, error: 'Invalid JSON' });
    return;
  }

  if (
    !body.boothId?.trim() ||
    !body.threadId?.trim() ||
    !body.text?.trim() ||
    (body.from !== 'visitor' && body.from !== 'sales')
  ) {
    sendJson(res, 400, { ok: false, error: 'boothId, threadId, from, and text required' });
    return;
  }

  if (!process.env.MONGODB_URI?.trim()) {
    sendJson(res, 200, { ok: true, stored: false });
    return;
  }

  try {
    const message = await insertSalesChatMessage({
      boothId: body.boothId,
      threadId: body.threadId,
      from: body.from,
      text: body.text,
      visitorId: body.visitorId,
      visitorName: body.visitorName,
      autoReply: body.autoReply,
    });
    if (!message) {
      sendJson(res, 500, { ok: false, error: 'Failed to store message' });
      return;
    }
    sendJson(res, 200, { ok: true, stored: true, message });
  } catch (e: unknown) {
    sendJson(res, 500, {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

export async function handleBoothSalesChatGet(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const boothId = url.searchParams.get('boothId')?.trim();
  const threadId = url.searchParams.get('threadId')?.trim();
  if (!boothId) {
    sendJson(res, 400, { ok: false, error: 'boothId query required' });
    return;
  }
  if (!process.env.MONGODB_URI?.trim()) {
    sendJson(res, 200, { ok: true, messages: [] });
    return;
  }
  try {
    const messages = await getBoothSalesChatMessages(boothId, { threadId });
    sendJson(res, 200, { ok: true, messages });
  } catch (e: unknown) {
    sendJson(res, 500, {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

export async function handleBoothPresencePost(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const raw = await readJsonBody(req);
  let body: {
    boothId?: string;
    sessionId?: string;
    visitorId?: string;
    visitorName?: string;
  };
  try {
    body = JSON.parse(raw);
  } catch {
    sendJson(res, 400, { ok: false, error: 'Invalid JSON' });
    return;
  }

  if (!body.boothId?.trim() || !body.sessionId?.trim()) {
    sendJson(res, 400, { ok: false, error: 'boothId and sessionId required' });
    return;
  }

  if (!process.env.MONGODB_URI?.trim()) {
    sendJson(res, 200, { ok: true, stored: false });
    return;
  }

  try {
    const stored = await upsertBoothPresence({
      boothId: body.boothId,
      sessionId: body.sessionId,
      visitorId: body.visitorId,
      visitorName: body.visitorName,
    });
    sendJson(res, 200, { ok: true, stored });
  } catch (e: unknown) {
    sendJson(res, 500, {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

export async function handleBoothPresenceDelete(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const raw = await readJsonBody(req);
  let body: {
    boothId?: string;
    sessionId?: string;
    visitorId?: string;
  };
  try {
    body = JSON.parse(raw);
  } catch {
    sendJson(res, 400, { ok: false, error: 'Invalid JSON' });
    return;
  }

  if (!body.boothId?.trim() || !body.sessionId?.trim()) {
    sendJson(res, 400, { ok: false, error: 'boothId and sessionId required' });
    return;
  }

  if (!process.env.MONGODB_URI?.trim()) {
    sendJson(res, 200, { ok: true, removed: false });
    return;
  }

  try {
    const removed = await removeBoothPresence({
      boothId: body.boothId,
      sessionId: body.sessionId,
      visitorId: body.visitorId,
    });
    sendJson(res, 200, { ok: true, removed });
  } catch (e: unknown) {
    sendJson(res, 500, {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

export async function handleBoothLivePresenceGet(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const boothId = url.searchParams.get('boothId')?.trim();
  if (!boothId) {
    sendJson(res, 400, { ok: false, error: 'boothId query required' });
    return;
  }
  try {
    const presence = await getBoothLivePresence(boothId);
    sendJson(res, 200, { ok: true, presence });
  } catch (e: unknown) {
    sendJson(res, 500, {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

export async function handleAnalyticsDashboardGet(res: ServerResponse): Promise<void> {
  if (!process.env.MONGODB_URI?.trim()) {
    sendJson(res, 200, {
      ok: true,
      mongoConnected: false,
      error: 'MONGODB_URI is not set — analytics need MongoDB',
    });
    return;
  }
  try {
    const data = await getAnalyticsDashboard();
    sendJson(res, 200, { ok: true, data });
  } catch (e: unknown) {
    sendJson(res, 500, {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
