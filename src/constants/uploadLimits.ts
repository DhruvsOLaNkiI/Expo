/** Max PDF/asset upload size for dev server (Multer). Override with MAX_UPLOAD_MB in .env */
export const DEFAULT_MAX_UPLOAD_MB = 100;

export function maxUploadBytesFromEnv(env: Record<string, string | undefined> = {}): number {
  const raw = env.MAX_UPLOAD_MB ?? env.VITE_MAX_UPLOAD_MB ?? String(DEFAULT_MAX_UPLOAD_MB);
  const mb = Number(raw);
  if (!Number.isFinite(mb) || mb < 1) return DEFAULT_MAX_UPLOAD_MB * 1024 * 1024;
  return Math.round(mb * 1024 * 1024);
}

export function maxUploadMbFromEnv(env: Record<string, string | undefined> = {}): number {
  return maxUploadBytesFromEnv(env) / (1024 * 1024);
}

export function formatMulterUploadError(err: unknown, maxMb: number): string {
  const code =
    err && typeof err === 'object' && 'code' in err ? String((err as { code: string }).code) : '';
  const msg = err instanceof Error ? err.message : String(err);
  if (code === 'LIMIT_FILE_SIZE' || /file too large/i.test(msg)) {
    return `PDF is too large (max ${maxMb} MB on this dev server). Compress the brochure or raise MAX_UPLOAD_MB in .env, then restart npm run dev.`;
  }
  return msg || 'Upload failed';
}
