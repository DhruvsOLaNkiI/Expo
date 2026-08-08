import { useEffect, useRef, useState } from 'react';
import { useProgress } from '@react-three/drei';
import { AnimatePresence, motion } from 'motion/react';

/** Drop a real logo here (png/svg/webp) and it replaces the built-in wordmark. */
const LOGO_SRC = '/images/digital-broker-logo.png';

/** Keep the brand on screen long enough to read it, even on a warm cache. */
const MIN_VISIBLE_MS = 2400;
/** Never trap a visitor behind the curtain if a texture silently stalls. */
const MAX_VISIBLE_MS = 22000;

const GOLD = '#d4af37';

type LogoState = 'pending' | 'image' | 'wordmark';

function useCustomLogo(): LogoState {
  const [state, setState] = useState<LogoState>('pending');

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) setState('image');
    };
    img.onerror = () => {
      if (!cancelled) setState('wordmark');
    };
    img.src = LOGO_SRC;
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

/**
 * Full-screen curtain shown while the expo's GLBs and textures stream in.
 * Progress comes from three's default loading manager via drei's `useProgress`,
 * padded with a time-based creep so the bar still moves during long single-file
 * downloads that report no intermediate progress.
 */
export function ExpoLoadingScreen() {
  const progressState = useProgress();
  const latest = useRef(progressState);
  latest.current = progressState;

  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(true);
  const [shown, setShown] = useState(0);
  const logoState = useCustomLogo();

  useEffect(() => {
    const start = performance.now();
    let settledAt: number | null = null;

    const tick = window.setInterval(() => {
      const { active, progress, loaded } = latest.current;
      const elapsed = performance.now() - start;

      const assetsDone = loaded > 0 && progress >= 100 && !active;
      const nothingQueued = loaded === 0 && !active && elapsed > 5000;

      if (assetsDone || nothingQueued) settledAt ??= performance.now();
      else settledAt = null;

      const held = settledAt !== null && performance.now() - settledAt > 450;
      const finished = (held && elapsed > MIN_VISIBLE_MS) || elapsed > MAX_VISIBLE_MS;

      const creep = Math.min(88, (elapsed / 9000) * 88);
      const target = finished ? 100 : Math.min(96, Math.max(progress, creep));
      setShown((prev) => (target > prev ? target : prev));

      if (finished) {
        setReady(true);
        window.clearInterval(tick);
      }
    }, 110);

    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const t = window.setTimeout(() => setVisible(false), 620);
    return () => window.clearTimeout(t);
  }, [ready]);

  const percent = Math.round(shown);
  const stage = percent < 35 ? 'Building the hall' : percent < 75 ? 'Dressing the booths' : 'Lighting the stage';

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="expo-loading"
          className="fixed inset-0 z-[999] flex flex-col items-center justify-center overflow-hidden bg-[#07070b]"
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.04, filter: 'blur(6px)' }}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
        >
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(120% 80% at 50% 0%, rgba(212,175,55,0.16) 0%, rgba(7,7,11,0) 55%), radial-gradient(90% 70% at 50% 110%, rgba(80,120,255,0.12) 0%, rgba(7,7,11,0) 60%)',
            }}
          />
          <motion.div
            className="pointer-events-none absolute inset-0 opacity-[0.16]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(212,175,55,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(212,175,55,0.35) 1px, transparent 1px)',
              backgroundSize: '68px 68px',
              maskImage: 'radial-gradient(70% 60% at 50% 50%, #000 0%, transparent 75%)',
              WebkitMaskImage: 'radial-gradient(70% 60% at 50% 50%, #000 0%, transparent 75%)',
            }}
            animate={{ backgroundPosition: ['0px 0px', '68px 68px'] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
          />

          <div className="relative flex w-[min(560px,88vw)] flex-col items-center">
            <div className="relative mb-9 flex h-[120px] w-[120px] items-center justify-center">
              <motion.span
                className="absolute inset-0 rounded-full"
                style={{
                  background: `conic-gradient(from 0deg, transparent 0deg, ${GOLD} 90deg, transparent 200deg)`,
                  maskImage: 'radial-gradient(circle, transparent 62%, #000 64%)',
                  WebkitMaskImage: 'radial-gradient(circle, transparent 62%, #000 64%)',
                }}
                animate={{ rotate: 360 }}
                transition={{ duration: 2.6, repeat: Infinity, ease: 'linear' }}
              />
              <span className="absolute inset-0 rounded-full border border-[#d4af37]/20" />
              <motion.span
                className="absolute inset-[14%] rounded-full"
                style={{ boxShadow: `0 0 60px 12px rgba(212,175,55,0.25)` }}
                animate={{ opacity: [0.35, 0.85, 0.35], scale: [0.94, 1.04, 0.94] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              />
              <motion.span
                className="relative text-[30px] font-black tracking-[0.08em] text-[#f5e6c8]"
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
              >
                DB
              </motion.span>
            </div>

            <div className="flex min-h-[46px] items-center justify-center">
              {logoState === 'image' && (
                <motion.img
                  src={LOGO_SRC}
                  alt="Digital Broker"
                  className="h-[46px] w-auto object-contain"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, ease: 'easeOut' }}
                />
              )}
              {logoState === 'wordmark' && (
                <motion.div
                  className="relative flex items-baseline gap-[0.16em] text-[clamp(28px,6vw,46px)] font-semibold leading-none tracking-[0.02em]"
                  initial="hidden"
                  animate="shown"
                  variants={{ shown: { transition: { staggerChildren: 0.09 } } }}
                >
                  {[
                    { text: 'Digital', color: '#ffffff' },
                    { text: 'Broker', color: GOLD },
                    { text: '.in', color: 'rgba(255,255,255,0.45)' },
                  ].map((part) => (
                    <motion.span
                      key={part.text}
                      style={{ color: part.color }}
                      variants={{
                        hidden: { opacity: 0, y: 18, filter: 'blur(8px)' },
                        shown: { opacity: 1, y: 0, filter: 'blur(0px)' },
                      }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                    >
                      {part.text}
                    </motion.span>
                  ))}
                  <motion.span
                    className="pointer-events-none absolute inset-y-0 w-24 -skew-x-12"
                    style={{
                      background:
                        'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)',
                      mixBlendMode: 'overlay',
                    }}
                    animate={{ left: ['-25%', '115%'] }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut', delay: 0.9 }}
                  />
                </motion.div>
              )}
            </div>

            <motion.p
              className="mt-3 text-[10px] font-semibold uppercase tracking-[0.42em] text-white/35"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.6 }}
            >
              Virtual Residential Expo
            </motion.p>

            <div className="mt-10 w-full">
              <div className="h-[3px] w-full overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    background: `linear-gradient(90deg, rgba(212,175,55,0.35), ${GOLD}, #fff2cc)`,
                    boxShadow: `0 0 16px rgba(212,175,55,0.65)`,
                  }}
                  animate={{ width: `${shown}%` }}
                  transition={{ duration: 0.45, ease: 'easeOut' }}
                />
              </div>
              <div className="mt-3 flex items-center justify-between text-[10px] uppercase tracking-[0.28em] text-white/40">
                <motion.span
                  key={stage}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  {ready ? 'Welcome' : stage}
                </motion.span>
                <span className="font-mono text-[#d4af37]">{percent}%</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
