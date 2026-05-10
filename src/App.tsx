import { Canvas } from '@react-three/fiber';
import { KeyboardControls, Stats } from '@react-three/drei';
import { Player } from './components/Player';
import { ExpoHall } from './components/ExpoHall';
import { Booths } from './components/Booths';
import { Ballroom } from './components/Ballroom';
import { Lighting } from './components/Lighting';
import { Effects } from './components/Effects';
import { useStore } from './store';
import { Suspense, useState, useEffect } from 'react';

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
    
    if (dist > maxDist) {
      dx *= maxDist / dist;
      dy *= maxDist / dist;
    }
    
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
      onTouchStart={handleStart}
      onTouchMove={handleMove}
      onTouchEnd={handleEnd}
      onMouseDown={handleStart}
      onMouseMove={handleMove}
      onMouseUp={handleEnd}
      onMouseLeave={handleEnd}
    >
      <div 
        className="w-12 h-12 bg-[#d4af37] rounded-full shadow-lg transition-transform duration-75"
        style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
      />
    </div>
  );
}

export default function App() {
  const activeBooth = useStore((state) => state.activeBooth);
  const setActiveBooth = useStore((state) => state.setActiveBooth);
  const showInstructions = useStore((state) => state.showInstructions);
  const setShowInstructions = useStore((state) => state.setShowInstructions);
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    setIsTouch('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  return (
    <div 
      className="w-full h-screen bg-black overflow-hidden select-none font-sans"
      onClick={() => {
        if (showInstructions && isTouch) {
          setShowInstructions(false);
        }
      }}
    >
      {/* 3D Canvas */}
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
          dpr={[1, 2]}
          gl={{
            antialias: true,
            alpha: false,
            stencil: false,
            depth: true,
            powerPreference: 'high-performance',
          }}
        >
          <color attach="background" args={['#fdfbf2']} />
          <fog attach="fog" args={['#fdfbf2', 25, 120]} />
          
          <Suspense fallback={null}>
            <Lighting />
            <ExpoHall />
            <Booths />
            <Ballroom />
            <Player />
            <Effects />
          </Suspense>
          {/* <Stats /> Uncomment for performance monitor */}
        </Canvas>
      </KeyboardControls>

      {/* Mobile Controls */}
      {isTouch && !showInstructions && <Joystick />}

      {/* UI Overlay - Active Booth Info */}
      {activeBooth && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-96 bg-white/90 border border-[#d4af37]/50 p-6 rounded-xl text-black shadow-2xl backdrop-blur-md z-50 pointer-events-auto">
          <div className="flex justify-between items-center mb-4 border-b border-black/10 pb-4">
            <h2 className="text-xl font-bold tracking-widest text-[#d4af37]">{activeBooth}</h2>
            <button 
              onClick={() => setActiveBooth(null)}
              className="text-black/50 hover:text-black transition-colors p-1"
            >
              ✕
            </button>
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
            <button 
              className="flex-1 bg-[#d4af37] hover:bg-[#b08d29] text-black font-semibold py-3 rounded tracking-wide transition-colors text-xs"
            >
              BROCHURE
            </button>
          </div>
        </div>
      )}

      {/* UI Overlay - Instructions */}
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

      {/* Crosshair - only show on desktop */}
      {!isTouch && <div className="absolute top-1/2 left-1/2 w-1.5 h-1.5 bg-black/50 rounded-full transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-30" />}
    </div>
  );
}
