import { useState } from 'react';
import { useStore } from '@/store';

export function AdminLoginModal() {
  const open = useStore((s) => s.adminLoginOpen);
  const setOpen = useStore((s) => s.setAdminLoginOpen);
  const loginAdmin = useStore((s) => s.loginAdmin);

  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const submit = () => {
    const ok = loginAdmin(key);
    if (!ok) {
      setError('Invalid admin key. Check VITE_EXPO_ADMIN_KEY in .env.');
      return;
    }
    setKey('');
    setError(null);
    setOpen(false);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 backdrop-blur-sm pointer-events-auto px-4">
      <div
        className="w-full max-w-sm rounded-2xl border-2 border-violet-500/50 p-6 shadow-2xl"
        style={{ background: 'linear-gradient(165deg, #1a1528 0%, #0f0f18 100%)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[10px] uppercase tracking-[0.35em] text-violet-300/80 mb-1">Expo admin</p>
        <h2 className="text-lg font-bold text-white mb-1">Admin login</h2>
        <p className="text-xs text-white/55 mb-4 leading-relaxed">
          Global environment, CMS, booths, and layout edits require admin access. Visitors cannot change
          the shared expo.
        </p>
        <label className="block text-[10px] uppercase tracking-wider text-white/45 mb-2">Admin key</label>
        <input
          type="password"
          value={key}
          onChange={(e) => {
            setKey(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
          placeholder="Enter admin key"
          autoFocus
          className="w-full rounded-lg border border-white/15 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-white/35 focus:border-violet-400/60 focus:outline-none focus:ring-1 focus:ring-violet-400/40 mb-2"
        />
        {error ? <p className="text-[11px] text-red-400 mb-3">{error}</p> : null}
        <div className="flex gap-2 mt-3">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setError(null);
            }}
            className="flex-1 py-2.5 rounded-lg border border-white/15 text-white/70 text-xs font-semibold uppercase tracking-wider hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            className="flex-1 py-2.5 rounded-lg bg-violet-600 text-white text-xs font-bold uppercase tracking-wider hover:bg-violet-500"
          >
            Sign in
          </button>
        </div>
      </div>
    </div>
  );
}
