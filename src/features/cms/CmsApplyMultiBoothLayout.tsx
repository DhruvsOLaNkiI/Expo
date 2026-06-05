import { useState } from 'react';
import { DEFAULT_EXPO_HALL_ID, type ExpoHallMeta } from '@/features/shared/data/expoHalls';

type Props = {
  slotIds: string[];
  boothLabels: string[];
  activeHallId: string;
  halls: ExpoHallMeta[];
  onApplyFromHall: (
    slotIds: string[],
    sourceHallId: string,
    targetHallIds: string[],
  ) => Promise<{ ok: boolean; applied: string[] }>;
  variant?: 'panel' | 'toolbar';
};

export function CmsApplyMultiBoothLayout({
  slotIds,
  boothLabels,
  activeHallId,
  halls,
  onApplyFromHall,
  variant = 'panel',
}: Props) {
  const [sourceHallId, setSourceHallId] = useState(DEFAULT_EXPO_HALL_ID);
  const [applying, setApplying] = useState<'this' | 'others' | null>(null);
  const [msg, setMsg] = useState('');

  const sourceLabel = halls.find((h) => h.hallId === sourceHallId)?.label ?? sourceHallId;
  const activeLabel = halls.find((h) => h.hallId === activeHallId)?.label ?? activeHallId;
  const otherCount = halls.filter((h) => h.hallId !== sourceHallId).length;
  const count = slotIds.length;

  const runApply = async (mode: 'this' | 'others') => {
    if (mode === 'this') {
      if (sourceHallId === activeHallId) {
        setMsg('Pick a different source hall to copy from.');
        return;
      }
      if (
        !window.confirm(
          `Copy placement for ${count} selected booth(s) from ${sourceLabel} onto ${activeLabel}?`,
        )
      ) {
        return;
      }
    } else {
      if (otherCount === 0) {
        setMsg('No other halls.');
        return;
      }
      if (
        !window.confirm(
          `Copy placement for ${count} selected booth(s) from ${sourceLabel} to the same slots in ${otherCount} other hall(s)?`,
        )
      ) {
        return;
      }
    }

    setApplying(mode);
    setMsg('');
    try {
      const targets =
        mode === 'this' ? [activeHallId] : halls.map((h) => h.hallId).filter((id) => id !== sourceHallId);
      const result = await onApplyFromHall(slotIds, sourceHallId, targets);
      if (result.applied.length > 0) {
        setMsg(
          result.ok
            ? mode === 'this'
              ? `Applied ${count} booth(s) to ${activeLabel}.`
              : `${count} booth(s) updated in ${result.applied.length} hall(s).`
            : `Saved locally; server may be offline.`,
        );
      } else {
        setMsg('Could not apply.');
      }
    } finally {
      setApplying(null);
    }
  };

  const selectEl = (
    <select
      value={sourceHallId}
      onChange={(e) => setSourceHallId(e.target.value)}
      className={
        variant === 'toolbar'
          ? 'rounded bg-white/[0.06] border border-white/10 px-2 py-0.5 text-[11px] text-white/70 outline-none max-w-[110px]'
          : 'w-full rounded-lg bg-white/[0.06] border border-white/10 px-2 py-1.5 text-xs text-white/80 outline-none focus:border-violet-400/40'
      }
    >
      {halls.map((h) => (
        <option key={h.hallId} value={h.hallId}>
          {h.label}
        </option>
      ))}
    </select>
  );

  if (variant === 'toolbar') {
    return (
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <div className="mx-1 h-4 w-px bg-white/10" />
        <span className="text-[10px] text-white/40 uppercase tracking-wider">{count} sel · From</span>
        {selectEl}
        <button
          type="button"
          disabled={applying !== null || sourceHallId === activeHallId}
          onClick={() => void runApply('this')}
          className="rounded bg-[#d4af37]/15 border border-[#d4af37]/40 px-2 py-1 text-[11px] font-semibold text-[#d4af37] hover:bg-[#d4af37]/25 disabled:opacity-40 whitespace-nowrap"
        >
          {applying === 'this' ? '…' : 'Apply here'}
        </button>
        <button
          type="button"
          disabled={applying !== null || otherCount === 0}
          onClick={() => void runApply('others')}
          className="rounded bg-violet-500/15 border border-violet-400/35 px-2 py-1 text-[11px] font-semibold text-violet-200 hover:bg-violet-500/25 disabled:opacity-40 whitespace-nowrap"
        >
          {applying === 'others' ? '…' : 'To other halls'}
        </button>
        {msg ? (
          <span className="text-[10px] text-violet-300/90 max-w-[140px] truncate" title={msg}>
            {msg}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-violet-500/25 bg-violet-500/8 p-3 space-y-3">
      <div className="text-xs font-semibold text-violet-200 uppercase tracking-wider">
        {count} booths selected · copy placement
      </div>
      <ul className="max-h-24 overflow-y-auto text-[10px] text-white/50 space-y-0.5 font-mono">
        {boothLabels.map((label, i) => (
          <li key={slotIds[i] ?? i}>
            {label}{' '}
            <span className="text-white/30">({slotIds[i]})</span>
          </li>
        ))}
      </ul>
      <p className="text-[10px] text-white/45 leading-relaxed">
        Shift+click booths on the map or sidebar to add/remove. Copy layout from a source hall to{' '}
        <strong className="text-white/65">{activeLabel}</strong> or all other halls.
      </p>
      <label className="block text-[10px] text-white/45 uppercase tracking-wider">Copy layout from</label>
      {selectEl}
      <button
        type="button"
        disabled={applying !== null || sourceHallId === activeHallId}
        onClick={() => void runApply('this')}
        className="w-full rounded-lg bg-[#d4af37]/15 border border-[#d4af37]/40 px-3 py-2 text-[11px] font-semibold text-[#d4af37] hover:bg-[#d4af37]/25 disabled:opacity-40 transition-colors"
      >
        {applying === 'this' ? 'Applying…' : `Apply to selected (${activeLabel})`}
      </button>
      <button
        type="button"
        disabled={applying !== null || otherCount === 0}
        onClick={() => void runApply('others')}
        className="w-full rounded-lg bg-violet-500/15 border border-violet-400/35 px-3 py-2 text-[11px] font-semibold text-violet-100 hover:bg-violet-500/25 disabled:opacity-40 transition-colors"
      >
        {applying === 'others' ? 'Applying…' : `Apply to all other halls (${otherCount})`}
      </button>
      {msg ? <p className="text-[10px] text-violet-300/90">{msg}</p> : null}
    </div>
  );
}
