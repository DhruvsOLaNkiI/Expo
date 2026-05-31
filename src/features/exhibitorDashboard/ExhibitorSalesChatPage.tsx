import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, Save, Upload, Users } from 'lucide-react';
import type { AssignedSalesPerson } from '@/features/shared/data/boothLayouts';
import {
  appendSalesChatMessageAsync,
  loadSalesChatMessagesAsync,
  loadSalesChatThreadsAsync,
  markSalesChatThreadRead,
  resolveSalesChatThreadId,
  type SalesChatMessageRow,
  type SalesChatThreadSummary,
} from '@/dashboard/salesChatLocal';
import { ExhibitorChecklistBanner } from './ExhibitorChecklistBanner';
import {
  exhibitorUploadError,
  exhibitorUploadFile,
  useExhibitorPersist,
} from './exhibitorUpload';
import type { ExhibitorNavId } from './exhibitorConfig';
import { useExhibitorBooth } from './useExhibitorBooth';

type Props = { onNav: (id: ExhibitorNavId) => void };

function formatChatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatThreadTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return formatChatTime(iso);
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function threadInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?';
}

export function ExhibitorSalesChatPage({ onNav }: Props) {
  const { booth, boothId, patchBooth, loading } = useExhibitorBooth();
  const persist = useExhibitorPersist(patchBooth);

  const [sales, setSales] = useState<AssignedSalesPerson>({ name: '', email: '', phone: '', photoUrl: '' });
  const [chatDraft, setChatDraft] = useState('');
  const [threads, setThreads] = useState<SalesChatThreadSummary[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [threadMessages, setThreadMessages] = useState<SalesChatMessageRow[]>([]);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!booth) return;
    setSales({
      name: booth.assignedSalesPerson?.name ?? '',
      email: booth.assignedSalesPerson?.email ?? '',
      phone: booth.assignedSalesPerson?.phone ?? '',
      photoUrl: booth.assignedSalesPerson?.photoUrl ?? '',
    });
  }, [booth]);

  const loadThreads = useCallback(() => {
    void loadSalesChatThreadsAsync(boothId).then((next) => {
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

  useEffect(() => {
    loadThreads();
    const onUpdate = () => loadThreads();
    window.addEventListener('vr-expo-sales-chat-updated', onUpdate);
    window.addEventListener('storage', onUpdate);
    const interval = window.setInterval(loadThreads, 3000);
    return () => {
      window.removeEventListener('vr-expo-sales-chat-updated', onUpdate);
      window.removeEventListener('storage', onUpdate);
      window.clearInterval(interval);
    };
  }, [loadThreads]);

  useEffect(() => {
    if (!selectedThreadId) {
      setThreadMessages([]);
      return;
    }
    void loadSalesChatMessagesAsync(boothId, selectedThreadId).then((rows) => {
      setThreadMessages(rows);
    });
    markSalesChatThreadRead(boothId, selectedThreadId);
  }, [boothId, selectedThreadId, threads]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [threadMessages, selectedThreadId]);

  const salesName = sales.name.trim();
  const displayName = salesName || 'Unassigned';
  const salesInitials = useMemo(() => threadInitials(displayName), [displayName]);

  const selectedThread = useMemo(
    () => threads.find((t) => t.threadId === selectedThreadId) ?? null,
    [threads, selectedThreadId],
  );

  const totalUnread = useMemo(
    () => threads.reduce((n, t) => n + t.unreadCount, 0),
    [threads],
  );

  const saveSales = useCallback(async () => {
    if (!salesName) {
      setErrorMsg('Enter the sales person name before saving.');
      return;
    }
    setSaving(true);
    setErrorMsg(null);
    const r = await persist(
      {
        assignedSalesPerson: {
          name: sales.name.trim(),
          email: sales.email.trim(),
          phone: sales.phone.trim(),
          photoUrl: sales.photoUrl?.trim() || undefined,
        },
      },
      'Sales assignment',
    );
    setStatusMsg(r.message);
    if (!r.ok) setErrorMsg(r.message);
    setSaving(false);
  }, [persist, sales, salesName]);

  const sendReply = () => {
    const text = chatDraft.trim();
    if (!text || !salesName || !selectedThreadId) return;

    void appendSalesChatMessageAsync({
      boothId,
      threadId: selectedThreadId,
      from: 'sales',
      text,
    });
    setChatDraft('');
    loadThreads();
  };

  const sendTestVisitorMessage = () => {
    const text = chatDraft.trim();
    if (!text || !salesName) return;

    const testName = `Test visitor ${threads.filter((t) => t.visitorName.startsWith('Test visitor')).length + 1}`;
    const threadId = resolveSalesChatThreadId({ visitorName: testName });

    void appendSalesChatMessageAsync({
      boothId,
      threadId,
      from: 'visitor',
      text,
      visitorName: testName,
    });
    void appendSalesChatMessageAsync({
      boothId,
      threadId,
      from: 'sales',
      text: `Hi! I'm ${salesName}. Thanks for your message — I'll get back to you shortly.${sales.phone.trim() ? ` You can also reach me at ${sales.phone.trim()}.` : ''}`,
      autoReply: true,
    });
    setChatDraft('');
    setSelectedThreadId(threadId);
    loadThreads();
  };

  if (loading || !booth) {
    return <div className="exb-loading">Loading sales chat…</div>;
  }

  return (
    <>
      <ExhibitorChecklistBanner onGo={onNav} filterNav="salesChat" />
      {(statusMsg || errorMsg) && (
        <div className={`exb-toast ${errorMsg ? 'error' : 'ok'}`}>{errorMsg ?? statusMsg}</div>
      )}

      <div className="exb-sales-page">
        <section className="exb-card exb-sales-assign-card">
          <h3>Assign sales person</h3>
          <p className="exb-muted">
            One rep handles all booth chats. Each visitor gets their own private conversation thread.
          </p>

          <div className={`exb-sales-live-badge ${salesName ? 'assigned' : 'empty'}`}>
            <span className="exb-muted">Assigned to booth</span>
            <strong>{displayName}</strong>
          </div>

          <div className="exb-sales-assign">
            <div className="exb-sales-avatar lg">
              {sales.photoUrl ? <img src={sales.photoUrl} alt="" /> : <span>{salesInitials}</span>}
            </div>
            <div className="exb-exhibitor-fields exb-sales-fields">
              <label>
                <span>Name (required)</span>
                <input
                  className="exb-field"
                  value={sales.name}
                  onChange={(e) => setSales({ ...sales, name: e.target.value })}
                  placeholder="e.g. Priya Sharma"
                />
              </label>
              <label>
                <span>Email</span>
                <input
                  className="exb-field"
                  type="email"
                  value={sales.email}
                  onChange={(e) => setSales({ ...sales, email: e.target.value })}
                />
              </label>
              <label>
                <span>Phone / WhatsApp</span>
                <input
                  className="exb-field"
                  value={sales.phone}
                  onChange={(e) => setSales({ ...sales, phone: e.target.value })}
                />
              </label>
              <label className="exb-btn exb-btn-sm">
                <Upload size={14} />
                Photo
                <input
                  type="file"
                  className="exb-hidden-input"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (!f) return;
                    void (async () => {
                      try {
                        const url = await exhibitorUploadFile(f, boothId, 'sales-photo');
                        setSales((s) => ({ ...s, photoUrl: url }));
                      } catch (err) {
                        setErrorMsg(exhibitorUploadError(err));
                      }
                    })();
                  }}
                />
              </label>
            </div>
          </div>

          <button type="button" className="exb-btn exb-btn-primary" disabled={saving} onClick={() => void saveSales()}>
            <Save size={14} />
            Save assignment
          </button>
        </section>

        <section className="exb-card exb-chat-panel exb-chat-page exb-chat-inbox">
          <div className="exb-chat-head">
            <MessageCircle size={18} />
            <div>
              <strong>
                {salesName ? `Inbox · ${salesName}` : 'Assign a sales person to enable chat'}
              </strong>
              <span className="exb-muted">
                {threads.length} active conversation{threads.length === 1 ? '' : 's'}
                {totalUnread > 0 ? ` · ${totalUnread} unread` : ''}
              </span>
            </div>
            <div className="exb-chat-inbox-stat">
              <Users size={14} />
              {threads.length}
            </div>
          </div>

          <div className="exb-chat-inbox-layout">
            <aside className="exb-chat-threads">
              {threads.length === 0 ? (
                <p className="exb-muted exb-chat-empty">
                  No visitor chats yet. Messages from the booth Sales Rep tab appear here — one thread per visitor.
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
                        {t.lastFrom === 'sales' ? 'You: ' : ''}
                        {t.lastMessage}
                      </span>
                    </div>
                    {t.unreadCount > 0 && (
                      <span className="exb-chat-unread">{t.unreadCount}</span>
                    )}
                  </button>
                ))
              )}
            </aside>

            <div className="exb-chat-thread-view">
              {!selectedThread ? (
                <p className="exb-muted exb-chat-empty">
                  Select a visitor conversation to read and reply.
                </p>
              ) : (
                <>
                  <div className="exb-chat-thread-bar">
                    <strong>{selectedThread.visitorName}</strong>
                    <span className="exb-muted">
                      {selectedThread.messageCount} message{selectedThread.messageCount === 1 ? '' : 's'}
                    </span>
                  </div>

                  <div className="exb-chat-messages tall">
                    {threadMessages.map((m) => (
                      <div
                        key={m.id}
                        className={`exb-chat-bubble ${m.from === 'visitor' ? 'you' : 'sales'}`}
                      >
                        {m.from === 'visitor' && (
                          <span className="exb-chat-sender">{selectedThread.visitorName}</span>
                        )}
                        {m.from === 'sales' && salesName && (
                          <span className="exb-chat-sender">
                            {salesName}
                            {m.autoReply ? ' · auto-reply' : ''}
                          </span>
                        )}
                        <span>{m.text}</span>
                        <time>{formatChatTime(m.at)}</time>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>

                  <div className="exb-chat-compose">
                    <input
                      className="exb-field"
                      disabled={!salesName}
                      placeholder={
                        salesName
                          ? `Reply to ${selectedThread.visitorName} as ${salesName}…`
                          : 'Save a sales person name first'
                      }
                      value={chatDraft}
                      onChange={(e) => setChatDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') sendReply();
                      }}
                    />
                    <button
                      type="button"
                      className="exb-btn exb-btn-primary"
                      disabled={!salesName || !chatDraft.trim()}
                      onClick={sendReply}
                    >
                      Reply
                    </button>
                    <button
                      type="button"
                      className="exb-btn"
                      disabled={!salesName || !chatDraft.trim()}
                      onClick={sendTestVisitorMessage}
                      title="Create a new test visitor thread"
                    >
                      Test
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
