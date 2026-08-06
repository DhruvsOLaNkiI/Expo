import { useState, useCallback, useMemo, useEffect, useLayoutEffect, useRef } from 'react';
import { useStore } from '@/store';
import {
  applyBoothOverrides,
  buildDefaultBoothLayoutList,
  deg3ToRad3,
  mergeSceneConfig,
  rad3ToDeg3,
  siteMapToStorageFields,
  siteMapUrlsFromConfig,
  type BoothLayoutConfig,
  type BoothLayoutPatch,
  type CompanyProfile,
  type BoothLighting,
  type MediaItem,
  type PlacedImage,
  type HostessQuickReply,
  type SceneConfig,
} from '@/features/shared/data/boothLayouts';
import { CmsPreview3D } from './CmsPreview3D';
import { CmsHallDisplayPreview } from './CmsHallDisplayPreview';
import { CmsHallMapTab } from './CmsHallMapTab';
import { CmsPageIndexTab } from './CmsPageIndexTab';
import { CmsAllHallsOverview } from './CmsAllHallsOverview';
import { CmsApplyHallLayoutControls } from './CmsApplyHallLayoutControls';
import { CmsApplySelectedBoothLayout } from './CmsApplySelectedBoothLayout';
import { CmsApplyMultiBoothLayout } from './CmsApplyMultiBoothLayout';
import { getExpoHallMeta } from '@/features/shared/data/expoHalls';
import { CmsScenePanel, HallLedMediaField } from './CmsScenePanel';
import { getDashboardPublicUrl } from '@/dashboard';
import { CtaResourcePopupView } from '@/features/media/components/CtaResourcePopup';
import { CmsUploadError, isR2Available, uploadCmsFile, type UploadResult } from '@/api/cmsUpload';
import { normalizeR2PublicUrl } from '@/api/r2Urls';
import { openUrlInNewTab } from '@/utils/openUrl';
import {
  autoIndexPdf,
  fetchBoothPageIndexStatus,
  getPageIndexStatus,
  indexPdfFromUrl,
  isPdfUrl,
  PAGEINDEX_STATUS_REFRESH,
  type PageIndexDbDocStatus,
} from '@/api/pageindexAutoIndex';

function num(v: string, fb: number) { const n = parseFloat(v); return Number.isFinite(n) ? n : fb; }

const PAGEINDEX_DOC_LABELS: Record<string, string> = {
  brochure: 'Brochure',
  priceList: 'Price list',
  siteLayout: 'Site layout',
  unitLayout: 'Unit layout',
};

function formatIndexedAt(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

function PageIndexBoothTracker({
  boothId,
  brochureUrl,
  priceListUrl,
}: {
  boothId: string;
  brochureUrl: string;
  priceListUrl: string;
}) {
  const [rows, setRows] = useState<PageIndexDbDocStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const docs = await fetchBoothPageIndexStatus(boothId, { brochureUrl, priceListUrl });
      setRows(docs.filter((d) => d.documentType === 'brochure' || d.documentType === 'priceList'));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [boothId, brochureUrl, priceListUrl]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onRefresh = (ev: Event) => {
      const detail = (ev as CustomEvent<{ boothId: string }>).detail;
      if (!detail?.boothId || detail.boothId === boothId) void load();
    };
    window.addEventListener(PAGEINDEX_STATUS_REFRESH, onRefresh);
    return () => window.removeEventListener(PAGEINDEX_STATUS_REFRESH, onRefresh);
  }, [boothId, load]);

  const cmsRows = [
    { type: 'brochure' as const, url: brochureUrl },
    { type: 'priceList' as const, url: priceListUrl },
  ];

  return (
    <div className="mb-3 rounded-lg border border-white/[0.08] bg-white/[0.03] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#d4af37]/90">AI index status (MongoDB)</span>
        <button
          type="button"
          className="text-[9px] font-semibold uppercase tracking-wide text-white/40 hover:text-[#d4af37]"
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? 'Checking…' : 'Refresh'}
        </button>
      </div>
      {error && (
        <p className="mb-2 text-[9px] leading-relaxed text-red-300/90">{error}</p>
      )}
      <ul className="space-y-1.5">
        {cmsRows.map(({ type, url }) => {
          const db = rows.find((r) => r.documentType === type);
          const live = getPageIndexStatus(boothId, type);
          const label = PAGEINDEX_DOC_LABELS[type] || type;
          const hasPdf = isPdfUrl(url);

          let badge = '—';
          let badgeClass = 'bg-white/10 text-white/40';
          let hint = '';

          if (live?.status === 'indexing') {
            badge = '⟳ Indexing…';
            badgeClass = 'bg-blue-500/20 text-blue-300';
            hint = live.message || 'Building tree — saved to MongoDB when complete…';
          } else if (db?.indexStatus === 'indexing') {
            badge = '⟳ Stuck indexing';
            badgeClass = 'bg-amber-500/20 text-amber-200';
            hint = 'Old run did not finish. Click Run PageIndex again.';
          } else if (live?.status === 'error') {
            badge = 'Error';
            badgeClass = 'bg-red-500/20 text-red-300';
            hint = live.error || '';
          } else if (!hasPdf) {
            badge = url.trim() ? 'Image (no AI index)' : 'No file';
            badgeClass = 'bg-white/10 text-white/35';
          } else if (db?.slotExists && db?.indexStatus === 'pending') {
            badge = '◌ Slot in MongoDB';
            badgeClass = 'bg-white/10 text-white/50';
            hint = 'Row exists — click Run PageIndex to build the tree.';
          } else if (db?.indexStatus === 'failed') {
            badge = '✗ Index failed';
            badgeClass = 'bg-red-500/20 text-red-300';
            hint = db.indexError || 'Click Run PageIndex again after fixing the PDF or API keys.';
          } else if (db?.readyForChat) {
            badge = '✓ Ready for AI chat';
            badgeClass = 'bg-green-500/20 text-green-300';
            if (db.treeStats) {
              const s = db.treeStats;
              hint = `${s.topLevelSections} top sections · ${s.totalNodes} nodes · ${s.jsonSizeKb} KB in MongoDB`;
              if (s.sampleTitles.length) {
                hint += ` — e.g. ${s.sampleTitles.slice(0, 3).join('; ')}`;
              }
            } else {
              hint = db.indexedAt ? `Indexed ${formatIndexedAt(db.indexedAt)}` : '';
            }
          } else if (db?.stale) {
            badge = '⚠ Stale — re-index';
            badgeClass = 'bg-amber-500/20 text-amber-200';
            hint = 'PDF URL changed since last index. Run PageIndex again.';
          } else if (db?.indexed) {
            badge = 'Indexed (check URL)';
            badgeClass = 'bg-amber-500/15 text-amber-100/80';
          } else {
            badge = '✗ Not indexed';
            badgeClass = 'bg-red-500/15 text-red-300/90';
            hint = 'Upload is not enough — click Run PageIndex below.';
          }

          return (
            <li
              key={type}
              className="flex items-start justify-between gap-2 rounded-md border border-white/[0.05] bg-black/20 px-2 py-1.5"
            >
              <div className="min-w-0">
                <span className="text-[10px] font-semibold text-white/70">{label}</span>
                {url.trim() && (
                  <p className="truncate text-[8px] font-mono text-white/25" title={url}>
                    {url.length > 48 ? `…${url.slice(-44)}` : url}
                  </p>
                )}
                {hint && (
                  <p className="mt-0.5 text-[8px] leading-snug text-white/35" title={hint}>
                    {hint}
                  </p>
                )}
              </div>
              <span className={`shrink-0 rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide ${badgeClass}`}>
                {badge}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PageIndexStatusIcon({ boothId, documentType }: { boothId: string; documentType: string }) {
  const [, tick] = useState(0);
  const status = getPageIndexStatus(boothId, documentType);

  useEffect(() => {
    if (status?.status !== 'indexing') return;
    const id = window.setInterval(() => tick((n) => n + 1), 800);
    return () => window.clearInterval(id);
  }, [status?.status]);

  if (!status) return null;

  const baseClass = 'inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide';

  if (status.status === 'indexing') {
    return <span className={`${baseClass} text-blue-400`}>⟳ Indexing…</span>;
  }
  if (status.status === 'indexed') {
    return <span className={`${baseClass} text-green-400`}>✓ Indexed</span>;
  }
  if (status.status === 'error') {
    return (
      <span title={status.error} className={`${baseClass} text-red-400`}>
        ✗ Error
      </span>
    );
  }
  return null;
}

function PageIndexDocControls({
  boothId,
  documentType,
  pdfUrl,
  enabled,
  onEnabledChange,
  enableLabel,
}: {
  boothId: string;
  documentType: 'brochure' | 'priceList';
  pdfUrl: string;
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  enableLabel: string;
}) {
  const canIndex = isPdfUrl(pdfUrl);

  return (
    <div className="space-y-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="flex items-center justify-between gap-2">
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={enabled} onChange={(e) => onEnabledChange(e.target.checked)} className="h-4 w-4" />
          <span className="text-[10px] uppercase tracking-wide text-white/45">{enableLabel}</span>
        </label>
        <PageIndexStatusIcon boothId={boothId} documentType={documentType} />
      </div>
      {canIndex ? (
        <button
          type="button"
          className="w-full rounded-lg border border-[#d4af37]/35 bg-[#d4af37]/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-[#f5e6bc] hover:bg-[#d4af37]/20"
          onClick={() => void indexPdfFromUrl(pdfUrl, boothId, documentType)}
        >
          Run PageIndex on current PDF
        </button>
      ) : (
        <p className="text-[9px] leading-relaxed text-white/30">Upload a PDF first, then run PageIndex (required for AI Chat on this document).</p>
      )}
    </div>
  );
}

function readFile(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(r.error);
    r.readAsDataURL(file);
  });
}

type Tab =
  | 'allHalls'
  | 'layout'
  | 'branding'
  | 'displays'
  | 'images'
  | 'media'
  | 'company'
  | 'lighting'
  | 'scene'
  | 'hallMap'
  | 'pageIndex';

const BOOTH_TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'allHalls', label: 'All Halls', icon: '▦' },
  { id: 'layout', label: 'Layout', icon: '⊞' },
  { id: 'branding', label: 'Branding', icon: '◈' },
  { id: 'displays', label: 'Displays', icon: '▣' },
  { id: 'images', label: 'Images', icon: '◫' },
  { id: 'media', label: 'Media', icon: '▶' },
  { id: 'pageIndex', label: 'Page Indexing', icon: '⊟' },
  { id: 'company', label: 'Company', icon: '◉' },
  { id: 'lighting', label: 'Lighting', icon: '☀' },
  { id: 'scene', label: 'Scene', icon: '⛶' },
  { id: 'hallMap', label: 'Hall Map', icon: '⊡' },
];

/** CMS sidebar entry for hall-wide LED screens (ballroom + center canopy). */
export const HALL_BIG_DISPLAY_ID = '__hall-big-display__';
/** CMS sidebar entry — every LED / screen across hall + all booths. */
export const ALL_DISPLAYS_ID = '__all-displays__';

export function CmsDashboard() {
  const overrides = useStore((s) => s.boothOverrides);
  const sceneOverrides = useStore((s) => s.sceneOverrides);
  const activeHallId = useStore((s) => s.activeHallId);
  const visitorLandingHallId = useStore((s) => s.visitorLandingHallId);
  const expoHalls = useStore((s) => s.expoHalls);
  const overridesByHall = useStore((s) => s.overridesByHall);
  const sceneOverridesByHall = useStore((s) => s.sceneOverridesByHall);
  const patch = useStore((s) => s.patchBoothOverride);
  const patchScene = useStore((s) => s.patchSceneOverride);
  const resetBooth = useStore((s) => s.resetBoothOverride);
  const resetAll = useStore((s) => s.resetAllBoothOverrides);
  const initCms = useStore((s) => s.initBoothCms);
  const loadCmsExpoOverview = useStore((s) => s.loadCmsExpoOverview);
  const setActiveHall = useStore((s) => s.setActiveHall);
  const setVisitorLandingHallId = useStore((s) => s.setVisitorLandingHallId);
  const applyExpoHallLayoutFrom = useStore((s) => s.applyExpoHallLayoutFrom);
  const applyBoothSlotLayoutFromHall = useStore((s) => s.applyBoothSlotLayoutFromHall);
  const applyBoothSlotsLayoutFromHall = useStore((s) => s.applyBoothSlotsLayoutFromHall);
  const setCmsPage = useStore((s) => s.setCmsPage);
  const boothCmsHydrated = useStore((s) => s._boothCmsHydrated);
  const activeHallLabel = getExpoHallMeta(activeHallId)?.label ?? activeHallId;
  const ctaResourcePopup = useStore((s) => s.ctaResourcePopup);
  const setCtaResourcePopup = useStore((s) => s.setCtaResourcePopup);
  const isAdmin = useStore((s) => s.isAdmin);
  const setAdminLoginOpen = useStore((s) => s.setAdminLoginOpen);

  useEffect(() => {
    void (async () => {
      await initCms();
      await loadCmsExpoOverview();
    })();
  }, [initCms, loadCmsExpoOverview]);

  const defaults = useMemo(() => buildDefaultBoothLayoutList(), []);
  const mergedList = useMemo(() => applyBoothOverrides(defaults, overrides), [defaults, overrides]);

  const [selectedIds, setSelectedIds] = useState<string[]>([defaults[0]?.id ?? 'vertex-elite']);
  const selectedId = selectedIds[selectedIds.length - 1] ?? defaults[0]?.id ?? 'vertex-elite';
  const multiSelect = selectedIds.length > 1;
  const [tab, setTab] = useState<Tab>('allHalls');
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState('');

  const handleBoothSelect = useCallback((id: string, opts?: { additive?: boolean }) => {
    if (opts?.additive) {
      setSelectedIds((prev) => {
        if (prev.includes(id)) {
          const next = prev.filter((x) => x !== id);
          return next.length > 0 ? next : [id];
        }
        return [...prev, id];
      });
    } else {
      setSelectedIds([id]);
    }
  }, []);

  useEffect(() => {
    setSelectedIds([defaults[0]?.id ?? 'vertex-elite']);
  }, [activeHallId, defaults]);

  const handleClearSelection = useCallback(() => {
    setSelectedIds([selectedId]);
  }, [selectedId]);

  const selected = useMemo(() => mergedList.find((b) => b.id === selectedId), [mergedList, selectedId]);
  const selectedBooths = useMemo(
    () => mergedList.filter((b) => selectedIds.includes(b.id)),
    [mergedList, selectedIds],
  );
  const isHallDisplay = selectedId === HALL_BIG_DISPLAY_ID;
  const isAllDisplays = selectedId === ALL_DISPLAYS_ID;
  const isSpecialView = isHallDisplay || isAllDisplays;
  const sceneConfig = useMemo(() => mergeSceneConfig(sceneOverrides), [sceneOverrides]);

  useEffect(() => {
    if (isHallDisplay || isAllDisplays) setTab('displays');
  }, [isHallDisplay, isAllDisplays]);

  const [hallBallroomUrl, setHallBallroomUrl] = useState('');
  const [hallCanopyUrl, setHallCanopyUrl] = useState('');
  const [hallEntranceUrl, setHallEntranceUrl] = useState('');

  const [px, setPx] = useState('0'); const [py, setPy] = useState('0'); const [pz, setPz] = useState('0');
  const [rxDeg, setRxDeg] = useState('0'); const [ryDeg, setRyDeg] = useState('0'); const [rzDeg, setRzDeg] = useState('0');
  const [sx, setSx] = useState('1'); const [sy, setSy] = useState('1'); const [sz, setSz] = useState('1');
  const [name, setName] = useState(''); const [color, setColor] = useState(''); const [accent, setAccent] = useState('');
  const [counterColor, setCounterColor] = useState('');
  const [videoUrl, setVideoUrl] = useState(''); const [headerLogoUrl, setHeaderLogoUrl] = useState('');
  const [stageScreenUrl, setStageScreenUrl] = useState('');
  const [description, setDescription] = useState('');
  const [brochureUrl, setBrochureUrl] = useState('');
  const [siteMapSlides, setSiteMapSlides] = useState<string[]>([]);
  const [priceListUrl, setPriceListUrl] = useState('');
  const [unitLayoutUrl, setUnitLayoutUrl] = useState('');
  const [signageImageUrl, setSignageImageUrl] = useState('');
  const [company, setCompany] = useState<CompanyProfile>({ companyName: '', tagline: '', website: '', phone: '', email: '', whatsapp: '', facebook: '', instagram: '', twitter: '', brandPrimary: '#d4af37', brandSecondary: '#1a1a1a' });
  const [lighting, setLighting] = useState<BoothLighting>({ spotlightIntensity: 55, spotlightColor: '#ffe7bf', ledStripColor: '#d4af37', ledStripIntensity: 2, emissiveGlow: 0.15, ambientIntensity: 0.35 });
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [placedImages, setPlacedImages] = useState<PlacedImage[]>([]);
  const [placingImageUrl, setPlacingImageUrl] = useState<string | null>(null);
  const [placingLabel, setPlacingLabel] = useState('');
  const [repositionImageId, setRepositionImageId] = useState<string | null>(null);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [hostessQuickReplies, setHostessQuickReplies] = useState<HostessQuickReply[]>([]);

  const [enablePageIndexBrochure, setEnablePageIndexBrochure] = useState(false);
  const [enablePageIndexPriceList, setEnablePageIndexPriceList] = useState(false);

  useEffect(() => {
    if (!isHallDisplay) return;
    setHallBallroomUrl(sceneConfig.ballroomStageScreenUrl ?? '');
    setHallCanopyUrl(sceneConfig.hallCanopyScreenUrl ?? '');
    setHallEntranceUrl(sceneConfig.entranceWallScreenUrl ?? '');
  }, [
    isHallDisplay,
    sceneConfig.ballroomStageScreenUrl,
    sceneConfig.hallCanopyScreenUrl,
    sceneConfig.entranceWallScreenUrl,
  ]);

  const loadForm = useCallback((b: BoothLayoutConfig) => {
    setPx(String(b.position[0])); setPy(String(b.position[1])); setPz(String(b.position[2]));
    const [dx, dy, dz] = rad3ToDeg3(b.rotation[0], b.rotation[1], b.rotation[2]);
    setRxDeg(dx.toFixed(2)); setRyDeg(dy.toFixed(2)); setRzDeg(dz.toFixed(2));
    setSx(String(b.scale[0])); setSy(String(b.scale[1])); setSz(String(b.scale[2]));
    setName(b.name); setColor(b.color); setAccent(b.accent); setCounterColor(b.counterColor);
    setVideoUrl(b.videoUrl); setHeaderLogoUrl(b.headerLogoUrl ?? '');
    setStageScreenUrl(b.stageScreenUrl ?? '');
    setDescription(b.description);
    setBrochureUrl(b.brochureUrl);
    setSiteMapSlides(siteMapUrlsFromConfig(b));
    setPriceListUrl(b.priceListUrl);
    setUnitLayoutUrl(b.unitLayoutUrl ?? '');
    setSignageImageUrl(b.signageImageUrl ?? '');
    setCompany({ ...b.company }); setLighting({ ...b.lighting }); setMedia([...b.media]);
    setPlacedImages([...(b.placedImages || [])]);
    setHostessQuickReplies([...(b.hostessQuickReplies ?? [])]);
    setEnablePageIndexBrochure(b.pageIndexBrochure !== false);
    setEnablePageIndexPriceList(b.pageIndexPriceList !== false);
    setPlacingImageUrl(null); setSelectedImageId(null);
  }, []);

  const prevSelectedIdRef = useRef<string | null>(null);
  const prevHydratedRef = useRef(false);
  const prevBoothHashRef = useRef('');
  useEffect(() => {
    if (isSpecialView) return;
    const b = mergedList.find((x) => x.id === selectedId);
    if (!b) return;
    const switchedBooth = prevSelectedIdRef.current !== selectedId;
    if (switchedBooth) prevSelectedIdRef.current = selectedId;
    const becameHydrated = boothCmsHydrated && !prevHydratedRef.current;
    if (becameHydrated) prevHydratedRef.current = true;

    const boothHash = `${b.position.join(',')}|${b.rotation.join(',')}|${b.scale.join(',')}`;
    const transformChanged = boothHash !== prevBoothHashRef.current;
    prevBoothHashRef.current = boothHash;

    if (switchedBooth || becameHydrated || (transformChanged && tab !== 'layout')) loadForm(b);
  }, [selectedId, mergedList, loadForm, boothCmsHydrated, isSpecialView, tab]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2400);
  }, []);

  const toastUploadResult = useCallback(
    (result: UploadResult, label: string) => {
      if (result.storage === 'r2') showToast(`${label} → Cloudflare R2 (uploading…)`);
      else showToast(`${label} saved locally (this browser only — needs R2 on production)`);
    },
    [showToast],
  );

  const showUploadError = useCallback(
    (err: unknown) => {
      const msg =
        err instanceof CmsUploadError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Upload failed';
      showToast(msg.length > 220 ? `${msg.slice(0, 217)}…` : msg);
    },
    [showToast],
  );

  const persistBoothDocumentField = useCallback(
    async (
      boothId: string,
      field: 'brochureUrl' | 'priceListUrl' | 'unitLayoutUrl' | 'videoUrl' | 'stageScreenUrl' | 'signageImageUrl',
      url: string,
      label: string,
      pageIndexFlags?: { brochure?: boolean; priceList?: boolean },
    ) => {
      const normalized =
        field === 'videoUrl' || field === 'stageScreenUrl' || field === 'signageImageUrl' || url.startsWith('data:') || url.startsWith('/')
          ? url.trim()
          : normalizeR2PublicUrl(url);
      const ok = await patch(boothId, { [field]: normalized } as BoothLayoutPatch);
      if (ok) {
        showToast(`${label} → saved for all visitors`);
      } else {
        showToast(`${label} save failed — server may be unreachable`);
      }

      const piBrochure = pageIndexFlags?.brochure ?? (boothId === selectedId && enablePageIndexBrochure);
      const piPriceList = pageIndexFlags?.priceList ?? (boothId === selectedId && enablePageIndexPriceList);
      if (field === 'priceListUrl' && isPdfUrl(normalized) && piPriceList) {
        void indexPdfFromUrl(normalized, boothId, 'priceList');
      }
      if (field === 'brochureUrl' && isPdfUrl(normalized) && piBrochure) {
        void indexPdfFromUrl(normalized, boothId, 'brochure');
      }
    },
    [patch, selectedId, showToast, enablePageIndexPriceList, enablePageIndexBrochure],
  );

  const persistDocumentField = useCallback(
    async (
      field: 'brochureUrl' | 'priceListUrl' | 'unitLayoutUrl' | 'videoUrl' | 'stageScreenUrl' | 'signageImageUrl',
      url: string,
      label: string,
    ) => persistBoothDocumentField(selectedId, field, url, label),
    [persistBoothDocumentField, selectedId],
  );

  const persistHallDisplayField = useCallback(
    async (
      field: 'ballroomStageScreenUrl' | 'hallCanopyScreenUrl' | 'entranceWallScreenUrl',
      url: string,
      label: string,
    ) => {
      patchScene({ [field]: url.trim() });
      showToast(`${label} saved`);
    },
    [patchScene, showToast],
  );

  const persistPageIndexFlag = useCallback(
    async (field: 'pageIndexBrochure' | 'pageIndexPriceList', enabled: boolean) => {
      if (field === 'pageIndexBrochure') setEnablePageIndexBrochure(enabled);
      else setEnablePageIndexPriceList(enabled);
      const ok = await patch(selectedId, { [field]: enabled });
      if (ok) {
        showToast(enabled ? 'PageIndex auto-index on upload (saved)' : 'PageIndex auto-index off (saved)');
        if (enabled) {
          const url = field === 'pageIndexBrochure' ? brochureUrl : priceListUrl;
          const docType = field === 'pageIndexBrochure' ? 'brochure' : 'priceList';
          if (isPdfUrl(url)) void indexPdfFromUrl(url, selectedId, docType);
        }
      } else {
        showToast('Could not save PageIndex setting — server may be unreachable.');
      }
    },
    [patch, selectedId, showToast, brochureUrl, priceListUrl],
  );

  const persistSiteMapSlides = useCallback(
    async (next: string[]) => {
      const { siteMapUrl, siteMapGallery } = siteMapToStorageFields(next);
      setSiteMapSlides(siteMapUrlsFromConfig({ siteMapUrl, siteMapGallery }));
      const ok = await patch(selectedId, { siteMapUrl, siteMapGallery });
      if (ok) showToast('Site map → saved for all visitors');
      else showToast('Site map save failed — server may be unreachable');
    },
    [patch, selectedId, showToast],
  );

  const switchSiteMapToBundledPublicPath = useCallback(async () => {
    await persistSiteMapSlides(['/maps/site-map.svg']);
  }, [persistSiteMapSlides]);

  const handleApply = async () => {
    if (isHallDisplay) {
      patchScene({
        ballroomStageScreenUrl: hallBallroomUrl.trim(),
        hallCanopyScreenUrl: hallCanopyUrl.trim(),
        entranceWallScreenUrl: hallEntranceUrl.trim(),
      });
      showToast('Hall display saved');
      return;
    }
    if (isAllDisplays) return;

    const sm = siteMapToStorageFields(siteMapSlides);
    const hqFiltered = hostessQuickReplies.filter((x) => x.label.trim() && (x.response.trim() || x.action === 'askAi'));
    const ok = await patch(selectedId, {
      position: [num(px, 0), num(py, 0), num(pz, 0)],
      rotation: deg3ToRad3(num(rxDeg, 0), num(ryDeg, 0), num(rzDeg, 0)),
      scale: [num(sx, 1), num(sy, 1), num(sz, 1)],
      name: name.trim() || undefined,
      color: color.trim() || undefined,
      accent: accent.trim() || undefined,
      counterColor: counterColor.trim() || undefined,
      videoUrl: videoUrl.trim() || undefined,
      stageScreenUrl: stageScreenUrl.trim() || undefined,
      headerLogoUrl: headerLogoUrl.trim() || undefined,
      description,
      brochureUrl,
      siteMapUrl: sm.siteMapUrl,
      siteMapGallery: sm.siteMapGallery,
      priceListUrl,
      unitLayoutUrl: unitLayoutUrl.trim() || undefined,
      signageImageUrl: signageImageUrl.trim() || undefined,
      pageIndexBrochure: enablePageIndexBrochure,
      pageIndexPriceList: enablePageIndexPriceList,
      company, lighting, media, placedImages,
      hostessQuickReplies: hqFiltered,
    });
    if (ok) {
      setSiteMapSlides(siteMapUrlsFromConfig({ siteMapUrl: sm.siteMapUrl, siteMapGallery: sm.siteMapGallery }));
      setHostessQuickReplies(hqFiltered);
      showToast('Changes applied & saved');
    } else showToast('Could not persist booth data (localStorage and IndexedDB). Export JSON or use /maps/… paths.');
  };

  const handleSelectHall = useCallback((hallId: string) => {
    void setActiveHall(hallId, { teleport: false });
    setTab('hallMap');
  }, [setActiveHall]);

  const handleSetVisitorLandingHall = useCallback(
    async (hallId: string) => {
      const ok = await setVisitorLandingHallId(hallId);
      if (ok) {
        const label = getExpoHallMeta(hallId)?.label ?? hallId;
        showToast(`Visitor landing hall → ${label}`);
      } else {
        showToast('Could not save visitor landing hall — check admin login / server');
      }
    },
    [setVisitorLandingHallId, showToast],
  );

  const handleApplyLayoutFrom = useCallback(
    async (sourceHallId: string) => {
      const result = await applyExpoHallLayoutFrom(sourceHallId);
      await loadCmsExpoOverview();
      return result;
    },
    [applyExpoHallLayoutFrom, loadCmsExpoOverview],
  );

  const handleApplyBoothSlotsFromHall = useCallback(
    async (slotIds: string[], sourceHallId: string, targetHallIds: string[]) => {
      const result = await applyBoothSlotsLayoutFromHall(slotIds, sourceHallId, targetHallIds);
      await loadCmsExpoOverview();
      return result;
    },
    [applyBoothSlotsLayoutFromHall, loadCmsExpoOverview],
  );

  const handleApplyBoothSlotFromHall = useCallback(
    async (slotId: string, sourceHallId: string, targetHallIds: string[]) =>
      handleApplyBoothSlotsFromHall([slotId], sourceHallId, targetHallIds),
    [handleApplyBoothSlotsFromHall],
  );

  const handleExport = () => {
    const st = useStore.getState();
    const blob = new Blob([JSON.stringify({
      hallId: st.activeHallId,
      halls: st.overridesByHall,
      scenes: st.sceneOverridesByHall,
      booths: overrides,
      scene: st.sceneOverrides,
    }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'booth-cms-export.json'; a.click();
    URL.revokeObjectURL(a.href);
    showToast('Exported JSON');
  };

  const [syncing, setSyncing] = useState(false);
  const handleSyncToServer = async () => {
    setSyncing(true);
    const st = useStore.getState();
    const hallId = st.activeHallId;
    try {
      const boothRes = await fetch('/api/booth-cms/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await import('@/features/admin')).getAdminApiHeaders() },
        body: JSON.stringify({ hallId, booths: st.boothOverrides, scene: st.sceneOverrides }),
      });
      const data = await boothRes.json();
      if (data?.ok) {
        showToast(`✓ All booths + scene synced to server for ${getExpoHallMeta(hallId)?.label ?? hallId} — all visitors will see your layout`);
      } else {
        showToast(`⚠ Server sync failed: ${data?.error || `HTTP ${boothRes.status}`} — check admin key`);
      }
    } catch (e) {
      showToast(`⚠ Server sync failed: ${e instanceof Error ? e.message : 'Network error'}`);
    }
    setSyncing(false);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      void (async () => {
        try {
          const j = JSON.parse(String(reader.result));
          const src = j?.booths || j?.overrides;
          if (src && typeof src === 'object') {
            for (const [id, p] of Object.entries(src)) {
              if (p && typeof p === 'object') await patch(id, p as BoothLayoutPatch);
            }
          }
          if (j?.scene) useStore.getState().patchSceneOverride(j.scene);
          showToast('Imported successfully');
        } catch {
          showToast('Invalid JSON file');
        }
      })();
    };
    reader.readAsText(file); e.target.value = '';
  };

  const filteredBooths = mergedList.filter((b) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return b.id.toLowerCase().includes(q) || b.name.toLowerCase().includes(q);
  });

  const showDisplaySidebarEntries = useMemo(() => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      'hall big display'.includes(q)
      || 'all displays'.includes(q)
      || q.includes('hall')
      || q.includes('display')
      || q.includes('led')
      || q.includes('screen')
    );
  }, [search]);

  const visibleTabs = isHallDisplay
    ? BOOTH_TABS.filter((t) => t.id === 'displays')
    : isAllDisplays
      ? []
      : BOOTH_TABS;

  const handleSurfaceClick = useCallback((pos: [number, number, number], normal: [number, number, number]) => {
    if (!placingImageUrl) return;
    const ry = Math.atan2(normal[0], normal[2]);
    const rx = -Math.asin(normal[1]);
    const nudge = 0.003;
    const position: [number, number, number] = [
      pos[0] + normal[0] * nudge,
      pos[1] + normal[1] * nudge,
      pos[2] + normal[2] * nudge,
    ];
    const rotation: [number, number, number] = [rx, ry, 0];

    if (repositionImageId) {
      setPlacedImages((prev) =>
        prev.map((p) => (p.id === repositionImageId ? { ...p, position, rotation } : p)),
      );
      setRepositionImageId(null);
      setPlacingImageUrl(null);
      setPlacingLabel('');
      showToast('Image moved to wall — drag to fine-tune, then Apply Changes');
      return;
    }

    const newImg: PlacedImage = {
      id: `pi-${Date.now()}`,
      url: placingImageUrl,
      label: placingLabel || 'image',
      position,
      rotation,
      size: [2, 1.5],
    };
    setPlacedImages((prev) => [...prev, newImg]);
    setPlacingImageUrl(null);
    setPlacingLabel('');
    setSelectedImageId(newImg.id);
    showToast('Image placed — drag to reposition, then Apply Changes');
  }, [placingImageUrl, placingLabel, repositionImageId]);

  const handleDragImage = useCallback((id: string, pos: [number, number, number]) => {
    setPlacedImages((prev) => prev.map((p) => p.id === id ? { ...p, position: pos } : p));
  }, []);

  const removePlacedImage = (id: string) => {
    setPlacedImages((prev) => prev.filter((p) => p.id !== id));
    if (selectedImageId === id) setSelectedImageId(null);
  };

  const updatePlacedImage = (id: string, patch: Partial<PlacedImage>) => {
    setPlacedImages((prev) => prev.map((p) => p.id === id ? { ...p, ...patch } : p));
  };

  const addMediaItem = async (file: File, type: MediaItem['type']) => {
    const uploaded = await uploadCmsFile(file, selectedId, 'media');
    setMedia((prev) => [...prev, { id: `m-${Date.now()}`, type, url: uploaded.url, label: file.name }]);
    toastUploadResult(uploaded, file.name);
  };

  const removeMediaItem = (id: string) => { setMedia((prev) => prev.filter((m) => m.id !== id)); };

  const siteMapFields = useMemo(() => siteMapToStorageFields(siteMapSlides), [siteMapSlides]);

  if (!isAdmin) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#0a0a0f] text-white px-6">
        <p className="text-[10px] uppercase tracking-[0.35em] text-violet-300/70 mb-2">Expo CMS</p>
        <h1 className="text-xl font-bold mb-2">Admin access required</h1>
        <p className="text-sm text-white/50 text-center max-w-md mb-6 leading-relaxed">
          Booth content, scene settings, and hall layout are global — only an admin can edit them.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <button
            type="button"
            onClick={() => setAdminLoginOpen(true)}
            className="rounded-lg bg-violet-600 px-5 py-2.5 text-xs font-bold uppercase tracking-wider hover:bg-violet-500"
          >
            Admin login
          </button>
          <button
            type="button"
            onClick={() => setCmsPage('expo')}
            className="rounded-lg border border-white/15 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-white/70 hover:bg-white/5"
          >
            Back to expo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex bg-[#0a0a0f] text-white font-sans select-none">
      {/* Sidebar */}
      <aside className="flex w-64 shrink-0 flex-col border-r border-white/[0.06] bg-[#0d0d14]">
        <div className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-4">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#d4af37] to-[#b08d29] flex items-center justify-center text-black text-sm font-bold">E</div>
          <div>
            <h1 className="text-sm font-bold tracking-wide text-[#d4af37]">EXPO CMS</h1>
            <p className="text-[10px] text-white/40">Virtual Residential Expo</p>
          </div>
        </div>
        <div className="px-3 pt-3 pb-2">
          <input
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-white placeholder-white/30 outline-none focus:border-[#d4af37]/40"
            placeholder="Search booths…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
          <div className="mx-1 mb-2 rounded-lg border border-[#d4af37]/25 bg-[#d4af37]/08 p-2.5">
            <p className="text-[9px] font-bold uppercase tracking-widest text-[#d4af37]/90">
              Visitor landing hall
            </p>
            <p className="mt-1 text-[10px] leading-snug text-white/45">
              Visitors open into this hall when they enter the expo.
            </p>
            <select
              className="mt-2 w-full rounded-md border border-white/12 bg-black/30 px-2 py-1.5 text-xs text-white outline-none focus:border-[#d4af37]/50"
              value={visitorLandingHallId}
              onChange={(e) => void handleSetVisitorLandingHall(e.target.value)}
            >
              {expoHalls.map((h) => (
                <option key={h.hallId} value={h.hallId}>
                  {h.label}
                  {h.hallId === visitorLandingHallId ? ' · active' : ''}
                </option>
              ))}
            </select>
          </div>
          <p className="px-3 pb-1 pt-2 text-[9px] font-bold uppercase tracking-widest text-white/25">Expo halls</p>
          {expoHalls.map((h) => (
            <button
              key={h.hallId}
              type="button"
              className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left transition-all ${
                h.hallId === activeHallId
                  ? 'bg-violet-500/15 text-violet-200'
                  : 'text-white/55 hover:bg-white/[0.04] hover:text-white/75'
              }`}
              onClick={() => handleSelectHall(h.hallId)}
            >
              <span className={`h-2 w-2 shrink-0 rounded-full ${h.hallId === activeHallId ? 'bg-violet-400' : 'bg-white/20'}`} />
              <span className="truncate text-xs font-semibold">{h.label}</span>
              {h.hallId === visitorLandingHallId ? (
                <span className="ml-auto shrink-0 rounded bg-[#d4af37]/20 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-[#d4af37]">
                  Live
                </span>
              ) : null}
            </button>
          ))}
          <div className="my-2 border-t border-white/[0.06]" />
          <p className="px-3 pb-1 text-[9px] font-bold uppercase tracking-widest text-white/25">
            Booths · {activeHallLabel}
          </p>
          {filteredBooths.map((b) => (
            <button
              key={b.id}
              className={`group w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition-all ${
                b.id === selectedId
                  ? 'bg-[#d4af37]/15 text-[#d4af37]'
                  : selectedIds.includes(b.id)
                    ? 'bg-violet-500/12 text-violet-200'
                    : 'text-white/60 hover:bg-white/[0.04] hover:text-white/80'
              }`}
              onClick={(e) => handleBoothSelect(b.id, { additive: e.shiftKey || e.metaKey || e.ctrlKey })}
            >
              <div
                className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                  b.id === selectedId ? 'bg-[#d4af37]' : selectedIds.includes(b.id) ? 'bg-violet-400' : 'bg-white/20'
                }`}
                style={{ backgroundColor: b.id === selectedId ? b.accent : undefined }}
              />
              <div className="min-w-0">
                <div className="truncate text-xs font-semibold">{b.name}</div>
                <div className="truncate text-[10px] text-white/30">{b.id}</div>
              </div>
            </button>
          ))}
          <div className="my-2 border-t border-white/[0.06]" />
          <p className="px-3 pb-1 text-[9px] font-bold uppercase tracking-widest text-white/25">Hall</p>
          <button
            type="button"
            className={`group w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition-all ${isHallDisplay ? 'bg-cyan-500/15 text-cyan-200' : 'text-white/60 hover:bg-white/[0.04] hover:text-white/80'}`}
            onClick={() => setSelectedIds([HALL_BIG_DISPLAY_ID])}
          >
            <div className={`flex h-2.5 w-2.5 shrink-0 items-center justify-center rounded-sm text-[8px] font-bold ${isHallDisplay ? 'bg-cyan-400 text-black' : 'bg-white/20 text-white/50'}`}>▶</div>
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold">Hall Big Display</div>
              <div className="truncate text-[10px] text-white/30">Ballroom + center LED</div>
            </div>
          </button>
        </div>
        <div className="space-y-1 border-t border-white/[0.06] p-3">
          <button
            className="w-full rounded-lg bg-emerald-500/15 px-3 py-2 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/25 transition-colors disabled:opacity-40"
            onClick={() => void handleSyncToServer()}
            disabled={syncing}
          >
            {syncing ? '⏳ Syncing…' : '↑ Sync All to Server'}
          </button>
          <button className="w-full rounded-lg bg-[#d4af37]/10 px-3 py-2 text-[11px] font-semibold text-[#d4af37] hover:bg-[#d4af37]/20 transition-colors" onClick={handleExport}>
            Export JSON
          </button>
          <label className="block w-full cursor-pointer rounded-lg border border-white/[0.08] px-3 py-2 text-center text-[11px] text-white/50 hover:bg-white/[0.04] transition-colors">
            Import JSON
            <input type="file" accept=".json" className="hidden" onChange={handleImport} />
          </label>
          <button className="w-full rounded-lg border border-red-500/20 px-3 py-2 text-[11px] text-red-400/70 hover:bg-red-500/10 transition-colors" onClick={() => void resetAll()}>
            Reset All Booths
          </button>
          <button
            className="w-full rounded-lg border border-violet-500/25 px-3 py-2 text-[11px] text-violet-200 hover:bg-violet-500/10 transition-colors mb-2"
            onClick={() => {
              const external = getDashboardPublicUrl();
              if (external) {
                window.open(external, '_blank', 'noopener,noreferrer');
                return;
              }
              window.history.pushState(null, '', '/analytics');
              setCmsPage('analytics');
            }}
          >
            Visitor analytics
          </button>
          <button className="w-full rounded-lg border border-white/[0.08] px-3 py-2 text-[11px] text-white/50 hover:bg-white/[0.04] transition-colors" onClick={() => setCmsPage('expo')}>
            ← Back to Expo
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center justify-between border-b border-white/[0.06] bg-[#0d0d14]/80 px-6 py-3 backdrop-blur-lg">
          <div className="flex items-center gap-4">
            <h2 className="text-base font-bold tracking-wider">
              {tab === 'pageIndex'
                ? 'Page Indexing'
                : tab === 'allHalls'
                ? 'All Expo Halls'
                : isHallDisplay
                  ? 'Hall Big Display'
                  : isAllDisplays
                    ? 'All Displays'
                    : (name || 'Select a booth')}
            </h2>
            <span className="rounded bg-white/[0.06] px-2 py-0.5 text-[10px] text-white/40 font-mono">
              {tab === 'pageIndex'
                ? 'mongodb · pageindexes'
                : tab === 'allHalls'
                  ? '6 halls'
                  : isHallDisplay
                    ? 'hall-led'
                    : isAllDisplays
                      ? 'all-displays'
                      : `${activeHallId} · ${selectedId}`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {!isSpecialView && (
            <button type="button" className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-[11px] text-white/50 hover:bg-white/[0.05] transition-colors" onClick={() => void resetBooth(selectedId)}>
              Reset Booth
            </button>
            )}
            {isHallDisplay && (
            <button
              type="button"
              className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-[11px] text-white/50 hover:bg-white/[0.05] transition-colors"
              onClick={() => {
                patchScene({ ballroomStageScreenUrl: '', hallCanopyScreenUrl: '', entranceWallScreenUrl: '' });
                setHallBallroomUrl('');
                setHallCanopyUrl('');
                setHallEntranceUrl('');
                showToast('Hall displays reset to defaults');
              }}
            >
              Reset Hall LEDs
            </button>
            )}
            {!isAllDisplays && tab !== 'allHalls' && (
            <button type="button" className="rounded-lg bg-gradient-to-r from-[#d4af37] to-[#b08d29] px-5 py-1.5 text-xs font-bold text-black hover:brightness-110 transition-all shadow-lg shadow-[#d4af37]/20" onClick={() => void handleApply()}>
              Apply Changes
            </button>
            )}
          </div>
        </header>

        {/* Tabs */}
        {visibleTabs.length > 0 && (
        <div className="flex border-b border-white/[0.06] bg-[#0d0d14]/50 px-6">
          {visibleTabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-3 text-xs font-medium transition-all border-b-2 ${tab === t.id ? 'border-[#d4af37] text-[#d4af37]' : 'border-transparent text-white/40 hover:text-white/60'}`}
            >
              <span className="mr-1.5">{t.icon}</span>{t.label}
            </button>
          ))}
        </div>
        )}

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {!isAllDisplays && (
          <div className="flex-1 min-w-0 relative">
            {tab === 'pageIndex' ? (
              <CmsPageIndexTab
                booths={mergedList}
                onSelectBooth={(boothId) => {
                  handleBoothSelect(boothId);
                  setTab('media');
                }}
              />
            ) : tab === 'allHalls' ? (
              <CmsAllHallsOverview
                halls={expoHalls}
                activeHallId={activeHallId}
                overridesByHall={overridesByHall}
                sceneOverridesByHall={sceneOverridesByHall}
                onSelectHall={handleSelectHall}
                onPatchBooth={(id, p, hallId) => patch(id, p, hallId)}
                onApplyLayoutFrom={handleApplyLayoutFrom}
              />
            ) : tab === 'hallMap' ? (
              <CmsHallMapTab
                booths={mergedList}
                selectedIds={selectedIds}
                primarySelectedId={selectedId}
                onSelectBooth={handleBoothSelect}
                onClearSelection={handleClearSelection}
                onPatchBooth={patch}
                hallLayout={sceneConfig.hallLayout}
                onPatchHallLayout={(hallLayoutPatch) => patchScene({ hallLayout: hallLayoutPatch })}
                layoutCopy={
                  !selected || isSpecialView
                    ? {
                        halls: expoHalls,
                        activeHallId,
                        onApplyLayoutFrom: handleApplyLayoutFrom,
                      }
                    : undefined
                }
                selectedBoothLayout={
                  selected && !isSpecialView
                    ? {
                        slotIds: selectedIds,
                        boothNames: selectedBooths.map((b) => b.name),
                        halls: expoHalls,
                        activeHallId,
                        onApplyFromHall: handleApplyBoothSlotsFromHall,
                      }
                    : undefined
                }
              />
            ) : isHallDisplay ? (
              <CmsHallDisplayPreview stageScreenUrl={hallBallroomUrl} />
            ) : selected ? (
              <CmsPreview3D
                boothId={selectedId}
                name={name}
                color={color}
                accent={accent}
                counterColor={counterColor}
                videoUrl={videoUrl}
                stageScreenUrl={stageScreenUrl}
                headerLogoUrl={headerLogoUrl}
                lighting={lighting}
                placedImages={placedImages}
                placingImageUrl={placingImageUrl}
                onSurfaceClick={handleSurfaceClick}
                selectedImageId={selectedImageId}
                onSelectImage={setSelectedImageId}
                onDragImage={handleDragImage}
                brochureUrl={brochureUrl}
                priceListUrl={priceListUrl}
                siteMapUrl={siteMapFields.siteMapUrl}
                siteMapGallery={siteMapFields.siteMapGallery}
                hostessQuickReplies={hostessQuickReplies}
              />
            ) : null}
          </div>
          )}

          {/* Properties panel */}
          {tab !== 'allHalls' && tab !== 'pageIndex' && (
          <div className={`${isAllDisplays ? 'flex-1' : 'w-80 shrink-0'} border-l border-white/[0.06] bg-[#0d0d14] overflow-y-auto`}>
            <div className={`${isAllDisplays ? 'p-6 max-w-4xl mx-auto' : 'p-5'} space-y-4`}>
              {isAllDisplays ? (
                <AllDisplaysPanel
                  booths={mergedList}
                  sceneConfig={sceneConfig}
                  patchScene={patchScene}
                  persistBoothDocumentField={persistBoothDocumentField}
                  toastUploadResult={toastUploadResult}
                  showUploadError={showUploadError}
                  onOpenBooth={(boothId) => {
                    handleBoothSelect(boothId);
                    setTab('displays');
                  }}
                />
              ) : isHallDisplay ? (
                <HallBigDisplayPanel
                  ballroomUrl={hallBallroomUrl}
                  setBallroomUrl={(url) => {
                    setHallBallroomUrl(url);
                    patchScene({ ballroomStageScreenUrl: url.trim() });
                  }}
                  canopyUrl={hallCanopyUrl}
                  setCanopyUrl={(url) => {
                    setHallCanopyUrl(url);
                    patchScene({ hallCanopyScreenUrl: url.trim() });
                  }}
                  entranceUrl={hallEntranceUrl}
                  setEntranceUrl={(url) => {
                    setHallEntranceUrl(url);
                    patchScene({ entranceWallScreenUrl: url.trim() });
                  }}
                />
              ) : (
              <>
              {tab === 'layout' && <LayoutTab px={px} setPx={setPx} py={py} setPy={setPy} pz={pz} setPz={setPz} rxDeg={rxDeg} setRxDeg={setRxDeg} ryDeg={ryDeg} setRyDeg={setRyDeg} rzDeg={rzDeg} setRzDeg={setRzDeg} sx={sx} setSx={setSx} sy={sy} setSy={setSy} sz={sz} setSz={setSz} />}
              {tab === 'displays' && !isSpecialView && (
                <BoothDisplaysTab
                  boothId={selectedId}
                  stageScreenUrl={stageScreenUrl}
                  setStageScreenUrl={setStageScreenUrl}
                  videoUrl={videoUrl}
                  setVideoUrl={setVideoUrl}
                  signageImageUrl={signageImageUrl}
                  setSignageImageUrl={setSignageImageUrl}
                  toastUploadResult={toastUploadResult}
                  persistDocumentField={persistDocumentField}
                  showUploadError={showUploadError}
                />
              )}
              {tab === 'branding' && (
                <BrandingTab
                  name={name}
                  setName={setName}
                  color={color}
                  setColor={setColor}
                  accent={accent}
                  setAccent={setAccent}
                  counterColor={counterColor}
                  setCounterColor={setCounterColor}
                  stageScreenUrl={stageScreenUrl}
                  setStageScreenUrl={setStageScreenUrl}
                  headerLogoUrl={headerLogoUrl}
                  setHeaderLogoUrl={setHeaderLogoUrl}
                  description={description}
                  setDescription={setDescription}
                  hostessQuickReplies={hostessQuickReplies}
                  setHostessQuickReplies={setHostessQuickReplies}
                  boothId={selectedId}
                  toastUploadResult={toastUploadResult}
                  persistDocumentField={persistDocumentField}
                  showUploadError={showUploadError}
                />
              )}
              {tab === 'images' && (
                <ImagesTab
                  boothId={selectedId}
                  toastUploadResult={toastUploadResult}
                  placedImages={placedImages}
                  placingImageUrl={placingImageUrl}
                  setPlacingImageUrl={setPlacingImageUrl}
                  setPlacingLabel={setPlacingLabel}
                  repositionImageId={repositionImageId}
                  setRepositionImageId={setRepositionImageId}
                  selectedImageId={selectedImageId}
                  setSelectedImageId={setSelectedImageId}
                  removePlacedImage={removePlacedImage}
                  updatePlacedImage={updatePlacedImage}
                />
              )}
              {tab === 'media' && (
                <MediaTab
                  boothId={selectedId}
                  toastUploadResult={toastUploadResult}
                  showUploadError={showUploadError}
                  media={media}
                  addMediaItem={addMediaItem}
                  removeMediaItem={removeMediaItem}
                  brochureUrl={brochureUrl}
                  setBrochureUrl={setBrochureUrl}
                  enablePageIndexBrochure={enablePageIndexBrochure}
                  setEnablePageIndexBrochure={setEnablePageIndexBrochure}
                  siteMapSlides={siteMapSlides}
                  setSiteMapSlides={setSiteMapSlides}
                  persistSiteMapSlides={persistSiteMapSlides}
                  priceListUrl={priceListUrl}
                  setPriceListUrl={setPriceListUrl}
                  enablePageIndexPriceList={enablePageIndexPriceList}
                  setEnablePageIndexPriceList={setEnablePageIndexPriceList}
                  videoUrl={videoUrl}
                  setVideoUrl={setVideoUrl}
                  stageScreenUrl={stageScreenUrl}
                  setStageScreenUrl={setStageScreenUrl}
                  unitLayoutUrl={unitLayoutUrl}
                  setUnitLayoutUrl={setUnitLayoutUrl}
                  signageImageUrl={signageImageUrl}
                  setSignageImageUrl={setSignageImageUrl}
                  persistDocumentField={persistDocumentField}
                  persistPageIndexFlag={persistPageIndexFlag}
                  onUseBundledSiteMapPath={switchSiteMapToBundledPublicPath}
                />
              )}
              {tab === 'company' && <CompanyTab company={company} setCompany={setCompany} />}
              {tab === 'lighting' && <LightingTab lighting={lighting} setLighting={setLighting} />}
              {tab === 'scene' && <CmsScenePanel />}
              {tab === 'hallMap' && (
                <div className="space-y-3">
                  {selected ? (
                  <>
                  {multiSelect ? (
                    <CmsApplyMultiBoothLayout
                      slotIds={selectedIds}
                      boothLabels={selectedBooths.map((b) => b.name)}
                      activeHallId={activeHallId}
                      halls={expoHalls}
                      onApplyFromHall={handleApplyBoothSlotsFromHall}
                    />
                  ) : (
                    <CmsApplySelectedBoothLayout
                      slotId={selectedId}
                      boothName={selected.name}
                      activeHallId={activeHallId}
                      halls={expoHalls}
                      onApplyFromHall={handleApplyBoothSlotFromHall}
                      variant="panel"
                    />
                  )}
                  <div className="text-xs font-semibold text-white/60 uppercase tracking-wider">
                    {multiSelect ? `${selectedIds.length} booths selected` : 'Selected Booth'}
                  </div>
                  {multiSelect ? (
                    <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3 space-y-2 max-h-40 overflow-y-auto">
                      {selectedBooths.map((b) => (
                        <div key={b.id} className="flex justify-between gap-2 text-[10px] font-mono text-white/55 border-b border-white/[0.04] pb-1 last:border-0">
                          <span className="truncate text-white/75">{b.name}</span>
                          <span className="shrink-0">
                            {b.position[0].toFixed(1)}, {b.position[2].toFixed(1)}
                          </span>
                        </div>
                      ))}
                      <button
                        type="button"
                        className="text-[10px] text-violet-300/80 hover:text-violet-200 underline pt-1"
                        onClick={handleClearSelection}
                      >
                        Clear multi-select
                      </button>
                    </div>
                  ) : (
                  <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3 space-y-2">
                    <div className="text-sm font-bold text-white/90">{selected.name}</div>
                    <div className="font-mono text-[11px] text-white/40">{selected.id}</div>
                    <div className="grid grid-cols-3 gap-2 pt-2">
                      <div className="text-center">
                        <div className="text-[9px] text-white/30 uppercase">X</div>
                        <div className="text-xs font-mono text-white/70">{selected.position[0].toFixed(1)}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-[9px] text-white/30 uppercase">Y</div>
                        <div className="text-xs font-mono text-white/70">{selected.position[1].toFixed(1)}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-[9px] text-white/30 uppercase">Z</div>
                        <div className="text-xs font-mono text-white/70">{selected.position[2].toFixed(1)}</div>
                      </div>
                    </div>
                  </div>
                  )}

                  {!multiSelect && (
                  <>
                  <div className="text-xs font-semibold text-white/60 uppercase tracking-wider pt-1">Rotation (Y-axis)</div>
                  <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3 space-y-2">
                    <p className="text-[10px] text-white/40 leading-snug">
                      East row booths should face the aisle at <strong className="text-white/55">-90°</strong>.
                      West row at <strong className="text-white/55">90°</strong>. Yaw 0° faces along the hall and looks wrong.
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-white/40 w-8">Yaw</span>
                      <input
                        type="number"
                        step={15}
                        value={Math.round((selected.rotation[1] * 180) / Math.PI)}
                        onChange={(e) => {
                          const deg = parseFloat(e.target.value);
                          if (!Number.isFinite(deg)) return;
                          void patch(selectedId, {
                            rotation: [selected.rotation[0], (deg * Math.PI) / 180, selected.rotation[2]],
                          });
                        }}
                        className="flex-1 rounded bg-white/[0.06] border border-white/10 px-2 py-1 text-xs text-white/80 font-mono outline-none focus:border-[#d4af37]/50"
                      />
                      <span className="text-[10px] text-white/30">deg</span>
                    </div>
                    <div className="flex gap-1.5 pt-1">
                      {[
                        { label: '0°', deg: 0 },
                        { label: '90°', deg: 90 },
                        { label: '180°', deg: 180 },
                        { label: '-90°', deg: -90 },
                      ].map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => {
                            void patch(selectedId, {
                              rotation: [selected.rotation[0], (preset.deg * Math.PI) / 180, selected.rotation[2]],
                            });
                          }}
                          className={`flex-1 rounded px-2 py-1 text-[10px] font-medium border transition-colors ${
                            Math.abs(Math.round((selected.rotation[1] * 180) / Math.PI) - preset.deg) < 2
                              ? 'bg-[#d4af37]/20 border-[#d4af37]/40 text-[#d4af37]'
                              : 'bg-white/[0.04] border-white/10 text-white/50 hover:bg-white/[0.08] hover:text-white/70'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Size controls */}
                  <div className="text-xs font-semibold text-white/60 uppercase tracking-wider pt-1">Booth Size</div>
                  <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3 space-y-2">
                    {([
                      { label: 'Width (X)', idx: 0 },
                      { label: 'Height (Y)', idx: 1 },
                      { label: 'Depth (Z)', idx: 2 },
                    ] as const).map(({ label, idx }) => (
                      <div key={label} className="flex items-center gap-2">
                        <span className="text-[10px] text-white/40 w-16">{label}</span>
                        <input
                          type="number"
                          step={0.1}
                          value={parseFloat(selected.scale[idx].toFixed(2))}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            if (!Number.isFinite(v) || v <= 0) return;
                            const next: [number, number, number] = [...selected.scale];
                            next[idx] = v;
                            void patch(selectedId, { scale: next });
                          }}
                          className="flex-1 rounded bg-white/[0.06] border border-white/10 px-2 py-1 text-xs text-white/80 font-mono outline-none focus:border-[#d4af37]/50"
                        />
                      </div>
                    ))}
                    <div className="flex gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => void patch(selectedId, { scale: [1.22, 1.48, 1.22] })}
                        className="flex-1 rounded px-2 py-1 text-[10px] font-medium border bg-white/[0.04] border-white/10 text-white/50 hover:bg-white/[0.08] hover:text-white/70 transition-colors"
                      >
                        Standard
                      </button>
                      <button
                        type="button"
                        onClick={() => void patch(selectedId, { scale: [1.3, 1.58, 1.3] })}
                        className="flex-1 rounded px-2 py-1 text-[10px] font-medium border bg-white/[0.04] border-white/10 text-white/50 hover:bg-white/[0.08] hover:text-white/70 transition-colors"
                      >
                        Luxe (larger)
                      </button>
                    </div>
                  </div>

                  <div className="text-[10px] text-white/30 leading-relaxed">
                    Drag to reposition. Shift+click map or sidebar to multi-select and move together.
                  </div>
                  </>
                  )}
                  </>
                  ) : (
                    <p className="text-[10px] text-white/35">Select a booth on the map to edit placement or apply it to other halls.</p>
                  )}
                  <details className="rounded-lg border border-white/[0.06] bg-white/[0.02] group">
                    <summary className="cursor-pointer px-3 py-2 text-[10px] text-white/40 uppercase tracking-wider list-none">
                      Entire hall layout (all booths)
                    </summary>
                    <div className="px-2 pb-2">
                      <CmsApplyHallLayoutControls
                        halls={expoHalls}
                        onApplyLayoutFrom={handleApplyLayoutFrom}
                        variant="panel"
                      />
                    </div>
                  </details>
                </div>
              )}
              </>
              )}
            </div>
          </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] rounded-xl border border-[#d4af37]/30 bg-[#1a1a22]/95 px-5 py-2.5 text-xs font-medium text-[#d4af37] shadow-2xl backdrop-blur-lg animate-[fadeInUp_0.3s_ease]">
          {toast}
        </div>
      )}

      {ctaResourcePopup && (
        <CtaResourcePopupView
          popup={ctaResourcePopup}
          onClose={() => setCtaResourcePopup(null)}
          overlayClassName="fixed inset-0 z-[220] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm pointer-events-auto"
        />
      )}
    </div>
  );
}

/* ─── Sub-panels ─── */

function BoothDisplaysTab({
  boothId,
  stageScreenUrl,
  setStageScreenUrl,
  videoUrl,
  setVideoUrl,
  signageImageUrl,
  setSignageImageUrl,
  toastUploadResult,
  persistDocumentField,
  showUploadError,
}: {
  boothId: string;
  stageScreenUrl: string;
  setStageScreenUrl: (v: string) => void;
  videoUrl: string;
  setVideoUrl: (v: string) => void;
  signageImageUrl: string;
  setSignageImageUrl: (v: string) => void;
  toastUploadResult: (result: UploadResult, label: string) => void;
  persistDocumentField: (
    field: 'brochureUrl' | 'priceListUrl' | 'unitLayoutUrl' | 'videoUrl' | 'stageScreenUrl' | 'signageImageUrl',
    url: string,
    label: string,
  ) => Promise<void>;
  showUploadError: (err: unknown) => void;
}) {
  return (
    <>
      <SectionTitle>Booth LED screens</SectionTitle>
      <p className="mb-3 text-[10px] leading-relaxed text-white/40">
        Manage this booth&apos;s large back-wall LED and walk-through video. Changes preview live on the left — click <strong className="text-white/60">Apply Changes</strong> to save.
      </p>
      <SectionTitle>Main stage screen (large LED)</SectionTitle>
      <CmsDocFieldWithPreview
        label="Stage screen URL"
        value={stageScreenUrl}
        onChange={setStageScreenUrl}
        placeholder="/images/first ever expo.jpg or .mp4"
        uploadLabel="Upload image or video"
        uploadAccept="image/*,video/*,.mp4,.webm"
        previewColumnTitle="Stage preview"
        onUploadFile={async (f) => {
          try {
            const folder = f.type.startsWith('video/') ? 'stage-video' : 'stage-image';
            const up = await uploadCmsFile(f, boothId, folder);
            setStageScreenUrl(up.url);
            toastUploadResult(up, 'Stage screen');
            await persistDocumentField('stageScreenUrl', up.url, 'Stage screen');
          } catch (e) {
            showUploadError(e);
          }
        }}
      />
      <SectionTitle>Walk-through video (booth button)</SectionTitle>
      <p className="mb-2 text-[10px] leading-relaxed text-white/35">
        Used when visitors tap <strong className="text-white/50">Walk Through</strong> — separate from the main stage screen.
      </p>
      <CmsDocFieldWithPreview
        label="Walk-through URL"
        value={videoUrl}
        onChange={setVideoUrl}
        placeholder="/13391496_3840_2160_60fps.mp4"
        uploadLabel="Upload video"
        uploadAccept="video/*,.mp4,.webm"
        previewColumnTitle="Video preview"
        onUploadFile={async (f) => {
          try {
            const up = await uploadCmsFile(f, boothId, 'walkthrough-video');
            setVideoUrl(up.url);
            toastUploadResult(up, 'Walk-through video');
            await persistDocumentField('videoUrl', up.url, 'Walk-through video');
          } catch (e) {
            showUploadError(e);
          }
        }}
      />
      {boothId === 'builder-8' && (
        <>
          <SectionTitle>Standing signage board</SectionTitle>
          <CmsDocFieldWithPreview
            label="Signage image URL"
            value={signageImageUrl}
            onChange={setSignageImageUrl}
            placeholder="/images/signage.jpg"
            uploadLabel="Upload signage image"
            uploadAccept="image/*"
            previewColumnTitle="Signage preview"
            onUploadFile={async (f) => {
              try {
                const up = await uploadCmsFile(f, boothId, 'signage-image');
                setSignageImageUrl(up.url);
                toastUploadResult(up, 'Signage image');
                await persistDocumentField('signageImageUrl', up.url, 'Signage image');
              } catch (e) {
                showUploadError(e);
              }
            }}
          />
        </>
      )}
    </>
  );
}

function AllDisplaysPanel({
  booths,
  sceneConfig,
  patchScene,
  persistBoothDocumentField,
  toastUploadResult,
  showUploadError,
  onOpenBooth,
}: {
  booths: BoothLayoutConfig[];
  sceneConfig: SceneConfig;
  patchScene: (patch: {
    ballroomStageScreenUrl?: string;
    hallCanopyScreenUrl?: string;
    entranceWallScreenUrl?: string;
  }) => void;
  persistBoothDocumentField: (
    boothId: string,
    field: 'videoUrl' | 'stageScreenUrl' | 'signageImageUrl',
    url: string,
    label: string,
  ) => Promise<void>;
  toastUploadResult: (result: UploadResult, label: string) => void;
  showUploadError: (err: unknown) => void;
  onOpenBooth: (boothId: string) => void;
}) {
  const [ballroomUrl, setBallroomUrl] = useState(sceneConfig.ballroomStageScreenUrl ?? '');
  const [canopyUrl, setCanopyUrl] = useState(sceneConfig.hallCanopyScreenUrl ?? '');
  const [entranceUrl, setEntranceUrl] = useState(sceneConfig.entranceWallScreenUrl ?? '');

  useEffect(() => {
    setBallroomUrl(sceneConfig.ballroomStageScreenUrl ?? '');
    setCanopyUrl(sceneConfig.hallCanopyScreenUrl ?? '');
    setEntranceUrl(sceneConfig.entranceWallScreenUrl ?? '');
  }, [
    sceneConfig.ballroomStageScreenUrl,
    sceneConfig.hallCanopyScreenUrl,
    sceneConfig.entranceWallScreenUrl,
  ]);

  const saveHall = (
    field: 'ballroomStageScreenUrl' | 'hallCanopyScreenUrl' | 'entranceWallScreenUrl',
    url: string,
  ) => {
    patchScene({ [field]: url.trim() });
  };

  return (
    <>
      <SectionTitle>All displays — hall & booths</SectionTitle>
      <p className="mb-4 text-[10px] leading-relaxed text-white/40">
        Edit every LED screen and display in the expo from one place. Uploads save immediately to R2 when online. Booth changes also need <strong className="text-white/55">Apply Changes</strong> if you typed a URL manually in a single booth view.
      </p>

      <div className="mb-6 rounded-xl border border-cyan-500/20 bg-cyan-500/[0.04] p-4">
        <h4 className="mb-2 text-xs font-bold text-cyan-200">Hall displays</h4>
        <HallLedMediaField
          label="Entrance wall TV (faces spawn)"
          hint="Large LED in front of the gold entry ring."
          value={entranceUrl}
          onChange={(url) => {
            setEntranceUrl(url);
            saveHall('entranceWallScreenUrl', url);
          }}
          uploadFolder="entrance-wall"
        />
        <HallLedMediaField
          label="Ballroom stage (east wall)"
          hint="Large LED behind the podium — Fast Travel → Ballroom stage."
          value={ballroomUrl}
          onChange={(url) => {
            setBallroomUrl(url);
            saveHall('ballroomStageScreenUrl', url);
          }}
          uploadFolder="ballroom-stage"
        />
        <HallLedMediaField
          label="Center canopy ring"
          hint="Suspended circular LED above the help desk."
          value={canopyUrl}
          onChange={(url) => {
            setCanopyUrl(url);
            saveHall('hallCanopyScreenUrl', url);
          }}
          uploadFolder="hall-canopy"
        />
      </div>

      <SectionTitle>Booth stage screens</SectionTitle>
      <div className="space-y-3">
        {booths.map((b) => (
          <BoothDisplayRow
            key={b.id}
            booth={b}
            persistBoothDocumentField={persistBoothDocumentField}
            toastUploadResult={toastUploadResult}
            showUploadError={showUploadError}
            onOpenBooth={onOpenBooth}
          />
        ))}
      </div>
    </>
  );
}

function BoothDisplayRow({
  booth,
  persistBoothDocumentField,
  toastUploadResult,
  showUploadError,
  onOpenBooth,
}: {
  booth: BoothLayoutConfig;
  persistBoothDocumentField: (
    boothId: string,
    field: 'videoUrl' | 'stageScreenUrl' | 'signageImageUrl',
    url: string,
    label: string,
  ) => Promise<void>;
  toastUploadResult: (result: UploadResult, label: string) => void;
  showUploadError: (err: unknown) => void;
  onOpenBooth: (boothId: string) => void;
}) {
  const [stageUrl, setStageUrl] = useState(booth.stageScreenUrl ?? booth.videoUrl ?? '');

  useEffect(() => {
    setStageUrl(booth.stageScreenUrl ?? booth.videoUrl ?? '');
  }, [booth.stageScreenUrl, booth.videoUrl, booth.id]);

  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-xs font-semibold text-white/85">{booth.name}</div>
          <div className="truncate font-mono text-[10px] text-white/30">{booth.id}</div>
        </div>
        <button
          type="button"
          className="shrink-0 text-[10px] font-semibold text-[#d4af37] hover:text-[#f5d060]"
          onClick={() => onOpenBooth(booth.id)}
        >
          Open booth →
        </button>
      </div>
      <input
        className="mb-2 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-white outline-none focus:border-[#d4af37]/40 font-mono"
        value={stageUrl}
        onChange={(e) => setStageUrl(e.target.value)}
        onBlur={() => void persistBoothDocumentField(booth.id, 'stageScreenUrl', stageUrl, `${booth.name} stage`)}
        placeholder="Stage screen image or video URL"
      />
      <div className="flex flex-wrap items-center gap-2">
        <label className="cursor-pointer rounded-lg border border-[#d4af37]/30 bg-[#d4af37]/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#d4af37] hover:bg-[#d4af37]/20">
          Upload
          <input
            type="file"
            accept="image/*,video/*,.mp4,.webm"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              void (async () => {
                try {
                  const folder = f.type.startsWith('video/') ? 'stage-video' : 'stage-image';
                  const up = await uploadCmsFile(f, booth.id, folder);
                  setStageUrl(up.url);
                  toastUploadResult(up, `${booth.name} stage`);
                  await persistBoothDocumentField(booth.id, 'stageScreenUrl', up.url, `${booth.name} stage`);
                } catch (err) {
                  showUploadError(err);
                }
              })();
              e.target.value = '';
            }}
          />
        </label>
        {stageUrl.trim() && (
          <div className="h-10 w-16 overflow-hidden rounded border border-white/10 bg-black/50">
            {/\.(mp4|webm)(\?|$)/i.test(stageUrl.trim()) ? (
              <video src={stageUrl.trim()} className="h-full w-full object-cover" muted playsInline />
            ) : (
              <img src={stageUrl.trim()} alt="" className="h-full w-full object-cover" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function HallBigDisplayPanel({
  ballroomUrl,
  setBallroomUrl,
  canopyUrl,
  setCanopyUrl,
  entranceUrl,
  setEntranceUrl,
}: {
  ballroomUrl: string;
  setBallroomUrl: (v: string) => void;
  canopyUrl: string;
  setCanopyUrl: (v: string) => void;
  entranceUrl: string;
  setEntranceUrl: (v: string) => void;
}) {
  return (
    <>
      <SectionTitle>Hall Big Display</SectionTitle>
      <p className="mb-3 text-[10px] leading-relaxed text-white/40">
        Manage the large hall LED screens — upload an image or video; changes save automatically and preview live on the left.
      </p>
      <HallLedMediaField
        label="Entrance wall TV (faces spawn)"
        hint="Large LED in front of the gold entry ring. Edit Layout → Large LED wall to move it."
        value={entranceUrl}
        onChange={setEntranceUrl}
        uploadFolder="entrance-wall"
      />
      {entranceUrl.trim() && (
        <div className="mb-3 overflow-hidden rounded-lg border border-white/[0.08]">
          {/\.(mp4|webm)(\?|$)/i.test(entranceUrl.trim()) ? (
            <video src={entranceUrl.trim()} className="max-h-28 w-full object-contain bg-black" muted playsInline controls />
          ) : (
            <img src={entranceUrl.trim()} alt="Entrance TV preview" className="max-h-28 w-full object-contain bg-black" />
          )}
        </div>
      )}
      <HallLedMediaField
        label="Ballroom stage (east wall)"
        hint="Main hall big screen behind the podium. Fast Travel → Ballroom stage."
        value={ballroomUrl}
        onChange={setBallroomUrl}
        uploadFolder="ballroom-stage"
      />
      {ballroomUrl.trim() && (
        <div className="mb-3 overflow-hidden rounded-lg border border-white/[0.08]">
          {/\.(mp4|webm)(\?|$)/i.test(ballroomUrl.trim()) ? (
            <video src={ballroomUrl.trim()} className="max-h-28 w-full object-contain bg-black" muted playsInline controls />
          ) : (
            <img src={ballroomUrl.trim()} alt="Ballroom preview" className="max-h-28 w-full object-contain bg-black" />
          )}
        </div>
      )}
      <HallLedMediaField
        label="Center canopy ring"
        hint="Suspended circular LED above the help desk — Fast Travel → Center plaza."
        value={canopyUrl}
        onChange={setCanopyUrl}
        uploadFolder="hall-canopy"
      />
      {canopyUrl.trim() && (
        <div className="mb-3 overflow-hidden rounded-lg border border-white/[0.08]">
          {/\.(mp4|webm)(\?|$)/i.test(canopyUrl.trim()) ? (
            <video src={canopyUrl.trim()} className="max-h-28 w-full object-contain bg-black" muted playsInline controls />
          ) : (
            <img src={canopyUrl.trim()} alt="Canopy preview" className="max-h-28 w-full object-contain bg-black" />
          )}
        </div>
      )}
      <p className="text-[9px] leading-relaxed text-white/30">
        Tip: use <code className="text-white/45">/images/first ever expo.jpg</code> for the default expo banner.
      </p>
    </>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[11px] font-bold uppercase tracking-widest text-white/30 mb-2">{children}</h3>;
}

function CmsField({ label, value, onChange, type = 'text', placeholder }: { label: React.ReactNode; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] uppercase tracking-wide text-white/35">{label}</label>
      <input
        type={type}
        className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-white outline-none focus:border-[#d4af37]/40 transition-colors placeholder-white/20"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function CmsColor({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] uppercase tracking-wide text-white/35">{label}</label>
      <div className="flex items-center gap-2">
        <input type="color" className="h-8 w-8 cursor-pointer rounded border border-white/[0.08] bg-transparent p-0" value={value} onChange={(e) => onChange(e.target.value)} />
        <input className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-white outline-none focus:border-[#d4af37]/40 font-mono" value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    </div>
  );
}

function CmsSlider({ label, value, onChange, min, max, step = 0.01, unit = '' }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number; unit?: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between">
        <label className="text-[10px] uppercase tracking-wide text-white/35">{label}</label>
        <span className="text-[10px] font-mono text-white/30">{value.toFixed(2)}{unit}</span>
      </div>
      <input type="range" className="w-full accent-[#d4af37] h-1" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} />
    </div>
  );
}

function UploadButton({ label, accept, onFile }: { label: string; accept: string; onFile: (f: File) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-white/[0.12] bg-white/[0.02] px-3 py-3 text-[11px] text-white/40 hover:border-[#d4af37]/30 hover:text-white/60 transition-colors">
      <span className="text-base">+</span> {label}
      <input type="file" accept={accept} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
    </label>
  );
}

function UploadFilesButton({ label, accept, onFiles }: { label: string; accept: string; onFiles: (files: File[]) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-white/[0.12] bg-white/[0.02] px-3 py-3 text-[11px] text-white/40 hover:border-[#d4af37]/30 hover:text-white/60 transition-colors">
      <span className="text-base">+</span> {label}
      <input
        type="file"
        accept={accept}
        multiple
        className="hidden"
        onChange={(e) => {
          const files = [...(e.target.files || [])];
          if (files.length) onFiles(files);
          e.target.value = '';
        }}
      />
    </label>
  );
}

/* ─── LAYOUT TAB ─── */
function LayoutTab({ px, setPx, py, setPy, pz, setPz, rxDeg, setRxDeg, ryDeg, setRyDeg, rzDeg, setRzDeg, sx, setSx, sy, setSy, sz, setSz }: {
  px: string; setPx: (v: string) => void; py: string; setPy: (v: string) => void; pz: string; setPz: (v: string) => void;
  rxDeg: string; setRxDeg: (v: string) => void; ryDeg: string; setRyDeg: (v: string) => void; rzDeg: string; setRzDeg: (v: string) => void;
  sx: string; setSx: (v: string) => void; sy: string; setSy: (v: string) => void; sz: string; setSz: (v: string) => void;
}) {
  return (
    <>
      <SectionTitle>Position</SectionTitle>
      <div className="grid grid-cols-3 gap-2">
        <CmsField label="X" value={px} onChange={setPx} />
        <CmsField label="Y" value={py} onChange={setPy} />
        <CmsField label="Z" value={pz} onChange={setPz} />
      </div>
      <SectionTitle>Rotation (degrees)</SectionTitle>
      <div className="grid grid-cols-3 gap-2">
        <CmsField label="X°" value={rxDeg} onChange={setRxDeg} />
        <CmsField label="Y°" value={ryDeg} onChange={setRyDeg} />
        <CmsField label="Z°" value={rzDeg} onChange={setRzDeg} />
      </div>
      <SectionTitle>Booth size</SectionTitle>
      <p className="mb-2 text-[10px] leading-relaxed text-white/45">
        Width = left–right · Height = floor to ceiling · Depth = front to back. 1.0 is default; Luxe booths use ~1.3 × 1.58 × 1.3.
      </p>
      <div className="grid grid-cols-3 gap-2">
        <CmsField label="Width (X)" value={sx} onChange={setSx} />
        <CmsField label="Height (Y)" value={sy} onChange={setSy} />
        <CmsField label="Depth (Z)" value={sz} onChange={setSz} />
      </div>
    </>
  );
}

/* ─── HOSTESS QUICK REPLIES (Branding tab) ─── */
function HostessQuickRepliesEditor({
  items,
  setItems,
}: {
  items: HostessQuickReply[];
  setItems: (next: HostessQuickReply[]) => void;
}) {
  const add = () => setItems([...items, { id: `hq-${Date.now()}`, label: '', response: '' }]);
  const remove = (id: string) => setItems(items.filter((x) => x.id !== id));
  const patchRow = (id: string, field: 'label' | 'response', v: string) =>
    setItems(items.map((x) => (x.id === id ? { ...x, [field]: v } : x)));
  const setAskAi = (id: string, enabled: boolean) =>
    setItems(
      items.map((x) =>
        x.id === id
          ? enabled
            ? { ...x, action: 'askAi' as const }
            : { ...x, action: undefined }
          : x,
      ),
    );

  return (
    <>
      <SectionTitle>Hostess quick replies</SectionTitle>
      <p className="mb-2 text-[9px] leading-relaxed text-white/35">
        When a visitor stands near the booth hostess, they see these chips after “How can I help you?”. Each row needs a chip label; add an answer, or enable “Ask AI” to open the AI chat instead of a fixed reply. Use <span className="text-[#d4af37]/80">Apply Changes</span> to save.
      </p>
      <ul className="max-h-56 space-y-2 overflow-y-auto pr-0.5">
        {items.map((row) => (
          <li key={row.id} className="space-y-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] p-2">
            <CmsField label="Chip label" value={row.label} onChange={(v) => patchRow(row.id, 'label', v)} placeholder="e.g. Pricing" />
            <label className="flex cursor-pointer items-center gap-2 text-[10px] text-white/55">
              <input
                type="checkbox"
                className="accent-[#d4af37]"
                checked={row.action === 'askAi'}
                onChange={(e) => setAskAi(row.id, e.target.checked)}
              />
              Opens Ask AI chat (no fixed answer / voice)
            </label>
            <div className={row.action === 'askAi' ? 'pointer-events-none opacity-40' : ''}>
              <label className="mb-0.5 block text-[10px] uppercase tracking-wide text-white/35">Answer (spoken + shown)</label>
              <textarea
                className="w-full resize-none rounded-lg border border-white/[0.08] bg-white/[0.04] px-2 py-1.5 text-[11px] text-white outline-none focus:border-[#d4af37]/40 h-16"
                value={row.response}
                onChange={(e) => patchRow(row.id, 'response', e.target.value)}
                placeholder="Short reply the hostess says…"
                disabled={row.action === 'askAi'}
              />
            </div>
            <button type="button" className="text-[10px] text-red-400/70 hover:text-red-400" onClick={() => remove(row.id)}>
              Remove
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="mt-2 w-full rounded-lg border border-white/15 py-2 text-[11px] text-white/50 hover:bg-white/[0.04]" onClick={add}>
        + Add option
      </button>
    </>
  );
}

/* ─── BRANDING TAB ─── */
function BrandingTab({
  name, setName, color, setColor, accent, setAccent, counterColor, setCounterColor,
  stageScreenUrl, setStageScreenUrl, headerLogoUrl, setHeaderLogoUrl, description, setDescription,
  hostessQuickReplies, setHostessQuickReplies, boothId, toastUploadResult, persistDocumentField, showUploadError,
}: {
  name: string; setName: (v: string) => void; color: string; setColor: (v: string) => void; accent: string; setAccent: (v: string) => void;
  counterColor: string; setCounterColor: (v: string) => void;
  stageScreenUrl: string; setStageScreenUrl: (v: string) => void;
  headerLogoUrl: string; setHeaderLogoUrl: (v: string) => void; description: string; setDescription: (v: string) => void;
  hostessQuickReplies: HostessQuickReply[];
  setHostessQuickReplies: (next: HostessQuickReply[]) => void;
  boothId: string;
  toastUploadResult: (result: UploadResult, label: string) => void;
  persistDocumentField: (
    field: 'brochureUrl' | 'priceListUrl' | 'unitLayoutUrl' | 'videoUrl' | 'stageScreenUrl' | 'signageImageUrl',
    url: string,
    label: string,
  ) => Promise<void>;
  showUploadError: (err: unknown) => void;
}) {
  return (
    <>
      <SectionTitle>Identity</SectionTitle>
      <CmsField label="Booth Name" value={name} onChange={setName} />
      <div>
        <label className="mb-1 block text-[10px] uppercase tracking-wide text-white/35">Description</label>
        <textarea className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-white outline-none focus:border-[#d4af37]/40 resize-none h-20" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <HostessQuickRepliesEditor items={hostessQuickReplies} setItems={setHostessQuickReplies} />
      <SectionTitle>Colors</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <CmsColor label="Wall" value={color} onChange={setColor} />
        <CmsColor label="Accent" value={accent} onChange={setAccent} />
        <CmsColor label="Counter" value={counterColor} onChange={setCounterColor} />
      </div>
      <SectionTitle>Main stage screen (large LED)</SectionTitle>
      <p className="mb-2 text-[10px] leading-relaxed text-white/40">
        Powers the <strong className="text-white/55">large back-wall LED</strong> and counter screen. Upload a project render (PNG/JPG) or a walkthrough video (MP4).
      </p>
      <CmsDocFieldWithPreview
        label="Stage screen URL"
        value={stageScreenUrl}
        onChange={setStageScreenUrl}
        placeholder="/13391496_3840_2160_60fps.mp4 or https://…/render.jpg"
        uploadLabel="Upload image or video"
        uploadAccept="image/*,video/*,.mp4,.webm"
        previewColumnTitle="Stage preview"
        onUploadFile={async (f) => {
          try {
            const folder = f.type.startsWith('video/') ? 'stage-video' : 'stage-image';
            const up = await uploadCmsFile(f, boothId, folder);
            setStageScreenUrl(up.url);
            toastUploadResult(up, 'Stage screen');
            await persistDocumentField('stageScreenUrl', up.url, 'Stage screen');
          } catch (e) {
            showUploadError(e);
          }
        }}
      />
      <SectionTitle>Header Logo</SectionTitle>
      <CmsField label="Logo URL" value={headerLogoUrl} onChange={setHeaderLogoUrl} placeholder="/assets/logo.png" />
      <UploadButton
        label="Upload logo"
        accept="image/*"
        onFile={async (f) => {
          const up = await uploadCmsFile(f, boothId, 'logo');
          setHeaderLogoUrl(up.url);
          toastUploadResult(up, 'Logo');
        }}
      />
      {headerLogoUrl && (
        <div className="mt-2 rounded-lg border border-white/[0.08] bg-white/[0.04] p-2">
          <img src={headerLogoUrl} alt="logo" className="mx-auto max-h-16 object-contain" />
        </div>
      )}
    </>
  );
}

/** Right-column thumbnail in Media → Documents (site map / price list images; PDF hint for brochure). */
function CmsMediaPreviewThumb({ url }: { url: string }) {
  const [rasterError, setRasterError] = useState(false);
  const u = url.trim();

  useLayoutEffect(() => {
    setRasterError(false);
  }, [u]);

  if (!u) {
    return (
      <div className="flex h-[5.5rem] w-[5.5rem] flex-col items-center justify-center rounded-lg border border-dashed border-white/10 bg-white/[0.02] px-1 text-center">
        <span className="text-[9px] uppercase tracking-wide text-white/25">Empty</span>
      </div>
    );
  }

  const lower = u.toLowerCase();
  const isPdf = /\.pdf(\?|#|$)/i.test(u) || lower.startsWith('data:application/pdf');
  if (isPdf) {
    return (
      <div className="flex h-[5.5rem] w-[5.5rem] flex-col items-center justify-center rounded-lg border border-white/10 bg-black/45 text-center">
        <span className="text-[11px] font-bold text-red-300/90">PDF</span>
        <span className="mt-1 px-1 text-[8px] leading-snug text-white/35">Opens in new tab from kiosk</span>
      </div>
    );
  }

  const isSvg = /\.svg(\?|#|$)/i.test(u) || /^data:image\/svg\+xml/i.test(u);
  const isVideo = /\.(mp4|webm|ogg|mov)(\?|#|$)/i.test(u) || /^data:video\//i.test(u);
  const remote = /^https?:\/\//i.test(u);

  if (isVideo) {
    return (
      <div className="flex h-[5.5rem] w-[5.5rem] items-center justify-center overflow-hidden rounded-lg border border-white/[0.08] bg-black/50">
        <video src={u} muted playsInline preload="metadata" className="max-h-full max-w-full object-contain" />
      </div>
    );
  }

  if (isSvg) {
    return (
      <div className="flex h-[5.5rem] w-[5.5rem] items-center justify-center overflow-hidden rounded-lg border border-white/[0.08] bg-black/50">
        <object type="image/svg+xml" data={u} title="Preview" className="max-h-full max-w-full" />
      </div>
    );
  }

  if (rasterError) {
    return (
      <div className="flex h-[5.5rem] w-[5.5rem] flex-col items-center justify-center rounded-lg border border-amber-500/20 bg-amber-500/5 px-1 text-center">
        <span className="text-[8px] leading-snug text-amber-200/80">Could not load preview</span>
      </div>
    );
  }

  return (
    <div className="flex h-[5.5rem] w-[5.5rem] items-center justify-center overflow-hidden rounded-lg border border-white/[0.08] bg-black/50">
      <img
        src={u}
        alt=""
        className="max-h-full max-w-full object-contain"
        referrerPolicy={remote ? 'no-referrer' : undefined}
        onError={() => setRasterError(true)}
      />
    </div>
  );
}

function CmsDocFieldWithPreview({
  label, value, onChange, placeholder, uploadLabel, uploadAccept, onUploadFile, previewColumnTitle = 'View image',
}: {
  label: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  uploadLabel: string;
  uploadAccept: string;
  onUploadFile: (f: File) => void;
  /** Shown above the thumbnail column (e.g. "Preview" for PDF brochure). */
  previewColumnTitle?: string;
}) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="flex gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <CmsField label={label} value={value} onChange={onChange} placeholder={placeholder} />
          <UploadButton label={uploadLabel} accept={uploadAccept} onFile={onUploadFile} />
        </div>
        <div className="flex shrink-0 flex-col items-center border-l border-white/[0.06] pl-3">
          <span className="mb-1.5 whitespace-nowrap text-[9px] font-semibold uppercase tracking-wider text-[#d4af37]/80">{previewColumnTitle}</span>
          <CmsMediaPreviewThumb url={value} />
        </div>
      </div>
    </div>
  );
}

function MediaGalleryThumb({ m, onOpen }: { m: MediaItem; onOpen: () => void }) {
  const remote = /^https?:\/\//i.test(m.url.trim());
  if (m.type === 'image') {
    const isSvg = /\.svg(\?|#|$)/i.test(m.url) || /^data:image\/svg\+xml/i.test(m.url);
    return (
      <button
        type="button"
        onClick={onOpen}
        className="group relative h-11 w-11 shrink-0 overflow-hidden rounded-md border border-white/10 bg-black/50 outline-none transition ring-[#d4af37]/0 hover:ring-2 hover:ring-[#d4af37]/40 focus-visible:ring-2 focus-visible:ring-[#d4af37]/50"
        title="View larger"
      >
        {isSvg ? (
          <object type="image/svg+xml" data={m.url} className="pointer-events-none h-full w-full" aria-hidden />
        ) : (
          <img src={m.url} alt="" className="h-full w-full object-cover" referrerPolicy={remote ? 'no-referrer' : undefined} />
        )}
        <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/70 py-0.5 text-[7px] font-semibold uppercase text-[#d4af37] opacity-0 transition group-hover:opacity-100">View</span>
      </button>
    );
  }
  if (m.type === 'video') {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="group relative h-11 w-14 shrink-0 overflow-hidden rounded-md border border-white/10 bg-black outline-none transition hover:ring-2 hover:ring-[#d4af37]/40 focus-visible:ring-2 focus-visible:ring-[#d4af37]/50"
        title="View larger"
      >
        <video src={m.url} muted playsInline preload="metadata" className="pointer-events-none h-full w-full object-cover" />
        <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/70 py-0.5 text-[7px] font-semibold uppercase text-[#d4af37] opacity-0 transition group-hover:opacity-100">View</span>
      </button>
    );
  }
  if (m.type === 'pdf') {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-md border border-white/10 bg-red-950/35 text-[8px] font-bold uppercase text-red-200/90 outline-none transition hover:ring-2 hover:ring-[#d4af37]/40"
        title="Open preview"
      >
        PDF
      </button>
    );
  }
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-white/10 bg-emerald-950/30 text-[8px] font-bold leading-tight text-emerald-200/90 text-center px-0.5" title="3D model (preview in GLB viewer separately)">
      3D
    </div>
  );
}

/* ─── MEDIA TAB ─── */
function BoothCtaBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded border border-[#d4af37]/35 bg-[#d4af37]/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-[#d4af37]">
      {label}
    </span>
  );
}

function MediaTab({
  boothId,
  toastUploadResult,
  media,
  addMediaItem,
  removeMediaItem,
  brochureUrl,
  setBrochureUrl,
  enablePageIndexBrochure,
  setEnablePageIndexBrochure,
  siteMapSlides,
  setSiteMapSlides,
  persistSiteMapSlides,
  priceListUrl,
  setPriceListUrl,
  enablePageIndexPriceList,
  setEnablePageIndexPriceList,
  videoUrl,
  setVideoUrl,
  stageScreenUrl,
  setStageScreenUrl,
  unitLayoutUrl,
  setUnitLayoutUrl,
  signageImageUrl,
  setSignageImageUrl,
  persistDocumentField,
  persistPageIndexFlag,
  onUseBundledSiteMapPath,
  showUploadError,
}: {
  boothId: string;
  toastUploadResult: (result: UploadResult, label: string) => void;
  showUploadError: (err: unknown) => void;
  media: MediaItem[];
  addMediaItem: (f: File, t: MediaItem['type']) => void;
  removeMediaItem: (id: string) => void;
  brochureUrl: string;
  setBrochureUrl: (v: string) => void;
  enablePageIndexBrochure: boolean;
  setEnablePageIndexBrochure: (v: boolean) => void;
  siteMapSlides: string[];
  setSiteMapSlides: (v: string[] | ((prev: string[]) => string[])) => void;
  persistSiteMapSlides: (urls: string[]) => Promise<void>;
  priceListUrl: string;
  setPriceListUrl: (v: string) => void;
  enablePageIndexPriceList: boolean;
  setEnablePageIndexPriceList: (v: boolean) => void;
  videoUrl: string;
  setVideoUrl: (v: string) => void;
  stageScreenUrl: string;
  setStageScreenUrl: (v: string) => void;
  unitLayoutUrl: string;
  setUnitLayoutUrl: (v: string) => void;
  signageImageUrl: string;
  setSignageImageUrl: (v: string) => void;
  persistDocumentField: (
    field: 'brochureUrl' | 'priceListUrl' | 'unitLayoutUrl' | 'videoUrl' | 'stageScreenUrl' | 'signageImageUrl',
    url: string,
    label: string,
  ) => Promise<void>;
  persistPageIndexFlag: (field: 'pageIndexBrochure' | 'pageIndexPriceList', enabled: boolean) => Promise<void>;
  onUseBundledSiteMapPath: () => void;
}) {
  const [galleryPreview, setGalleryPreview] = useState<MediaItem | null>(null);
  const [r2ApiOnline, setR2ApiOnline] = useState<boolean | null>(null);

  useEffect(() => {
    void isR2Available().then(setR2ApiOnline);
  }, []);
  const remotePreview = galleryPreview ? /^https?:\/\//i.test(galleryPreview.url.trim()) : false;
  const galleryDataUrlChars = useMemo(
    () => media.reduce((acc, m) => acc + (/^data:/i.test(m.url) ? m.url.length : 0), 0),
    [media],
  );
  const siteMapHasHeavyDataUrl = useMemo(
    () => siteMapSlides.some((u) => /^data:image\//i.test(u.trim()) && u.length > 20_000),
    [siteMapSlides],
  );

  return (
    <>
      <SectionTitle>Main stage screen (large LED)</SectionTitle>
      <p className="mb-3 text-[10px] leading-relaxed text-white/40">
        The <strong className="text-white/55">big back-wall screen</strong> in the booth. Upload a project image (PNG/JPG) or video (MP4). Saves immediately when uploaded to R2.
      </p>
      <div className="mb-5 rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3">
        <CmsDocFieldWithPreview
          label="Stage screen"
          value={stageScreenUrl}
          onChange={setStageScreenUrl}
          placeholder="/13391496_3840_2160_60fps.mp4 or https://…/render.jpg"
          uploadLabel="Upload image or video"
          uploadAccept="image/*,video/*,.mp4,.webm"
          previewColumnTitle="Stage preview"
          onUploadFile={async (f) => {
            try {
              const folder = f.type.startsWith('video/') ? 'stage-video' : 'stage-image';
              const up = await uploadCmsFile(f, boothId, folder);
              setStageScreenUrl(up.url);
              toastUploadResult(up, 'Stage screen');
              await persistDocumentField('stageScreenUrl', up.url, 'Stage screen');
            } catch (e) {
              showUploadError(e);
            }
          }}
        />
      </div>

      <SectionTitle>Booth side menu — visitor buttons</SectionTitle>
      <p className="mb-3 text-[10px] leading-relaxed text-white/40">
        Upload here for each gold button at your booth. Production uploads need Coolify running <span className="font-mono text-white/50">npm run start:prod</span> with all <span className="font-mono text-white/50">R2_*</span> env vars (Runtime ON). Otherwise upload PDFs in Cloudflare R2 and edit <span className="font-mono text-white/50">public/r2-documents.json</span>.
      </p>
      {r2ApiOnline === false && (
        <p className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[10px] leading-relaxed text-amber-100/90">
          R2 upload API is offline — brochures save in this browser only. Fix: Coolify start command <span className="font-mono">npm run start</span>, all <span className="font-mono">R2_*</span> Runtime ON, redeploy.
        </p>
      )}
      {r2ApiOnline === true && (
        <p className="mb-3 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-[10px] leading-relaxed text-emerald-100/90">
          R2 upload is online. After upload you should see: <strong>“→ R2 · saved for all visitors”</strong> — then every guest sees the same brochure.
        </p>
      )}

      <div className="mb-4 space-y-3 rounded-lg border border-[#d4af37]/20 bg-[#d4af37]/5 p-3">
        <CmsDocFieldWithPreview
          label="Brochure — booth button"
          value={brochureUrl}
          onChange={setBrochureUrl}
          placeholder="https://…/brochure.pdf"
          uploadLabel="Upload brochure (PDF)"
          uploadAccept=".pdf,application/pdf"
          onUploadFile={async (f) => {
            try {
              const up = await uploadCmsFile(f, boothId, 'brochure');
              setBrochureUrl(up.url);
              toastUploadResult(up, 'Brochure');
              await persistDocumentField('brochureUrl', up.url, 'Brochure');
              if (enablePageIndexBrochure) void autoIndexPdf(f, boothId, 'brochure', up.url);
            } catch (e) {
              showUploadError(e);
            }
          }}
        />
        <CmsDocFieldWithPreview
          label="Price list — booth button"
          value={priceListUrl}
          onChange={setPriceListUrl}
          placeholder="https://…/price-list.pdf"
          uploadLabel="Upload price list (PDF or image)"
          uploadAccept=".pdf,application/pdf,image/*"
          onUploadFile={async (f) => {
            try {
              const up = await uploadCmsFile(f, boothId, 'price-list');
              setPriceListUrl(up.url);
              toastUploadResult(up, 'Price list');
              await persistDocumentField('priceListUrl', up.url, 'Price list');
              const isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
              if (enablePageIndexPriceList && isPdf) void autoIndexPdf(f, boothId, 'priceList', up.url);
            } catch (e) {
              showUploadError(e);
            }
          }}
        />

        <SectionTitle>PageIndex — AI document tree</SectionTitle>
        <p className="mb-2 text-[10px] leading-relaxed text-white/40">
          Builds a searchable tree in MongoDB so <strong className="text-white/55">Ask AI</strong> answers from your PDFs only.
          Turn on auto-index, upload a PDF above, or click <strong className="text-white/55">Run PageIndex</strong>.
          Requires <span className="font-mono text-white/50">MONGODB_URI</span> and dev server running.
          When indexing finishes, click <strong className="text-white/55">Refresh</strong> to see section/node counts. Full JSON:{' '}
          <a href="/pageindex" className="text-[#d4af37]/90 underline hover:text-[#f5d060]" target="_blank" rel="noreferrer">
            /pageindex
          </a>{' '}
          or Atlas → <span className="font-mono text-white/50">pageindexes.structure</span>.
        </p>
        <PageIndexBoothTracker boothId={boothId} brochureUrl={brochureUrl} priceListUrl={priceListUrl} />
        <div className="mb-3 grid gap-3 sm:grid-cols-2">
          <PageIndexDocControls
            boothId={boothId}
            documentType="brochure"
            pdfUrl={brochureUrl}
            enabled={enablePageIndexBrochure}
            enableLabel="Auto-index brochure on upload"
            onEnabledChange={(v) => {
              setEnablePageIndexBrochure(v);
              void persistPageIndexFlag('pageIndexBrochure', v);
            }}
          />
          <PageIndexDocControls
            boothId={boothId}
            documentType="priceList"
            pdfUrl={priceListUrl}
            enabled={enablePageIndexPriceList}
            enableLabel="Auto-index price list on upload"
            onEnabledChange={(v) => {
              setEnablePageIndexPriceList(v);
              void persistPageIndexFlag('pageIndexPriceList', v);
            }}
          />
        </div>

        <CmsDocFieldWithPreview
          label="Walkthrough — booth button"
          value={videoUrl}
          onChange={setVideoUrl}
          placeholder="/13391496_3840_2160_60fps.mp4"
          uploadLabel="Upload walkthrough video"
          uploadAccept="video/*,.mp4,.webm"
          onUploadFile={async (f) => {
            const up = await uploadCmsFile(f, boothId, 'walkthrough');
            setVideoUrl(up.url);
            toastUploadResult(up, 'Walkthrough');
            await persistDocumentField('videoUrl', up.url, 'Walkthrough');
          }}
          previewColumnTitle="Preview"
        />
        <p className="-mt-2 mb-1 text-[9px] text-white/30">
          Opens when visitors tap <strong className="text-white/45">Walk Through</strong> — separate from the main stage screen above.
        </p>
        <CmsDocFieldWithPreview
          label="Unit layout — booth button"
          value={unitLayoutUrl}
          onChange={setUnitLayoutUrl}
          placeholder="https://…/unit-layout.pdf"
          uploadLabel="Upload unit layout (PDF or image)"
          uploadAccept=".pdf,application/pdf,image/*"
          onUploadFile={async (f) => {
            const up = await uploadCmsFile(f, boothId, 'unit-layout');
            setUnitLayoutUrl(up.url);
            toastUploadResult(up, 'Unit layout');
            await persistDocumentField('unitLayoutUrl', up.url, 'Unit layout');
          }}
        />
        <CmsDocFieldWithPreview
          label="Signage image — digital board"
          value={signageImageUrl}
          onChange={setSignageImageUrl}
          placeholder="https://…/signage.png"
          uploadLabel="Upload signage image"
          uploadAccept="image/*"
          onUploadFile={async (f) => {
            const up = await uploadCmsFile(f, boothId, 'signage');
            setSignageImageUrl(up.url);
            toastUploadResult(up, 'Signage image');
            await persistDocumentField('signageImageUrl', up.url, 'Signage image');
          }}
          previewColumnTitle="Preview"
        />
      </div>

      <SectionTitle>Images — booth button</SectionTitle>
      <p className="mb-2 text-[10px] text-white/35">
        Upload gallery photos below ({media.filter((m) => m.type === 'image').length} image(s) in media list). Then click Apply Changes.
      </p>
      <div className="mb-4 grid grid-cols-2 gap-2">
        <UploadFilesButton
          label="Add booth images"
          accept="image/*"
          onFiles={async (files) => {
            for (const f of files) addMediaItem(f, 'image');
          }}
        />
      </div>

      <SectionTitle>Extra media library (optional)</SectionTitle>
      <p className="mb-2 text-[10px] text-white/35">Additional videos, PDFs, or 3D models — booth buttons above use the dedicated fields.</p>
      <div className="grid grid-cols-2 gap-2">
        <UploadButton label="Image" accept="image/*" onFile={(f) => addMediaItem(f, 'image')} />
        <UploadButton label="Video" accept="video/*" onFile={(f) => addMediaItem(f, 'video')} />
        <UploadButton label="PDF" accept=".pdf" onFile={(f) => addMediaItem(f, 'pdf')} />
        <UploadButton label="3D Model" accept=".glb,.gltf" onFile={(f) => addMediaItem(f, 'model')} />
      </div>
      {media.length > 0 && (
        <div className="mt-3 overflow-hidden rounded-lg border border-white/[0.06]">
          <div className="grid grid-cols-[auto_minmax(0,1fr)_3.25rem_auto] items-center gap-2 border-b border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-[9px] font-semibold uppercase tracking-wider text-white/35">
            <span>Type</span>
            <span>Uploaded file</span>
            <span className="text-center">View</span>
            <span className="w-6" />
          </div>
          <ul className="divide-y divide-white/[0.06]">
            {media.map((m) => (
              <li key={m.id} className="grid grid-cols-[auto_minmax(0,1fr)_3.25rem_auto] items-center gap-2 bg-white/[0.02] px-3 py-2">
                <span className={`justify-self-start text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${m.type === 'image' ? 'bg-blue-500/20 text-blue-300' : m.type === 'video' ? 'bg-purple-500/20 text-purple-300' : m.type === 'pdf' ? 'bg-red-500/20 text-red-300' : 'bg-green-500/20 text-green-300'}`}>{m.type}</span>
                <span className="min-w-0 truncate text-[11px] text-white/55" title={m.label}>{m.label}</span>
                <div className="flex justify-center">
                  <MediaGalleryThumb m={m} onOpen={() => setGalleryPreview(m)} />
                </div>
                <button type="button" className="justify-self-end text-[10px] text-red-400/50 hover:text-red-400" onClick={() => removeMediaItem(m.id)} aria-label="Remove">✕</button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {galleryDataUrlChars > 150_000 && (
        <p className="mt-2 rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-[10px] leading-relaxed text-amber-100/90">
          Media gallery holds large embedded files (~{Math.round(galleryDataUrlChars / 1024)} KB of data URLs). They share the same browser storage limit as documents. Remove rows you do not need (✕), then Apply Changes.
        </p>
      )}

      {galleryPreview && (
        <div
          role="presentation"
          className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setGalleryPreview(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Preview ${galleryPreview.label}`}
            className="relative max-h-[90vh] max-w-[min(96vw,900px)] overflow-hidden rounded-xl border border-[#d4af37]/35 bg-[#0a0a10] p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="absolute right-3 top-3 z-10 rounded p-1 text-white/50 hover:bg-white/10 hover:text-white"
              onClick={() => setGalleryPreview(null)}
              aria-label="Close preview"
            >
              ✕
            </button>
            <p className="mb-3 truncate pr-10 text-xs font-medium text-[#d4af37]">{galleryPreview.label}</p>
            <div className="max-h-[min(78vh,720px)] overflow-auto rounded-lg border border-white/10 bg-black/40">
              {galleryPreview.type === 'image' && (
                /\.svg(\?|#|$)/i.test(galleryPreview.url) || /^data:image\/svg\+xml/i.test(galleryPreview.url) ? (
                  <object type="image/svg+xml" data={galleryPreview.url} title={galleryPreview.label} className="mx-auto block max-h-[72vh] w-full max-w-full" />
                ) : (
                  <img
                    src={galleryPreview.url}
                    alt={galleryPreview.label}
                    className="mx-auto block max-h-[72vh] w-auto max-w-full object-contain"
                    referrerPolicy={remotePreview ? 'no-referrer' : undefined}
                  />
                )
              )}
              {galleryPreview.type === 'video' && (
                <video src={galleryPreview.url} controls playsInline className="mx-auto block max-h-[72vh] w-full max-w-full" />
              )}
              {galleryPreview.type === 'pdf' && (
                /^https?:\/\//i.test(galleryPreview.url.trim()) ? (
                  <iframe title={galleryPreview.label} src={galleryPreview.url} className="h-[min(72vh,640px)] w-full min-w-[min(90vw,720px)] rounded bg-white" />
                ) : (
                  <div className="flex flex-col items-center gap-3 p-8 text-center">
                    <p className="text-sm text-amber-200/90">PDF is stored in the browser only. Open in a new tab, or upload to R2 on a server with Node.</p>
                    <button
                      type="button"
                      className="rounded-lg bg-[#d4af37] px-4 py-2 text-xs font-bold uppercase text-black"
                      onClick={() => openUrlInNewTab(galleryPreview.url)}
                    >
                      Open PDF
                    </button>
                  </div>
                )
              )}
              {galleryPreview.type === 'model' && (
                <p className="p-8 text-center text-sm text-white/50">GLB / GLTF preview is not embedded here. Download from your files or open the asset URL in a 3D viewer.</p>
              )}
            </div>
          </div>
        </div>
      )}
      <SectionTitle>Site layout slides</SectionTitle>
      <p className="mb-2 text-[10px] leading-relaxed text-white/35">
        Powers the <strong className="text-white/55">Site layout</strong> booth button and kiosk “View site map”. Saves immediately to R2 when configured.
      </p>
      <div className="space-y-3">
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
          <div className="mb-2">
            <span className="mb-0.5 block text-[10px] uppercase tracking-wide text-white/45">Site layout slides</span>
            <p className="text-[9px] leading-relaxed text-white/30">Order = carousel order. Use Add image(s) for multi-upload.</p>
          </div>
          {siteMapSlides.length === 0 ? (
            <p className="mb-2 text-[10px] text-white/35">No images yet — add one or use the bundled SVG.</p>
          ) : (
            <ul className="max-h-64 space-y-2 overflow-y-auto pr-0.5">
              {siteMapSlides.map((url, i) => (
                <li key={`sm-${i}`} className="flex gap-2 rounded-md border border-white/[0.06] bg-black/25 p-2">
                  <div className="shrink-0 pt-0.5">
                    <CmsMediaPreviewThumb url={url} />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <CmsField
                      label={`Slide ${i + 1}`}
                      value={url}
                      onChange={(v) => setSiteMapSlides((prev) => { const n = [...prev]; n[i] = v; return n; })}
                      placeholder="/maps/floor-1.png"
                    />
                    <button
                      type="button"
                      className="text-[9px] text-red-400/70 hover:text-red-400"
                      onClick={() => void persistSiteMapSlides(siteMapSlides.filter((_, j) => j !== i))}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <UploadFilesButton
              label="Add image(s)"
              accept="image/*"
              onFiles={async (files) => {
                const uploaded = await Promise.all(
                  files.map(async (f) => {
                    const up = await uploadCmsFile(f, boothId, 'site-map');
                    toastUploadResult(up, f.name);
                    return up.url;
                  }),
                );
                await persistSiteMapSlides([...siteMapSlides, ...uploaded]);
              }}
            />
            <button
              type="button"
              className="rounded-lg border border-white/15 px-3 py-2.5 text-[11px] text-white/45 hover:bg-white/[0.04]"
              onClick={() => setSiteMapSlides((prev) => [...prev, ''])}
            >
              + URL row
            </button>
          </div>
        </div>
        {siteMapHasHeavyDataUrl && (
          <div className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2.5">
            <p className="mb-2 text-[10px] leading-relaxed text-amber-100/95">
              Long data URLs can fill browser storage. Prefer files under <span className="font-mono text-amber-200/95">public/maps/</span> with short paths.
            </p>
            <button
              type="button"
              className="rounded-lg bg-amber-500/25 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber-100 ring-1 ring-amber-400/40 hover:bg-amber-500/35"
              onClick={() => void onUseBundledSiteMapPath()}
            >
              Use bundled /maps/site-map.svg
            </button>
          </div>
        )}
      </div>
    </>
  );
}

/* ─── COMPANY TAB ─── */
function CompanyTab({ company, setCompany }: { company: CompanyProfile; setCompany: (c: CompanyProfile) => void }) {
  const upd = (k: keyof CompanyProfile, v: string) => setCompany({ ...company, [k]: v });
  return (
    <>
      <SectionTitle>Company Info</SectionTitle>
      <CmsField label="Company Name" value={company.companyName} onChange={(v) => upd('companyName', v)} />
      <CmsField label="Tagline" value={company.tagline} onChange={(v) => upd('tagline', v)} />
      <CmsField label="Website" value={company.website} onChange={(v) => upd('website', v)} placeholder="https://" />
      <CmsField label="Phone" value={company.phone} onChange={(v) => upd('phone', v)} placeholder="+91 …" />
      <CmsField label="Email" value={company.email} onChange={(v) => upd('email', v)} />
      <SectionTitle>Social Links</SectionTitle>
      <CmsField label="WhatsApp" value={company.whatsapp} onChange={(v) => upd('whatsapp', v)} placeholder="+91 …" />
      <CmsField label="Facebook" value={company.facebook} onChange={(v) => upd('facebook', v)} placeholder="https://facebook.com/…" />
      <CmsField label="Instagram" value={company.instagram} onChange={(v) => upd('instagram', v)} placeholder="https://instagram.com/…" />
      <CmsField label="Twitter / X" value={company.twitter} onChange={(v) => upd('twitter', v)} placeholder="https://x.com/…" />
      <SectionTitle>Brand Colors</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <CmsColor label="Primary" value={company.brandPrimary} onChange={(v) => upd('brandPrimary', v)} />
        <CmsColor label="Secondary" value={company.brandSecondary} onChange={(v) => upd('brandSecondary', v)} />
      </div>
    </>
  );
}

function PlacedImageSizeFields({
  size,
  onCommit,
}: {
  size: [number, number];
  onCommit: (size: [number, number]) => void;
}) {
  const [widthText, setWidthText] = useState(String(size[0]));
  const [heightText, setHeightText] = useState(String(size[1]));

  useEffect(() => {
    setWidthText(String(size[0]));
    setHeightText(String(size[1]));
  }, [size[0], size[1]]);

  const commit = useCallback(() => {
    const w = parseFloat(widthText);
    const h = parseFloat(heightText);
    if (Number.isFinite(w) && w > 0 && Number.isFinite(h) && h > 0) {
      onCommit([w, h]);
      setWidthText(String(w));
      setHeightText(String(h));
    } else {
      setWidthText(String(size[0]));
      setHeightText(String(size[1]));
    }
  }, [widthText, heightText, onCommit, size]);

  return (
    <div className="grid grid-cols-2 gap-2">
      <div>
        <label className="mb-0.5 block text-[9px] uppercase text-white/30">Width (m)</label>
        <input
          className="w-full rounded border border-white/[0.08] bg-white/[0.04] px-2 py-1 text-[11px] text-white outline-none"
          value={widthText}
          onChange={(e) => setWidthText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
      <div>
        <label className="mb-0.5 block text-[9px] uppercase text-white/30">Height (m)</label>
        <input
          className="w-full rounded border border-white/[0.08] bg-white/[0.04] px-2 py-1 text-[11px] text-white outline-none"
          value={heightText}
          onChange={(e) => setHeightText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  );
}

/* ─── IMAGES TAB (click-to-place) ─── */
function ImagesTab({
  boothId, toastUploadResult, placedImages, placingImageUrl, setPlacingImageUrl, setPlacingLabel,
  repositionImageId, setRepositionImageId,
  selectedImageId, setSelectedImageId, removePlacedImage, updatePlacedImage,
}: {
  boothId: string;
  toastUploadResult: (result: UploadResult, label: string) => void;
  placedImages: PlacedImage[];
  placingImageUrl: string | null;
  setPlacingImageUrl: (url: string | null) => void;
  setPlacingLabel: (l: string) => void;
  repositionImageId: string | null;
  setRepositionImageId: (id: string | null) => void;
  selectedImageId: string | null;
  setSelectedImageId: (id: string | null) => void;
  removePlacedImage: (id: string) => void;
  updatePlacedImage: (id: string, patch: Partial<PlacedImage>) => void;
}) {
  const selectedImg = placedImages.find((p) => p.id === selectedImageId);
  const cancelPlacing = () => {
    setPlacingImageUrl(null);
    setPlacingLabel('');
    setRepositionImageId(null);
  };

  return (
    <>
      <SectionTitle>Place Image on Booth</SectionTitle>
      <p className="text-[10px] text-white/35 leading-relaxed mb-3">
        Upload an image, then <strong className="text-white/50">click the large white aisle side wall</strong> in the 3D preview.
        Orbit is paused while placing. Drag after placing to fine-tune. Click <strong className="text-white/50">Apply Changes</strong> to save.
      </p>
      {placingImageUrl ? (
        <div className="rounded-lg border border-[#d4af37]/30 bg-[#d4af37]/5 p-3 mb-3">
          <p className="text-[11px] text-[#d4af37] font-semibold mb-2 animate-pulse">
            {repositionImageId ? 'Click the wall where you want this image' : 'Click the side wall in the 3D view to place'}
          </p>
          <img src={placingImageUrl} alt="placing" className="mx-auto max-h-20 rounded border border-white/10 object-contain mb-2" />
          <button className="w-full rounded border border-white/10 px-2 py-1 text-[10px] text-white/40 hover:bg-white/5" onClick={cancelPlacing}>
            Cancel
          </button>
        </div>
      ) : (
        <UploadButton
          label="Upload image to place"
          accept="image/*"
          onFile={async (f) => {
            const up = await uploadCmsFile(f, boothId, 'placed-images');
            setPlacingImageUrl(up.url);
            setPlacingLabel(f.name);
            toastUploadResult(up, f.name);
          }}
        />
      )}

      <SectionTitle>Placed Images ({placedImages.length})</SectionTitle>
      {placedImages.length === 0 && (
        <p className="text-[10px] text-white/25 italic">No images placed yet</p>
      )}
      <div className="space-y-2">
        {placedImages.map((img) => (
          <div
            key={img.id}
            className={`rounded-lg border p-2.5 transition-all ${img.id === selectedImageId ? 'border-[#d4af37]/50 bg-[#d4af37]/10' : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]'}`}
          >
            <div
              className="flex items-center gap-2 mb-1.5 cursor-pointer"
              onClick={() => setSelectedImageId(img.id === selectedImageId ? null : img.id)}
            >
              <img src={img.url} alt={img.label} className="h-8 w-8 rounded border border-white/10 object-cover shrink-0" />
              <span className="flex-1 truncate text-[11px] text-white/60">{img.label}</span>
              <button className="text-[10px] text-red-400/50 hover:text-red-400 shrink-0" onClick={(e) => { e.stopPropagation(); removePlacedImage(img.id); }}>✕</button>
            </div>
            {img.id === selectedImageId && (
              <div
                className="space-y-2 pt-1.5 border-t border-white/[0.06]"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  className="w-full rounded border border-[#d4af37]/35 bg-[#d4af37]/10 px-2 py-1.5 text-[10px] font-semibold text-[#d4af37] hover:bg-[#d4af37]/15"
                  onClick={() => {
                    setRepositionImageId(img.id);
                    setPlacingImageUrl(img.url);
                    setPlacingLabel(img.label);
                  }}
                >
                  Move to wall — click in 3D
                </button>
                <PlacedImageSizeFields
                  size={img.size}
                  onCommit={(size) => updatePlacedImage(img.id, { size })}
                />
                <p className="text-[9px] text-white/20 font-mono">
                  pos: [{img.position.map((v) => v.toFixed(2)).join(', ')}]
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

/* ─── LIGHTING TAB ─── */
function LightingTab({ lighting, setLighting }: { lighting: BoothLighting; setLighting: (l: BoothLighting) => void }) {
  const upd = (k: keyof BoothLighting, v: number | string) => setLighting({ ...lighting, [k]: v });
  return (
    <>
      <SectionTitle>Spotlight</SectionTitle>
      <CmsSlider label="Intensity" value={lighting.spotlightIntensity} onChange={(v) => upd('spotlightIntensity', v)} min={0} max={200} step={1} />
      <CmsColor label="Spotlight Color" value={lighting.spotlightColor} onChange={(v) => upd('spotlightColor', v)} />
      <SectionTitle>LED Strip</SectionTitle>
      <CmsColor label="LED Color" value={lighting.ledStripColor} onChange={(v) => upd('ledStripColor', v)} />
      <CmsSlider label="LED Intensity" value={lighting.ledStripIntensity} onChange={(v) => upd('ledStripIntensity', v)} min={0} max={10} step={0.1} />
      <SectionTitle>Glow & Ambient</SectionTitle>
      <CmsSlider label="Emissive Glow" value={lighting.emissiveGlow} onChange={(v) => upd('emissiveGlow', v)} min={0} max={2} />
      <CmsSlider label="Ambient Intensity" value={lighting.ambientIntensity} onChange={(v) => upd('ambientIntensity', v)} min={0} max={2} />
    </>
  );
}
