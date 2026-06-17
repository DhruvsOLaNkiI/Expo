import type { PageIndexDocType, PageIndexOverviewEntry } from '@/api/pageindexAutoIndex';
import { PAGE_INDEX_DOC_LABELS, type PageIndexTreePick } from './pageIndexTreeUi';

const DOC_TYPES: PageIndexDocType[] = ['brochure', 'priceList', 'siteLayout', 'unitLayout'];

function formatIndexedAt(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

function fileLabel(pdfUrl: string | null, docName: string | null): string {
  if (docName?.trim()) return docName.trim();
  if (!pdfUrl?.trim()) return '—';
  try {
    const path = new URL(pdfUrl).pathname;
    return decodeURIComponent(path.split('/').pop() || pdfUrl);
  } catch {
    return pdfUrl.split('/').pop() || pdfUrl;
  }
}

function statusBadge(entry: PageIndexOverviewEntry | undefined) {
  if (!entry) {
    return (
      <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white/35">
        No MongoDB row
      </span>
    );
  }
  if (entry.indexStatus === 'indexing') {
    return (
      <span className="rounded-full bg-blue-500/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-blue-300">
        Indexing…
      </span>
    );
  }
  if (entry.indexStatus === 'failed' || entry.indexError) {
    return (
      <span className="rounded-full bg-red-500/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-red-300">
        Failed
      </span>
    );
  }
  if (entry.indexed && entry.treeStats) {
    return (
      <span className="rounded-full bg-green-500/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-green-300">
        Indexed · {entry.treeStats.topLevelSections} sections
      </span>
    );
  }
  if (entry.indexStatus === 'pending' || entry.pdfUrl) {
    return (
      <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-200">
        PDF slot only
      </span>
    );
  }
  return (
    <span className="rounded-full bg-red-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-red-300/90">
      Not indexed
    </span>
  );
}

type Props = {
  boothId: string;
  boothName: string;
  docs: Map<PageIndexDocType, PageIndexOverviewEntry> | undefined;
  onBack: () => void;
  onOpenTree: (pick: PageIndexTreePick) => void;
  onOpenBooth: () => void;
};

export function CmsPageIndexBoothDashboard({
  boothId,
  boothName,
  docs,
  onBack,
  onOpenTree,
  onOpenBooth,
}: Props) {
  const indexedCount = DOC_TYPES.filter((t) => docs?.get(t)?.indexed).length;
  const rowCount = DOC_TYPES.filter((t) => docs?.has(t)).length;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#0a0a0f]">
      <div className="shrink-0 border-b border-white/[0.06] px-6 py-4">
        <button
          type="button"
          onClick={onBack}
          className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/45 hover:text-[#d4af37]"
        >
          ← Back to all booths
        </button>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold tracking-wide text-[#d4af37]">Booth indexing dashboard</h3>
            <p className="mt-1 font-mono text-sm text-white/70">{boothId}</p>
            <p className="text-sm font-semibold text-white/85">{boothName}</p>
            <p className="mt-2 text-[11px] text-white/40">
              {indexedCount} of {DOC_TYPES.length} document types indexed · {rowCount} MongoDB row
              {rowCount === 1 ? '' : 's'}
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenBooth}
            className="rounded-lg border border-white/10 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-white/55 hover:border-[#d4af37]/40 hover:text-[#d4af37]"
          >
            Open booth in CMS
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-5">
        <div className="grid gap-4 md:grid-cols-2">
          {DOC_TYPES.map((docType) => {
            const entry = docs?.get(docType);
            const pick: PageIndexTreePick = { boothId, documentType: docType, boothName };
            const canOpenTree = !!entry;

            return (
              <article
                key={docType}
                className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h4 className="text-sm font-bold uppercase tracking-wide text-[#d4af37]">
                    {PAGE_INDEX_DOC_LABELS[docType]}
                  </h4>
                  {statusBadge(entry)}
                </div>

                <dl className="mt-4 space-y-2 text-[11px]">
                  <div className="flex gap-2">
                    <dt className="w-24 shrink-0 text-white/35">Source file</dt>
                    <dd className="min-w-0 flex-1 break-all font-mono text-white/65">
                      {entry?.pdfUrl ? (
                        <a
                          href={entry.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#d4af37] hover:underline"
                        >
                          {fileLabel(entry.pdfUrl, entry.docName)}
                        </a>
                      ) : (
                        fileLabel(null, entry?.docName ?? null)
                      )}
                    </dd>
                  </div>
                  {entry?.docName ? (
                    <div className="flex gap-2">
                      <dt className="w-24 shrink-0 text-white/35">doc_name</dt>
                      <dd className="min-w-0 flex-1 break-all font-mono text-white/50">{entry.docName}</dd>
                    </div>
                  ) : null}
                  <div className="flex gap-2">
                    <dt className="w-24 shrink-0 text-white/35">Last indexed</dt>
                    <dd className="text-white/55">{formatIndexedAt(entry?.indexedAt ?? null)}</dd>
                  </div>
                  {entry?.treeStats ? (
                    <>
                      <div className="flex gap-2">
                        <dt className="w-24 shrink-0 text-white/35">Tree size</dt>
                        <dd className="text-white/55">
                          {entry.treeStats.topLevelSections} sections · {entry.treeStats.totalNodes} nodes ·{' '}
                          {entry.treeStats.jsonSizeKb} KB
                        </dd>
                      </div>
                      {entry.treeStats.sampleTitles.length > 0 ? (
                        <div className="flex gap-2">
                          <dt className="w-24 shrink-0 text-white/35">Sections</dt>
                          <dd className="min-w-0 flex-1">
                            <ul className="space-y-0.5 text-white/45">
                              {entry.treeStats.sampleTitles.map((title, i) => (
                                <li key={i} className="truncate">
                                  · {title}
                                </li>
                              ))}
                            </ul>
                          </dd>
                        </div>
                      ) : null}
                    </>
                  ) : null}
                  {entry?.indexError ? (
                    <div className="flex gap-2">
                      <dt className="w-24 shrink-0 text-white/35">Error</dt>
                      <dd className="min-w-0 flex-1 text-red-300/90">{entry.indexError}</dd>
                    </div>
                  ) : null}
                </dl>

                {canOpenTree ? (
                  <button
                    type="button"
                    onClick={() => onOpenTree(pick)}
                    className="mt-4 rounded-lg border border-[#d4af37]/35 bg-[#d4af37]/10 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-[#d4af37] hover:bg-[#d4af37]/18"
                  >
                    Open full structure tree →
                  </button>
                ) : (
                  <p className="mt-4 text-[10px] text-white/30">No data in MongoDB for this document type.</p>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
