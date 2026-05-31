import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { loadEnv } from 'vite';
import { applyCorsHeaders, parseCorsOrigins } from './server/cors';
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
} from './server/routes';

type ApiConnectServer = {
  middlewares: {
    use: (fn: (req: IncomingMessage, res: ServerResponse, next: () => void) => void) => void;
  };
};

function attachAnalyticsApi(server: ApiConnectServer, rootDir: string, mode: string) {
  const env = loadEnv(mode, rootDir, '');
  if (env.MONGODB_URI) process.env.MONGODB_URI = env.MONGODB_URI;
  const corsOrigins = parseCorsOrigins(
    env.ANALYTICS_CORS_ORIGINS ?? process.env.ANALYTICS_CORS_ORIGINS,
  );

  server.middlewares.use((req, res, next) => {
    const url = req.url?.split('?')[0] ?? '';

    if (corsOrigins.length > 0 && applyCorsHeaders(req, res, corsOrigins)) {
      return;
    }

    if (url === '/api/analytics/track' && req.method === 'POST') {
      void handleAnalyticsTrack(req, res);
      return;
    }

    if (url === '/api/analytics/dashboard' && req.method === 'GET') {
      void handleAnalyticsDashboardGet(res);
      return;
    }

    if (url === '/api/analytics/booth-documents' && req.method === 'GET') {
      void handleBoothDocumentStatsGet(req, res);
      return;
    }

    if (url === '/api/analytics/booth-visitors' && req.method === 'GET') {
      void handleBoothVisitorStatsGet(req, res);
      return;
    }

    if (url === '/api/analytics/booth-visits' && req.method === 'GET') {
      void handleBoothVisitSessionsGet(req, res);
      return;
    }

    if (url === '/api/analytics/faq-submit' && req.method === 'POST') {
      void handleFaqSubmitPost(req, res);
      return;
    }

    if (url === '/api/analytics/booth-faq-responses' && req.method === 'GET') {
      void handleBoothFaqResponsesGet(req, res);
      return;
    }

    if (url === '/api/analytics/booth-visitor-profile' && req.method === 'GET') {
      void handleBoothVisitorProfileGet(req, res);
      return;
    }

    if (url === '/api/analytics/sales-chat' && req.method === 'POST') {
      void handleSalesChatPost(req, res);
      return;
    }

    if (url === '/api/analytics/booth-sales-chat' && req.method === 'GET') {
      void handleBoothSalesChatGet(req, res);
      return;
    }

    if (url === '/api/analytics/booth-presence' && req.method === 'POST') {
      void handleBoothPresencePost(req, res);
      return;
    }

    if (url === '/api/analytics/booth-presence' && req.method === 'DELETE') {
      void handleBoothPresenceDelete(req, res);
      return;
    }

    if (url === '/api/analytics/booth-live-presence' && req.method === 'GET') {
      void handleBoothLivePresenceGet(req, res);
      return;
    }

    next();
  });
}

export function analyticsApiPlugin(rootDir: string): Plugin {
  return {
    name: 'virtual-expo-analytics-api',
    configureServer(server) {
      attachAnalyticsApi(server, rootDir, server.config.mode);
    },
    configurePreviewServer(server) {
      attachAnalyticsApi(server, rootDir, 'production');
    },
  };
}
