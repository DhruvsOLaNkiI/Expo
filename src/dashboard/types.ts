export interface AnalyticsDashboardData {
  asOf: string;
  mongoConnected: boolean;
  visitors: {
    total: number;
    registeredToday: number;
    checkedInToday: number;
  };
  questionnaires: {
    total: number;
    avgScore: number;
    byCategory: { hot: number; warm: number; cold: number };
    recent: Array<{
      visitorName: string;
      visitorEmail?: string;
      totalScore: number;
      category: string;
      categoryLabel: string;
      submittedAt: string;
    }>;
  };
  documents: {
    totalOpens: number;
    uniqueDocs: number;
    topDocuments: Array<{
      title: string;
      opens: number;
      variant?: string;
      avgDwellMs?: number;
      totalDwellMs?: number;
    }>;
  };
  zones: {
    topZones: Array<{ zone: string; totalDwellMs: number; visits: number }>;
  };
  sessions: {
    activeNow: number;
    totalSessions: number;
  };
  recentVisitors: Array<{
    visitorId: string;
    displayName: string;
    email?: string;
    createdAt: string;
    lobbyCheckInAt?: string;
  }>;
  recentActivity: Array<{
    at: string;
    type: string;
    visitorId?: string;
    label: string;
  }>;
}
