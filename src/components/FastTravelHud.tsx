import { useMemo, useState } from 'react';
import { useStore } from '../store';
import {
  buildExpoTeleportDestinations,
  REGISTRATION_LOBBY_DESTINATION,
} from '../data/expoTeleportDestinations';

export function FastTravelHud() {
  const expoPhase = useStore((s) => s.expoPhase);
  const boothOverrides = useStore((s) => s.boothOverrides);
  const teleportPlayer = useStore((s) => s.teleportPlayer);
  const enterMainExpo = useStore((s) => s.enterMainExpo);
  const enterRegistrationLobby = useStore((s) => s.enterRegistrationLobby);
  const showInstructions = useStore((s) => s.showInstructions);
  const registrationUi = useStore((s) => s.registrationUi);
  const ctaResourcePopup = useStore((s) => s.ctaResourcePopup);
  const activeBooth = useStore((s) => s.activeBooth);

  const [open, setOpen] = useState(true);

  const expoDestinations = useMemo(
    () => buildExpoTeleportDestinations(boothOverrides),
    [boothOverrides],
  );

  if (showInstructions || registrationUi !== 'none' || ctaResourcePopup || activeBooth) {
    return null;
  }

  const inExpo = expoPhase === 'expo';

  return (
    <div className="fixed top-20 right-3 z-[54] pointer-events-auto flex flex-col items-end gap-2 max-w-[220px]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg border border-[#d4af37]/35 bg-[#1a1a22]/92 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#d4af37] shadow-lg backdrop-blur-md hover:bg-black transition-colors"
      >
        {open ? 'Hide travel' : 'Fast travel'}
      </button>

      {open && (
        <div className="w-full rounded-xl border border-[#d4af37]/25 bg-[#1a1a22]/94 p-3 shadow-2xl backdrop-blur-md">
          <p className="text-[9px] uppercase tracking-[0.28em] text-[#8a7a5a] mb-2">
            {inExpo ? 'Main expo' : 'Arrival lobby'}
          </p>

          {inExpo ? (
            <>
              <TravelBtn
                label={REGISTRATION_LOBBY_DESTINATION.label}
                highlight="gold"
                onClick={() => enterRegistrationLobby()}
              />
              <div className="my-2 border-t border-white/10" />
              <p className="text-[9px] uppercase tracking-wider text-white/40 mb-1.5">Jump to</p>
              <DestinationList
                destinations={expoDestinations}
                onPick={(id) => {
                  const dest = expoDestinations.find((d) => d.id === id);
                  if (dest) teleportPlayer(dest.position);
                }}
              />
            </>
          ) : (
            <>
              <TravelBtn label="Enter main expo hall" highlight="gold" onClick={() => enterMainExpo()} />
              <p className="text-[10px] text-white/45 mt-2 leading-snug">
                Register at the counter to access the main expo
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function TravelBtn({
  label,
  onClick,
  highlight,
}: {
  label: string;
  onClick: () => void;
  highlight?: 'gold' | 'default';
}) {
  const base =
    highlight === 'gold'
      ? 'bg-[#d4af37]/15 border-[#d4af37]/40 text-[#f5e6c8] hover:bg-[#d4af37]/25'
      : 'bg-white/5 border-white/10 text-white/90 hover:bg-white/10';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-2.5 py-2 mb-1 rounded-lg border text-[11px] font-semibold tracking-wide transition-colors ${base}`}
    >
      {label}
    </button>
  );
}

function DestinationList({
  destinations,
  onPick,
}: {
  destinations: { id: string; label: string }[];
  onPick: (id: string) => void;
}) {
  return (
    <div className="max-h-[42vh] overflow-y-auto pr-0.5 -mr-0.5">
      {destinations.map((d) => (
        <TravelBtn key={d.id} label={d.label} onClick={() => onPick(d.id)} />
      ))}
    </div>
  );
}
