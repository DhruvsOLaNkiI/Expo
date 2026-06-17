import { useMemo, type ReactNode } from 'react';
import { useStore } from '@/store';
import {
  buildExpoTeleportDestinations,
  REGISTRATION_LOBBY_DESTINATION,
} from '@/features/shared/data/expoTeleportDestinations';
import { getExpoHallMeta } from '@/features/shared/data/expoHalls';

type PanelTheme = 'dark' | 'light';

export function FastTravelPanel({
  theme = 'dark',
  onNavigate,
}: {
  theme?: PanelTheme;
  /** Called after a teleport / hall switch so parent can close the menu. */
  onNavigate?: () => void;
}) {
  const expoPhase = useStore((s) => s.expoPhase);
  const boothOverrides = useStore((s) => s.boothOverrides);
  const activeHallId = useStore((s) => s.activeHallId);
  const expoHalls = useStore((s) => s.expoHalls);
  const setActiveHall = useStore((s) => s.setActiveHall);
  const teleportPlayer = useStore((s) => s.teleportPlayer);
  const enterMainExpo = useStore((s) => s.enterMainExpo);
  const skipToMainExpo = useStore((s) => s.skipToMainExpo);
  const registrationPass = useStore((s) => s.registrationPass);
  const enterRegistrationLobby = useStore((s) => s.enterRegistrationLobby);

  const expoDestinations = useMemo(
    () => buildExpoTeleportDestinations(boothOverrides),
    [boothOverrides],
  );

  const inExpo = expoPhase === 'expo';
  const light = theme === 'light';

  const after = () => onNavigate?.();

  return (
    <div className="space-y-3">
      <p
        className={`text-[9px] uppercase tracking-[0.28em] ${light ? 'text-[#8a7a5a]' : 'text-[#8a7a5a]'}`}
      >
        {inExpo ? getExpoHallMeta(activeHallId)?.label ?? 'Expo hall' : 'Arrival lobby'}
      </p>

      {inExpo ? (
        <>
          {expoHalls.length > 1 && (
            <>
              <SectionLabel light={light}>Which hall to go</SectionLabel>
              <div className="grid grid-cols-2 gap-1.5">
                {expoHalls.map((h) => (
                  <TravelBtn
                    key={h.hallId}
                    light={light}
                    label={h.hallId === activeHallId ? `● ${h.label}` : h.label}
                    highlight={h.hallId === activeHallId ? 'gold' : 'default'}
                    onClick={() => {
                      void setActiveHall(h.hallId);
                      after();
                    }}
                  />
                ))}
              </div>
            </>
          )}
          <TravelBtn
            light={light}
            label={REGISTRATION_LOBBY_DESTINATION.label}
            highlight="gold"
            onClick={() => {
              enterRegistrationLobby();
              after();
            }}
          />
          <SectionLabel light={light}>Jump to</SectionLabel>
          <div className="max-h-40 overflow-y-auto pr-0.5 -mr-0.5">
            {expoDestinations.map((d) => (
              <TravelBtn
                key={d.id}
                light={light}
                label={d.label}
                onClick={() => {
                  teleportPlayer([d.position[0], d.position[1], d.position[2]]);
                  after();
                }}
              />
            ))}
          </div>
        </>
      ) : (
        <>
          <TravelBtn
            light={light}
            label="Enter main expo hall"
            highlight="gold"
            onClick={() => {
              enterMainExpo();
              after();
            }}
          />
          {!registrationPass ? (
            <>
              <TravelBtn
                light={light}
                label="Skip registration"
                onClick={() => {
                  skipToMainExpo();
                  after();
                }}
              />
              <p className={`text-[10px] leading-snug ${light ? 'text-[#8a7a5a]' : 'text-white/45'}`}>
                Or register at the counter for a full visitor pass
              </p>
            </>
          ) : (
            <p className={`text-[10px] ${light ? 'text-[#8a7a5a]' : 'text-white/45'}`}>
              You have expo access
            </p>
          )}
        </>
      )}
    </div>
  );
}

function SectionLabel({ children, light }: { children: ReactNode; light: boolean }) {
  return (
    <p
      className={`text-[9px] uppercase tracking-wider mb-1 ${light ? 'text-[#a89878]' : 'text-white/40'}`}
    >
      {children}
    </p>
  );
}

function TravelBtn({
  label,
  onClick,
  highlight,
  light,
}: {
  label: string;
  onClick: () => void;
  highlight?: 'gold' | 'default';
  light: boolean;
}) {
  const base = light
    ? highlight === 'gold'
      ? 'bg-[#d4af37]/18 border-[#d4af37]/50 text-[#5c4a1a] hover:bg-[#d4af37]/28'
      : 'bg-white border-[#e8dcc8] text-[#1a1520] hover:bg-[#faf8f4]'
    : highlight === 'gold'
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
