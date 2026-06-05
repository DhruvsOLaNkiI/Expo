import { useMemo } from 'react';
import {
  applyBoothOverrides,
  buildDefaultBoothLayoutList,
  mergeSceneConfig,
  type BoothLayoutPatch,
} from '@/features/shared/data/boothLayouts';
import type { ExpoHallMeta } from '@/features/shared/data/expoHalls';
import { CmsApplyHallLayoutControls } from './CmsApplyHallLayoutControls';
import { CmsHallMapTab } from './CmsHallMapTab';

type Props = {
  halls: ExpoHallMeta[];
  activeHallId: string;
  overridesByHall: Record<string, Record<string, BoothLayoutPatch>>;
  sceneOverridesByHall: Record<string, Record<string, unknown>>;
  onSelectHall: (hallId: string) => void;
  onPatchBooth: (id: string, patch: BoothLayoutPatch, hallId: string) => Promise<boolean>;
  onApplyLayoutFrom: (sourceHallId: string) => Promise<{ ok: boolean; applied: string[] }>;
};

function countCustomizedBooths(overrides: Record<string, BoothLayoutPatch> | undefined): number {
  if (!overrides) return 0;
  return Object.keys(overrides).filter((id) => Object.keys(overrides[id] ?? {}).length > 0).length;
}

export function CmsAllHallsOverview({
  halls,
  activeHallId,
  overridesByHall,
  sceneOverridesByHall,
  onSelectHall,
  onPatchBooth,
  onApplyLayoutFrom,
}: Props) {
  const defaults = useMemo(() => buildDefaultBoothLayoutList(), []);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#08080e]">
      <div className="border-b border-white/10 bg-[#0d0d14] px-5 py-3 space-y-3">
        <div>
          <h2 className="text-sm font-bold text-[#d4af37] tracking-wide">All Expo Halls</h2>
          <p className="text-[11px] text-white/45 mt-0.5">
            Click a hall to edit branding. Use the same booth placement everywhere:
          </p>
        </div>
        <CmsApplyHallLayoutControls
          halls={halls}
          defaultSourceHallId={halls[0]?.hallId ?? 'hall-1'}
          onApplyLayoutFrom={onApplyLayoutFrom}
          variant="panel"
        />
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-[1400px] mx-auto">
          {halls.map((hall) => {
            const overrides = overridesByHall[hall.hallId] ?? {};
            const mergedList = applyBoothOverrides(defaults, overrides);
            const sceneOv = sceneOverridesByHall[hall.hallId] ?? {};
            const sceneConfig = mergeSceneConfig(sceneOv);
            const customized = countCustomizedBooths(overrides);
            const isActive = hall.hallId === activeHallId;

            return (
              <button
                key={hall.hallId}
                type="button"
                onClick={() => onSelectHall(hall.hallId)}
                className={`group flex flex-col rounded-xl border text-left transition-all overflow-hidden ${
                  isActive
                    ? 'border-[#d4af37]/60 ring-1 ring-[#d4af37]/30 bg-[#12121a]'
                    : 'border-white/10 bg-[#0d0d14] hover:border-[#d4af37]/35 hover:bg-[#101018]'
                }`}
              >
                <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-white/[0.06]">
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white/90 truncate">{hall.label}</div>
                    <div className="text-[10px] font-mono text-white/35">{hall.hallId}</div>
                  </div>
                  <span className="shrink-0 rounded-full bg-white/[0.06] px-2 py-0.5 text-[9px] text-white/50">
                    {customized > 0 ? `${customized} customized` : 'defaults'}
                  </span>
                </div>
                <div className="h-[200px] min-h-[180px] relative">
                  <CmsHallMapTab
                    compact
                    interactive={false}
                    booths={mergedList}
                    selectedIds={[]}
                    primarySelectedId=""
                    onSelectBooth={() => {}}
                    onPatchBooth={(id, patch) => onPatchBooth(id, patch, hall.hallId)}
                    hallLayout={sceneConfig.hallLayout}
                    onPatchHallLayout={() => {}}
                  />
                </div>
                <div className="px-3 py-2 text-[10px] text-[#d4af37]/80 group-hover:text-[#d4af37]">
                  {isActive ? 'Selected · open Hall Map to edit' : 'Click to select hall →'}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
