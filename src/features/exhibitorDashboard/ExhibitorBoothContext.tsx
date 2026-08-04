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
  DEFAULT_EXPO_HALL_ID,
  normalizeHallId,
  type ExpoHallMeta,
} from '@/features/shared/data/expoHalls';
import {
  DEFAULT_EXHIBITOR_BOOTH_ID,
  listExhibitorBoothOptions,
  resolveExhibitorBoothId,
  resolveExhibitorHallIdFromUrl,
  type ExhibitorBoothOption,
} from './exhibitorConfig';

type ExhibitorBoothContextValue = {
  boothId: string;
  booth: BoothLayoutConfig | null;
  booths: ExhibitorBoothOption[];
  hallId: string;
  hallLabel: string;
  halls: ExpoHallMeta[];
  loading: boolean;
  hydrated: boolean;
  setBoothId: (id: string) => void;
  setHallId: (id: string) => Promise<void>;
  patchBooth: (patch: BoothLayoutPatch) => Promise<boolean>;
};

const ExhibitorBoothContext = createContext<ExhibitorBoothContextValue | null>(null);

function syncExhibitorUrl(boothId: string, hallId: string) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (boothId === DEFAULT_EXHIBITOR_BOOTH_ID) {
    url.searchParams.delete('booth');
  } else {
    url.searchParams.set('booth', boothId);
  }
  if (hallId === DEFAULT_EXPO_HALL_ID) {
    url.searchParams.delete('hall');
  } else {
    url.searchParams.set('hall', hallId);
  }
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
}

export function ExhibitorBoothProvider({ children }: { children: ReactNode }) {
  const initBoothCms = useStore((s) => s.initBoothCms);
  const syncBoothOverridesFromPersistence = useStore((s) => s.syncBoothOverridesFromPersistence);
  const boothOverrides = useStore((s) => s.boothOverrides);
  const patchBoothOverride = useStore((s) => s.patchBoothOverride);
  const hydrated = useStore((s) => s._boothCmsHydrated);
  const activeHallId = useStore((s) => s.activeHallId);
  const setActiveHall = useStore((s) => s.setActiveHall);
  const expoHalls = useStore((s) => s.expoHalls);
  const [loading, setLoading] = useState(true);
  const [boothId, setBoothIdState] = useState(() => resolveExhibitorBoothId());

  const halls = useMemo(
    () => expoHalls.filter((h) => h.enabled).sort((a, b) => a.sortOrder - b.sortOrder),
    [expoHalls],
  );

  const hallId = normalizeHallId(activeHallId);
  const hallLabel =
    halls.find((h) => h.hallId === hallId)?.label ??
    expoHalls.find((h) => h.hallId === hallId)?.label ??
    hallId;

  // Apply ?hall= from URL once on mount (loads that hall's CMS overrides).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const fromUrl = normalizeHallId(
        resolveExhibitorHallIdFromUrl(activeHallId || DEFAULT_EXPO_HALL_ID),
      );
      if (fromUrl !== normalizeHallId(activeHallId)) {
        await setActiveHall(fromUrl, { teleport: false });
      } else {
        await initBoothCms();
      }
      if (!cancelled) {
        syncExhibitorUrl(boothId, useStore.getState().activeHallId || DEFAULT_EXPO_HALL_ID);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Only on mount — hall changes go through setHallId.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      syncExhibitorUrl(next, useStore.getState().activeHallId || DEFAULT_EXPO_HALL_ID);
    },
    [booths],
  );

  const setHallId = useCallback(
    async (id: string) => {
      const next = normalizeHallId(id);
      if (next === normalizeHallId(useStore.getState().activeHallId)) {
        syncExhibitorUrl(boothId, next);
        return;
      }
      setLoading(true);
      await setActiveHall(next, { teleport: false });
      syncExhibitorUrl(boothId, next);
      setLoading(false);
    },
    [boothId, setActiveHall],
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
      hallId,
      hallLabel,
      halls,
      loading,
      hydrated,
      setBoothId,
      setHallId,
      patchBooth,
    }),
    [
      boothId,
      booth,
      booths,
      hallId,
      hallLabel,
      halls,
      loading,
      hydrated,
      setBoothId,
      setHallId,
      patchBooth,
    ],
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
