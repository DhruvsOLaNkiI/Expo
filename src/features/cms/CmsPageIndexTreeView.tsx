import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchPageIndexTree,
  type PageIndexTreeResponse,
} from '@/api/pageindexAutoIndex';
import {
  normalizePageIndexTreeNodes,
  PAGE_INDEX_DOC_LABELS,
  PageIndexTreeNode,
  type PageIndexTreePick,
} from './pageIndexTreeUi';

type Props = {
  pick: PageIndexTreePick;
  onBack: () => void;
  backLabel?: string;
};

export function CmsPageIndexTreeView({ pick, onBack, backLabel }: Props) {
  const [data, setData] = useState<PageIndexTreeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showRaw, setShowRaw] = useState(false);
  const [expandAll, setExpandAll] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const tree = await fetchPageIndexTree(pick.boothId, pick.documentType);
      setData(tree);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [pick.boothId, pick.documentType]);

  useEffect(() => {
    void load();
  }, [load]);

  const topNodes = useMemo(() => (data?.structure ? normalizePageIndexTreeNodes(data.structure) : []), [data]);
  const openDepth = expandAll ? 99 : 2;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#0a0a0f]">
      <div className="shrink-0 border-b border-white/[0.06] px-6 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <button
              type="button"
              onClick={onBack}
              className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/45 hover:text-[#d4af37]"
            >
              {backLabel ?? '← Back to Page Indexing table'}
            </button>
            <h3 className="text-lg font-bold tracking-wide text-[#d4af37]">Full structure tree</h3>
            <p className="mt-1 font-mono text-sm text-white/70">{pick.boothId}</p>
            <p className="text-sm text-white/55">
              {pick.boothName} · {PAGE_INDEX_DOC_LABELS[pick.documentType]}
            </p>
            {data?.docName ? (
              <p className="mt-2 font-mono text-[11px] text-white/40 break-all">doc_name: {data.docName}</p>
            ) : null}
            {data?.pdfUrl ? (
              <a
                href={data.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block text-[11px] text-[#d4af37] hover:underline break-all"
              >
                Open source PDF
              </a>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {data?.treeStats ? (
              <span className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] text-white/50">
                {data.treeStats.topLevelSections} sections · {data.treeStats.totalNodes} nodes ·{' '}
                {data.treeStats.jsonSizeKb} KB
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => setExpandAll((v) => !v)}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/55 hover:bg-white/[0.05]"
            >
              {expandAll ? 'Collapse sections' : 'Expand all'}
            </button>
            <button
              type="button"
              onClick={() => setShowRaw((v) => !v)}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/55 hover:bg-white/[0.05]"
            >
              {showRaw ? 'Hide JSON' : 'Show raw JSON'}
            </button>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="rounded-lg border border-[#d4af37]/35 bg-[#d4af37]/10 px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#d4af37] hover:bg-[#d4af37]/18 disabled:opacity-50"
            >
              {loading ? 'Loading…' : 'Reload'}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className={`${showRaw ? 'w-1/2' : 'w-full'} min-w-0 overflow-y-auto px-6 py-5`}>
          {error ? (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </p>
          ) : null}
          {loading && !data ? (
            <p className="text-sm text-white/40">Loading tree from MongoDB…</p>
          ) : null}
          {!loading && data && !data.indexed ? (
            <p className="mb-4 rounded-lg border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              {data.indexError || 'No valid indexed tree in MongoDB yet.'}
            </p>
          ) : null}
          {topNodes.length > 0 ? (
            <div className="space-y-1" key={expandAll ? 'expanded' : 'collapsed'}>
              {topNodes.map((node, i) => (
                <PageIndexTreeNode key={i} node={node} depth={0} defaultOpenDepth={openDepth} />
              ))}
            </div>
          ) : null}
          {!loading && !error && data?.indexed && topNodes.length === 0 ? (
            <p className="text-sm text-white/40">Tree structure is empty.</p>
          ) : null}
        </div>

        {showRaw && data?.structure != null ? (
          <div className="w-1/2 shrink-0 border-l border-white/[0.06] overflow-hidden flex flex-col bg-[#06060a]">
            <div className="shrink-0 border-b border-white/[0.06] px-4 py-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                Raw JSON · MongoDB structure
              </p>
            </div>
            <pre className="flex-1 overflow-auto p-4 text-[11px] leading-relaxed text-white/60 font-mono">
              {JSON.stringify(data.structure, null, 2)}
            </pre>
          </div>
        ) : null}
      </div>
    </div>
  );
}
