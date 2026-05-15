import type { ReactNode } from 'react';
import { useStore } from '../store';

export function RegistrationLobbyHud() {
  const registrationUi = useStore((s) => s.registrationUi);
  const confirmRegistration = useStore((s) => s.confirmRegistration);
  const enterMainExpo = useStore((s) => s.enterMainExpo);
  const closeRegistrationUi = useStore((s) => s.closeRegistrationUi);
  const expoPhase = useStore((s) => s.expoPhase);

  if (expoPhase !== 'registration' || registrationUi === 'none') return null;

  return (
    <>
      <div
        className="absolute inset-0 bg-black/40 z-[48] pointer-events-auto"
        onClick={closeRegistrationUi}
        aria-hidden
      />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] w-[90%] max-w-md bg-white/95 border border-[#d4af37]/40 p-6 rounded-2xl shadow-2xl backdrop-blur-md pointer-events-auto">
        {registrationUi === 'granted' ? (
          <GrantedPanel onContinue={enterMainExpo} />
        ) : (
          <RegisterPanel onRegister={confirmRegistration} onClose={closeRegistrationUi} />
        )}
      </div>
    </>
  );
}

function PanelShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <div className="mb-4 border-b border-black/10 pb-3">
        <h2 className="text-lg font-bold tracking-widest text-[#d4af37]">{title}</h2>
      </div>
      {children}
    </>
  );
}

function RegisterPanel({ onRegister, onClose }: { onRegister: () => void; onClose: () => void }) {
  return (
    <PanelShell title="Visitor Registration">
      <p className="text-sm text-gray-600 leading-relaxed mb-6">
        Complete registration to access the main luxury property exhibition hall.
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 py-3 rounded-lg border border-black/10 text-black/70 text-xs font-semibold uppercase tracking-wider hover:bg-black/5"
        >
          Later
        </button>
        <button
          type="button"
          onClick={onRegister}
          className="flex-1 py-3 rounded-lg bg-[#d4af37] text-black text-xs font-bold uppercase tracking-wider hover:bg-[#c4a030] shadow-lg"
        >
          Register Now
        </button>
      </div>
    </PanelShell>
  );
}

function GrantedPanel({ onContinue }: { onContinue: () => void }) {
  return (
    <PanelShell title="Access Granted">
      <div className="text-center py-2 mb-4">
        <div className="text-4xl mb-3 text-emerald-600">✓</div>
        <p className="text-sm text-emerald-800 font-medium">Welcome. Your pass is active.</p>
      </div>
      <button
        type="button"
        onClick={onContinue}
        className="w-full py-3 rounded-lg bg-black text-[#d4af37] text-xs font-bold uppercase tracking-wider hover:bg-black/90"
      >
        Enter Main Expo
      </button>
    </PanelShell>
  );
}
