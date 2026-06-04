import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useStore } from '@/store';
import { BOOTH_CMS_PERSIST_EVENT } from '@/store/persist/boothCms';
import {
  applyBoothOverrides,
  buildDefaultBoothLayoutList,
  type BoothLayoutConfig,
  type BoothLayoutPatch,
} from '@/features/shared/data/boothLayouts';
import {
  DEFAULT_EXHIBITOR_BOOTH_ID,
  listExhibitorBoothOptions,
  resolveExhibitorBoothId,
  type ExhibitorBoothOption,
} from './exhibitorConfig';

type ExhibitorBoothContextValue = {
  boothId: string;
  booth: BoothLayoutConfig | null;
  booths: ExhibitorBoothOption[];
  loading: boolean;
  hydrated: boolean;
  setBoothId: (id: string) => void;
  patchBooth: (patch: BoothLayoutPatch) => Promise<boolean>;
};

const ExhibitorBoothContext = createContext<ExhibitorBoothContextValue | null>(null);

function syncBoothToUrl(boothId: string) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (boothId === DEFAULT_EXHIBITOR_BOOTH_ID) {
    url.searchParams.delete('booth');
  } else {
    url.searchParams.set('booth', boothId);
  }
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
}

export function ExhibitorBoothProvider({ children }: { children: ReactNode }) {
  const initBoothCms = useStore((s) => s.initBoothCms);
  const syncBoothOverridesFromPersistence = useStore((s) => s.syncBoothOverridesFromPersistence);
  const boothOverrides = useStore((s) => s.boothOverrides);
  const patchBoothOverride = useStore((s) => s.patchBoothOverride);
  const hydrated = useStore((s) => s._boothCmsHydrated);
  const [loading, setLoading] = useState(!hydrated);
  const [boothId, setBoothIdState] = useState(() => resolveExhibitorBoothId());

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await initBoothCms();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [initBoothCms]);

  useEffect(() => {
    const onPersisted = () => void syncBoothOverridesFromPersistence();
    window.addEventListener(BOOTH_CMS_PERSIST_EVENT, onPersisted);
    window.addEventListener('storage', onPersisted);
    return () => {
      window.removeEventListener(BOOTH_CMS_PERSIST_EVENT, onPersisted);
      window.removeEventListener('storage', onPersisted);
    };
  }, [syncBoothOverridesFromPersistence]);

  const layouts = useMemo(
    () => applyBoothOverrides(buildDefaultBoothLayoutList(), boothOverrides),
    [boothOverrides],
  );

  const booths = useMemo(() => listExhibitorBoothOptions(layouts), [layouts]);

  const booth = useMemo(
    () => layouts.find((b) => b.id === boothId) ?? null,
    [layouts, boothId],
  );

  const setBoothId = useCallback(
    (id: string) => {
      const next = booths.some((b) => b.id === id) ? id : DEFAULT_EXHIBITOR_BOOTH_ID;
      setBoothIdState(next);
      syncBoothToUrl(next);
    },
    [booths],
  );

  const patchBooth = useCallback(
    async (patch: BoothLayoutPatch) => patchBoothOverride(boothId, patch),
    [boothId, patchBoothOverride],
  );

  const value = useMemo(
    () => ({
      boothId,
      booth,
      booths,
      loading,
      hydrated,
      setBoothId,
      patchBooth,
    }),
    [boothId, booth, booths, loading, hydrated, setBoothId, patchBooth],
  );

  return (
    <ExhibitorBoothContext.Provider value={value}>{children}</ExhibitorBoothContext.Provider>
  );
}

export function useExhibitorBoothContext(): ExhibitorBoothContextValue {
  const ctx = useContext(ExhibitorBoothContext);
  if (!ctx) {
    throw new Error('useExhibitorBoothContext must be used within ExhibitorBoothProvider');
  }
  return ctx;
}
