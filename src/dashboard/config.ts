/** Base URL for analytics API (empty = same origin as the page). */
export function getAnalyticsApiBase(): string {
  const raw = (import.meta.env.VITE_ANALYTICS_API_URL as string | undefined)?.trim() ?? '';
  return raw.replace(/\/$/, '');
}

export function analyticsApiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  const base = getAnalyticsApiBase();
  return base ? `${base}${p}` : p;
}

/** Public URL of the hosted dashboard UI (for links from the 3D expo). */
export function getDashboardPublicUrl(): string {
  return (import.meta.env.VITE_DASHBOARD_URL as string | undefined)?.trim().replace(/\/$/, '') ?? '';
}

export function isStandaloneDashboard(): boolean {
  return (import.meta.env.VITE_DASHBOARD_STANDALONE as string | undefined) === 'true';
}

/** Main virtual expo site (3D floor). */
export function getExpoPublicUrl(): string {
  const url = (import.meta.env.VITE_EXPO_PUBLIC_URL as string | undefined)?.trim();
  return url?.replace(/\/$/, '') || '/';
}

export function getCmsPublicUrl(): string {
  const cms = (import.meta.env.VITE_CMS_PUBLIC_URL as string | undefined)?.trim();
  if (cms) return cms.replace(/\/$/, '');
  const expo = getExpoPublicUrl();
  return expo === '/' ? '/cms' : `${expo}/cms`;
}
