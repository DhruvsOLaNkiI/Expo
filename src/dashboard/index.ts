/**
 * Visitor analytics dashboard — self-contained module.
 *
 * src/dashboard/
 *   components/   UI (AnalyticsDashboard)
 *   api/          Browser client (track + fetch)
 *   hooks/        Expo visitor tracking
 *   server/       MongoDB aggregates (dev API via vite-plugin)
 *   types.ts      Shared types
 *   vite-plugin.ts Vite /api/analytics/* middleware (dev)
 *
 * Separate VPS deploy: see /dashboard-host/ (npm run dashboard:build && dashboard:start)
 */

export { AnalyticsDashboard } from './components/AnalyticsDashboard';
export { useVisitorTracking, useExpoAnalytics } from './hooks/useVisitorTracking';
export {
  fetchAnalyticsDashboard,
  trackAnalytics,
  flushAnalytics,
  getAnalyticsSessionId,
} from './api/client';
export type { AnalyticsDashboardData } from './types';
export {
  getAnalyticsApiBase,
  getDashboardPublicUrl,
  analyticsApiUrl,
  isStandaloneDashboard,
} from './config';
