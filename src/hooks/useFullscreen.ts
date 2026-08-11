import { useCallback, useEffect, useState } from 'react';

type OrientationLock = ScreenOrientation & { lock?: (o: string) => Promise<void> };

type FullscreenDoc = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type FullscreenEl = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

function getFullscreenElement(): Element | null {
  const doc = document as FullscreenDoc;
  return document.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

function canRequestFullscreen(): boolean {
  const el = document.documentElement as FullscreenEl;
  return typeof el.requestFullscreen === 'function' || typeof el.webkitRequestFullscreen === 'function';
}

/**
 * Chrome/Android hides the URL bar for a fullscreen request made inside a user gesture.
 * iPhone Safari has no element fullscreen — callers should show an "Add to Home Screen" tip.
 */
export function useFullscreen() {
  const [active, setActive] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(canRequestFullscreen());
    const sync = () => setActive(Boolean(getFullscreenElement()));
    sync();
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync as EventListener);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync as EventListener);
    };
  }, []);

  const enter = useCallback(async () => {
    if (getFullscreenElement()) return;
    const el = document.documentElement as FullscreenEl;
    try {
      if (typeof el.requestFullscreen === 'function') {
        await el.requestFullscreen({ navigationUI: 'hide' });
      } else if (typeof el.webkitRequestFullscreen === 'function') {
        await el.webkitRequestFullscreen();
      }
    } catch {
      return;
    }
    try {
      await (screen.orientation as OrientationLock)?.lock?.('landscape');
    } catch {
      /* orientation lock unavailable */
    }
  }, []);

  const exit = useCallback(() => {
    if (!getFullscreenElement()) return;
    const doc = document as FullscreenDoc;
    if (typeof document.exitFullscreen === 'function') {
      void document.exitFullscreen().catch(() => {});
    } else if (typeof doc.webkitExitFullscreen === 'function') {
      void Promise.resolve(doc.webkitExitFullscreen()).catch(() => {});
    }
  }, []);

  const toggle = useCallback(() => {
    if (getFullscreenElement()) exit();
    else void enter();
  }, [enter, exit]);

  return { active, supported, enter, exit, toggle };
}
