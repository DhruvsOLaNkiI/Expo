import { isPdfUrl } from '@/api/pageindexAutoIndex';
import type { CtaResourcePopup } from '@/store';
import type { AnalyticsEventInput } from './api/client';
import { flushAnalytics, trackAnalytics } from './api/client';

/** PDF popup sessions — open + heartbeat + close with dwell duration. */
export type PdfDocSession = {
  docTitle: string;
  docUrl: string;
  docVariant?: string;
  boothId?: string;
  zone?: string;
  openedAt: number;
  lastHeartbeatAt: number;
};

const PDF_HEARTBEAT_MS = 20_000;

export function isPdfDocumentPopup(popup: CtaResourcePopup | null | undefined): boolean {
  if (!popup?.url?.trim()) return false;
  const variant = popup.variant ?? 'document';
  if (variant !== 'document') return false;
  return isPdfUrl(popup.url);
}

type VisitorMeta = { visitorId?: string; visitorName?: string };

export function createPdfDocumentTracker(meta: VisitorMeta) {
  let session: PdfDocSession | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  const baseEvent = (): Omit<AnalyticsEventInput, 'type' | 'dwellMs'> => ({
    docTitle: session?.docTitle,
    docUrl: session?.docUrl,
    docVariant: session?.docVariant,
    boothId: session?.boothId,
    zone: session?.zone,
  });

  const sendHeartbeat = () => {
    if (!session) return;
    const now = Date.now();
    const sliceMs = now - session.lastHeartbeatAt;
    if (sliceMs < 1000) return;
    session.lastHeartbeatAt = now;
    trackAnalytics(
      {
        type: 'doc_heartbeat',
        ...baseEvent(),
        dwellMs: sliceMs,
      },
      meta,
    );
  };

  const stopHeartbeat = () => {
    if (heartbeatTimer != null) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  };

  const endSession = () => {
    if (!session) return;
    stopHeartbeat();
    const now = Date.now();
    const totalMs = now - session.openedAt;
    if (totalMs >= 500) {
      trackAnalytics(
        {
          type: 'doc_close',
          ...baseEvent(),
          dwellMs: totalMs,
        },
        meta,
      );
      void flushAnalytics(meta);
    }
    session = null;
  };

  const startSession = (popup: CtaResourcePopup, boothId?: string, zone?: string) => {
    const now = Date.now();
    session = {
      docTitle: popup.title,
      docUrl: popup.url,
      docVariant: popup.variant ?? 'document',
      boothId,
      zone,
      openedAt: now,
      lastHeartbeatAt: now,
    };
    stopHeartbeat();
    heartbeatTimer = setInterval(sendHeartbeat, PDF_HEARTBEAT_MS);
  };

  return {
    onPopupChange(
      popup: CtaResourcePopup | null,
      prevPopup: CtaResourcePopup | null,
      boothId?: string,
      zone?: string,
    ) {
      const wasPdf = isPdfDocumentPopup(prevPopup);
      const isPdf = isPdfDocumentPopup(popup);

      if (wasPdf && (!isPdf || popup !== prevPopup)) {
        endSession();
      }

      if (isPdf && popup && popup !== prevPopup) {
        startSession(popup, boothId, zone);
      }
    },

    /** Called when booth changes — closes any open PDF session for accuracy. */
    onBoothExit() {
      endSession();
    },

    onUnload() {
      endSession();
    },

    dispose() {
      endSession();
    },
  };
}
