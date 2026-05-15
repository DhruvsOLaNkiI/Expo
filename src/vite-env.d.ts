/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GEMINI_API_KEY?: string;
  /** Optional override, e.g. gemini-2.5-flash. Default: gemini-3.1-flash-lite-preview */
  readonly VITE_GEMINI_MODEL?: string;
  /** Optional; when set, overrides CMS “AI deck context” (single-line or use \\n in .env). */
  readonly VITE_AI_DECK_CONTEXT?: string;
  /** Optional max tokens for each assistant reply (128–8192). Defaults: 1024 with deck context, 512 without. */
  readonly VITE_GEMINI_MAX_OUTPUT_TOKENS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
