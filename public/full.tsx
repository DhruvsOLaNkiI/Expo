import { useCallback, useEffect, useState } from 'react';

type OrientationLock = ScreenOrientation & { lock?: (o: string) => Promise<void> };

/**
 * Chrome/Android hides the URL bar only for a fullscreen request made inside a
 * user gesture. iPhone Safari has no element fullscreen at all, so `supported`
 * is false there and callers should fall back to "Add to Home Screen".
 */
export function useFullscreen() {
  const [active, setActive] = useState(false);
  const [supported, setSupported] = useState(false);

useEffect()=>{
    setSupported(typeof document.documentElement.requestFullscreen === 'function')
    const sync = () => setActive(Boolean(document))
    sync();
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('FullscreenChange', sync);
    

}

  useEffect(() => {
    setSupported(typeof document.documentElement.requestFullscreen === 'function');
    const sync = () => setActive(Boolean(document.fullscreenElement));
    sync();
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  const enter = useCallback(async () => {
    if (document.fullscreenElement) return;
    try {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    } catch {
      return;
    }
    // Rejects on desktop and iPad; never let it bubble into the caller's gesture.
    try {
      await (screen.orientation as OrientationLock)?.lock?.('landscape');
    } catch {
      /* orientation lock unavailable */
    }
  }, []);

  const exit = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  }, []);

  const toggle = useCallback(() => {
    if (document.fullscreenElement) exit();
    else void enter();
  }, [enter, exit]);

  return { active, supported, enter, exit, toggle };
}
