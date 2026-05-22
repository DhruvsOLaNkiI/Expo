import { useState, useRef, useEffect, useCallback } from 'react';
import { fetchExpoLiveStats } from '../api/expoStats';
import { DEFAULT_SCENE_CONFIG } from '../data/boothLayouts';
import {
  buildExpoStatsFactsBlock,
  computeCatalogStats,
  tryAnswerExpoStatsQuestion,
  type ExpoLiveStats,
} from '../data/expoStats';
import { useStore } from '../store';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
};

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
  const activeBooth = useStore((s) => s.activeBooth);
  const boothOverrides = useStore((s) => s.boothOverrides);
  const vertexEliteHudAlpha = useStore((s) => s.vertexEliteHudAlpha);
  const vertexEliteHudContext = useStore((s) => s.vertexEliteHudContext);
  const sceneOverrides = useStore((s) => s.sceneOverrides);

  /** Vertex Elite uses screen HUD (not `activeBooth`); treat as in-booth when HUD is visible. */
  const chatBoothId =
    activeBooth ??
    (vertexEliteHudAlpha >= 0.12 && vertexEliteHudContext?.boothId ? vertexEliteHudContext.boothId : null);
  
  const deckContextRaw =
    (import.meta.env.VITE_AI_DECK_CONTEXT || '').trim() ||
    (sceneOverrides.aiDeckContext ?? DEFAULT_SCENE_CONFIG.aiDeckContext ?? '').trim();
  const deckContext =
    deckContextRaw.length > 15000 ? `${deckContextRaw.slice(0, 15000)}\n\n[Context truncated at 15000 characters]` : deckContextRaw;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');
  const [documentType, setDocumentType] = useState<'brochure' | 'priceList' | 'siteLayout' | 'unitLayout'>('brochure');
  /** Booth PDF tree vs general OpenRouter chat (no indexing required). */
  const [usePageIndex, setUsePageIndex] = useState(false);
  const [expoStats, setExpoStats] = useState<ExpoLiveStats | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isExpoConcierge = aiChatContext === 'expo-concierge' && !chatBoothId;

  const loadExpoStats = useCallback(async () => {
    const stats = await fetchExpoLiveStats();
    if (stats) setExpoStats(stats);
    return stats;
  }, []);

  useEffect(() => {
    if (!aiChatOpen || !isExpoConcierge) return;
    void loadExpoStats();
    setUsePageIndex(false);
  }, [aiChatOpen, isExpoConcierge, loadExpoStats]);

  const aiModelLabel =
    (import.meta.env.VITE_OPENROUTER_MODEL || import.meta.env.OPENROUTER_MODEL || 'openrouter/free').trim();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      if (isExpoConcierge) {
        const stats = expoStats ?? (await loadExpoStats());
        if (stats) {
          const quick = tryAnswerExpoStatsQuestion(userMessage.content, stats);
          if (quick) {
            setDebugInfo('📊 Answered from live expo stats');
            setMessages((prev) => [
              ...prev,
              {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: quick.replace(/\*\*/g, ''),
                timestamp: Date.now(),
              },
            ]);
            setLoading(false);
            return;
          }
        }
      }

      // If PageIndex is enabled and we have an active booth, use booth-specific tree
      if (usePageIndex && chatBoothId) {
        setDebugInfo(`📚 Loading ${documentType} tree for ${chatBoothId}...`);
        
        const response = await fetch('/api/pageindex/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: userMessage.content,
            boothId: chatBoothId,
            documentType,
          }),
        });

        const data = (await response.json()) as { ok: boolean; answer?: string; error?: string };
        
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
        setLoading(false);
        return;
      }

      // General chat via server → OpenRouter (OPENROUTER_API_KEY in .env, not exposed to browser)
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

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPrompt,
          messages: chatMessages,
          temperature: deckContext ? 0.35 : 0.65,
          maxOutputTokens,
        }),
      });

      const data = (await response.json()) as { ok: boolean; answer?: string; error?: string; model?: string };
      if (!response.ok || !data.ok) {
        const errorMsg = data.error || `Chat API error (${response.status})`;
        if (errorMsg.includes('OPENROUTER_API_KEY')) {
          throw new Error(
            'OpenRouter is not configured.\n\n1. Get a key: https://openrouter.ai/keys\n2. Add OPENROUTER_API_KEY=sk-or-... to .env\n3. Restart npm run dev',
          );
        }
        throw new Error(errorMsg);
      }

      setDebugInfo(`✅ OpenRouter (${data.model || 'free'})`);

      const replyText = data.answer || 'Sorry, I could not generate a response.';

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: replyText,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
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
              {chatBoothId
                ? `AI · ${formatBoothName(chatBoothId)}`
                : isExpoConcierge
                  ? 'AI · Expo Help Desk'
                  : 'Ask AI Assistant'}
            </h3>
            <p className="text-[10px] text-white/40">
              {usePageIndex ? (
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

      {/* Chat mode: direct AI vs booth PDF (PageIndex) */}
      <div className="px-4 py-2.5 border-b border-white/10 bg-white/[0.03] space-y-2">
        <div className="flex rounded-lg border border-white/10 p-0.5 text-[10px] font-semibold uppercase tracking-wide">
          <button
            type="button"
            onClick={() => setUsePageIndex(false)}
            className={`flex-1 rounded-md px-2 py-1.5 transition-colors ${
              !usePageIndex ? 'bg-[#d4af37] text-black' : 'text-white/45 hover:text-white/70'
            }`}
          >
            💬 Direct AI
          </button>
          <button
            type="button"
            onClick={() => setUsePageIndex(true)}
            disabled={!chatBoothId}
            title={!chatBoothId ? 'Enter a booth to use document Q&A' : undefined}
            className={`flex-1 rounded-md px-2 py-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              usePageIndex ? 'bg-[#d4af37] text-black' : 'text-white/45 hover:text-white/70'
            }`}
          >
            📚 Booth PDF
          </button>
        </div>
        {!usePageIndex && (
          <p className="text-[9px] leading-relaxed text-white/35">
            General AI via OpenRouter — no PDF indexing needed. Answers are not limited to uploaded booth files.
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
            placeholder="Type your question..."
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#d4af37]/50 transition-colors"
            disabled={loading}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="bg-[#d4af37] hover:bg-[#b08d29] disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold px-5 py-2.5 rounded-xl transition-colors text-sm"
          >
            Send
          </button>
        </div>
        <p className="text-[9px] text-white/25 mt-2 text-center">
          {usePageIndex
            ? 'Booth PDF mode · answers from indexed documents only'
            : 'Direct AI mode · OpenRouter (no indexing required)'}
        </p>
      </div>
    </div>
  );
}
