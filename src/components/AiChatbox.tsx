import { useState, useRef, useEffect } from 'react';
import { useStore } from '../store';
import { DEFAULT_SCENE_CONFIG } from '../data/boothLayouts';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
};

export function AiChatbox() {
  const aiChatOpen = useStore((s) => s.aiChatOpen);
  const setAiChatOpen = useStore((s) => s.setAiChatOpen);
  const sceneOverrides = useStore((s) => s.sceneOverrides);
  
  // Use environment variable first, then fall back to CMS config
  const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || sceneOverrides.aiApiKey || DEFAULT_SCENE_CONFIG.aiApiKey;
  const deckContextRaw =
    (import.meta.env.VITE_AI_DECK_CONTEXT || '').trim() ||
    (sceneOverrides.aiDeckContext ?? DEFAULT_SCENE_CONFIG.aiDeckContext ?? '').trim();
  const deckContext =
    deckContextRaw.length > 15000 ? `${deckContextRaw.slice(0, 15000)}\n\n[Context truncated at 15000 characters]` : deckContextRaw;

  const resolvedModel = (
    (import.meta.env.VITE_GEMINI_MODEL || '').trim() ||
    (sceneOverrides.aiGeminiModel ?? DEFAULT_SCENE_CONFIG.aiGeminiModel ?? 'gemini-3.1-flash-lite-preview').trim()
  );

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    
    if (!apiKey?.trim()) {
      setDebugInfo('❌ No API key found. Add VITE_GEMINI_API_KEY to your .env file.');
      alert('Please configure your Gemini API key:\n\n1. Create a .env file in the project root\n2. Add: VITE_GEMINI_API_KEY=your_key_here\n3. Restart the dev server\n\nGet it FREE from: https://aistudio.google.com/app/apikey');
      return;
    }

    const keySource = (import.meta as any).env?.VITE_GEMINI_API_KEY ? '(from .env)' : '(from CMS)';
    setDebugInfo(`🔑 Using API key ${keySource}: ${apiKey.substring(0, 10)}...`);

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

      const systemPrompt = deckContext
        ? [
            'You are the on-site AI assistant for ONE showcase deck at a luxury residential expo.',
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
          ].join('\n')
        : `You are a helpful real estate assistant at a luxury residential property expo. ${baseBrevity}`;

      const modelAck = deckContext
        ? 'Understood — I will quote your deck facts accurately with complete figures and stay concise. How can I help?'
        : 'Understood — I will keep answers brief and conversational. How can I help?';

      const allMessages = [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'model', parts: [{ text: modelAck }] },
        ...messages.map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
        { role: 'user', parts: [{ text: userMessage.content }] },
      ];

      const model = resolvedModel;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: allMessages,
            generationConfig: {
              temperature: deckContext ? 0.35 : 0.65,
              maxOutputTokens,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.error?.message || `API Error: ${response.status}`;
        setDebugInfo(`❌ Error: ${errorMsg}`);
        
        if (errorMsg.includes('API_KEY') || errorMsg.includes('API key') || response.status === 400) {
          throw new Error(`Invalid API key. Please:\n1. Go to https://aistudio.google.com/app/apikey\n2. Create a new API key\n3. Copy it (starts with AIza...)\n4. Paste in CMS → Scene → AI Settings`);
        }
        throw new Error(errorMsg);
      }

      setDebugInfo('✅ Response received successfully!');

      const data = await response.json();
      const cand = data.candidates?.[0];
      const finishReason = String(cand?.finishReason ?? '');
      let replyText = cand?.content?.parts?.[0]?.text || 'Sorry, I could not generate a response.';

      if (finishReason === 'MAX_TOKENS') {
        const t = replyText.trim();
        replyText = t
          ? `${t} …\n_(Hit length limit — ask one detail at a time, or raise VITE_GEMINI_MAX_OUTPUT_TOKENS in .env.)_`
          : 'The reply was cut off before any text arrived. Try a shorter question or increase max output tokens.';
        setDebugInfo('⚠️ Model hit MAX_TOKENS — answer may be incomplete');
      } else if (finishReason && finishReason !== 'STOP') {
        setDebugInfo(`✅ Done (${finishReason})`);
      }

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
            <h3 className="font-bold text-white text-sm">Ask AI Assistant</h3>
            <p className="text-[10px] text-white/40">
              {deckContext ? 'This deck only · ' : ''}
              {resolvedModel}
              {(import.meta.env.VITE_GEMINI_MODEL || '').trim() ? ' · from .env' : ''}
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

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">💬</div>
            <p className="text-white/40 text-sm">
              {deckContext ? 'Ask about this showcase deck — answers stay within your deck facts.' : 'Ask me anything about the properties!'}
            </p>
            <div className="mt-4 space-y-2">
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
          {!apiKey?.trim() ? (
            <span className="text-[#d4af37]">⚠️ Add VITE_GEMINI_API_KEY to .env file</span>
          ) : (
            <>Press Enter to send • API key {(import.meta as any).env?.VITE_GEMINI_API_KEY ? 'from .env' : 'from CMS'} ✓</>
          )}
        </p>
      </div>
    </div>
  );
}
