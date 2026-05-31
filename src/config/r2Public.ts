/** Runtime R2 public origin — set from booth-cms.json, r2-documents.json, or VITE_R2_PUBLIC_BASE_URL. */
let runtimePublicBase = '';

export function getR2PublicBase(): string {
  const fromEnv = String(import.meta.env.VITE_R2_PUBLIC_BASE_URL ?? '').trim().replace(/\/$/, '');
  return (runtimePublicBase || fromEnv).replace(/\/$/, '');
}

/** Warm DNS + TLS to the R2 CDN origin (pub-*.r2.dev or your custom assets domain). */
export function preconnectR2Cdn(publicBase?: string): void {
  if (typeof document === 'undefined') return;
  const base = (publicBase ?? getR2PublicBase()).trim();
  if (!base) return;
  try {
    const origin = new URL(base).origin;
    if (document.querySelector(`link[rel="preconnect"][href="${origin}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = origin;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  } catch {
    /* ignore invalid base */
  }
}

export function setR2PublicBase(base: string): void {
  runtimePublicBase = base.trim().replace(/\/$/, '');
  preconnectR2Cdn(runtimePublicBase);
}
