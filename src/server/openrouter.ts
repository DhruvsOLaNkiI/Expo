/**
 * OpenRouter chat completions (OpenAI-compatible).
 * https://openrouter.ai/docs/api/reference/overview
 */

export const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';

/** Auto-routes across OpenRouter free models — see openrouter.ai/openrouter/free */
export const DEFAULT_OPENROUTER_MODEL = 'openrouter/free';

/** Strong free instruct model (alternative to openrouter/free). */
export const OPENROUTER_FREE_LLAMA = 'meta-llama/llama-3.3-70b-instruct:free';

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export function getOpenRouterApiKey(): string | null {
  const key =
    process.env.OPENROUTER_API_KEY?.trim() ||
    process.env.VITE_OPENROUTER_API_KEY?.trim() ||
    '';
  return key || null;
}

export function getOpenRouterModel(): string {
  return (
    process.env.OPENROUTER_MODEL?.trim() ||
    process.env.VITE_OPENROUTER_MODEL?.trim() ||
    DEFAULT_OPENROUTER_MODEL
  );
}

export function isOpenRouterConfigured(): boolean {
  return Boolean(getOpenRouterApiKey());
}

export interface OpenRouterChatOptions {
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
}

export async function openRouterChat(options: OpenRouterChatOptions): Promise<string> {
  const apiKey = getOpenRouterApiKey();
  if (!apiKey) {
    throw new Error(
      'OPENROUTER_API_KEY is not set. Get a key at https://openrouter.ai/keys and add it to .env',
    );
  }

  const model = options.model || getOpenRouterModel();
  const res = await fetch(OPENROUTER_CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'http://localhost:3000',
      'X-Title': process.env.OPENROUTER_APP_NAME || 'Virtual Residential Expo',
    },
    body: JSON.stringify({
      model,
      messages: options.messages,
      temperature: options.temperature ?? 0.4,
      max_tokens: options.maxTokens ?? 2048,
    }),
  });

  const data = (await res.json()) as {
    error?: { message?: string };
    choices?: { message?: { content?: string } }[];
  };

  if (!res.ok) {
    throw new Error(data.error?.message || `OpenRouter HTTP ${res.status}`);
  }

  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error('OpenRouter returned an empty response');
  }
  return text;
}

/** Env vars passed to PageIndex Python (LiteLLM reads OPENROUTER_API_KEY). */
export function pageIndexChildEnv(base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const out = { ...base };
  const orKey = getOpenRouterApiKey();
  if (orKey) out.OPENROUTER_API_KEY = orKey;
  if (!out.OPENROUTER_API_BASE) out.OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1';
  return out;
}

export function requirePageIndexLlmEnv(): { ok: true } | { ok: false; error: string } {
  if (isOpenRouterConfigured()) return { ok: true };
  const gemini =
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.VITE_GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_API_KEY?.trim();
  if (gemini) return { ok: true };
  return {
    ok: false,
    error:
      'No LLM API key. Set OPENROUTER_API_KEY in .env (https://openrouter.ai/keys) or GEMINI_API_KEY for Google.',
  };
}
