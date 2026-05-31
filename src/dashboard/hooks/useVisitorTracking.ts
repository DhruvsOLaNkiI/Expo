import { useEffect, useRef } from 'react';
import { flushAnalytics, getAnalyticsSessionId, trackAnalytics } from '../api/client';
import { createBoothVisitTracker, resolveCurrentBoothId } from '../boothVisitTracking';
import { createBoothPresenceTracker } from '../boothPresence';
import {
  createPdfDocumentTracker,
  isPdfDocumentPopup,
} from '../pdfDocTracking';
import { useStore } from '@/store';

function resolvePlatformZone(state: ReturnType<typeof useStore.getState>): string {
  if (state.expoPhase === 'registration') return 'registration_lobby';
  if (state.helpDeskOpen) return 'help_desk';
  if (state.aiChatOpen) return 'ai_chat';
  if (state.ctaResourcePopup) return 'viewing_document';
  const boothId = resolveCurrentBoothId(state);
  if (boothId) return `booth:${boothId}`;
  return 'expo_hall';
}

/** Tracks where visitors stay, booth visits, document opens, and PDF read duration. */
export function useVisitorTracking() {
  const visitorId = useStore((s) => s.visitorProfile?.id);
  const visitorName = useStore((s) => s.visitorProfile?.displayName);
  const meta = { visitorId, visitorName };

  const lastZoneRef = useRef<string | null>(null);
  const zoneSinceRef = useRef(Date.now());
  const lastBoothRef = useRef<string | null>(null);
  /** Keep booth attribution when HUD alpha dips while a PDF popup is open. */
  const lastKnownBoothRef = useRef<string | null>(null);
  const startedRef = useRef(false);
  const pdfTrackerRef = useRef<ReturnType<typeof createPdfDocumentTracker> | null>(null);
  const boothTrackerRef = useRef<ReturnType<typeof createBoothVisitTracker> | null>(null);
  const presenceTrackerRef = useRef<ReturnType<typeof createBoothPresenceTracker> | null>(null);

  useEffect(() => {
    pdfTrackerRef.current = createPdfDocumentTracker(meta);
    boothTrackerRef.current = createBoothVisitTracker(meta);
    presenceTrackerRef.current = createBoothPresenceTracker(meta);

    const booth = resolveCurrentBoothId(useStore.getState());
    lastBoothRef.current = booth;
    if (booth) {
      boothTrackerRef.current.syncBooth(booth, null);
      presenceTrackerRef.current.syncBooth(booth);
    }

    return () => {
      pdfTrackerRef.current?.dispose();
      boothTrackerRef.current?.dispose();
      presenceTrackerRef.current?.dispose();
    };
  }, [visitorId, visitorName]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    trackAnalytics({ type: 'session_start', zone: resolvePlatformZone(useStore.getState()) }, meta);
    void flushAnalytics(meta);

    const onUnload = () => {
      const zone = lastZoneRef.current;
      if (zone) {
        trackAnalytics(
          { type: 'zone_dwell', zone, dwellMs: Date.now() - zoneSinceRef.current },
          meta,
        );
      }
      boothTrackerRef.current?.onUnload();
      pdfTrackerRef.current?.onUnload();
      presenceTrackerRef.current?.onUnload();
      void flushAnalytics(meta);
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [visitorId, visitorName]);

  useEffect(() => {
    const unsub = useStore.subscribe((state, prev) => {
      const zone = resolvePlatformZone(state);
      const prevZone = resolvePlatformZone(prev);

      if (zone !== prevZone) {
        if (lastZoneRef.current) {
          trackAnalytics(
            {
              type: 'zone_dwell',
              zone: lastZoneRef.current,
              dwellMs: Date.now() - zoneSinceRef.current,
            },
            meta,
          );
        }
        lastZoneRef.current = zone;
        zoneSinceRef.current = Date.now();
      }

      const resolvedBooth = resolveCurrentBoothId(state);
      if (resolvedBooth) lastKnownBoothRef.current = resolvedBooth;
      const booth =
        resolvedBooth ??
        (state.ctaResourcePopup ? lastKnownBoothRef.current : null);
      const prevBooth = resolveCurrentBoothId(prev) ?? lastKnownBoothRef.current;

      const boothChanged = booth !== lastBoothRef.current;
      if (boothChanged) {
        lastBoothRef.current = booth;
        boothTrackerRef.current?.syncBooth(booth, prevBooth);
        presenceTrackerRef.current?.syncBooth(booth);
        if (lastBoothRef.current === null && isPdfDocumentPopup(state.ctaResourcePopup)) {
          pdfTrackerRef.current?.onBoothExit();
        }
      }

      const popup = state.ctaResourcePopup;
      const prevPopup = prev.ctaResourcePopup;
      const boothId = booth ?? undefined;
      const docZone = boothId ? `booth:${boothId}` : zone;

      pdfTrackerRef.current?.onPopupChange(popup, prevPopup, boothId, docZone);

      if (popup && popup !== prevPopup) {
        trackAnalytics(
          {
            type: 'doc_open',
            docTitle: popup.title,
            docUrl: popup.url,
            docVariant: popup.variant,
            boothId,
            zone: docZone,
          },
          meta,
        );
        if (isPdfDocumentPopup(popup)) {
          void flushAnalytics(meta);
        }
      }
    });

    return unsub;
  }, [visitorId, visitorName]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const zone = resolvePlatformZone(useStore.getState());
      trackAnalytics({ type: 'heartbeat', zone }, meta);
      void flushAnalytics(meta);
    }, 45_000);
    return () => window.clearInterval(interval);
  }, [visitorId, visitorName]);

  useEffect(() => {
    void getAnalyticsSessionId();
  }, []);
}

/** @deprecated Use useVisitorTracking */
export const useExpoAnalytics = useVisitorTracking;
