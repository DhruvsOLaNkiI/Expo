import { useEffect, useRef, useState } from 'react';

type Health = 'good' | 'ok' | 'low';

function healthFor(fps: number): Health {
  if (fps >= 50) return 'good';
  if (fps >= 30) return 'ok';
  return 'low';
}

const STYLES: Record<Health, { ring: string; text: string; glow: string; label: string }> = {
  good: {
    ring: 'border-emerald-400/60',
    text: 'text-emerald-300',
    glow: 'shadow-[0_0_24px_rgba(52,211,153,0.35)]',
    label: 'Smooth',
  },
  ok: {
    ring: 'border-amber-400/60',
    text: 'text-amber-300',
    glow: 'shadow-[0_0_24px_rgba(251,191,36,0.32)]',
    label: 'Fair',
  },
  low: {
    ring: 'border-red-400/60',
    text: 'text-red-300',
    glow: 'shadow-[0_0_24px_rgba(248,113,113,0.32)]',
    label: 'Laggy',
  },
};

/**
 * Big, legible on-screen FPS meter. Measures real browser frame rate via rAF and
 * refreshes the readout a few times a second so the number stays easy to read.
 */
export function FpsMeter() {
  const [fps, setFps] = useState(0);

  const frames = useRef(0);
  const lastSample = useRef(performance.now());
  const rafId = useRef(0);

  useEffect(() => {
    const loop = () => {
      frames.current += 1;
      const now = performance.now();
      const elapsed = now - lastSample.current;
      // Update ~3×/second — frequent enough to feel live, slow enough to read.
      if (elapsed >= 333) {
        setFps(Math.round((frames.current * 1000) / elapsed));
        frames.current = 0;
        lastSample.current = now;
      }
      rafId.current = requestAnimationFrame(loop);
    };
    rafId.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId.current);
  }, []);

  const health = healthFor(fps);
  const s = STYLES[health];

  return (
    <div
      className={`pointer-events-none fixed right-4 top-20 z-[60] flex items-center gap-3 rounded-2xl border ${s.ring} ${s.glow} bg-[#0d0d12]/90 px-5 py-3 backdrop-blur-md select-none`}
    >
      <div className="flex flex-col items-end leading-none">
        <span className={`font-mono text-5xl font-black tabular-nums ${s.text}`}>
          {fps}
        </span>
        <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.35em] text-white/45">
          FPS
        </span>
      </div>
      <div className="flex flex-col items-center gap-1">
        <span
          className={`h-3 w-3 rounded-full ${
            health === 'good'
              ? 'bg-emerald-400'
              : health === 'ok'
                ? 'bg-amber-400'
                : 'bg-red-400'
          } animate-pulse`}
        />
        <span className={`text-[10px] font-bold uppercase tracking-wider ${s.text}`}>
          {s.label}
        </span>
      </div>
    </div>
  );
}
