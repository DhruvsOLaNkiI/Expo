import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchAllPageIndexOverview,
  PAGEINDEX_STATUS_REFRESH,
  type PageIndexDocType,
  type PageIndexOverviewEntry,
} from '@/api/pageindexAutoIndex';
import type { BoothLayoutConfig } from '@/features/shared/data/boothLayouts';
import { CmsPageIndexBoothDashboard } from './CmsPageIndexBoothDashboard';
import { CmsPageIndexTreeView } from './CmsPageIndexTreeView';
import { type PageIndexTreePick } from './pageIndexTreeUi';

const DOC_TYPES: PageIndexDocType[] = ['brochure', 'priceList', 'siteLayout', 'unitLayout'];

const DOC_LABELS: Record<PageIndexDocType, string> = {
  brochure: 'Brochure',
  priceList: 'Price list',
  siteLayout: 'Site layout',
  unitLayout: 'Unit layout',
};

function formatIndexedAt(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

function docCell(
  entry: PageIndexOverviewEntry | undefined,
  pick: PageIndexTreePick,
  onOpenTree: (pick: PageIndexTreePick) => void,
) {
  if (!entry) {
    return (
      <span className="inline-flex rounded px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide bg-white/[0.06] text-white/35">
        No row
      </span>
    );
  }
  if (entry.indexStatus === 'indexing') {
    return (
      <span className="inline-flex rounded px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide bg-blue-500/20 text-blue-300">
        Indexing…
      </span>
    );
  }
  if (entry.indexStatus === 'failed' || entry.indexError) {
    return (
      <button
        type="button"
        onClick={() => onOpenTree(pick)}
        className="inline-flex rounded px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide bg-red-500/20 text-red-300 hover:bg-red-500/30"
        title={entry.indexError ?? 'View MongoDB row'}
      >
        Failed · open tree
      </button>
    );
  }
  if (entry.indexed && entry.treeStats) {
    const s = entry.treeStats;
    return (
      <button
        type="button"
        onClick={() => onOpenTree(pick)}
        className="space-y-0.5 text-left rounded-md px-1 py-0.5 transition-colors hover:bg-white/[0.04]"
        title="Open full structure tree page"
      >
        <span className="inline-flex rounded px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide bg-green-500/20 text-green-300">
          ✓ {s.topLevelSections} sections
        </span>
        <p className="text-[8px] text-white/35">{s.totalNodes} nodes · {s.jsonSizeKb} KB</p>
        <p className="text-[8px] font-semibold text-[#d4af37]/80">Open full tree →</p>
      </button>
    );
  }
  if (entry.indexStatus === 'pending' || entry.pdfUrl) {
    return (
      <button
        type="button"
        onClick={() => onOpenTree(pick)}
        className="inline-flex rounded px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide bg-amber-500/15 text-amber-200 hover:bg-amber-500/25"
      >
        Slot only · open tree
      </button>
    );
  }
  return (
    <span className="inline-flex rounded px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide bg-red-500/15 text-red-300/90">
      Not indexed
    </span>
  );
}

type Props = {
  booths: BoothLayoutConfig[];
  onSelectBooth: (boothId: string) => void;
};

export function CmsPageIndexTab({ booths, onSelectBooth }: Props) {
  const [rows, setRows] = useState<PageIndexOverviewEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'indexed' | 'missing'>('all');
  const [boothPick, setBoothPick] = useState<{ boothId: string; boothName: string } | null>(null);
  const [treePick, setTreePick] = useState<PageIndexTreePick | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const docs = await fetchAllPageIndexOverview();
      setRows(docs);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onRefresh = () => void load();
    window.addEventListener(PAGEINDEX_STATUS_REFRESH, onRefresh);
    return () => window.removeEventListener(PAGEINDEX_STATUS_REFRESH, onRefresh);
  }, [load]);

  const byBooth = useMemo(() => {
    const map = new Map<string, Map<PageIndexDocType, PageIndexOverviewEntry>>();
    for (const row of rows) {
      const type = row.documentType as PageIndexDocType;
      if (!map.has(row.boothId)) map.set(row.boothId, new Map());
      map.get(row.boothId)!.set(type, row);
    }
    return map;
  }, [rows]);

  const tableRows = useMemo(() => {
    const mongoBoothIds = new Set(rows.map((r) => r.boothId));
    const allIds = new Set([...booths.map((b) => b.id), ...mongoBoothIds]);

    return [...allIds]
      .sort()
      .map((boothId) => {
        const booth = booths.find((b) => b.id === boothId);
        const docs = byBooth.get(boothId);
        const hasIndexed = DOC_TYPES.some((t) => docs?.get(t)?.indexed);
        return {
          boothId,
          name: booth?.name ?? boothId,
          docs,
          hasIndexed,
        };
      })
      .filter((r) => {
        if (filter === 'indexed') return r.hasIndexed;
        if (filter === 'missing') return !r.hasIndexed;
        return true;
      });
  }, [booths, byBooth, rows, filter]);

  const indexedBoothCount = useMemo(() => {
    const ids = new Set([...booths.map((b) => b.id), ...rows.map((r) => r.boothId)]);
    let n = 0;
    for (const boothId of ids) {
      const docs = byBooth.get(boothId);
      if (DOC_TYPES.some((t) => docs?.get(t)?.indexed)) n += 1;
    }
    return n;
  }, [booths, byBooth, rows]);

  if (treePick) {
    return (
      <CmsPageIndexTreeView
        pick={treePick}
        onBack={() => setTreePick(null)}
        backLabel={boothPick ? '← Back to booth dashboard' : '← Back to Page Indexing table'}
      />
    );
  }

  if (boothPick) {
    return (
      <CmsPageIndexBoothDashboard
        boothId={boothPick.boothId}
        boothName={boothPick.boothName}
        docs={byBooth.get(boothPick.boothId)}
        onBack={() => setBoothPick(null)}
        onOpenTree={setTreePick}
        onOpenBooth={() => onSelectBooth(boothPick.boothId)}
      />
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#0a0a0f]">
      <div className="border-b border-white/[0.06] px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold tracking-wide text-[#d4af37]">Page Indexing</h3>
            <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-white/45">
              MongoDB <span className="font-mono text-white/55">pageindexes</span> — click a{' '}
              <span className="text-[#d4af37]/90">booth name</span> for all document indexing, or{' '}
              <span className="text-[#d4af37]/90">Open full tree</span> on a single file.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as typeof filter)}
              className="rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-[11px] text-white/80"
            >
              <option value="all">All booths</option>
              <option value="indexed">Indexed only</option>
              <option value="missing">Missing index</option>
            </select>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="rounded-lg border border-[#d4af37]/35 bg-[#d4af37]/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[#d4af37] hover:bg-[#d4af37]/18 disabled:opacity-50"
            >
              {loading ? 'Loading…' : 'Refresh'}
            </button>
          </div>
        </div>
        {error ? (
          <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-300">
            {error}
          </p>
        ) : null}
        <p className="mt-2 text-[10px] text-white/35">
          {indexedBoothCount} booth{indexedBoothCount === 1 ? '' : 's'} with at least one indexed document ·{' '}
          {rows.length} MongoDB row{rows.length === 1 ? '' : 's'}
        </p>
      </div>

      <div className="flex-1 overflow-auto px-6 py-4">
        <table className="w-full min-w-[900px] border-collapse text-left text-[11px]">
          <thead>
            <tr className="border-b border-white/[0.08] text-[9px] font-bold uppercase tracking-widest text-white/40">
              <th className="sticky top-0 bg-[#0a0a0f] px-3 py-2">Booth ID</th>
              <th className="sticky top-0 bg-[#0a0a0f] px-3 py-2">Name</th>
              {DOC_TYPES.map((t) => (
                <th key={t} className="sticky top-0 bg-[#0a0a0f] px-3 py-2">
                  {DOC_LABELS[t]}
                </th>
              ))}
              <th className="sticky top-0 bg-[#0a0a0f] px-3 py-2">Last indexed</th>
              <th className="sticky top-0 bg-[#0a0a0f] px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {tableRows.map((row) => {
              const docs = row.docs;
              const lastAt = DOC_TYPES.map((t) => docs?.get(t)?.indexedAt)
                .filter((v): v is string => !!v)
                .sort()
                .reverse()[0];

              return (
                <tr
                  key={row.boothId}
                  className={`border-b border-white/[0.04] hover:bg-white/[0.03] ${
                    row.hasIndexed ? '' : 'opacity-80'
                  }`}
                >
                  <td className="px-3 py-3 font-mono text-[10px] text-[#d4af37]/90">{row.boothId}</td>
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      onClick={() => setBoothPick({ boothId: row.boothId, boothName: row.name })}
                      className="font-semibold text-white/85 hover:text-[#d4af37] text-left"
                      title="Open booth indexing dashboard"
                    >
                      {row.name}
                    </button>
                  </td>
                  {DOC_TYPES.map((t) => (
                    <td key={t} className="px-3 py-3 align-top">
                      {docCell(docs?.get(t), {
                        boothId: row.boothId,
                        documentType: t,
                        boothName: row.name,
                      }, setTreePick)}
                    </td>
                  ))}
                  <td className="px-3 py-3 text-white/45 whitespace-nowrap">{formatIndexedAt(lastAt ?? null)}</td>
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      onClick={() => onSelectBooth(row.boothId)}
                      className="rounded border border-white/10 px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-white/50 hover:border-[#d4af37]/40 hover:text-[#d4af37]"
                    >
                      Open booth
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!loading && tableRows.length === 0 ? (
          <p className="py-12 text-center text-sm text-white/35">No booths match this filter.</p>
        ) : null}
      </div>
    </div>
  );
}
