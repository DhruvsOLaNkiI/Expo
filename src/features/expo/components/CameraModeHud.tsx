import { CAMERA_MODES, CAMERA_MODE_ORDER, type CameraMode } from '@/features/expo/camera/cameraModes';
import { useStore } from '@/store';

export function CameraModeHud() {
  const cameraMode = useStore((s) => s.cameraMode);
  const setCameraMode = useStore((s) => s.setCameraMode);
  const showInstructions = useStore((s) => s.showInstructions);
  const registrationUi = useStore((s) => s.registrationUi);
  const ctaResourcePopup = useStore((s) => s.ctaResourcePopup);
  const activeBooth = useStore((s) => s.activeBooth);
  const hallLayoutEditMode = useStore((s) => s.hallLayoutEditMode);
  const visitorProfile = useStore((s) => s.visitorProfile);
  const aiChatOpen = useStore((s) => s.aiChatOpen);
  const helpDeskOpen = useStore((s) => s.helpDeskOpen);

  if (
    !visitorProfile ||
    showInstructions ||
    registrationUi !== 'none' ||
    ctaResourcePopup ||
    activeBooth ||
    hallLayoutEditMode ||
    aiChatOpen ||
    helpDeskOpen
  ) {
    return null;
  }

  const preset = CAMERA_MODES[cameraMode];
  const showBodyHint = !preset.showAvatar;

  return (
    <div className="fixed bottom-16 right-3 z-[54] pointer-events-auto flex flex-col items-end gap-1.5">
      <p className="text-[9px] uppercase tracking-[0.28em] text-white/50 pointer-events-none text-right max-w-[220px]">
        Camera · press <span className="text-[#d4af37]">V</span>
        {showBodyHint ? (
          <span className="block mt-0.5 text-[#d4af37]/80 normal-case tracking-normal">
            Tap <strong>Body</strong> or <strong>Wide</strong> to see your character
          </span>
        ) : (
          <span className="block mt-0.5 text-emerald-400/90 normal-case tracking-normal">
            {preset.label} — character visible
          </span>
        )}
      </p>
      <div className="flex rounded-xl border border-[#d4af37]/30 bg-[#1a1a22]/92 p-1 shadow-xl backdrop-blur-md">
        {CAMERA_MODE_ORDER.map((mode) => (
          <CameraModeButton
            key={mode}
            mode={mode}
            active={cameraMode === mode}
            onSelect={() => setCameraMode(mode)}
          />
        ))}
      </div>
    </div>
  );
}

function CameraModeButton({
  mode,
  active,
  onSelect,
}: {
  mode: CameraMode;
  active: boolean;
  onSelect: () => void;
}) {
  const preset = CAMERA_MODES[mode];
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${
        active
          ? 'bg-[#d4af37] text-black shadow-md'
          : 'text-[#d4af37]/80 hover:bg-white/5 hover:text-[#d4af37]'
      }`}
      title={preset.label}
    >
      {preset.shortLabel}
    </button>
  );
}
