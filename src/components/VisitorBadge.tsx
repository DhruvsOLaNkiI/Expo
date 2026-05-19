import { useStore } from '../store';

export function VisitorBadge() {
  const visitorProfile = useStore((s) => s.visitorProfile);
  const showInstructions = useStore((s) => s.showInstructions);
  const registrationUi = useStore((s) => s.registrationUi);
  const hallLayoutEditMode = useStore((s) => s.hallLayoutEditMode);

  if (!visitorProfile || showInstructions || registrationUi !== 'none' || hallLayoutEditMode) {
    return null;
  }

  const { displayName, id, avatar } = visitorProfile;

  return (
    <div className="fixed bottom-20 left-3 z-[46] pointer-events-none flex items-center gap-3 rounded-xl border border-[#d4af37]/25 bg-[#1a1a22]/90 px-3 py-2.5 shadow-lg backdrop-blur-md">
      <div className="relative h-10 w-8 shrink-0" aria-hidden>
        <div
          className="absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 rounded-full border border-white/10"
          style={{ backgroundColor: avatar.skinTone }}
        />
        <div
          className="absolute left-1/2 top-2 h-1.5 w-4 -translate-x-1/2 rounded-t-full"
          style={{ backgroundColor: avatar.hairColor }}
        />
        <div
          className="absolute bottom-0 left-1/2 h-6 w-6 -translate-x-1/2 rounded-t-md rounded-b-sm"
          style={{ backgroundColor: avatar.outfitColor }}
        />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-[#e8e4dc] truncate max-w-[140px]">{displayName}</p>
        <p className="text-[9px] font-mono uppercase tracking-wider text-[#8a7a5a]">{id}</p>
      </div>
    </div>
  );
}
