import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { fetchExpoLiveStats } from '@/api/expoStats';
import {
  applyBoothOverrides,
  buildDefaultBoothLayoutList,
  DEFAULT_SCENE_CONFIG,
  type AssignedSalesPerson,
} from '@/features/shared/data/boothLayouts';
import {
  buildExpoStatsFactsBlock,
  computeCatalogStats,
  tryAnswerExpoStatsQuestion,
  type ExpoLiveStats,
} from '@/features/shared/data/expoStats';
import { fetchJson, isBackendApiUnavailableError } from '@/api/fetchJson';
import {
  clientOpenRouterChat,
  getClientOpenRouterModel,
  isClientOpenRouterConfigured,
} from '@/api/openRouterClient';
import { useStore } from '@/store';
import { resolveCurrentBoothId } from '@/dashboard/boothVisitTracking';
import {
  appendSalesChatMessageAsync,
  hasVisitorMessagesInThread,
  loadSalesChatMessagesAsync,
  resolveSalesChatThreadId,
} from '@/dashboard/salesChatLocal';
import {
  appendAiChatMessageAsync,
  resolveAiChatThreadId,
} from '@/dashboard/aiChatLocal';
import { getAnalyticsSessionId } from '@/dashboard/api/client';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
};

type SalesMessage = {
  id: string;
  from: 'visitor' | 'sales';
  content: string;
  timestamp: number;
};

type ChatMode = 'ai' | 'pdf' | 'sales';

function formatBoothName(boothId: string): string {
  return boothId
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function AiChatbox() {
  const aiChatOpen = useStore((s) => s.aiChatOpen);
  const setAiChatOpen = useStore((s) => s.setAiChatOpen);
  const aiChatContext = useStore((s) => s.aiChatContext);
  const aiChatBoothId = useStore((s) => s.aiChatBoothId);
  const activeBooth = useStore((s) => s.activeBooth);
  const boothOverrides = useStore((s) => s.boothOverrides);
  const boothHudReports = useStore((s) => s._boothHudReports);
  const vertexEliteHudAlpha = useStore((s) => s.vertexEliteHudAlpha);
  const vertexEliteHudContext = useStore((s) => s.vertexEliteHudContext);
  const sceneOverrides = useStore((s) => s.sceneOverrides);
  const syncBoothOverridesFromPersistence = useStore((s) => s.syncBoothOverridesFromPersistence);
  const initBoothCms = useStore((s) => s.initBoothCms);
  const visitorId = useStore((s) => s.visitorProfile?.id);
  const visitorName = useStore((s) => s.visitorProfile?.displayName);

  const chatBoothId = useMemo(() => {
    if (aiChatBoothId) return aiChatBoothId;
    if (activeBooth) return activeBooth;
    const fromProximity = resolveCurrentBoothId({
      activeBooth,
      _boothHudReports: boothHudReports,
      vertexEliteHudContext,
      vertexEliteHudAlpha,
    } as ReturnType<typeof useStore.getState>);
    if (fromProximity) return fromProximity;
    if (vertexEliteHudContext?.boothId && vertexEliteHudAlpha >= 0.04) {
      return vertexEliteHudContext.boothId;
    }
    return null;
  }, [
    aiChatBoothId,
    activeBooth,
    boothHudReports,
    vertexEliteHudContext,
    vertexEliteHudAlpha,
  ]);
  
  const deckContextRaw =
    (import.meta.env.VITE_AI_DECK_CONTEXT || '').trim() ||
    (sceneOverrides.aiDeckContext ?? DEFAULT_SCENE_CONFIG.aiDeckContext ?? '').trim();
  const deckContext =
    deckContextRaw.length > 15000 ? `${deckContextRaw.slice(0, 15000)}\n\n[Context truncated at 15000 characters]` : deckContextRaw;

  const [messages, setMessages] = useState<Message[]>([]);
  const [salesMessages, setSalesMessages] = useState<SalesMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');
  const [documentType, setDocumentType] = useState<'brochure' | 'priceList' | 'siteLayout' | 'unitLayout'>('brochure');
  const [chatMode, setChatMode] = useState<ChatMode>('ai');
  const [expoStats, setExpoStats] = useState<ExpoLiveStats | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wasOpenRef = useRef(false);

  const salesPerson = useMemo((): AssignedSalesPerson | null => {
    const merged = applyBoothOverrides(buildDefaultBoothLayoutList(), boothOverrides);
    const pick = (boothId: string): AssignedSalesPerson | null => {
      const booth = merged.find((b) => b.id === boothId);
      const name = booth?.assignedSalesPerson?.name?.trim();
      if (!name) return null;
      return {
        name,
        email: booth?.assignedSalesPerson?.email?.trim() ?? '',
        phone: booth?.assignedSalesPerson?.phone?.trim() ?? '',
        photoUrl: booth?.assignedSalesPerson?.photoUrl?.trim() || undefined,
      };
    };

    const lookupId = chatBoothId ?? aiChatBoothId;
    if (lookupId) {
      const hit = pick(lookupId);
      if (hit) return hit;
    }

    const assigned = merged.filter((b) => b.assignedSalesPerson?.name?.trim());
    if (assigned.length === 1) {
      return pick(assigned[0]!.id);
    }
    return null;
  }, [chatBoothId, aiChatBoothId, boothOverrides]);

  const salesInitials = useMemo(() => {
    if (!salesPerson?.name) return '?';
    return salesPerson.name
      .split(/\s+/)
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }, [salesPerson?.name]);

  const isExpoConcierge = aiChatContext === 'expo-concierge' && !chatBoothId;
  const usePageIndex = chatMode === 'pdf';
  const isSalesMode = chatMode === 'sales';

  const salesThreadId = useMemo(
    () =>
      resolveSalesChatThreadId({
        visitorId,
        sessionId: getAnalyticsSessionId(visitorId),
        visitorName,
      }),
    [visitorId, visitorName],
  );

  const aiChatThreadId = useMemo(
    () =>
      resolveAiChatThreadId({
        visitorId,
        sessionId: getAnalyticsSessionId(visitorId),
        visitorName,
      }),
    [visitorId, visitorName],
  );

  const recordAiChatMessage = useCallback(
    (role: 'user' | 'assistant', text: string) => {
      if (!chatBoothId || isSalesMode) return;
      void appendAiChatMessageAsync({
        boothId: chatBoothId,
        threadId: aiChatThreadId,
        role,
        text,
        visitorId,
        visitorName,
      });
    },
    [chatBoothId, isSalesMode, aiChatThreadId, visitorId, visitorName],
  );

  const loadExpoStats = useCallback(async () => {
    const stats = await fetchExpoLiveStats();
    if (stats) setExpoStats(stats);
    return stats;
  }, []);

  useEffect(() => {
    if (!aiChatOpen) return;
    void initBoothCms();
    void syncBoothOverridesFromPersistence();
  }, [aiChatOpen, initBoothCms, syncBoothOverridesFromPersistence]);

  useEffect(() => {
    if (!aiChatOpen || !isExpoConcierge) return;
    void loadExpoStats();
    setChatMode('ai');
  }, [aiChatOpen, isExpoConcierge, loadExpoStats]);

  useEffect(() => {
    if (aiChatOpen && !wasOpenRef.current && salesPerson?.name) {
      setChatMode('sales');
    }
    wasOpenRef.current = aiChatOpen;
  }, [aiChatOpen, salesPerson?.name]);

  useEffect(() => {
    const boothId = chatBoothId ?? aiChatBoothId;
    if (!aiChatOpen || !isSalesMode || !boothId) return;

    let cancelled = false;
    const sync = () => {
      void loadSalesChatMessagesAsync(boothId, salesThreadId).then((rows) => {
        if (cancelled) return;
        setSalesMessages(
          rows.map((m) => ({
            id: m.id,
            from: m.from,
            content: m.text,
            timestamp: new Date(m.at).getTime(),
          })),
        );
      });
    };

    sync();
    window.addEventListener('vr-expo-sales-chat-updated', sync);
    window.addEventListener('storage', sync);
    const interval = window.setInterval(sync, 5000);
    return () => {
      cancelled = true;
      window.removeEventListener('vr-expo-sales-chat-updated', sync);
      window.removeEventListener('storage', sync);
      window.clearInterval(interval);
    };
  }, [aiChatOpen, isSalesMode, chatBoothId, aiChatBoothId, salesThreadId]);

  const aiModelLabel =
    (import.meta.env.VITE_OPENROUTER_MODEL || import.meta.env.OPENROUTER_MODEL || 'openrouter/free').trim();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, salesMessages, chatMode]);

  const sendSalesMessage = () => {
    const text = input.trim();
    if (!text || loading || !salesPerson?.name) return;

    const boothId = chatBoothId ?? aiChatBoothId;
    if (!boothId) {
      setDebugInfo('Walk into your booth to send a sales message');
      return;
    }

    const now = Date.now();
    const rep = salesPerson.name;
    const isFirstMessage = !hasVisitorMessagesInThread(boothId, salesThreadId);
    const visitorMsg: SalesMessage = {
      id: `${now}-v`,
      from: 'visitor',
      content: text,
      timestamp: now,
    };

    void appendSalesChatMessageAsync({
      boothId,
      threadId: salesThreadId,
      from: 'visitor',
      text,
      visitorId,
      visitorName,
    });

    const nextMessages: SalesMessage[] = [visitorMsg];

    if (isFirstMessage) {
      const salesMsg: SalesMessage = {
        id: `${now}-s`,
        from: 'sales',
        content: `Hi! I'm ${rep}. Thanks for reaching out — I'll get back to you shortly.${salesPerson.phone ? ` You can also call me at ${salesPerson.phone}.` : ''}`,
        timestamp: now + 1,
      };
      void appendSalesChatMessageAsync({
        boothId,
        threadId: salesThreadId,
        from: 'sales',
        text: salesMsg.content,
        autoReply: true,
      });
      nextMessages.push(salesMsg);
    }

    setSalesMessages((prev) => [...prev, ...nextMessages]);
    setInput('');
    setDebugInfo(`✅ Message sent to ${rep}`);
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    if (isSalesMode) {
      sendSalesMessage();
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    recordAiChatMessage('user', userMessage.content);
    setInput('');
    setLoading(true);

    try {
      if (isExpoConcierge) {
        const stats = expoStats ?? (await loadExpoStats());
        if (stats) {
          const quick = tryAnswerExpoStatsQuestion(userMessage.content, stats);
          if (quick) {
            setDebugInfo('📊 Answered from live expo stats');
            const reply = quick.replace(/\*\*/g, '');
            setMessages((prev) => [
              ...prev,
              {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: reply,
                timestamp: Date.now(),
              },
            ]);
            recordAiChatMessage('assistant', reply);
            setLoading(false);
            return;
          }
        }
      }

      // If PageIndex is enabled and we have an active booth, use booth-specific tree
      if (usePageIndex && chatBoothId) {
        setDebugInfo(`📚 Loading ${documentType} tree for ${chatBoothId}...`);
        
        const { response, data } = await fetchJson<{ ok: boolean; answer?: string; error?: string }>(
          '/api/pageindex/ask',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              question: userMessage.content,
              boothId: chatBoothId,
              documentType,
            }),
          },
        );
        
        if (!response.ok || !data.ok) {
          const errorMsg = data.error || `Failed to get answer from PageIndex (${response.status})`;
          
          // If document not indexed yet, show helpful message
          if (errorMsg.includes('not found') || errorMsg.includes('No tree')) {
            const docLabel = documentType === 'priceList' ? 'price list' : documentType;
            throw new Error(
              `This booth's ${docLabel} is not indexed yet (upload alone is not enough for Chat).\n\n` +
              `In CMS → Media:\n` +
              `1. Confirm the PDF URL is saved\n` +
              `2. Click "Run PageIndex on current PDF"\n` +
              `3. Wait for ✓ Indexed\n\n` +
              `To view the file in the expo (no index needed): use the Price list button on the booth.`
            );
          }
          
          throw new Error(errorMsg);
        }

        setDebugInfo(`✅ Answered from ${chatBoothId} ${documentType}`);

        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.answer || 'No answer available.',
          timestamp: Date.now(),
        };

        setMessages((prev) => [...prev, assistantMessage]);
        recordAiChatMessage('assistant', assistantMessage.content);
        setLoading(false);
        return;
      }

      // General chat via server → OpenRouter
      setDebugInfo('🤖 Asking OpenRouter (free models)…');

      const envMaxRaw = import.meta.env.VITE_GEMINI_MAX_OUTPUT_TOKENS;
      const envMax = envMaxRaw != null && envMaxRaw !== '' ? Number.parseInt(String(envMaxRaw), 10) : NaN;
      const maxOutputTokens =
        Number.isFinite(envMax) && envMax >= 128 && envMax <= 8192
          ? envMax
          : deckContext
            ? 1024
            : 512;

      const baseBrevity =
        'Keep replies readable and concise — no long brochures. ' +
        'Always end on a complete sentence with full numbers and units when you quote specs (sq ft, carpet area, price). Never stop mid-phrase.';

      const deckStyle =
        'Use ONLY the deck facts for numbers and specs. When the document states built-up / carpet / saleable area or price, repeat the exact figures and units in full. ' +
        'If one answer needs several facts, you may use up to 8 short bullet lines or about 8 sentences — still no multi-page essays.';

      const boothLine = chatBoothId
        ? `The visitor is at the "${formatBoothName(chatBoothId)}" booth. You may use general real-estate knowledge; do not claim specific prices or specs unless you are certain.`
        : '';

      const expoFactsBlock = isExpoConcierge
        ? buildExpoStatsFactsBlock(
            expoStats ?? {
              ...computeCatalogStats(boothOverrides),
              visitorsTotal: null,
              visitorsRegisteredToday: null,
              visitorsCheckedInToday: null,
              statsAsOf: new Date().toISOString(),
              mongoConnected: false,
            },
          )
        : '';

      const systemPrompt = deckContext
        ? [
            'You are the on-site AI assistant for ONE showcase deck at a luxury residential expo.',
            boothLine,
            '',
            'AUTHORITATIVE FACTS — the ONLY source of truth for product, project, pricing, and policy details (do not invent or guess beyond this):',
            '---',
            deckContext,
            '---',
            '',
            'RULES:',
            '- Answer using ONLY the facts above, plus brief pleasantries (greetings, thanks).',
            '- If the facts do not mention something, say you do not have that detail on this deck and suggest they speak with on-site staff or use booth materials.',
            '- Never invent pricing, legal advice, other developments, or competitor names.',
            `- ${deckStyle}`,
            `- ${baseBrevity}`,
          ]
            .filter(Boolean)
            .join('\n')
        : isExpoConcierge
          ? [
              'You are the Smart Help Desk AI concierge for the Virtual Property Expo (Noida).',
              'Use ONLY the live statistics below for how many developers, projects, and visitor registrations exist.',
              'Do not invent counts. Developers = exhibitor brands/booths, not software engineers.',
              '---',
              expoFactsBlock,
              '---',
              'For brochures, pricing, and floor plans, direct the visitor to a specific developer booth or the Smart Help Desk panel.',
              baseBrevity,
            ]
              .filter(Boolean)
              .join('\n')
          : [
              'You are a helpful real estate assistant at a luxury residential property expo.',
              boothLine,
              'Answer clearly and helpfully. For exact pricing or legal details, suggest booth staff or official brochures.',
              baseBrevity,
            ]
              .filter(Boolean)
              .join(' ');

      const chatMessages = [
        ...messages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
        { role: 'user' as const, content: userMessage.content },
      ];

      const orMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [];
      if (systemPrompt.trim()) orMessages.push({ role: 'system', content: systemPrompt.trim() });
      for (const m of chatMessages) {
        if (m.content?.trim()) orMessages.push({ role: m.role, content: m.content });
      }

      let replyText: string;
      let modelLabel: string;

      try {
        const { response, data } = await fetchJson<{
          ok: boolean;
          answer?: string;
          error?: string;
          model?: string;
        }>('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemPrompt,
            messages: chatMessages,
            temperature: deckContext ? 0.35 : 0.65,
            maxOutputTokens,
          }),
        });
        if (!response.ok || !data.ok) {
          const errorMsg = data.error || `Chat API error (${response.status})`;
          if (errorMsg.includes('OPENROUTER_API_KEY')) {
            throw new Error(
              'OpenRouter is not configured on the server.\n\nAdd OPENROUTER_API_KEY to .env and run npm run start:prod — or set VITE_OPENROUTER_API_KEY before npm run build for static hosting.',
            );
          }
          throw new Error(errorMsg);
        }
        replyText = data.answer || 'Sorry, I could not generate a response.';
        modelLabel = data.model || 'openrouter/free';
        setDebugInfo(`✅ OpenRouter server (${modelLabel})`);
      } catch (apiErr) {
        const apiMsg = apiErr instanceof Error ? apiErr.message : String(apiErr);
        if (!isBackendApiUnavailableError(apiMsg) || !isClientOpenRouterConfigured()) {
          throw apiErr;
        }
        setDebugInfo('🌐 OpenRouter browser fallback (static host — no /api/chat)…');
        replyText = await clientOpenRouterChat({
          messages: orMessages,
          temperature: deckContext ? 0.35 : 0.65,
          maxTokens: maxOutputTokens,
        });
        modelLabel = `${getClientOpenRouterModel()} (browser)`;
        setDebugInfo(`✅ ${modelLabel}`);
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: replyText,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      recordAiChatMessage('assistant', assistantMessage.content);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to connect to AI service. Please check your API key.';
      setDebugInfo(`❌ ${errorMsg}`);
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Error: ${errorMsg}`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      recordAiChatMessage('assistant', errorMessage.content);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!aiChatOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col w-[400px] h-[600px] bg-[#1a1a22]/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-[#d4af37]/20">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#d4af37] to-[#b08d29] flex items-center justify-center">
            <span className="text-lg">🤖</span>
          </div>
          <div>
            <h3 className="font-bold text-white text-sm">
              {isSalesMode && salesPerson?.name
                ? `Chat · ${salesPerson.name}`
                : chatBoothId
                  ? `AI · ${formatBoothName(chatBoothId)}`
                  : isExpoConcierge
                    ? 'AI · Expo Help Desk'
                    : 'Ask AI Assistant'}
            </h3>
            <p className="text-[10px] text-white/40">
              {isSalesMode ? (
                <>👤 Direct chat with sales rep</>
              ) : usePageIndex ? (
                <>📚 Booth documents (PageIndex)</>
              ) : (
                <>💬 Direct chat · {aiModelLabel}</>
              )}
            </p>
          </div>
        </div>
        <button
          onClick={() => setAiChatOpen(false)}
          className="text-white/50 hover:text-white transition-colors p-1"
        >
          ✕
        </button>
      </div>

      {/* Chat mode: direct AI vs booth PDF vs sales rep */}
      <div className="px-4 py-2.5 border-b border-white/10 bg-white/[0.03] space-y-2">
        <div className="flex rounded-lg border border-white/10 p-0.5 text-[9px] font-semibold uppercase tracking-wide">
          <button
            type="button"
            onClick={() => setChatMode('ai')}
            className={`flex-1 rounded-md px-1.5 py-1.5 transition-colors ${
              chatMode === 'ai' ? 'bg-[#d4af37] text-black' : 'text-white/45 hover:text-white/70'
            }`}
          >
            💬 Direct AI
          </button>
          <button
            type="button"
            onClick={() => setChatMode('pdf')}
            disabled={!chatBoothId}
            title={!chatBoothId ? 'Enter a booth to use document Q&A' : undefined}
            className={`flex-1 rounded-md px-1.5 py-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              chatMode === 'pdf' ? 'bg-[#d4af37] text-black' : 'text-white/45 hover:text-white/70'
            }`}
          >
            📚 Booth PDF
          </button>
          <button
            type="button"
            onClick={() => setChatMode('sales')}
            disabled={!salesPerson?.name}
            title={
              !salesPerson?.name
                ? 'Assign a sales person in Exhibitor Dashboard → Sales Chat, then Save'
                : `Chat with ${salesPerson.name}`
            }
            className={`flex-1 rounded-md px-1.5 py-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              chatMode === 'sales' ? 'bg-[#d4af37] text-black' : 'text-white/45 hover:text-white/70'
            }`}
          >
            👤 Sales Rep
          </button>
        </div>
        {isSalesMode && salesPerson && (
          <div className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-black/20 px-3 py-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#d4af37] to-[#b08d29] text-[11px] font-bold text-black">
              {salesPerson.photoUrl ? (
                <img src={salesPerson.photoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                salesInitials
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-semibold text-white">{salesPerson.name}</p>
              <p className="truncate text-[9px] text-white/40">
                {[salesPerson.email, salesPerson.phone].filter(Boolean).join(' · ') ||
                  'Sales representative'}
              </p>
            </div>
          </div>
        )}
        {chatMode === 'ai' && (
          <p className="text-[9px] leading-relaxed text-white/35">
            General AI via OpenRouter — no PDF indexing needed. Answers are not limited to uploaded booth files.
          </p>
        )}
        {isSalesMode && !salesPerson?.name && (
          <p className="text-[9px] text-amber-200/80">
            No sales person assigned for this booth yet. Exhibitor can set one under Sales Chat in the dashboard.
          </p>
        )}
        {usePageIndex && chatBoothId && (
          <label className="flex items-center gap-2 text-[10px] text-white/50">
            <span>Document:</span>
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value as typeof documentType)}
              className="flex-1 bg-black/30 border border-white/10 rounded px-2 py-1 text-white text-[10px]"
            >
              <option value="brochure">📄 Brochure</option>
              <option value="priceList">💰 Price List</option>
              <option value="siteLayout">🗺️ Site Layout</option>
              <option value="unitLayout">🏠 Unit Layout</option>
            </select>
          </label>
        )}
        {usePageIndex && !chatBoothId && (
          <p className="text-[9px] text-amber-200/80">Walk into a booth to ask from its indexed PDFs.</p>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isSalesMode ? (
          <>
            {salesMessages.length === 0 && (
              <div className="text-center py-12">
                <div className="text-4xl mb-3">👤</div>
                <p className="text-white/40 text-sm">
                  {salesPerson?.name
                    ? `Send a message directly to ${salesPerson.name}. They'll respond as soon as possible.`
                    : 'Assign a sales person in the exhibitor dashboard to enable this chat.'}
                </p>
                {salesPerson?.name && (
                  <div className="mt-4 space-y-2">
                    <button
                      type="button"
                      onClick={() => setInput('Hi, I would like more information about your project.')}
                      className="block w-full text-left px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white/60 transition-colors"
                    >
                      Hi, I would like more information about your project.
                    </button>
                    <button
                      type="button"
                      onClick={() => setInput('Can we schedule a call to discuss pricing?')}
                      className="block w-full text-left px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white/60 transition-colors"
                    >
                      Can we schedule a call to discuss pricing?
                    </button>
                    <button
                      type="button"
                      onClick={() => setInput('What unit types are available right now?')}
                      className="block w-full text-left px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white/60 transition-colors"
                    >
                      What unit types are available right now?
                    </button>
                  </div>
                )}
              </div>
            )}
            {salesMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.from === 'visitor' ? 'justify-end' : 'justify-start gap-2'}`}
              >
                {msg.from === 'sales' && (
                  <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#d4af37] to-[#b08d29] text-[9px] font-bold text-black">
                    {salesPerson?.photoUrl ? (
                      <img src={salesPerson.photoUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      salesInitials
                    )}
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                    msg.from === 'visitor'
                      ? 'bg-[#d4af37] text-black'
                      : 'bg-white/10 text-white'
                  }`}
                >
                  {msg.from === 'sales' && (
                    <span className="mb-1 block text-[9px] font-semibold text-[#d4af37]">
                      {salesPerson?.name ?? 'Sales'}
                    </span>
                  )}
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  <span className="text-[9px] opacity-50 mt-1 block">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
          </>
        ) : (
          <>
        {!chatBoothId && usePageIndex && (
          <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-center">
            <p className="text-xs text-amber-100/90 leading-relaxed">
              <strong>No booth selected.</strong><br />
              Walk into a booth first, then open Chat to ask about that booth's documents.
            </p>
          </div>
        )}
        {messages.length === 0 && (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">💬</div>
            <p className="text-white/40 text-sm">
              {usePageIndex ? (
                <>Ask about this booth&apos;s {documentType} — answers from indexed PDFs only.</>
              ) : (
                <>Direct AI chat — ask anything. No PageIndex or PDF upload required.</>
              )}
            </p>
            <div className="mt-4 space-y-2">
              {usePageIndex ? (
                <>
                  <button
                    onClick={() => setInput('What is mentioned in this document?')}
                    className="block w-full text-left px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white/60 transition-colors"
                  >
                    What is mentioned in this document?
                  </button>
                  <button
                    onClick={() => setInput('Tell me about pricing')}
                    className="block w-full text-left px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white/60 transition-colors"
                  >
                    Tell me about pricing
                  </button>
                  <button
                    onClick={() => setInput('What are the key features?')}
                    className="block w-full text-left px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white/60 transition-colors"
                  >
                    What are the key features?
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setInput('What properties are available?')}
                    className="block w-full text-left px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white/60 transition-colors"
                  >
                    What properties are available?
                  </button>
                  <button
                    onClick={() => setInput('Tell me about Vertex Elite')}
                    className="block w-full text-left px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white/60 transition-colors"
                  >
                    Tell me about Vertex Elite
                  </button>
                  <button
                    onClick={() => setInput('What are the payment options?')}
                    className="block w-full text-left px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white/60 transition-colors"
                  >
                    What are the payment options?
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                msg.role === 'user'
                  ? 'bg-[#d4af37] text-black'
                  : 'bg-white/10 text-white'
              }`}
            >
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              <span className="text-[9px] opacity-50 mt-1 block">
                {new Date(msg.timestamp).toLocaleTimeString()}
              </span>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white/10 rounded-2xl px-4 py-2.5">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-white/10">
        {debugInfo && (
          <div className="mb-2 p-2 bg-white/5 border border-white/10 rounded text-[9px] text-white/60 font-mono">
            {debugInfo}
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={
              isSalesMode
                ? salesPerson?.name
                  ? `Message ${salesPerson.name}…`
                  : 'Assign a sales person first'
                : 'Type your question...'
            }
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#d4af37]/50 transition-colors"
            disabled={loading || (isSalesMode && !salesPerson?.name)}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim() || (isSalesMode && !salesPerson?.name)}
            className="bg-[#d4af37] hover:bg-[#b08d29] disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold px-5 py-2.5 rounded-xl transition-colors text-sm"
          >
            Send
          </button>
        </div>
        <p className="text-[9px] text-white/25 mt-2 text-center">
          {isSalesMode
            ? 'Direct sales chat · messages go to your assigned rep'
            : usePageIndex
              ? 'Booth PDF mode · answers from indexed documents only'
              : 'Direct AI mode · OpenRouter (no indexing required)'}
        </p>
      </div>
    </div>
  );
}
