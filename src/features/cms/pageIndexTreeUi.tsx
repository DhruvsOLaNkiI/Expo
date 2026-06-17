import { useState } from 'react';
import type { PageIndexDocType } from '@/api/pageindexAutoIndex';

export const PAGE_INDEX_DOC_LABELS: Record<PageIndexDocType, string> = {
  brochure: 'Brochure',
  priceList: 'Price list',
  siteLayout: 'Site layout',
  unitLayout: 'Unit layout',
};

export type PageIndexTreePick = {
  boothId: string;
  documentType: PageIndexDocType;
  boothName: string;
};

export function normalizePageIndexTreeNodes(structure: unknown): unknown[] {
  if (Array.isArray(structure)) return structure;
  if (structure && typeof structure === 'object') {
    const inner = (structure as { structure?: unknown[] }).structure;
    if (Array.isArray(inner)) return inner;
  }
  return [];
}

export function PageIndexTreeNode({
  node,
  depth = 0,
  defaultOpenDepth = 3,
}: {
  node: unknown;
  depth?: number;
  defaultOpenDepth?: number;
}) {
  const [open, setOpen] = useState(depth < defaultOpenDepth);
  if (!node || typeof node !== 'object') return null;
  const n = node as Record<string, unknown>;
  const title = typeof n.title === 'string' ? n.title : 'Untitled';
  const summary = typeof n.summary === 'string' ? n.summary : '';
  const text = typeof n.text === 'string' ? n.text.trim() : '';
  const children = Array.isArray(n.nodes) ? (n.nodes as unknown[]) : [];
  const p0 = n.start_index;
  const p1 = n.end_index;
  const pages =
    typeof p0 === 'number'
      ? `pages ${p0}${typeof p1 === 'number' && p1 !== p0 ? `–${p1}` : ''}`
      : null;

  return (
    <div className="select-text border-l border-white/[0.06] pl-3" style={{ marginLeft: depth > 0 ? 8 : 0 }}>
      <button
        type="button"
        onClick={() => children.length && setOpen((o) => !o)}
        className={`flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left transition-colors ${
          children.length ? 'cursor-pointer hover:bg-white/[0.04]' : 'cursor-default'
        }`}
      >
        <span className="mt-1 w-4 shrink-0 text-xs text-[#d4af37]/70">
          {children.length ? (open ? '▾' : '▸') : '•'}
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-sm font-semibold text-white/92">{title}</span>
          {pages ? (
            <span className="ml-2 text-[10px] font-mono text-[#d4af37]/80">{pages}</span>
          ) : null}
          {summary ? (
            <p className="mt-1 text-xs leading-relaxed text-white/50">{summary}</p>
          ) : null}
          {text ? (
            <p className="mt-1 text-xs leading-relaxed text-white/40 font-mono whitespace-pre-wrap break-words">
              {text}
            </p>
          ) : null}
        </span>
      </button>
      {open &&
        children.map((child, i) => (
          <PageIndexTreeNode
            key={`${depth}-${i}-${title}`}
            node={child}
            depth={depth + 1}
            defaultOpenDepth={defaultOpenDepth}
          />
        ))}
    </div>
  );
}
