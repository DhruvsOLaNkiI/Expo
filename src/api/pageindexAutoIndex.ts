/** Auto-index PDFs to PageIndex on upload (CMS). Background task. */

export type PageIndexStatus = 'idle' | 'indexing' | 'indexed' | 'error';

export interface PageIndexProgressEvent {
  boothId: string;
  documentType: 'brochure' | 'priceList' | 'siteLayout' | 'unitLayout';
  status: PageIndexStatus;
  message?: string;
  error?: string;
}

export type PageIndexDocType = 'brochure' | 'priceList' | 'siteLayout' | 'unitLayout';

export type PageIndexTreeStats = {
  topLevelSections: number;
  totalNodes: number;
  jsonSizeKb: number;
  sampleTitles: string[];
};

export interface PageIndexDbDocStatus {
  documentType: PageIndexDocType;
  indexed: boolean;
  indexStatus: string | null;
  indexError?: string | null;
  slotExists: boolean;
  indexedAt: string | null;
  pdfUrl: string | null;
  currentUrl: string | null;
  urlMatches: boolean;
  stale: boolean;
  readyForChat: boolean;
  isPdf: boolean;
  treeStats?: PageIndexTreeStats | null;
}

/** Create MongoDB row for priceList (or other type) if missing, then run PageIndex. */
export async function ensureIndexDocumentFromUrl(
  pdfUrl: string,
  boothId: string,
  documentType: PageIndexDocType,
): Promise<void> {
  if (!isPdfUrl(pdfUrl)) {
    setPageIndexStatus(boothId, documentType, 'error', undefined, 'URL is not a PDF');
    return;
  }
  await indexPdfFromUrl(pdfUrl, boothId, documentType);
}

export const PAGEINDEX_STATUS_REFRESH = 'pageindex-status-refresh';

/** Map of `boothId/documentType` → indexing state for UI. */
const indexingMap = new Map<string, PageIndexProgressEvent>();

export function notifyPageIndexStatusRefresh(boothId: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(PAGEINDEX_STATUS_REFRESH, { detail: { boothId } }));
}

/** Only pass public URLs in query strings — data: URLs can be megabytes and break fetch(). */
function urlForStatusQuery(url: string | undefined): string | undefined {
  const u = (url ?? '').trim();
  if (!u) return undefined;
  if (u.startsWith('data:')) return undefined;
  if (!/^https?:\/\//i.test(u)) return undefined;
  if (u.length > 2048) return undefined;
  return u;
}

export async function fetchBoothPageIndexStatus(
  boothId: string,
  urls: { brochureUrl?: string; priceListUrl?: string },
): Promise<PageIndexDbDocStatus[]> {
  const qs = new URLSearchParams({ boothId });
  const brochureQ = urlForStatusQuery(urls.brochureUrl);
  const priceQ = urlForStatusQuery(urls.priceListUrl);
  if (brochureQ) qs.set('brochureUrl', brochureQ);
  if (priceQ) qs.set('priceListUrl', priceQ);

  let res: Response;
  try {
    res = await fetch(`/api/pageindex/status?${qs}`);
  } catch (e) {
    const hint =
      e instanceof TypeError && e.message === 'Failed to fetch'
        ? 'Cannot reach /api/pageindex/status. Run npm run dev (not vite preview) and keep the terminal open.'
        : e instanceof Error
          ? e.message
          : String(e);
    throw new Error(hint);
  }
  const text = await res.text();
  let data: { ok: boolean; error?: string; documents?: PageIndexDbDocStatus[] };
  try {
    data = text.trim() ? (JSON.parse(text) as typeof data) : { ok: false, error: `Empty response (${res.status})` };
  } catch {
    throw new Error(
      res.status === 404
        ? 'PageIndex API not found — restart the dev server (npm run dev).'
        : `Invalid PageIndex response (${res.status})`,
    );
  }
  if (!res.ok || !data.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data.documents ?? [];
}

export function getPageIndexStatus(
  boothId: string,
  documentType: string
): PageIndexProgressEvent | null {
  const key = `${boothId}/${documentType}`;
  return indexingMap.get(key) || null;
}

export function isPdfUrl(url: string): boolean {
  const u = url.trim().toLowerCase();
  return /\.pdf(\?|#|$)/i.test(u) || u.startsWith('data:application/pdf');
}

export function setPageIndexStatus(
  boothId: string,
  documentType: string,
  status: PageIndexStatus,
  message?: string,
  error?: string
): void {
  const key = `${boothId}/${documentType}`;
  indexingMap.set(key, {
    boothId,
    documentType: documentType as 'brochure' | 'priceList' | 'siteLayout' | 'unitLayout',
    status,
    message,
    error,
  });
}

/**
 * Auto-index a PDF file to PageIndex (non-blocking).
 * Uploads PDF to R2, then calls PageIndex API in background.
 * Returns immediately; status updates via getPageIndexStatus().
 */
export async function autoIndexPdf(
  file: File,
  boothId: string,
  documentType: 'brochure' | 'priceList' | 'siteLayout' | 'unitLayout',
  pdfUrl: string
): Promise<void> {
  const key = `${boothId}/${documentType}`;

  // Only auto-index PDFs (not images)
  if (file.type !== 'application/pdf') {
    console.log(`[PageIndex] Skipping indexing for ${key}: not a PDF (${file.type})`);
    return;
  }

  setPageIndexStatus(boothId, documentType, 'indexing', 'Starting…');

  try {
    // Build FormData with just the PDF
    const fd = new FormData();
    fd.append('pdf', file, file.name);

    // Call PageIndex API with booth context
    const qs = new URLSearchParams({
      boothId,
      documentType,
      pdfUrl, // Pass R2 URL so server can reference it in MongoDB
    });

    let res: Response;
    try {
      res = await fetch(`/api/pageindex/index?${qs}`, {
        method: 'POST',
        body: fd,
      });
    } catch (e) {
      const hint =
        e instanceof TypeError && e.message === 'Failed to fetch'
          ? 'Cannot reach PageIndex API. Run npm run dev and keep the dev server running.'
          : e instanceof Error
            ? e.message
            : String(e);
      throw new Error(hint);
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`HTTP ${res.status}: ${errText}`);
    }

    const data = (await res.json()) as {
      ok: boolean;
      error?: string;
      outputPath?: string;
      boothId?: string;
      documentType?: string;
    };

    if (!data.ok) {
      throw new Error(data.error || 'Unknown PageIndex error');
    }

    const saved = (data as { savedToDb?: boolean; dbError?: string }).savedToDb;
    const dbError = (data as { dbError?: string }).dbError;

    if (!saved) {
      throw new Error(
        dbError ||
          'Index ran but tree was NOT saved to MongoDB. Add MONGODB_URI to .env and restart npm run dev.',
      );
    }

    setPageIndexStatus(
      boothId,
      documentType,
      'indexed',
      `Indexed. Saved: ${data.outputPath || 'MongoDB'}`
    );

    console.log(`✓ PageIndex: ${boothId}/${documentType} indexed & saved to MongoDB`);
    notifyPageIndexStatusRefresh(boothId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    setPageIndexStatus(boothId, documentType, 'error', undefined, msg);
    console.error(`✗ PageIndex failed for ${boothId}/${documentType}:`, msg);
  }
}

/** Index an already-uploaded PDF by URL (e.g. R2) — use when upload happened without PageIndex enabled. */
export async function indexPdfFromUrl(
  pdfUrl: string,
  boothId: string,
  documentType: 'brochure' | 'priceList' | 'siteLayout' | 'unitLayout',
): Promise<void> {
  if (!isPdfUrl(pdfUrl)) {
    setPageIndexStatus(boothId, documentType, 'error', undefined, 'URL is not a PDF');
    return;
  }

  setPageIndexStatus(boothId, documentType, 'indexing', 'Indexing via server…');

  try {
    const qs = new URLSearchParams({ boothId, documentType, pdfUrl });
    let res: Response;
    try {
      res = await fetch(`/api/pageindex/index-from-url?${qs}`, { method: 'POST' });
    } catch (e) {
      const hint =
        e instanceof TypeError && e.message === 'Failed to fetch'
          ? 'Cannot reach PageIndex API. Run npm run dev (not static hosting).'
          : e instanceof Error
            ? e.message
            : String(e);
      throw new Error(hint);
    }
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText || `HTTP ${res.status}`);
    }
    const data = (await res.json()) as {
      ok: boolean;
      error?: string;
      savedToDb?: boolean;
      dbError?: string;
    };
    if (!data.ok) {
      throw new Error(data.error || 'Unknown PageIndex error');
    }
    if (!data.savedToDb) {
      throw new Error(
        data.dbError ||
          'Index ran but tree was NOT saved to MongoDB. Add MONGODB_URI to .env and restart npm run dev.',
      );
    }
    setPageIndexStatus(boothId, documentType, 'indexed', 'Indexed & saved to MongoDB');
    console.log(`✓ PageIndex: ${boothId}/${documentType} indexed from R2 URL`);
    notifyPageIndexStatusRefresh(boothId);
    return;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    setPageIndexStatus(boothId, documentType, 'error', undefined, msg);
    console.error(`✗ PageIndex from URL failed for ${boothId}/${documentType}:`, msg);
  }
}
