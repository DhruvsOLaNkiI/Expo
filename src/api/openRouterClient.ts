/**
 * Browser-side OpenRouter — used when /api/chat is unavailable (static Hostinger deploy).
 * Set VITE_OPENROUTER_API_KEY before `npm run build` (Hostinger build env).
 */
const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';

export type ClientChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export function getClientOpenRouterKey(): string | null {
  const key = String(import.meta.env.VITE_OPENROUTER_API_KEY ?? '').trim();
  return key || null;
}

export function getClientOpenRouterModel(): string {
  return (
    String(import.meta.env.VITE_OPENROUTER_MODEL ?? import.meta.env.OPENROUTER_MODEL ?? '').trim() ||
    'openrouter/free'
  );
}

export function isClientOpenRouterConfigured(): boolean {
  return Boolean(getClientOpenRouterKey());
}

export async function clientOpenRouterChat(options: {
  messages: ClientChatMessage[];
  temperature?: number;
  maxTokens?: number;
  model?: string;
}): Promise<string> {
  const apiKey = getClientOpenRouterKey();
  if (!apiKey) {
    throw new Error(
      'Add VITE_OPENROUTER_API_KEY in Hostinger build environment, then rebuild (npm run build). Get a key: https://openrouter.ai/keys',
    );
  }

  const model = options.model || getClientOpenRouterModel();
  const res = await fetch(OPENROUTER_CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'https://expo.digitalbroker.in',
      'X-Title': 'Virtual Residential Expo',
    },
    body: JSON.stringify({
      model,
      messages: options.messages,
      temperature: options.temperature ?? 0.5,
      max_tokens: options.maxTokens ?? 2048,
    }),
  });

  const text = await res.text();
  let data: { error?: { message?: string }; choices?: { message?: { content?: string } }[] };
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`OpenRouter returned invalid JSON (HTTP ${res.status})`);
  }

  if (!res.ok) {
    throw new Error(data.error?.message || `OpenRouter HTTP ${res.status}`);
  }

  const answer = data.choices?.[0]?.message?.content?.trim();
  if (!answer) throw new Error('OpenRouter returned an empty response');
  return answer;
}
