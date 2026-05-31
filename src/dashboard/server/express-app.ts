import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyCorsHeaders, parseCorsOrigins } from './cors';
import {
  handleAnalyticsDashboardGet,
  handleAnalyticsTrack,
  handleBoothDocumentStatsGet,
  handleBoothFaqResponsesGet,
  handleBoothVisitSessionsGet,
  handleBoothVisitorProfileGet,
  handleBoothVisitorStatsGet,
  handleFaqSubmitPost,
  handleSalesChatPost,
  handleBoothSalesChatGet,
  handleBoothPresencePost,
  handleBoothPresenceDelete,
  handleBoothLivePresenceGet,
} from './routes';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export type CreateAnalyticsServerOptions = {
  /** Folder with built index.html (dashboard-host/dist). */
  staticDir?: string;
  corsOrigins?: string[];
};

export function createAnalyticsServer(opts: CreateAnalyticsServerOptions = {}) {
  const allowedOrigins = opts.corsOrigins ?? parseCorsOrigins(process.env.ANALYTICS_CORS_ORIGINS);
  const app = express();
  app.use(express.json({ limit: '512kb' }));

  app.use((req, res, next) => {
    const isPreflight = applyCorsHeaders(req, res, allowedOrigins);
    if (isPreflight) {
      res.statusCode = 204;
      res.end();
      return;
    }
    next();
  });

  app.post('/api/analytics/track', (req, res) => {
    void handleAnalyticsTrack(req, res);
  });

  app.get('/api/analytics/dashboard', (req, res) => {
    void handleAnalyticsDashboardGet(res);
  });

  app.get('/api/analytics/booth-documents', (req, res) => {
    void handleBoothDocumentStatsGet(req, res);
  });

  app.get('/api/analytics/booth-visitors', (req, res) => {
    void handleBoothVisitorStatsGet(req, res);
  });

  app.get('/api/analytics/booth-visits', (req, res) => {
    void handleBoothVisitSessionsGet(req, res);
  });

  app.post('/api/analytics/faq-submit', (req, res) => {
    void handleFaqSubmitPost(req, res);
  });

  app.get('/api/analytics/booth-faq-responses', (req, res) => {
    void handleBoothFaqResponsesGet(req, res);
  });

  app.get('/api/analytics/booth-visitor-profile', (req, res) => {
    void handleBoothVisitorProfileGet(req, res);
  });

  app.post('/api/analytics/sales-chat', (req, res) => {
    void handleSalesChatPost(req, res);
  });

  app.get('/api/analytics/booth-sales-chat', (req, res) => {
    void handleBoothSalesChatGet(req, res);
  });

  app.post('/api/analytics/booth-presence', (req, res) => {
    void handleBoothPresencePost(req, res);
  });

  app.delete('/api/analytics/booth-presence', (req, res) => {
    void handleBoothPresenceDelete(req, res);
  });

  app.get('/api/analytics/booth-live-presence', (req, res) => {
    void handleBoothLivePresenceGet(req, res);
  });

  app.get('/api/analytics/health', (_req, res) => {
    res.json({
      ok: true,
      mongo: Boolean(process.env.MONGODB_URI?.trim()),
    });
  });

  if (opts.staticDir) {
    const dir = path.resolve(opts.staticDir);
    app.use(express.static(dir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(dir, 'index.html'));
    });
  }

  return app;
}

/** Default dist path when running dashboard-host/server.mts */
export function defaultDashboardDistDir(): string {
  return path.resolve(__dirname, '../../../dashboard-host/dist');
}
