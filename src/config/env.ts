/** Client-safe environment (VITE_* only — never secrets). */
export const env = {
  geminiApiKey: String(import.meta.env.VITE_GEMINI_API_KEY ?? '').trim(),
  geminiModel: String(import.meta.env.VITE_GEMINI_MODEL ?? 'gemini-3.1-flash-lite-preview').trim(),
  openRouterApiKey: String(import.meta.env.VITE_OPENROUTER_API_KEY ?? '').trim(),
  openRouterModel: String(import.meta.env.VITE_OPENROUTER_MODEL ?? 'openrouter/free').trim(),
  aiDeckContext: String(import.meta.env.VITE_AI_DECK_CONTEXT ?? '').trim(),
  geminiMaxOutputTokens: Number(import.meta.env.VITE_GEMINI_MAX_OUTPUT_TOKENS) || undefined,
} as const;
