import type { ExpoLiveStats } from '../data/expoStats';

export async function fetchExpoLiveStats(): Promise<ExpoLiveStats | null> {
  try {
    const res = await fetch('/api/expo/stats');
    const data = (await res.json()) as { ok: boolean; stats?: ExpoLiveStats; error?: string };
    if (!res.ok || !data.ok || !data.stats) {
      console.warn('[expo stats]', data.error || res.statusText);
      return null;
    }
    return data.stats;
  } catch (e) {
    console.warn('[expo stats] fetch failed', e);
    return null;
  }
}
