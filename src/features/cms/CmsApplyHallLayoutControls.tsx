import { useState } from 'react';
import { DEFAULT_EXPO_HALL_ID, type ExpoHallMeta } from '@/features/shared/data/expoHalls';

type Props = {
  halls: ExpoHallMeta[];
  /** Default source hall in the dropdown (e.g. active hall on Hall Map). */
  defaultSourceHallId: string;
  onApplyLayoutFrom: (sourceHallId: string) => Promise<{ ok: boolean; applied: string[] }>;
  /** `toolbar` = single row in Hall Map toolbar; `panel` = stacked in sidebar. */
  variant?: 'toolbar' | 'panel';
};

export function CmsApplyHallLayoutControls({
  halls,
  defaultSourceHallId = DEFAULT_EXPO_HALL_ID,
  onApplyLayoutFrom,
  variant = 'panel',
}: Props) {
  const [layoutSourceId, setLayoutSourceId] = useState(
    defaultSourceHallId || DEFAULT_EXPO_HALL_ID,
  );
  const [applying, setApplying] = useState(false);
  const [layoutMsg, setLayoutMsg] = useState('');

  const handleApplyLayout = async (forceSourceId?: string) => {
    const sourceId = forceSourceId ?? layoutSourceId;
    const sourceLabel = halls.find((h) => h.hallId === sourceId)?.label ?? sourceId;
    const others = halls.filter((h) => h.hallId !== sourceId).length;
    if (others === 0) {
      setLayoutMsg('No other halls to update.');
      return;
    }
    if (
      !window.confirm(
        `Copy booth positions, sizes, rotation, and entry spawn from "${sourceLabel}" to the other ${others} hall(s)? Branding and media stay unchanged.`,
      )
    ) {
      return;
    }
    setApplying(true);
    setLayoutMsg('');
    try {
      const result = await onApplyLayoutFrom(sourceId);
      if (result.applied.length > 0) {
        setLayoutMsg(
          result.ok
            ? `Layout applied to ${result.applied.length} hall(s).`
            : `Saved locally for ${result.applied.length} hall(s); server may be offline.`,
        );
      } else {
        setLayoutMsg('Nothing to apply.');
      }
    } finally {
      setApplying(false);
    }
  };

  if (variant === 'toolbar') {
    return (
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <div className="mx-1 h-4 w-px bg-white/10" />
        <span className="text-[10px] text-white/40 uppercase tracking-wider">Layout</span>
        <select
          value={layoutSourceId}
          onChange={(e) => setLayoutSourceId(e.target.value)}
          className="rounded bg-white/[0.06] border border-white/10 px-2 py-0.5 text-[11px] text-white/70 outline-none max-w-[120px]"
          title="Copy layout from this hall"
        >
          {halls.map((h) => (
            <option key={h.hallId} value={h.hallId}>
              {h.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={applying || halls.length < 2}
          onClick={() => void handleApplyLayout()}
          className="rounded bg-[#d4af37]/15 border border-[#d4af37]/40 px-2.5 py-1 text-[11px] font-semibold text-[#d4af37] hover:bg-[#d4af37]/25 disabled:opacity-40 whitespace-nowrap"
        >
          {applying ? 'Applying…' : 'Apply to other halls'}
        </button>
        {layoutMsg ? (
          <span className="text-[10px] text-[#d4af37]/80 max-w-[200px] truncate" title={layoutMsg}>
            {layoutMsg}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#d4af37]/20 bg-[#d4af37]/5 p-3 space-y-2">
      <div className="text-xs font-semibold text-[#d4af37] uppercase tracking-wider">Copy hall layout</div>
      <p className="text-[10px] text-white/40 leading-relaxed">
        Copy every booth&apos;s position, rotation (angle), size, and entry spawn to all other halls. Branding and media stay the same on each hall.
      </p>
      <label className="block text-[10px] text-white/45 uppercase tracking-wider">From hall</label>
      <select
        value={layoutSourceId}
        onChange={(e) => setLayoutSourceId(e.target.value)}
        className="w-full rounded-lg bg-white/[0.06] border border-white/10 px-2 py-1.5 text-xs text-white/80 outline-none focus:border-[#d4af37]/40"
      >
        {halls.map((h) => (
          <option key={h.hallId} value={h.hallId}>
            {h.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={applying || halls.length < 2}
        onClick={() => void handleApplyLayout(DEFAULT_EXPO_HALL_ID)}
        className="w-full rounded-lg bg-violet-500/20 border border-violet-400/40 px-3 py-2 text-[11px] font-semibold text-violet-100 hover:bg-violet-500/30 disabled:opacity-40 transition-colors"
        title="Use Expo Hall 1 as the master layout"
      >
        {applying ? 'Applying…' : 'Sync all halls → match Expo Hall 1'}
      </button>
      <button
        type="button"
        disabled={applying || halls.length < 2}
        onClick={() => void handleApplyLayout()}
        className="w-full rounded-lg bg-[#d4af37]/15 border border-[#d4af37]/40 px-3 py-2 text-[11px] font-semibold text-[#d4af37] hover:bg-[#d4af37]/25 disabled:opacity-40 transition-colors"
      >
        {applying ? 'Applying…' : 'Apply selected hall to all others'}
      </button>
      {layoutMsg ? <p className="text-[10px] text-[#d4af37]/90">{layoutMsg}</p> : null}
    </div>
  );
}
