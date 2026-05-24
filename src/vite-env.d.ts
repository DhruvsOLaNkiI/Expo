/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GEMINI_API_KEY?: string;
  readonly VITE_GEMINI_MODEL?: string;
  readonly VITE_OPENROUTER_API_KEY?: string;
  readonly VITE_OPENROUTER_MODEL?: string;
  /** Cloudflare R2 public origin (https://pub-….r2.dev) — used to resolve r2:booths/… paths in booth-cms.json. */
  readonly VITE_R2_PUBLIC_BASE_URL?: string;
  /** Optional; when set, overrides CMS “AI deck context” (single-line or use \\n in .env). */
  readonly VITE_AI_DECK_CONTEXT?: string;
  /** Optional max tokens for each assistant reply (128–8192). Defaults: 1024 with deck context, 512 without. */
  readonly VITE_GEMINI_MAX_OUTPUT_TOKENS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
