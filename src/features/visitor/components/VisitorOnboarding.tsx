import { useState } from 'react';
import { useStore } from '@/store';
import { VisitorLoginBackForm } from './VisitorLoginBackForm';
import {
  DEFAULT_AVATAR,
  generateVisitorId,
  HAIR_SWATCHES,
  isValidVisitorId,
  normalizeVisitorId,
  OUTFIT_SWATCHES,
  readVisitorProfile,
  SKIN_SWATCHES,
  type VisitorAvatar,
} from '@/features/visitor/visitorProfile';

type Step = 'login' | 'avatar';
type EntryMode = 'new' | 'returning';

function AvatarPreview({ avatar }: { avatar: VisitorAvatar }) {
  return (
    <div className="relative mx-auto mb-6 h-36 w-24">
      <div
        className="absolute left-1/2 top-0 h-10 w-10 -translate-x-1/2 rounded-full border-2 border-white/20"
        style={{ backgroundColor: avatar.skinTone }}
      />
      <div
        className="absolute left-1/2 top-7 h-5 w-14 -translate-x-1/2 rounded-t-full"
        style={{ backgroundColor: avatar.hairColor }}
      />
      <div
        className="absolute bottom-0 left-1/2 h-24 w-20 -translate-x-1/2 rounded-t-2xl rounded-b-lg border-2 border-[#d4af37]/30"
        style={{ backgroundColor: avatar.outfitColor }}
      />
      <div
        className="absolute bottom-14 left-1/2 h-8 w-16 -translate-x-1/2 rounded-full opacity-90"
        style={{ backgroundColor: avatar.outfitColor, filter: 'brightness(1.15)' }}
      />
    </div>
  );
}

function SwatchRow({
  label,
  colors,
  value,
  onChange,
}: {
  label: string;
  colors: readonly string[];
  value: string;
  onChange: (c: string) => void;
}) {
  return (
    <div className="mb-4">
      <p className="text-[10px] uppercase tracking-[0.25em] text-gray-500 mb-2">{label}</p>
      <div className="flex flex-wrap gap-2 justify-center">
        {colors.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className={`h-9 w-9 rounded-full border-2 transition-transform hover:scale-110 ${
              value === c ? 'border-[#d4af37] ring-2 ring-[#d4af37]/40 scale-110' : 'border-black/15'
            }`}
            style={{ backgroundColor: c }}
            aria-label={`${label} ${c}`}
          />
        ))}
      </div>
    </div>
  );
}

export function VisitorOnboarding() {
  const completeVisitorOnboarding = useStore((s) => s.completeVisitorOnboarding);
  const skipToMainExpo = useStore((s) => s.skipToMainExpo);
  const [entryMode, setEntryMode] = useState<EntryMode>('new');
  const [step, setStep] = useState<Step>('login');
  const [visitorId, setVisitorId] = useState('');
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState<VisitorAvatar>({ ...DEFAULT_AVATAR });
  const [idError, setIdError] = useState<string | null>(null);

  const normalizedId = normalizeVisitorId(visitorId);
  const trimmedName = name.trim();
  const canContinueLogin = isValidVisitorId(normalizedId) && trimmedName.length >= 2;

  const applyGeneratedId = () => {
    const id = generateVisitorId();
    setVisitorId(id);
    setIdError(null);
  };

  const continueFromLogin = () => {
    if (!canContinueLogin) {
      setIdError(
        !isValidVisitorId(normalizedId)
          ? 'Enter a valid Visitor ID (4–24 letters/numbers, e.g. VX-ABC12).'
          : 'Please enter your display name (2+ characters).',
      );
      return;
    }
    const existing = readVisitorProfile();
    if (existing?.id === normalizedId) {
      setAvatar(existing.avatar);
      if (!name.trim()) setName(existing.displayName);
    }
    setIdError(null);
    setStep('avatar');
  };

  const finish = () => {
    if (!canContinueLogin) return;
    completeVisitorOnboarding({
      id: normalizedId,
      displayName: trimmedName,
      avatar,
    });
  };

  return (
    <div className="absolute inset-0 z-[70] flex items-center justify-center bg-[#1a1520]/88 backdrop-blur-md pointer-events-auto px-4">
      <div
        className="w-full max-w-md rounded-2xl border-2 border-[#d4af37]/50 p-6 md:p-8 shadow-2xl"
        style={{
          background: 'linear-gradient(165deg, #faf8f4 0%, #f5efe4 100%)',
        }}
      >
        <p className="text-center text-[10px] uppercase tracking-[0.35em] text-[#8a7a5a] mb-1">
          Visitor login
        </p>
        <h1 className="text-center text-xl md:text-2xl font-bold tracking-widest text-[#1a1520] mb-1">
          Virtual Luxury Expo
        </h1>
        <div className="flex gap-1 mb-5 rounded-lg border border-[#e8dcc8] bg-white/70 p-1">
          <button
            type="button"
            onClick={() => setEntryMode('new')}
            className={`flex-1 rounded-md py-2 text-[10px] font-bold uppercase tracking-wider ${
              entryMode === 'new'
                ? 'bg-[#1a1520] text-[#d4af37]'
                : 'text-[#8a7a5a] hover:bg-white'
            }`}
          >
            New visitor
          </button>
          <button
            type="button"
            onClick={() => setEntryMode('returning')}
            className={`flex-1 rounded-md py-2 text-[10px] font-bold uppercase tracking-wider ${
              entryMode === 'returning'
                ? 'bg-[#1a1520] text-[#d4af37]'
                : 'text-[#8a7a5a] hover:bg-white'
            }`}
          >
            Login back
          </button>
        </div>

        <p className="text-center text-xs text-[#8a7a5a] mb-6 tracking-wide">
          {entryMode === 'returning'
            ? 'Enter your saved Visitor ID'
            : step === 'login'
              ? 'Create your Visitor ID and name'
              : 'Step 2 — Choose your look (optional)'}
        </p>

        {entryMode === 'returning' ? (
          <VisitorLoginBackForm variant="onboarding" />
        ) : step === 'login' ? (
          <>
            <label className="block text-[10px] uppercase tracking-[0.2em] text-[#8a7a5a] mb-2">
              Visitor ID <span className="text-[#d4af37]">*</span>
            </label>
            <input
              type="text"
              value={visitorId}
              onChange={(e) => {
                setVisitorId(e.target.value);
                setIdError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') continueFromLogin();
              }}
              placeholder="e.g. VX-ABC12"
              maxLength={24}
              autoFocus
              className="w-full rounded-lg border border-[#e8dcc8] bg-white px-4 py-3 text-[#1a1520] font-mono text-sm placeholder:text-[#c4b89a] focus:border-[#d4af37] focus:outline-none focus:ring-1 focus:ring-[#d4af37]/40 mb-2"
            />
            <button
              type="button"
              onClick={applyGeneratedId}
              className="text-[10px] font-semibold uppercase tracking-wider text-[#b8952e] hover:text-[#d4af37] mb-4"
            >
              Generate new visitor ID →
            </button>

            <label className="block text-[10px] uppercase tracking-[0.2em] text-[#8a7a5a] mb-2">
              Your name <span className="text-[#d4af37]">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') continueFromLogin();
              }}
              placeholder="e.g. Alex Morgan"
              maxLength={32}
              className="w-full rounded-lg border border-[#e8dcc8] bg-white px-4 py-3 text-[#1a1520] placeholder:text-[#c4b89a] focus:border-[#d4af37] focus:outline-none focus:ring-1 focus:ring-[#d4af37]/40 mb-2"
            />

            {idError ? <p className="text-[11px] text-red-700 mb-3">{idError}</p> : null}

            <button
              type="button"
              disabled={!canContinueLogin}
              onClick={continueFromLogin}
              className="w-full py-3 rounded-lg bg-[#1a1520] text-[#d4af37] text-xs font-bold uppercase tracking-wider hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed shadow-lg transition-colors mt-2"
            >
              Continue
            </button>
            <button
              type="button"
              onClick={skipToMainExpo}
              className="w-full mt-3 py-2.5 rounded-lg border border-[#e8dcc8] text-[#8a7a5a] text-xs font-semibold uppercase tracking-wider hover:bg-white/80 transition-colors"
            >
              Quick guest — skip login
            </button>
          </>
        ) : (
          <>
            <AvatarPreview avatar={avatar} />
            <p className="text-center text-sm text-[#5c4a1a] mb-4">
              <span className="font-semibold">{trimmedName}</span>
              <span className="block font-mono text-xs text-[#b8952e] mt-1">{normalizedId}</span>
            </p>
            <SwatchRow
              label="Outfit"
              colors={OUTFIT_SWATCHES}
              value={avatar.outfitColor}
              onChange={(outfitColor) => setAvatar((a) => ({ ...a, outfitColor }))}
            />
            <SwatchRow
              label="Skin tone"
              colors={SKIN_SWATCHES}
              value={avatar.skinTone}
              onChange={(skinTone) => setAvatar((a) => ({ ...a, skinTone }))}
            />
            <SwatchRow
              label="Hair"
              colors={HAIR_SWATCHES}
              value={avatar.hairColor}
              onChange={(hairColor) => setAvatar((a) => ({ ...a, hairColor }))}
            />
            <div className="flex gap-3 mt-2">
              <button
                type="button"
                onClick={() => setStep('login')}
                className="flex-1 py-3 rounded-lg border border-[#e8dcc8] text-[#5c4a1a] text-xs font-semibold uppercase tracking-wider hover:bg-white/80"
              >
                Back
              </button>
              <button
                type="button"
                onClick={finish}
                className="flex-1 py-3 rounded-lg bg-[#d4af37] text-[#1a1520] text-xs font-bold uppercase tracking-wider hover:bg-[#c4a030] shadow-lg"
              >
                Enter expo
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
