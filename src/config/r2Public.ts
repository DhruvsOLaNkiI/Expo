/** Runtime R2 public origin — set from booth-cms.json, r2-documents.json, or VITE_R2_PUBLIC_BASE_URL. */
let runtimePublicBase = '';

export function getR2PublicBase(): string {
  const fromEnv = String(import.meta.env.VITE_R2_PUBLIC_BASE_URL ?? '').trim().replace(/\/$/, '');
  return (runtimePublicBase || fromEnv).replace(/\/$/, '');
}

export function setR2PublicBase(base: string): void {
  runtimePublicBase = base.trim().replace(/\/$/, '');
}
