import { useStore } from '@/store';

type Props = {
  title: string;
  description?: string;
};

export function AdminRequiredScreen({
  title,
  description = 'This area changes the global expo environment. Sign in as admin to continue.',
}: Props) {
  const setAdminLoginOpen = useStore((s) => s.setAdminLoginOpen);
  const setCmsPage = useStore((s) => s.setCmsPage);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0f] text-white px-6">
      <p className="text-[10px] uppercase tracking-[0.35em] text-violet-300/70 mb-2">{title}</p>
      <h1 className="text-xl font-bold mb-2">Admin access required</h1>
      <p className="text-sm text-white/50 text-center max-w-md mb-6 leading-relaxed">{description}</p>
      <div className="flex flex-wrap gap-3 justify-center">
        <button
          type="button"
          onClick={() => setAdminLoginOpen(true)}
          className="rounded-lg bg-violet-600 px-5 py-2.5 text-xs font-bold uppercase tracking-wider hover:bg-violet-500"
        >
          Admin login
        </button>
        <button
          type="button"
          onClick={() => setCmsPage('expo')}
          className="rounded-lg border border-white/15 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-white/70 hover:bg-white/5"
        >
          Back to expo
        </button>
      </div>
    </div>
  );
}
