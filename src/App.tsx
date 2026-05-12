import { Canvas } from '@react-three/fiber';
import { KeyboardControls } from '@react-three/drei';
import { Player } from './components/Player';
import { ExpoHall } from './components/ExpoHall';
import { Booths } from './components/Booths';
import { RoamingExecutive } from './components/RoamingExecutive';
import { Ballroom } from './components/Ballroom';
import { Lighting } from './components/Lighting';
import { Effects } from './components/Effects';
import { useStore, type CtaResourcePopup } from './store';
import { CmsDashboard } from './cms/CmsDashboard';
import { Suspense, useState, useEffect, lazy } from 'react';

function Joystick() {
  const setJoystickData = useStore((state) => state.setJoystickData);
  const [active, setActive] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  const handleStart = (e: any) => {
    setActive(true);
    handleMove(e);
  };

  const handleMove = (e: any) => {
    if (!active) return;
    const touch = e.touches ? e.touches[0] : e;
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    let dx = touch.clientX - centerX;
    let dy = touch.clientY - centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxDist = 40;
    if (dist > maxDist) { dx *= maxDist / dist; dy *= maxDist / dist; }
    setPos({ x: dx, y: dy });
    setJoystickData({ x: dx / maxDist, y: -dy / maxDist });
  };

  const handleEnd = () => {
    setActive(false);
    setPos({ x: 0, y: 0 });
    setJoystickData({ x: 0, y: 0 });
  };

  return (
    <div
      className="fixed bottom-12 left-12 w-32 h-32 bg-black/10 rounded-full border border-white/20 backdrop-blur-md z-50 touch-none flex items-center justify-center"
      onTouchStart={handleStart} onTouchMove={handleMove} onTouchEnd={handleEnd}
      onMouseDown={handleStart} onMouseMove={handleMove} onMouseUp={handleEnd} onMouseLeave={handleEnd}
    >
      <div className="w-12 h-12 bg-[#d4af37] rounded-full shadow-lg transition-transform duration-75" style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }} />
    </div>
  );
}

function CtaResourcePopupView({ popup, onClose }: { popup: CtaResourcePopup; onClose: () => void }) {
  const variant = popup.variant ?? 'document';
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [popup.url, popup.title]);

  const openTab = () => {
    window.open(popup.url, '_blank', 'noopener,noreferrer');
  };

  const isImage = variant === 'image';

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm pointer-events-auto"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cta-popup-title"
        className={`w-full rounded-xl border border-[#d4af37]/40 bg-[#0a0a10]/95 p-6 text-[#fffef8] shadow-2xl ${isImage ? 'max-w-4xl' : 'max-w-lg'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3 border-b border-white/10 pb-4">
          <h2 id="cta-popup-title" className="text-lg font-bold uppercase tracking-[0.18em] text-[#d4af37]">
            {popup.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {isImage && !imageError ? (
          <>
            <p className="mb-3 text-sm text-white/70">
              Site map preview on screen. Scroll if the image is larger than the panel. Use &quot;Open in new tab&quot; for the full-size file or if the image does not load.
            </p>
            <div className="mb-6 max-h-[min(72vh,780px)] overflow-auto rounded-lg border border-white/10 bg-black/40 p-2">
              <img
                src={popup.url}
                alt={popup.title}
                className="mx-auto block max-h-[min(68vh,720px)] w-auto max-w-full object-contain select-none"
                draggable={false}
                decoding="async"
                referrerPolicy="no-referrer"
                onError={() => setImageError(true)}
              />
            </div>
          </>
        ) : isImage && imageError ? (
          <>
            <p className="mb-4 text-sm text-amber-200/90">
              This URL could not be shown as an image (wrong format, blocked hotlink, or unavailable). Use &quot;Open in new tab&quot;, or set Site Map URL in CMS to a PNG, JPG, WebP, SVG, or a data URL.
            </p>
            <p className="mb-6 break-all rounded-lg bg-black/40 px-3 py-2 font-mono text-xs text-[#f5d060]">
              {popup.url}
            </p>
          </>
        ) : (
          <>
            <p className="mb-4 text-sm text-white/70">
              Preview opens in a new tab, or use the button below. Close this panel to keep exploring the hall.
            </p>
            <p className="mb-6 break-all rounded-lg bg-black/40 px-3 py-2 font-mono text-xs text-[#f5d060]">
              {popup.url}
            </p>
          </>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="min-h-[44px] flex-1 rounded-lg bg-[#d4af37] px-4 py-3 text-xs font-bold uppercase tracking-wider text-black transition-colors hover:bg-[#c9a43a]"
            onClick={openTab}
          >
            Open in new tab
          </button>
          <button
            type="button"
            className="min-h-[44px] flex-1 rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-white/90 transition-colors hover:bg-white/10"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const activeBooth = useStore((s) => s.activeBooth);
  const setActiveBooth = useStore((s) => s.setActiveBooth);
  const ctaResourcePopup = useStore((s) => s.ctaResourcePopup);
  const setCtaResourcePopup = useStore((s) => s.setCtaResourcePopup);
  const showInstructions = useStore((s) => s.showInstructions);
  const setShowInstructions = useStore((s) => s.setShowInstructions);
  const cmsPage = useStore((s) => s.cmsPage);
  const setCmsPage = useStore((s) => s.setCmsPage);
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    setIsTouch('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  useEffect(() => {
    const normalized = window.location.pathname.replace(/\/$/, '') || '/';
    if (normalized === '/cms') {
      setCmsPage('cms');
      window.history.replaceState(null, '', '/cms');
    }
  }, [setCmsPage]);

  useEffect(() => {
    if (cmsPage === 'cms') {
      if (document.pointerLockElement) document.exitPointerLock();
      window.history.replaceState(null, '', '/cms');
    } else {
      window.history.replaceState(null, '', '/');
    }
  }, [cmsPage]);

  useEffect(() => {
    if (ctaResourcePopup && document.pointerLockElement) document.exitPointerLock();
  }, [ctaResourcePopup]);

  if (cmsPage === 'cms') return <CmsDashboard />;

  return (
    <div
      className="w-full h-screen bg-black overflow-hidden select-none font-sans"
      onClick={() => { if (showInstructions) setShowInstructions(false); }}
    >
      <KeyboardControls
        map={[
          { name: 'forward', keys: ['ArrowUp', 'KeyW'] },
          { name: 'backward', keys: ['ArrowDown', 'KeyS'] },
          { name: 'left', keys: ['ArrowLeft', 'KeyA'] },
          { name: 'right', keys: ['ArrowRight', 'KeyD'] },
        ]}
      >
        <Canvas
          shadows="soft"
          camera={{ fov: 65, near: 0.1, far: 220 }}
          dpr={[1, 1.25]}
          gl={{ antialias: true, alpha: false, stencil: false, depth: true, powerPreference: 'high-performance' }}
        >
          <color attach="background" args={['#fdfbf2']} />
          <fog attach="fog" args={['#fdfbf2', 25, 120]} />
          <Suspense fallback={null}>
            <Lighting />
            <ExpoHall />
            <Booths />
            <RoamingExecutive />
            <Ballroom />
            <Player />
            <Effects />
          </Suspense>
        </Canvas>
      </KeyboardControls>

      {/* CMS launch button */}
      <button
        type="button"
        className="fixed bottom-3 right-3 z-[55] rounded-lg border border-white/15 bg-[#1a1a22]/90 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#d4af37] shadow-xl backdrop-blur-md pointer-events-auto hover:bg-[#1a1a22] transition-all"
        onClick={() => setCmsPage('cms')}
      >
        Open CMS
      </button>

      {isTouch && !showInstructions && !ctaResourcePopup && <Joystick />}

      {ctaResourcePopup && (
        <CtaResourcePopupView popup={ctaResourcePopup} onClose={() => setCtaResourcePopup(null)} />
      )}

      {activeBooth && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-96 bg-white/90 border border-[#d4af37]/50 p-6 rounded-xl text-black shadow-2xl backdrop-blur-md z-50 pointer-events-auto">
          <div className="flex justify-between items-center mb-4 border-b border-black/10 pb-4">
            <h2 className="text-xl font-bold tracking-widest text-[#d4af37]">{activeBooth}</h2>
            <button onClick={() => setActiveBooth(null)} className="text-black/50 hover:text-black transition-colors p-1">✕</button>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed mb-6">
            Welcome to the luxury showcase of {activeBooth}. Explore our latest visionary developments redefining the skyline.
          </p>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Starting Price</span>
              <span className="font-semibold text-black">₹ 15.5 Cr*</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Configuration</span>
              <span className="font-semibold text-black">4, 5 & 6 BHK</span>
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button
              onClick={() => {
                if (useStore.getState().activeBoothPosition) {
                  useStore.getState().setPlayerPosition(useStore.getState().activeBoothPosition);
                  setActiveBooth(null);
                }
              }}
              className="flex-1 bg-black/5 hover:bg-black/10 text-black font-semibold py-3 rounded tracking-wide transition-colors border border-black/10 text-xs"
            >
              MOVE HERE
            </button>
            <button className="flex-1 bg-[#d4af37] hover:bg-[#b08d29] text-black font-semibold py-3 rounded tracking-wide transition-colors text-xs">
              BROCHURE
            </button>
          </div>
        </div>
      )}

      {showInstructions && (
        <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-40 backdrop-blur-sm pointer-events-auto">
          <div className="text-center px-4">
            <h1 className="text-3xl md:text-5xl font-bold tracking-widest text-[#d4af37] mb-4">VIRTUAL EXPO</h1>
            <h2 className="text-lg md:text-2xl font-light text-black tracking-[0.2em] mb-8 md:mb-12">LUXURY RESIDENCES</h2>
            <div className="bg-black/5 border border-black/10 p-6 md:p-8 rounded-2xl backdrop-blur-md inline-block">
              <p className="text-black text-base md:text-lg mb-6">{isTouch ? "Tap to enter" : "Click anywhere to enter"}</p>
              <div className="flex items-center justify-center gap-4 md:gap-8 text-gray-700">
                <div className="flex flex-col items-center">
                  <div className="p-2 md:p-3 border border-black/20 rounded-lg mb-2 text-black font-semibold text-xs md:text-sm">{isTouch ? "JOYSTICK" : "WASD"}</div>
                  <span className="text-[10px] md:text-xs uppercase tracking-widest">Move</span>
                </div>
                <div className="flex flex-col items-center">
                  <div className="p-2 md:p-3 border border-black/20 rounded-lg mb-2 text-black font-semibold text-xs md:text-sm">{isTouch ? "DRAG" : "MOUSE"}</div>
                  <span className="text-[10px] md:text-xs uppercase tracking-widest">Look</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!isTouch && <div className="absolute top-1/2 left-1/2 w-1.5 h-1.5 bg-black/50 rounded-full transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-30" />}
    </div>
  );
}
