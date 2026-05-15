import { Canvas } from '@react-three/fiber';
import { KeyboardControls } from '@react-three/drei';
import { Player } from './components/Player';
import { ExpoHall } from './components/ExpoHall';
import { Booths } from './components/Booths';
import { RoamingExecutive } from './components/RoamingExecutive';
import { Ballroom } from './components/Ballroom';
import { Lighting } from './components/Lighting';
import { Effects } from './components/Effects';
import { useStore } from './store';
import { CmsDashboard } from './cms/CmsDashboard';
import { CtaResourcePopupView } from './components/CtaResourcePopup';
import { AiChatbox } from './components/AiChatbox';
import { VertexEliteScreenHud } from './components/VertexEliteScreenHud';
import { PageIndexPortal } from './PageIndexPortal';
import { Suspense, useState, useEffect, useMemo } from 'react';
import { mergeSceneConfig } from './data/boothLayouts';
import { HallLayoutGizmos } from './components/HallLayoutGizmos';
import { HallLayoutEditHud } from './components/HallLayoutEditHud';
import { RegistrationHall } from './components/RegistrationHall';
import { RegistrationLobbyHud } from './components/RegistrationLobbyHud';
import { FastTravelHud } from './components/FastTravelHud';

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

export default function App() {
  const activeBooth = useStore((s) => s.activeBooth);
  const setActiveBooth = useStore((s) => s.setActiveBooth);
  const ctaResourcePopup = useStore((s) => s.ctaResourcePopup);
  const setCtaResourcePopup = useStore((s) => s.setCtaResourcePopup);
  const setAiChatOpen = useStore((s) => s.setAiChatOpen);
  const showInstructions = useStore((s) => s.showInstructions);
  const setShowInstructions = useStore((s) => s.setShowInstructions);
  const cmsPage = useStore((s) => s.cmsPage);
  const setCmsPage = useStore((s) => s.setCmsPage);
  const sceneOverrides = useStore((s) => s.sceneOverrides);
  const sceneConfig = useMemo(() => mergeSceneConfig(sceneOverrides), [sceneOverrides]);
  const postProcessing = sceneConfig.postProcessing;
  const showBallroom = sceneConfig.showBallroom;
  const showRoamingExecutive = sceneConfig.showRoamingExecutive;
  const showVideos = sceneConfig.showVideos;
  const setHallLayoutEditMode = useStore((s) => s.setHallLayoutEditMode);
  const setHallLayoutSelection = useStore((s) => s.setHallLayoutSelection);
  const hallLayoutEditMode = useStore((s) => s.hallLayoutEditMode);
  const expoPhase = useStore((s) => s.expoPhase);
  const registrationUi = useStore((s) => s.registrationUi);
  const openRegistrationPopup = useStore((s) => s.openRegistrationPopup);
  const [isTouch, setIsTouch] = useState(false);

  const inRegistration = expoPhase === 'registration';
  const sceneBg = inRegistration ? '#0f0f12' : '#fdfbf2';
  const sceneFogNear = inRegistration ? 25 : 25;
  const sceneFogFar = inRegistration ? 100 : 120;

  const glConfig = useMemo(
    () => ({ antialias: postProcessing, alpha: false, stencil: false, depth: true, powerPreference: 'high-performance' as const }),
    [postProcessing],
  );

  useEffect(() => {
    setIsTouch('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  useEffect(() => {
    const normalized = window.location.pathname.replace(/\/$/, '') || '/';
    if (normalized === '/cms') {
      setCmsPage('cms');
      window.history.replaceState(null, '', '/cms');
    } else if (normalized === '/pageindex') {
      setCmsPage('pageindex');
      window.history.replaceState(null, '', '/pageindex');
    }
  }, [setCmsPage]);

  useEffect(() => {
    if (cmsPage === 'cms') {
      if (document.pointerLockElement) document.exitPointerLock();
      window.history.replaceState(null, '', '/cms');
    } else if (cmsPage === 'pageindex') {
      if (document.pointerLockElement) document.exitPointerLock();
      window.history.replaceState(null, '', '/pageindex');
    } else {
      window.history.replaceState(null, '', '/');
    }
  }, [cmsPage]);

  useEffect(() => {
    if (ctaResourcePopup && document.pointerLockElement) document.exitPointerLock();
  }, [ctaResourcePopup]);

  if (cmsPage === 'cms') return <CmsDashboard />;
  if (cmsPage === 'pageindex') return <PageIndexPortal />;

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
          shadows
          camera={{ fov: 65, near: 0.1, far: 220 }}
          dpr={[1, 1]}
          gl={glConfig}
        >
          <color attach="background" args={[sceneBg]} />
          <fog attach="fog" args={[sceneBg, sceneFogNear, sceneFogFar]} />
          <Suspense fallback={null}>
            <Lighting />
            {inRegistration ? (
              <RegistrationHall />
            ) : (
              <>
                <ExpoHall showVideos={showVideos} />
                <Booths showVideos={showVideos} />
                {showRoamingExecutive && <RoamingExecutive />}
                {showBallroom && <Ballroom showVideos={showVideos} />}
              </>
            )}
            <HallLayoutGizmos />
            <Player />
            {postProcessing && <Effects />}
          </Suspense>
        </Canvas>
      </KeyboardControls>

      {inRegistration && registrationUi === 'none' && !showInstructions && !hallLayoutEditMode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[45] pointer-events-none text-center px-4">
          <p className="text-[10px] md:text-xs uppercase tracking-[0.35em] text-[#d4af37] mb-1">Event registration</p>
          <p className="text-sm md:text-base font-semibold text-[#e8e4dc] tracking-wide">
            Join the queue · Click the counter to check in
          </p>
        </div>
      )}

      <RegistrationLobbyHud />

      <FastTravelHud />

      {!inRegistration && <VertexEliteScreenHud />}

      <HallLayoutEditHud />

      {inRegistration && !showInstructions && registrationUi === 'none' && (
        <button
          type="button"
          className="fixed bottom-3 left-1/2 -translate-x-1/2 z-[55] rounded-lg border border-[#d4af37]/40 bg-[#1a1a22]/90 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-[#d4af37] shadow-xl backdrop-blur-md pointer-events-auto hover:bg-black transition-all"
          onClick={() => openRegistrationPopup()}
        >
          Register Now
        </button>
      )}

      {/* Move hall props / booths in-world; saves to localStorage (scene + booth overrides). */}
      <button
        type="button"
        className="fixed bottom-3 left-36 z-[55] rounded-lg border border-cyan-500/25 bg-cyan-950/75 px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-cyan-100 shadow-xl backdrop-blur-md pointer-events-auto hover:bg-cyan-900/90 transition-all"
        onClick={() => {
          setHallLayoutSelection(inRegistration ? 'reg-reception-root' : 'hall-entrance-lobby');
          setHallLayoutEditMode(true);
        }}
      >
        Edit layout
      </button>

      {/* PageIndex PDF tool (separate page) */}
      <button
        type="button"
        className="fixed bottom-3 left-3 z-[55] rounded-lg border border-emerald-500/25 bg-emerald-950/80 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-emerald-200 shadow-xl backdrop-blur-md pointer-events-auto hover:bg-emerald-900/90 transition-all"
        onClick={() => setCmsPage('pageindex')}
      >
        PageIndex
      </button>

      {/* CMS launch button */}
      <button
        type="button"
        className="fixed bottom-3 right-3 z-[55] rounded-lg border border-white/15 bg-[#1a1a22]/90 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#d4af37] shadow-xl backdrop-blur-md pointer-events-auto hover:bg-[#1a1a22] transition-all"
        onClick={() => setCmsPage('cms')}
      >
        Open CMS
      </button>

      {/* Ask AI button */}
      <button
        type="button"
        className="fixed bottom-3 right-32 z-[55] rounded-lg border border-[#d4af37]/20 bg-[#d4af37]/10 backdrop-blur-md px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#d4af37] shadow-xl pointer-events-auto hover:bg-[#d4af37]/20 transition-all flex items-center gap-2"
        onClick={() => setAiChatOpen(true)}
      >
        <span>🤖</span>
        Ask AI
      </button>

      {/* AI Chatbox */}
      <AiChatbox />

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
            <h2 className="text-lg md:text-2xl font-light text-black tracking-[0.2em] mb-4 md:mb-6">LUXURY RESIDENCES</h2>
            {inRegistration && (
              <p className="text-sm text-gray-600 tracking-wide mb-8 md:mb-10 max-w-md mx-auto">
                You will arrive in the registration lobby first, then enter the main exhibition hall.
              </p>
            )}
            {!inRegistration && <div className="mb-8 md:mb-12" />}
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
