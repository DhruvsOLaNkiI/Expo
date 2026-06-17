import { useState, type FormEvent } from 'react';
import { useStore } from '@/store';
import { isValidVisitorId, normalizeVisitorId } from '@/features/visitor/visitorProfile';

const inputClass =
  'w-full rounded-lg border border-[#e8dcc8] bg-white px-4 py-3 text-[#1a1520] font-mono text-sm placeholder:text-[#c4b89a] focus:border-[#d4af37] focus:outline-none focus:ring-1 focus:ring-[#d4af37]/40';

type Props = {
  onSuccess?: () => void;
  /** Lighter copy for the registration desk modal */
  variant?: 'onboarding' | 'registration';
};

export function VisitorLoginBackForm({ onSuccess, variant = 'onboarding' }: Props) {
  const loginReturningVisitor = useStore((s) => s.loginReturningVisitor);
  const enterMainExpo = useStore((s) => s.enterMainExpo);

  const [visitorId, setVisitorId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedId = normalizeVisitorId(visitorId);
  const canSubmit = isValidVisitorId(normalizedId) && !submitting;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) {
      setError('Enter a valid Visitor ID (e.g. VX-ABC12).');
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await loginReturningVisitor(normalizedId);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error ?? 'Could not sign in. Try again.');
      return;
    }
    if (result.enteredExpo) {
      onSuccess?.();
      return;
    }
    const hasPass = useStore.getState().registrationPass;
    if (hasPass) {
      enterMainExpo();
    }
    onSuccess?.();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-xs text-[#8a7a5a] leading-relaxed">
        {variant === 'registration'
          ? 'Already checked in before? Enter the Visitor ID from your last visit to restore your pass.'
          : 'Welcome back — enter your Visitor ID from a previous visit.'}
      </p>
      <div>
        <label className="block text-[10px] uppercase tracking-[0.2em] text-[#8a7a5a] mb-2">
          Visitor ID
        </label>
        <input
          type="text"
          value={visitorId}
          onChange={(e) => {
            setVisitorId(e.target.value);
            setError(null);
          }}
          placeholder="e.g. VX-NVUCCDUM"
          maxLength={24}
          autoFocus
          disabled={submitting}
          className={inputClass}
        />
      </div>
      {error ? <p className="text-[11px] text-red-700">{error}</p> : null}
      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full py-3 rounded-lg bg-[#1a1520] text-[#d4af37] text-xs font-bold uppercase tracking-wider hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed shadow-lg transition-colors"
      >
        {submitting ? 'Signing in…' : 'Login back'}
      </button>
    </form>
  );
}
