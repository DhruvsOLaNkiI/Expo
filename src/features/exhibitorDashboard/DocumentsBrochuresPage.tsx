import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  CloudUpload,
  Download,
  Eye,
  FileText,
  HelpCircle,
  LayoutGrid,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Search,
  Upload,
} from 'lucide-react';
import { openUrlInNewTab } from '@/utils/openUrl';
import type { BoothLayoutPatch } from '@/features/shared/data/boothLayouts';
import { fetchBoothDocumentStats } from '@/dashboard/api/client';
import {
  DOC_CATEGORIES,
  applyDocumentAnalytics,
  buildBoothDocumentInventory,
  categoryCounts,
  formatStorageUsedGb,
  type BoothDocument,
  type DocCategory,
} from './boothDocumentInventory';
import { STORAGE_LIMIT_GB, type ExhibitorNavId } from './exhibitorConfig';
import { useExhibitorBooth } from './useExhibitorBooth';

const PAGE_SIZE = 6;

type Props = {
  onRegisterHeader?: (node: React.ReactNode) => void;
  onNav?: (id: ExhibitorNavId) => void;
};

const CATEGORY_CLASS: Record<DocCategory, string> = {
  Brochures: 'cat-brochure',
  'Floor Plans': 'cat-floor',
  'Price Lists': 'cat-price',
  Images: 'cat-image',
  Videos: 'cat-video',
  FAQ: 'cat-faq',
  Logo: 'cat-logo',
};

const UPLOAD_SHORTCUTS: {
  label: string;
  description: string;
  nav: ExhibitorNavId;
  icon: typeof Upload;
}[] = [
  { label: 'Booth Setup', description: 'Logo, unit layouts, site plan', nav: 'setup', icon: LayoutGrid },
  { label: 'Upload Documents', description: 'Brochure, price list, video', nav: 'uploads', icon: Upload },
  { label: 'FAQ', description: 'FAQ PDF for AI & visitors', nav: 'faq', icon: HelpCircle },
  { label: 'Sales Chat', description: 'Assign sales person by name', nav: 'salesChat', icon: MessageCircle },
];

export function DocumentsBrochuresPage({ onRegisterHeader, onNav }: Props) {
  const { booth, patchBooth } = useExhibitorBooth();
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('All Categories');
  const [filterType, setFilterType] = useState('All Types');
  const [sortBy, setSortBy] = useState('Recently Added');
  const [page, setPage] = useState(1);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const [analyticsRows, setAnalyticsRows] = useState<
    Awaited<ReturnType<typeof fetchBoothDocumentStats>>
  >([]);

  const boothId = booth?.id ?? '';

  useEffect(() => {
    if (!boothId) return;
    let cancelled = false;
    void fetchBoothDocumentStats(boothId).then((rows) => {
      if (!cancelled) setAnalyticsRows(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [boothId]);

  const documents = useMemo(() => {
    const base = booth ? buildBoothDocumentInventory(booth) : [];
    if (!analyticsRows.length) return base;
    return applyDocumentAnalytics(base, analyticsRows);
  }, [booth, analyticsRows]);

  const counts = useMemo(() => categoryCounts(documents), [documents]);
  const storageUsed = formatStorageUsedGb(documents);
  const storagePct = Math.min(100, (storageUsed / STORAGE_LIMIT_GB) * 100);

  const filtered = useMemo(() => {
    let rows = [...documents];
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.fileName.toLowerCase().includes(q) ||
          d.category.toLowerCase().includes(q),
      );
    }
    if (filterCategory !== 'All Categories') {
      rows = rows.filter((d) => d.category === filterCategory);
    }
    if (filterType !== 'All Types') {
      rows = rows.filter((d) => d.fileType === filterType);
    }
    if (sortBy === 'Most Opens') rows.sort((a, b) => b.opens - a.opens);
    return rows;
  }, [documents, search, filterCategory, filterType, sortBy]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, pageCount);
  const pageRows = filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search, filterCategory, filterType, sortBy]);

  useEffect(() => {
    if (!onRegisterHeader) return;
    onRegisterHeader(
      <>
        <div className="exb-storage-pill">
          <span>
            Storage Usage: {storageUsed.toFixed(2)} GB / {STORAGE_LIMIT_GB} GB
          </span>
          <div className="exb-storage-bar">
            <i style={{ width: `${storagePct}%` }} />
          </div>
        </div>
        <button
          type="button"
          className="exb-btn exb-btn-primary"
          onClick={() => onNav?.('uploads')}
        >
          <Plus size={15} />
          Upload Document
        </button>
      </>,
    );
    return () => onRegisterHeader(null);
  }, [onRegisterHeader, onNav, storagePct, storageUsed]);

  const totals = useMemo(() => {
    const opens = analyticsRows.length
      ? analyticsRows.reduce((s, r) => s + r.opens, 0)
      : documents.reduce((s, d) => s + d.opens, 0);
    const downloads = analyticsRows.length
      ? analyticsRows.reduce((s, r) => s + r.closes, 0)
      : documents.reduce((s, d) => s + d.downloads, 0);
    const avgMs =
      analyticsRows.length > 0
        ? Math.round(
            analyticsRows.reduce((s, r) => s + r.avgDwellMs * r.closes, 0) /
              Math.max(1, analyticsRows.reduce((s, r) => s + r.closes, 0)),
          )
        : 0;
    return {
      docs: documents.length,
      downloads,
      opens,
      avgTime:
        avgMs > 0
          ? `${Math.floor(avgMs / 60_000)}m ${String(Math.floor((avgMs % 60_000) / 1000)).padStart(2, '0')}s`
          : '3m 42s',
    };
  }, [documents, analyticsRows]);

  const removeDocument = useCallback(
    async (doc: BoothDocument) => {
      if (!booth) return;
      const patch: BoothLayoutPatch = {};

      if (doc.source === 'media' && doc.mediaId) {
        patch.media = (booth.media ?? []).filter((m) => m.id !== doc.mediaId);
      } else if (doc.fieldKey) {
        assignBoothField(patch, doc.fieldKey, '');
        if (doc.fieldKey === 'siteMapUrl') patch.siteMapGallery = [];
      }

      await patchBooth(patch);
      setStatusMsg(`Removed ${doc.name}`);
    },
    [booth, patchBooth],
  );

  if (!booth) {
    return <div className="exb-loading">Loading documents…</div>;
  }

  return (
    <>
      <section className="exb-kpi-grid exb-docs-kpis">
        <article className="exb-card exb-stat-card">
          <FileText size={18} className="exb-stat-icon purple" />
          <p className="exb-muted">Total Documents</p>
          <p className="exb-kpi-value sm">{totals.docs}</p>
          <span className="exb-stat-sub">All time uploaded</span>
        </article>
        <article className="exb-card exb-stat-card">
          <Download size={18} className="exb-stat-icon blue" />
          <p className="exb-muted">Total Downloads</p>
          <p className="exb-kpi-value sm">{totals.downloads.toLocaleString()}</p>
          <span className="exb-stat-sub">Across all documents</span>
        </article>
        <article className="exb-card exb-stat-card">
          <Eye size={18} className="exb-stat-icon green" />
          <p className="exb-muted">Total Opens</p>
          <p className="exb-kpi-value sm">{totals.opens.toLocaleString()}</p>
          <span className="exb-stat-sub">Brochure / PDF opens</span>
        </article>
        <article className="exb-card exb-stat-card">
          <BarChart3 size={18} className="exb-stat-icon amber" />
          <p className="exb-muted">Avg. Time Spent</p>
          <p className="exb-kpi-value sm">{totals.avgTime}</p>
          <span className="exb-stat-sub">On documents</span>
        </article>
        <article className="exb-card exb-stat-card">
          <CloudUpload size={18} className="exb-stat-icon pink" />
          <p className="exb-muted">Total Storage</p>
          <p className="exb-kpi-value sm">{storageUsed.toFixed(2)} GB</p>
          <span className="exb-stat-sub">of {STORAGE_LIMIT_GB} GB used</span>
        </article>
      </section>

      {statusMsg && <div className="exb-toast ok">{statusMsg}</div>}

      <section className="exb-row exb-docs-upload-row">
        {onNav && (
          <article className="exb-card exb-upload-hub">
            <div className="exb-card-head">
              <h3>Upload & manage</h3>
            </div>
            <p className="exb-muted exb-upload-hub-lead">
              No drag-and-drop here — open the right page for each asset type.
            </p>
            <div className="exb-upload-hub-grid">
              {UPLOAD_SHORTCUTS.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.nav}
                    type="button"
                    className="exb-upload-hub-tile"
                    onClick={() => onNav(item.nav)}
                  >
                    <Icon size={18} />
                    <strong>{item.label}</strong>
                    <span>{item.description}</span>
                  </button>
                );
              })}
            </div>
          </article>
        )}

        <article className="exb-card exb-categories-card">
          <div className="exb-card-head">
            <h3>Document Categories</h3>
          </div>
          <div className="exb-category-grid">
            {DOC_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                className="exb-category-tile exb-category-tile-btn"
                onClick={() => {
                  setFilterCategory(cat);
                  setPage(1);
                }}
              >
                <span className={`exb-cat-tag ${CATEGORY_CLASS[cat]}`}>{cat}</span>
                <strong>{counts[cat]}</strong>
              </button>
            ))}
          </div>
        </article>
      </section>

      <section className="exb-card exb-docs-table-card">
        <div className="exb-card-head">
          <h3>All Documents</h3>
        </div>
        <div className="exb-docs-toolbar">
          <div className="exb-search">
            <Search size={14} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search documents…"
            />
          </div>
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
            <option>All Categories</option>
            {DOC_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option>All Types</option>
            <option>PDF</option>
            <option>JPG</option>
            <option>PNG</option>
            <option>MP4</option>
            <option>WEBP</option>
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option>Recently Added</option>
            <option>Most Opens</option>
          </select>
        </div>

        <div className="exb-table-scroll">
          <table className="exb-table exb-docs-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Document Name</th>
                <th>Category</th>
                <th>Type</th>
                <th>Size</th>
                <th>Opens</th>
                <th>Downloads</th>
                <th>Avg. Time</th>
                <th>Status</th>
                <th>Uploaded On</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="exb-empty">
                    No documents yet. Use Upload Document or the shortcuts above to add files.
                  </td>
                </tr>
              ) : (
                pageRows.map((doc, idx) => (
                  <DocTableRow
                    key={doc.id}
                    doc={doc}
                    index={(pageSafe - 1) * PAGE_SIZE + idx + 1}
                    onRemove={() => void removeDocument(doc)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && (
          <footer className="exb-table-footer">
            <span>
              Showing {(pageSafe - 1) * PAGE_SIZE + 1} to{' '}
              {Math.min(pageSafe * PAGE_SIZE, filtered.length)} of {filtered.length} documents
            </span>
            <div className="exb-pagination">
              <button
                type="button"
                className="exb-btn exb-btn-sm"
                disabled={pageSafe <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ‹
              </button>
              {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`exb-btn exb-btn-sm ${n === pageSafe ? 'active' : ''}`}
                  onClick={() => setPage(n)}
                >
                  {n}
                </button>
              ))}
              <button
                type="button"
                className="exb-btn exb-btn-sm"
                disabled={pageSafe >= pageCount}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              >
                ›
              </button>
            </div>
          </footer>
        )}
      </section>
    </>
  );
}

function assignBoothField(patch: BoothLayoutPatch, field: keyof BoothLayoutPatch, value: string) {
  switch (field) {
    case 'brochureUrl':
      patch.brochureUrl = value;
      break;
    case 'priceListUrl':
      patch.priceListUrl = value;
      break;
    case 'unitLayoutUrl':
      patch.unitLayoutUrl = value;
      break;
    case 'videoUrl':
      patch.videoUrl = value;
      break;
    case 'stageScreenUrl':
      patch.stageScreenUrl = value;
      break;
    case 'signageImageUrl':
      patch.signageImageUrl = value;
      break;
    case 'siteMapUrl':
      patch.siteMapUrl = value;
      break;
    case 'headerLogoUrl':
      patch.headerLogoUrl = value;
      break;
    case 'faqUrl':
      patch.faqUrl = value;
      break;
    default:
      break;
  }
}

function DocTableRow({
  doc,
  index,
  onRemove,
}: {
  doc: BoothDocument;
  index: number;
  onRemove: () => void;
}) {
  const maxBar = 320;
  const barPct = Math.min(100, (doc.opens / maxBar) * 100);

  return (
    <tr>
      <td>{index}</td>
      <td>
        <div className="exb-doc-name">
          <div className="exb-doc-thumb">{doc.fileType.slice(0, 1)}</div>
          <div>
            <strong>{doc.name}</strong>
            <span>{doc.fileName}</span>
          </div>
        </div>
      </td>
      <td>
        <span className={`exb-cat-pill ${CATEGORY_CLASS[doc.category]}`}>{doc.category}</span>
      </td>
      <td>
        <span className="exb-type-pill">{doc.fileType}</span>
      </td>
      <td>{doc.sizeLabel}</td>
      <td>{doc.opens}</td>
      <td>{doc.downloads}</td>
      <td>
        <div className="exb-avg-cell">
          <span>{doc.avgTime}</span>
          <div className="exb-avg-bar">
            <i style={{ width: `${barPct}%` }} />
          </div>
        </div>
      </td>
      <td>
        <span className="status published">{doc.status}</span>
      </td>
      <td className="exb-uploaded-on">{doc.uploadedAt}</td>
      <td>
        <div className="exb-row-actions">
          <button type="button" title="View" onClick={() => openUrlInNewTab(doc.url)}>
            <Eye size={14} />
          </button>
          <button type="button" title="Download" onClick={() => openUrlInNewTab(doc.url)}>
            <Download size={14} />
          </button>
          <button type="button" title="Stats" onClick={() => openUrlInNewTab(doc.url)}>
            <BarChart3 size={14} />
          </button>
          <button type="button" title="More" onClick={onRemove}>
            <MoreHorizontal size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
}
