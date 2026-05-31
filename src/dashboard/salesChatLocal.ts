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

export type SalesChatThreadSummary = {
  threadId: string;
  visitorId?: string;
  visitorName: string;
  lastMessage: string;
  lastAt: string;
  messageCount: number;
  unreadCount: number;
  lastFrom: 'visitor' | 'sales';
};

const LS_KEY = 'vr-expo-sales-chat';
const READ_LS_KEY = 'vr-expo-sales-chat-read';

function readAll(): Record<string, SalesChatMessageRow[]> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, SalesChatMessageRow[]>)
      : {};
  } catch {
    return {};
  }
}

function writeAll(data: Record<string, SalesChatMessageRow[]>): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent('vr-expo-sales-chat-updated'));
  } catch {
    /* ignore quota */
  }
}

function readReadState(): Record<string, Record<string, string>> {
  try {
    const raw = localStorage.getItem(READ_LS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, Record<string, string>>)
      : {};
  } catch {
    return {};
  }
}

function writeReadState(data: Record<string, Record<string, string>>): void {
  try {
    localStorage.setItem(READ_LS_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

/** Stable conversation id per visitor (registered id, browser session, or name). */
export function resolveSalesChatThreadId(params: {
  visitorId?: string;
  sessionId?: string;
  visitorName?: string;
}): string {
  const id = params.visitorId?.trim();
  if (id) return `v:${id}`;
  const sid = params.sessionId?.trim();
  if (sid) return `s:${sid}`;
  const name = params.visitorName?.trim();
  if (name) return `n:${name.toLowerCase().replace(/\s+/g, '-')}`;
  return `anon:${Date.now()}`;
}

function migrateRow(row: SalesChatMessageRow): SalesChatMessageRow {
  if (row.threadId) return row;
  return {
    ...row,
    threadId: resolveSalesChatThreadId({
      visitorId: row.visitorId,
      visitorName: row.visitorName,
    }),
  };
}

export function appendSalesChatMessage(row: SalesChatMessageRow): void {
  const all = readAll();
  const list = (all[row.boothId] ?? []).map(migrateRow);
  all[row.boothId] = [...list, row].slice(-500);
  writeAll(all);
}

export function readSalesChatMessages(boothId: string, threadId?: string): SalesChatMessageRow[] {
  const list = (readAll()[boothId] ?? []).map(migrateRow);
  const filtered = threadId ? list.filter((m) => m.threadId === threadId) : list;
  return filtered.sort((a, b) => a.at.localeCompare(b.at));
}

export function buildSalesChatThreads(
  boothId: string,
  messages: SalesChatMessageRow[],
): SalesChatThreadSummary[] {
  const readMap = readReadState()[boothId] ?? {};
  const byThread = new Map<string, SalesChatMessageRow[]>();

  for (const m of messages) {
    const arr = byThread.get(m.threadId) ?? [];
    arr.push(m);
    byThread.set(m.threadId, arr);
  }

  const threads: SalesChatThreadSummary[] = [];
  for (const [threadId, msgs] of byThread) {
    const sorted = [...msgs].sort((a, b) => a.at.localeCompare(b.at));
    const last = sorted[sorted.length - 1]!;
    const visitorMsg = sorted.find((m) => m.from === 'visitor');
    const visitorName =
      visitorMsg?.visitorName?.trim() ||
      sorted.find((m) => m.visitorName)?.visitorName?.trim() ||
      'Visitor';
    const lastReadAt = readMap[threadId];
    const unreadCount = lastReadAt
      ? sorted.filter((m) => m.from === 'visitor' && m.at > lastReadAt).length
      : sorted.filter((m) => m.from === 'visitor').length;

    threads.push({
      threadId,
      visitorId: visitorMsg?.visitorId,
      visitorName,
      lastMessage: last.text,
      lastAt: last.at,
      messageCount: sorted.length,
      unreadCount,
      lastFrom: last.from,
    });
  }

  return threads.sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

export function listSalesChatThreads(boothId: string): SalesChatThreadSummary[] {
  return buildSalesChatThreads(boothId, readSalesChatMessages(boothId));
}

export async function loadSalesChatMessagesAsync(
  boothId: string,
  threadId?: string,
): Promise<SalesChatMessageRow[]> {
  const { fetchBoothSalesChatMessages } = await import('./api/client');
  return fetchBoothSalesChatMessages(boothId, threadId);
}

export async function loadSalesChatThreadsAsync(boothId: string): Promise<SalesChatThreadSummary[]> {
  const messages = await loadSalesChatMessagesAsync(boothId);
  return buildSalesChatThreads(boothId, messages);
}

export async function appendSalesChatMessageAsync(
  partial: Omit<SalesChatMessageRow, 'id' | 'at'> & { at?: string },
): Promise<SalesChatMessageRow> {
  const { postSalesChatMessage } = await import('./api/client');
  return (
    (await postSalesChatMessage({
      boothId: partial.boothId,
      threadId: partial.threadId,
      from: partial.from,
      text: partial.text,
      visitorId: partial.visitorId,
      visitorName: partial.visitorName,
      autoReply: partial.autoReply,
    })) ??
    createSalesChatMessage(partial)
  );
}

export function markSalesChatThreadRead(boothId: string, threadId: string): void {
  const all = readReadState();
  const booth = { ...(all[boothId] ?? {}), [threadId]: new Date().toISOString() };
  writeReadState({ ...all, [boothId]: booth });
}

export function hasVisitorMessagesInThread(boothId: string, threadId: string): boolean {
  return readSalesChatMessages(boothId, threadId).some((m) => m.from === 'visitor');
}

export function createSalesChatMessage(
  partial: Omit<SalesChatMessageRow, 'id' | 'at'> & { at?: string },
): SalesChatMessageRow {
  return {
    id: `sc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    at: partial.at ?? new Date().toISOString(),
    ...partial,
  };
}
