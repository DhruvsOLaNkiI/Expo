import { useState } from 'react';
import { useStore } from '../store';
import {
  DEFAULT_AVATAR,
  generateVisitorId,
  HAIR_SWATCHES,
  OUTFIT_SWATCHES,
  SKIN_SWATCHES,
  type VisitorAvatar,
} from '../visitorProfile';

type Step = 'name' | 'avatar';

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
  const [step, setStep] = useState<Step>('name');
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState<VisitorAvatar>({ ...DEFAULT_AVATAR });
  const [previewId] = useState(() => generateVisitorId());

  const trimmed = name.trim();
  const canContinueName = trimmed.length >= 2;

  const finish = () => {
    if (!canContinueName) return;
    completeVisitorOnboarding({
      id: previewId,
      displayName: trimmed,
      avatar,
    });
  };

  return (
    <div className="absolute inset-0 z-[70] flex items-center justify-center bg-[#0f0f12]/95 backdrop-blur-md pointer-events-auto px-4">
      <div className="w-full max-w-md rounded-2xl border border-[#d4af37]/35 bg-white/95 p-6 md:p-8 shadow-2xl">
        <p className="text-center text-[10px] uppercase tracking-[0.35em] text-[#d4af37] mb-1">Welcome</p>
        <h1 className="text-center text-xl md:text-2xl font-bold tracking-widest text-black mb-1">
          Virtual Luxury Expo
        </h1>
        <p className="text-center text-xs text-gray-500 mb-6 tracking-wide">
          {step === 'name' ? 'Step 1 of 2 — Your name' : 'Step 2 of 2 — Your look'}
        </p>

        {step === 'name' ? (
          <>
            <label className="block text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-2">
              Display name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canContinueName) setStep('avatar');
              }}
              placeholder="e.g. Alex Morgan"
              maxLength={32}
              autoFocus
              className="w-full rounded-lg border border-black/15 bg-white px-4 py-3 text-black placeholder:text-gray-400 focus:border-[#d4af37] focus:outline-none focus:ring-1 focus:ring-[#d4af37]/40 mb-2"
            />
            <p className="text-[10px] text-gray-400 mb-4">
              A temporary visitor ID will be created for this session.
            </p>
            <p className="text-center text-xs font-mono text-[#8a7a5a] mb-6 tracking-wider">
              Preview ID · <span className="text-[#d4af37]">{previewId}</span>
            </p>
            <button
              type="button"
              disabled={!canContinueName}
              onClick={() => setStep('avatar')}
              className="w-full py-3 rounded-lg bg-[#d4af37] text-black text-xs font-bold uppercase tracking-wider hover:bg-[#c4a030] disabled:opacity-40 disabled:cursor-not-allowed shadow-lg transition-colors"
            >
              Continue
            </button>
          </>
        ) : (
          <>
            <AvatarPreview avatar={avatar} />
            <p className="text-center text-sm text-gray-600 mb-4">
              Hi <span className="font-semibold text-black">{trimmed}</span> ·{' '}
              <span className="font-mono text-xs text-[#d4af37]">{previewId}</span>
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
                onClick={() => setStep('name')}
                className="flex-1 py-3 rounded-lg border border-black/10 text-black/70 text-xs font-semibold uppercase tracking-wider hover:bg-black/5"
              >
                Back
              </button>
              <button
                type="button"
                onClick={finish}
                className="flex-1 py-3 rounded-lg bg-black text-[#d4af37] text-xs font-bold uppercase tracking-wider hover:bg-black/90 shadow-lg"
              >
                Enter lobby
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
