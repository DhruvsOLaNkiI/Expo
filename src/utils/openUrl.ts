/** Relative R2 keys or placeholders — not openable in browser until resolved to https. */
export function isUnopenableAssetUrl(url: string): boolean {
  const u = url.trim();
  if (!u) return true;
  if (/REPLACE-WITH/i.test(u)) return true;
  if (u.startsWith('booths/') || u.startsWith('r2:')) return true;
  if (u.startsWith('data:') && u.length > 1_500_000) return true;
  return false;
}

/** Open URL in a new tab without popup-blocker issues (prefer <a> over window.open). */
export function openUrlInNewTab(url: string): boolean {
  const u = url.trim();
  if (!u || isUnopenableAssetUrl(u)) return false;

  if (u.startsWith('data:')) {
    try {
      const comma = u.indexOf(',');
      if (comma < 0) return false;
      const header = u.slice(0, comma);
      const payload = u.slice(comma + 1);
      const mime = header.match(/data:([^;]+)/)?.[1] || 'application/octet-stream';
      const binary = atob(payload);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: mime });
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 120_000);
      return true;
    } catch {
      return false;
    }
  }

  const a = document.createElement('a');
  a.href = u;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  a.remove();
  return true;
}
