import { useCallback, useEffect, useMemo, useState } from 'react';
import { useStore } from '@/store';
import {
  applyBoothOverrides,
  buildDefaultBoothLayoutList,
  type BoothLayoutConfig,
  type BoothLayoutPatch,
} from '@/features/shared/data/boothLayouts';
import { resolveExhibitorBoothId } from './exhibitorConfig';

export function useExhibitorBooth() {
  const boothId = resolveExhibitorBoothId();
  const initBoothCms = useStore((s) => s.initBoothCms);
  const boothOverrides = useStore((s) => s.boothOverrides);
  const patchBoothOverride = useStore((s) => s.patchBoothOverride);
  const hydrated = useStore((s) => s._boothCmsHydrated);
  const [loading, setLoading] = useState(!hydrated);

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

  const booth = useMemo((): BoothLayoutConfig | null => {
    const list = applyBoothOverrides(buildDefaultBoothLayoutList(), boothOverrides);
    return list.find((b) => b.id === boothId) ?? null;
  }, [boothId, boothOverrides]);

  const patchBooth = useCallback(
    async (patch: BoothLayoutPatch) => {
      const ok = await patchBoothOverride(boothId, patch);
      return ok;
    },
    [boothId, patchBoothOverride],
  );

  return {
    boothId,
    booth,
    loading,
    hydrated,
    patchBooth,
  };
}
