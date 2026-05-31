import type { useStore } from '@/store';
import type { AnalyticsEventInput } from './api/client';
import { flushAnalytics, trackAnalytics } from './api/client';

/** Which booth the visitor is at (proximity HUD — all luxury stalls, not just Vertex Elite). */
export function resolveCurrentBoothId(state: ReturnType<typeof useStore.getState>): string | null {
  if (state.activeBooth) return state.activeBooth;

  let bestAlpha = 0;
  let bestId: string | null = null;
  for (const [id, report] of Object.entries(state._boothHudReports ?? {})) {
    if (report.alpha > bestAlpha) {
      bestAlpha = report.alpha;
      bestId = id;
    }
  }
  if (bestId && bestAlpha >= 0.12) return bestId;

  const hud = state.vertexEliteHudContext;
  if (hud?.boothId && state.vertexEliteHudAlpha >= 0.12) return hud.boothId;
  return null;
}

type BoothVisitSession = {
  visitId: string;
  boothId: string;
  enteredAt: number;
};

type VisitorMeta = { visitorId?: string; visitorName?: string };

export function createBoothVisitTracker(meta: VisitorMeta) {
  let open: BoothVisitSession | null = null;

  const endVisit = () => {
    if (!open) return;
    const dwellMs = Date.now() - open.enteredAt;
    if (dwellMs >= 500) {
      trackAnalytics(
        {
          type: 'booth_exit',
          boothId: open.boothId,
          zone: `booth:${open.boothId}`,
          dwellMs,
          visitId: open.visitId,
        },
        meta,
      );
      void flushAnalytics(meta);
    }
    open = null;
  };

  const startVisit = (boothId: string) => {
    const visitId = `vst_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    open = { visitId, boothId, enteredAt: Date.now() };
    trackAnalytics(
      {
        type: 'booth_enter',
        boothId,
        zone: `booth:${boothId}`,
        visitId,
      } satisfies AnalyticsEventInput,
      meta,
    );
    void flushAnalytics(meta);
  };

  return {
    syncBooth(current: string | null, prev: string | null) {
      if (open && open.boothId !== current) endVisit();
      if (current && current !== prev) startVisit(current);
      if (!current && open) endVisit();
    },
    onUnload() {
      endVisit();
    },
    dispose() {
      endVisit();
    },
  };
}
