import { useState, type FormEvent, type ReactNode } from 'react';
import { registerVisitorOnServer } from '../api/visitorMongo';
import { useStore } from '../store';

const inputClass =
  'w-full rounded-lg border border-black/15 bg-white px-4 py-2.5 text-sm text-black placeholder:text-gray-400 focus:border-[#d4af37] focus:outline-none focus:ring-1 focus:ring-[#d4af37]/40';

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isValidPhone(value: string): boolean {
  return value.replace(/\D/g, '').length >= 8;
}

export function RegistrationLobbyHud() {
  const registrationUi = useStore((s) => s.registrationUi);
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
          <RegisterForm onClose={closeRegistrationUi} />
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

function RegisterForm({ onClose }: { onClose: () => void }) {
  const visitorProfile = useStore((s) => s.visitorProfile);
  const confirmRegistration = useStore((s) => s.confirmRegistration);

  const [name, setName] = useState(visitorProfile?.displayName ?? '');
  const [email, setEmail] = useState(visitorProfile?.email ?? '');
  const [phone, setPhone] = useState(visitorProfile?.phone ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visitorId = visitorProfile?.id ?? '—';
  const trimmedName = name.trim();
  const canSubmit =
    trimmedName.length >= 2 &&
    isValidEmail(email) &&
    isValidPhone(phone) &&
    !!visitorProfile &&
    !submitting;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!visitorProfile || !canSubmit) return;

    setSubmitting(true);
    setError(null);

    const payload = {
      displayName: trimmedName,
      email: email.trim(),
      phone: phone.trim(),
    };

    const profileForServer = {
      ...visitorProfile,
      ...payload,
    };

    const result = await registerVisitorOnServer(profileForServer, { lobbyCheckIn: true });
    if (!result.ok) {
      setError('error' in result ? result.error : 'Could not save registration. Try again.');
      setSubmitting(false);
      return;
    }

    confirmRegistration(payload);
    setSubmitting(false);
  };

  return (
    <PanelShell title="Visitor Registration">
      <p className="text-xs text-gray-500 mb-4 leading-relaxed">
        Complete the form below to check in and access the main exhibition hall.
      </p>

      {!visitorProfile ? (
        <p className="text-sm text-amber-800 mb-4">
          Finish visitor onboarding first (name and avatar), then return to register.
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-1.5">
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            maxLength={64}
            autoFocus
            disabled={!visitorProfile || submitting}
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-1.5">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            disabled={!visitorProfile || submitting}
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-1.5">
            Visitor ID
          </label>
          <input
            type="text"
            value={visitorId}
            readOnly
            className={`${inputClass} bg-gray-50 font-mono text-[#8a7a5a] cursor-default`}
          />
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-1.5">
            Phone number
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 555 000 0000"
            disabled={!visitorProfile || submitting}
            className={inputClass}
          />
        </div>

        {error ? <p className="text-xs text-red-600">{error}</p> : null}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 py-3 rounded-lg border border-black/10 text-black/70 text-xs font-semibold uppercase tracking-wider hover:bg-black/5 disabled:opacity-50"
          >
            Later
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="flex-1 py-3 rounded-lg bg-[#d4af37] text-black text-xs font-bold uppercase tracking-wider hover:bg-[#c4a030] shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? 'Saving…' : 'Register'}
          </button>
        </div>
      </form>
    </PanelShell>
  );
}

function GrantedPanel({ onContinue }: { onContinue: () => void }) {
  const visitorProfile = useStore((s) => s.visitorProfile);
  return (
    <PanelShell title="Access Granted">
      <div className="text-center py-2 mb-4">
        <div className="text-4xl mb-3 text-emerald-600">✓</div>
        <p className="text-sm text-emerald-800 font-medium">
          {visitorProfile
            ? `${visitorProfile.displayName}, your pass is active.`
            : 'Welcome. Your pass is active.'}
        </p>
        {visitorProfile?.email ? (
          <p className="text-xs text-gray-500 mt-2">{visitorProfile.email}</p>
        ) : null}
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
