import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { openUrlInNewTab } from '@/utils/openUrl';
import type { BoothLayoutPatch } from '@/features/shared/data/boothLayouts';
import { fetchBoothDocumentStats } from '@/dashboard/api/client';
import {
  applyDocumentAnalytics,
  buildBoothDocumentInventory,
  type BoothDocument,
} from './boothDocumentInventory';
import { ExhibitorChecklistBanner } from './ExhibitorChecklistBanner';
import {
  exhibitorUploadError,
  exhibitorUploadFile,
  useExhibitorPersist,
} from './exhibitorUpload';
import type { ExhibitorNavId } from './exhibitorConfig';
import { UploadSlotCard } from './UploadSlotCard';
import { useExhibitorBooth } from './useExhibitorBooth';

const MAX_FILE_MB = 100;

const BOOTH_DOC_SLOTS = [
  {
    id: 'brochure',
    title: 'Project brochure',
    description: 'PDF visitors open from the Brochure button at your booth.',
    field: 'brochureUrl' as const,
    folder: 'brochure',
    accept: '.pdf,application/pdf',
    hint: 'PDF · max 100 MB',
  },
  {
    id: 'price',
    title: 'Price list',
    description: 'Pricing sheet or rate card for the Price list button.',
    field: 'priceListUrl' as const,
    folder: 'price-list',
    accept: '.pdf,application/pdf,image/*',
    hint: 'PDF or image',
  },
  {
    id: 'video',
    title: 'Walkthrough video',
    description: 'Project walkthrough for the Walk Through button.',
    field: 'videoUrl' as const,
    folder: 'walkthrough-video',
    accept: 'video/*,.mp4,.webm',
    hint: 'MP4 / WEBM · max 100 MB',
  },
] as const;

type Props = { onNav: (id: ExhibitorNavId) => void };

export function ExhibitorDocumentsPage({ onNav }: Props) {
  const { booth, boothId, patchBooth, loading } = useExhibitorBooth();
  const persist = useExhibitorPersist(patchBooth);

  const [brochureUrl, setBrochureUrl] = useState('');
  const [priceListUrl, setPriceListUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [analyticsRows, setAnalyticsRows] = useState<
    Awaited<ReturnType<typeof fetchBoothDocumentStats>>
  >([]);

  useEffect(() => {
    if (!booth) return;
    setBrochureUrl(booth.brochureUrl ?? '');
    setPriceListUrl(booth.priceListUrl ?? '');
    setVideoUrl(booth.videoUrl ?? '');
  }, [booth]);

  useEffect(() => {
    let cancelled = false;
    void fetchBoothDocumentStats(boothId).then((rows) => {
      if (!cancelled) setAnalyticsRows(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [boothId]);

  const urlByField = useMemo(
    () => ({
      brochureUrl,
      priceListUrl,
      videoUrl,
    }),
    [brochureUrl, priceListUrl, videoUrl],
  );

  const setUrlByField = useCallback((field: keyof typeof urlByField, url: string) => {
    if (field === 'brochureUrl') setBrochureUrl(url);
    if (field === 'priceListUrl') setPriceListUrl(url);
    if (field === 'videoUrl') setVideoUrl(url);
  }, []);

  const uploadSlot = useCallback(
    async (slot: (typeof BOOTH_DOC_SLOTS)[number], file: File) => {
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        setErrorMsg(`${file.name} exceeds ${MAX_FILE_MB} MB`);
        return;
      }
      setUploadingId(slot.id);
      setErrorMsg(null);
      try {
        const url = await exhibitorUploadFile(file, boothId, slot.folder);
        setUrlByField(slot.field, url);
        const patch: BoothLayoutPatch = { [slot.field]: url };
        const r = await persist(patch, slot.title);
        setStatusMsg(r.message);
        const stats = await fetchBoothDocumentStats(boothId);
        setAnalyticsRows(stats);
      } catch (e) {
        setErrorMsg(exhibitorUploadError(e));
      } finally {
        setUploadingId(null);
      }
    },
    [boothId, persist, setUrlByField],
  );

  const documents = useMemo(() => {
    if (!booth) return [];
    const base = buildBoothDocumentInventory(booth);
    if (!analyticsRows.length) return base;
    return applyDocumentAnalytics(base, analyticsRows);
  }, [booth, analyticsRows]);

  const docRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const boothDocs = documents.filter((d) =>
      ['Brochures', 'Price Lists', 'Videos'].includes(d.category),
    );
    if (!q) return boothDocs;
    return boothDocs.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.fileName.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q),
    );
  }, [documents, search]);

  if (loading || !booth) {
    return <div className="exb-loading">Loading documents…</div>;
  }

  return (
    <>
      <ExhibitorChecklistBanner onGo={onNav} filterNav="uploads" />
      {(statusMsg || errorMsg) && (
        <div className={`exb-toast ${errorMsg ? 'error' : 'ok'}`}>{errorMsg ?? statusMsg}</div>
      )}

      <p className="exb-page-lead">
        Upload each visitor-facing document in its own slot. Logo, unit layouts, and site plan are in{' '}
        <button type="button" className="exb-inline-link" onClick={() => onNav('setup')}>
          Booth Setup
        </button>
        .
      </p>

      <div className="exb-slot-grid">
        {BOOTH_DOC_SLOTS.map((slot) => (
          <UploadSlotCard
            key={slot.id}
            title={slot.title}
            description={slot.description}
            accept={slot.accept}
            hint={slot.hint}
            url={urlByField[slot.field]}
            uploading={uploadingId === slot.id}
            onUpload={(file) => uploadSlot(slot, file)}
          />
        ))}
      </div>

      <section className="exb-card exb-docs-table-card">
        <div className="exb-card-head">
          <h3>Uploaded documents</h3>
        </div>
        <div className="exb-docs-toolbar">
          <div className="exb-search">
            <Search size={14} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" />
          </div>
        </div>
        <div className="exb-table-scroll">
          <table className="exb-table exb-docs-table">
            <thead>
              <tr>
                <th>Document</th>
                <th>Category</th>
                <th>Opens</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {docRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="exb-empty">
                    Upload brochure, price list, and walkthrough above.
                  </td>
                </tr>
              ) : (
                docRows.map((doc) => <DocRow key={doc.id} doc={doc} />)
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function DocRow({ doc }: { doc: BoothDocument }) {
  return (
    <tr>
      <td>
        <strong>{doc.name}</strong>
        <span className="exb-muted" style={{ display: 'block', fontSize: 10 }}>
          {doc.fileName}
        </span>
      </td>
      <td>{doc.category}</td>
      <td>{doc.opens}</td>
      <td>
        <button type="button" className="exb-btn exb-btn-sm" onClick={() => openUrlInNewTab(doc.url)}>
          View
        </button>
      </td>
    </tr>
  );
}
