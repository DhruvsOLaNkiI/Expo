import type { VisitorProfile } from '../visitorProfile';

type ApiResult = { ok: true } | { ok: false; error: string };

async function parseVisitorApiJson(res: Response): Promise<{ ok: boolean; error?: string }> {
  const text = await res.text();
  if (!text.trim()) {
    return {
      ok: false,
      error:
        res.status === 404
          ? 'Registration API not found — restart the dev server (npm run dev).'
          : `Empty response (${res.status})`,
    };
  }
  try {
    return JSON.parse(text) as { ok: boolean; error?: string };
  } catch {
    return { ok: false, error: `Invalid server response (${res.status})` };
  }
}

/** Save visitor id + name to MongoDB (dev server API). Fails silently if offline. */
export async function registerVisitorOnServer(
  profile: VisitorProfile,
  options?: { lobbyCheckIn?: boolean },
): Promise<ApiResult> {
  try {
    const res = await fetch('/api/visitors/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitorId: profile.id,
        displayName: profile.displayName,
        email: profile.email,
        phone: profile.phone,
        avatar: profile.avatar,
        createdAt: profile.createdAt,
        lobbyCheckIn: options?.lobbyCheckIn ?? false,
      }),
    });
    const data = await parseVisitorApiJson(res);
    if (!res.ok || !data.ok) {
      return {
        ok: false,
        error:
          data.error ||
          (res.status === 404
            ? 'Registration API not found — restart the dev server (npm run dev).'
            : res.statusText),
      };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Network error' };
  }
}

export async function recordVisitorLobbyCheckIn(visitorId: string): Promise<ApiResult> {
  try {
    const res = await fetch('/api/visitors/check-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitorId }),
    });
    const data = await parseVisitorApiJson(res);
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error || res.statusText };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Network error' };
  }
}
