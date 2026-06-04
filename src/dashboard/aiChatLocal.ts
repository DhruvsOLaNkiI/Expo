import { resolveSalesChatThreadId } from './salesChatLocal';

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

export type AiChatThreadSummary = {
  threadId: string;
  visitorId?: string;
  visitorName: string;
  lastMessage: string;
  lastAt: string;
  messageCount: number;
  lastFrom: 'user' | 'assistant';
};

const LS_KEY = 'vr-expo-ai-chat';

function readAll(): Record<string, AiChatMessageRow[]> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, AiChatMessageRow[]>)
      : {};
  } catch {
    return {};
  }
}

function writeAll(data: Record<string, AiChatMessageRow[]>): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent('vr-expo-ai-chat-updated'));
  } catch {
    /* ignore quota */
  }
}

export function appendAiChatMessage(row: AiChatMessageRow): void {
  const all = readAll();
  const list = all[row.boothId] ?? [];
  all[row.boothId] = [...list, row].slice(-1000);
  writeAll(all);
}

export function readAiChatMessages(boothId: string, threadId?: string): AiChatMessageRow[] {
  const list = readAll()[boothId] ?? [];
  const filtered = threadId ? list.filter((m) => m.threadId === threadId) : list;
  return filtered.sort((a, b) => a.at.localeCompare(b.at));
}

export function buildAiChatThreads(boothId: string, messages: AiChatMessageRow[]): AiChatThreadSummary[] {
  const byThread = new Map<string, AiChatMessageRow[]>();
  for (const m of messages) {
    const arr = byThread.get(m.threadId) ?? [];
    arr.push(m);
    byThread.set(m.threadId, arr);
  }

  const threads: AiChatThreadSummary[] = [];
  for (const [threadId, msgs] of byThread) {
    const sorted = [...msgs].sort((a, b) => a.at.localeCompare(b.at));
    const last = sorted[sorted.length - 1]!;
    const visitorMsg = sorted.find((m) => m.role === 'user');
    const visitorName =
      visitorMsg?.visitorName?.trim() ||
      sorted.find((m) => m.visitorName)?.visitorName?.trim() ||
      'Visitor';

    threads.push({
      threadId,
      visitorId: visitorMsg?.visitorId,
      visitorName,
      lastMessage: last.text,
      lastAt: last.at,
      messageCount: sorted.length,
      lastFrom: last.role,
    });
  }

  return threads.sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

export function createAiChatMessage(
  partial: Omit<AiChatMessageRow, 'id' | 'at'> & { at?: string },
): AiChatMessageRow {
  return {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: partial.at ?? new Date().toISOString(),
    ...partial,
  };
}

export async function loadAiChatMessagesAsync(
  boothId: string,
  threadId?: string,
): Promise<AiChatMessageRow[]> {
  const { fetchBoothAiChatMessages } = await import('./api/client');
  return fetchBoothAiChatMessages(boothId, threadId);
}

export async function loadAiChatThreadsAsync(boothId: string): Promise<AiChatThreadSummary[]> {
  const messages = await loadAiChatMessagesAsync(boothId);
  return buildAiChatThreads(boothId, messages);
}

export async function appendAiChatMessageAsync(
  partial: Omit<AiChatMessageRow, 'id' | 'at'> & { at?: string },
): Promise<AiChatMessageRow> {
  const { postAiChatMessage } = await import('./api/client');
  return (
    (await postAiChatMessage({
      boothId: partial.boothId,
      threadId: partial.threadId,
      role: partial.role,
      text: partial.text,
      visitorId: partial.visitorId,
      visitorName: partial.visitorName,
    })) ?? createAiChatMessage(partial)
  );
}

export { resolveSalesChatThreadId as resolveAiChatThreadId };
