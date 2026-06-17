import { readAdminSession } from './adminSession';
import { isVisitorAssignedAdmin } from './adminVisitors';
import { useStore } from '@/store';

export function AdminBadge() {
  const isAdmin = useStore((s) => s.isAdmin);
  const visitorProfile = useStore((s) => s.visitorProfile);
  const logoutAdmin = useStore((s) => s.logoutAdmin);
  const showInstructions = useStore((s) => s.showInstructions);
  const cmsPage = useStore((s) => s.cmsPage);

  if (!isAdmin || showInstructions || cmsPage !== 'expo') return null;

  const assignedAdmin = isVisitorAssignedAdmin(visitorProfile);
  const keyAdmin = readAdminSession();

  return (
    <div
      data-expo-ui
      className="fixed top-3 left-1/2 -translate-x-1/2 z-[57] pointer-events-auto flex items-center gap-2 rounded-full border border-violet-400/45 bg-violet-950/90 px-3 py-1.5 shadow-lg backdrop-blur-md"
    >
      <span className="h-2 w-2 rounded-full bg-violet-400 animate-pulse" />
      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-100">
        {assignedAdmin ? `Admin · ${visitorProfile?.id ?? ''}` : 'Admin mode'}
      </span>
      {keyAdmin && !assignedAdmin ? (
        <button
          type="button"
          onClick={() => logoutAdmin()}
          className="text-[9px] font-semibold uppercase tracking-wider text-violet-200/80 hover:text-white ml-1"
        >
          Sign out
        </button>
      ) : null}
    </div>
  );
}
