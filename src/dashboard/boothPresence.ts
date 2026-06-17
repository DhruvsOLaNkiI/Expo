import { clearBoothPresence, getAnalyticsSessionId, pingBoothPresence } from './api/client';

/** How often visitors ping while inside a booth (MongoDB upsert, not a new row each time). */
export const BOOTH_PRESENCE_PING_MS = 5_000;

type VisitorMeta = { visitorId?: string; visitorName?: string };

function sessionId(meta: VisitorMeta): string {
  return getAnalyticsSessionId(meta.visitorId);
}

export function createBoothPresenceTracker(meta: VisitorMeta) {
  let timer: ReturnType<typeof setInterval> | null = null;
  let currentBooth: string | null = null;

  const stopTimer = () => {
    if (timer != null) {
      clearInterval(timer);
      timer = null;
    }
  };

  const sendPing = () => {
    if (!currentBooth) return;
    void pingBoothPresence({
      boothId: currentBooth,
      sessionId: sessionId(meta),
      visitorId: meta.visitorId,
      visitorName: meta.visitorName,
    });
  };

  const leaveBooth = (boothId: string) => {
    void clearBoothPresence({
      boothId,
      sessionId: sessionId(meta),
      visitorId: meta.visitorId,
    });
  };

  return {
    syncBooth(boothId: string | null) {
      if (boothId === currentBooth) return;

      if (currentBooth && !boothId) {
        leaveBooth(currentBooth);
        stopTimer();
      } else if (currentBooth && boothId && currentBooth !== boothId) {
        leaveBooth(currentBooth);
        stopTimer();
      }

      currentBooth = boothId;

      if (boothId) {
        sendPing();
        stopTimer();
        timer = setInterval(sendPing, BOOTH_PRESENCE_PING_MS);
      }
    },
    onUnload() {
      if (currentBooth) leaveBooth(currentBooth);
      stopTimer();
      currentBooth = null;
    },
    dispose() {
      this.onUnload();
    },
  };
}
