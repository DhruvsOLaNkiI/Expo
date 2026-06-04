import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bot, MessageCircle, RefreshCw } from 'lucide-react';
import {
  loadAiChatMessagesAsync,
  loadAiChatThreadsAsync,
  type AiChatMessageRow,
  type AiChatThreadSummary,
} from '@/dashboard/aiChatLocal';
import { useExhibitorBooth } from './useExhibitorBooth';
import type { ExhibitorNavId } from './exhibitorConfig';

type Props = { onNav: (id: ExhibitorNavId) => void };

function formatChatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatThreadTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return formatChatTime(iso);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function threadInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?';
}

export function ExhibitorAssistanceHistoryPage({ onNav: _onNav }: Props) {
  const { boothId, loading } = useExhibitorBooth();
  const [threads, setThreads] = useState<AiChatThreadSummary[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [threadMessages, setThreadMessages] = useState<AiChatMessageRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadThreads = useCallback(() => {
    void loadAiChatThreadsAsync(boothId).then((next) => {
      setThreads(next);
      if (next.length === 0) {
        setSelectedThreadId(null);
        setThreadMessages([]);
        return;
      }
      setSelectedThreadId((prev) => {
        if (prev && next.some((t) => t.threadId === prev)) return prev;
        return next[0]!.threadId;
      });
    });
  }, [boothId]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    loadThreads();
    window.setTimeout(() => setRefreshing(false), 400);
  }, [loadThreads]);

  useEffect(() => {
    loadThreads();
    const onUpdate = () => loadThreads();
    window.addEventListener('vr-expo-ai-chat-updated', onUpdate);
    window.addEventListener('storage', onUpdate);
    const interval = window.setInterval(loadThreads, 15_000);
    return () => {
      window.removeEventListener('vr-expo-ai-chat-updated', onUpdate);
      window.removeEventListener('storage', onUpdate);
      window.clearInterval(interval);
    };
  }, [loadThreads]);

  useEffect(() => {
    if (!selectedThreadId) {
      setThreadMessages([]);
      return;
    }
    void loadAiChatMessagesAsync(boothId, selectedThreadId).then(setThreadMessages);
  }, [boothId, selectedThreadId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [threadMessages, selectedThreadId]);

  const selectedThread = useMemo(
    () => threads.find((t) => t.threadId === selectedThreadId) ?? null,
    [threads, selectedThreadId],
  );

  const totalMessages = useMemo(
    () => threads.reduce((sum, t) => sum + t.messageCount, 0),
    [threads],
  );

  if (loading) {
    return <div className="exb-loading">Loading assistance history…</div>;
  }

  return (
    <section className="exb-card exb-chat-panel exb-chat-page exb-chat-inbox exb-assistance-page">
      <div className="exb-chat-head">
        <Bot size={18} />
        <div>
          <strong>AI assistance history</strong>
          <span className="exb-muted">
            {threads.length} visitor conversation{threads.length === 1 ? '' : 's'} · {totalMessages} message
            {totalMessages === 1 ? '' : 's'}
          </span>
        </div>
        <button type="button" className="exb-btn exb-btn-sm" disabled={refreshing} onClick={refresh}>
          <RefreshCw size={14} className={refreshing ? 'exb-spin' : undefined} />
          Refresh
        </button>
      </div>

      <div className="exb-chat-inbox-layout">
        <aside className="exb-chat-threads">
          {threads.length === 0 ? (
            <p className="exb-muted exb-chat-empty">
              No AI chats yet. When visitors use the booth AI assistant, their questions and answers appear here — one
              thread per visitor.
            </p>
          ) : (
            threads.map((t) => (
              <button
                key={t.threadId}
                type="button"
                className={`exb-chat-thread ${selectedThreadId === t.threadId ? 'active' : ''}`}
                onClick={() => setSelectedThreadId(t.threadId)}
              >
                <div className="exb-chat-thread-avatar">{threadInitials(t.visitorName)}</div>
                <div className="exb-chat-thread-body">
                  <div className="exb-chat-thread-top">
                    <strong>{t.visitorName}</strong>
                    <time>{formatThreadTime(t.lastAt)}</time>
                  </div>
                  <span className="exb-chat-thread-preview">
                    {t.lastFrom === 'assistant' ? 'AI: ' : ''}
                    {t.lastMessage.length > 72 ? `${t.lastMessage.slice(0, 72)}…` : t.lastMessage}
                  </span>
                </div>
                <span className="exb-chat-inbox-stat">{t.messageCount}</span>
              </button>
            ))
          )}
        </aside>

        <div className="exb-chat-thread-view">
          {!selectedThread ? (
            <div className="exb-assistance-empty">
              <MessageCircle size={32} strokeWidth={1.5} />
              <p>Select a conversation to read the full chat between the visitor and your booth AI.</p>
            </div>
          ) : (
            <>
              <div className="exb-chat-thread-bar">
                <strong>{selectedThread.visitorName}</strong>
                <span className="exb-muted">
                  {selectedThread.messageCount} message{selectedThread.messageCount === 1 ? '' : 's'} · started{' '}
                  {formatThreadTime(threadMessages[0]?.at ?? selectedThread.lastAt)}
                </span>
              </div>

              <div className="exb-chat-messages tall">
                {threadMessages.map((m) => (
                  <div
                    key={m.id}
                    className={`exb-chat-bubble ${m.role === 'user' ? 'you' : 'ai'}`}
                  >
                    <span className="exb-chat-sender">
                      {m.role === 'user' ? selectedThread.visitorName : 'AI Assistant'}
                    </span>
                    <span>{m.text}</span>
                    <time>{formatChatTime(m.at)}</time>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
