import { useStore } from '@/store';

type Props = {
  onOpenAnalytics: () => void;
};

/** Scattered bottom admin controls — only rendered for admin users. */
export function ExpoAdminBottomBar({ onOpenAnalytics }: Props) {
  const isAdmin = useStore((s) => s.isAdmin);
  const showInstructions = useStore((s) => s.showInstructions);
  const needsOnboarding = !useStore((s) => s.visitorProfile);
  const inRegistration = useStore((s) => s.expoPhase) === 'registration';
  const setCmsPage = useStore((s) => s.setCmsPage);
  const setHallLayoutEditMode = useStore((s) => s.setHallLayoutEditMode);
  const setHallLayoutSelection = useStore((s) => s.setHallLayoutSelection);
  const setHelpDeskOpen = useStore((s) => s.setHelpDeskOpen);
  const setAiChatOpen = useStore((s) => s.setAiChatOpen);

  if (!isAdmin || needsOnboarding || inRegistration || showInstructions) return null;

  const btn =
    'rounded-lg px-4 py-2.5 text-xs font-bold uppercase tracking-wider shadow-xl backdrop-blur-md pointer-events-auto transition-all';

  return (
    <>
      <button
        type="button"
        className={`fixed bottom-3 left-3 z-[55] border border-emerald-500/25 bg-emerald-950/80 text-emerald-200 hover:bg-emerald-900/90 ${btn}`}
        onClick={() => setCmsPage('pageindex')}
      >
        PageIndex
      </button>
      <button
        type="button"
        className={`fixed bottom-3 left-36 z-[55] border border-cyan-500/25 bg-cyan-950/75 text-cyan-100 hover:bg-cyan-900/90 ${btn}`}
        onClick={() => {
          setHallLayoutSelection(null);
          setHallLayoutEditMode(true);
        }}
      >
        Edit layout
      </button>
      <button
        type="button"
        className={`fixed bottom-3 right-32 z-[55] border border-[#d4af37]/20 bg-[#d4af37]/10 text-[#d4af37] hover:bg-[#d4af37]/20 flex items-center gap-2 ${btn}`}
        onClick={() => setAiChatOpen(true)}
      >
        <span>🤖</span>
        Ask AI
      </button>
      <button
        type="button"
        className={`fixed bottom-3 right-[17.5rem] z-[55] border border-[#d4af37]/35 bg-[#0f1a3d]/90 text-[#f5e6c8] hover:bg-[#1a2d52] ${btn}`}
        onClick={() => setHelpDeskOpen(true)}
      >
        Help Desk
      </button>
      <button
        type="button"
        className={`fixed bottom-3 right-3 z-[55] border border-white/15 bg-[#1a1a22]/90 text-[#d4af37] hover:bg-[#1a1a22] ${btn}`}
        onClick={() => setCmsPage('cms')}
      >
        Open CMS
      </button>
      <button
        type="button"
        className={`fixed bottom-14 right-3 z-[55] border border-violet-500/30 bg-violet-950/80 text-violet-200 hover:bg-violet-900/90 ${btn}`}
        onClick={() => onOpenAnalytics()}
      >
        Analytics
      </button>
    </>
  );
}
