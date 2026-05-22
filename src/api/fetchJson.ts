/** True when /api/* is missing (static hosting) or body is not JSON. */
export function isBackendApiUnavailableError(message: string): boolean {
  return /AI API is not running|invalid JSON|Unexpected end of JSON/i.test(message);
}

/** Parse API responses safely — static hosts often return HTML/empty instead of JSON. */
export async function fetchJson<T extends Record<string, unknown>>(
  url: string,
  init?: RequestInit,
): Promise<{ response: Response; data: T }> {
  const response = await fetch(url, init);
  const text = await response.text();
  let data: T;
  try {
    data = (text ? JSON.parse(text) : {}) as T;
  } catch {
    const isHtml = /^\s*</.test(text) || text.includes('<!DOCTYPE');
    const hint = isHtml || response.status === 404
      ? 'The AI API is not running on this server. Static hosting (uploading only the dist folder) cannot run /api/chat or /api/pageindex. Deploy with Node: npm run build && npm run start:prod, and set OPENROUTER_API_KEY + MONGODB_URI in the server environment (not only VITE_* in the panel).'
      : `Server returned invalid JSON (HTTP ${response.status}).`;
    throw new Error(hint);
  }
  return { response, data };
}
