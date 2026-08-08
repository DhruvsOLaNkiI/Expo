import { Canvas } from '@react-three/fiber';
import { KeyboardControls } from '@react-three/drei';
import { Component, lazy, Suspense, useState, useEffect, useMemo, useCallback, type ReactNode } from 'react';
import { useStore } from '@/store';
import { mergeSceneConfig } from '@/features/shared/data/boothLayouts';
import { getRenderQualityPreset } from '@/features/shared/data/renderQuality';
import { getEffectiveCanvasDpr } from '@/utils/devicePerformance';
import { useFullscreen } from '@/hooks/useFullscreen';
import {
  Player,
  ExpoHall,
  Lighting,
  Effects,
  HallLayoutGizmos,
  HallLayoutEditHud,
  ExpoVisitorMenu,
  ExpoAdminBottomBar,
  CameraModeHud,
  SceneQualityHud,
  ExpoSceneSettingsHud,
  RoamingExecutive,
  FpsMeter,
  RenderStatsProbe,
  ExpoLoadingScreen,
} from '@/features/expo';
import { Booths, Ballroom, VertexEliteScreenHud } from '@/features/booths';
import {
  RegistrationHall,
  RegistrationLobbyLighting,
  RegistrationLobbyHud,
} from '@/features/registration';
import { AiChatbox, HelpDeskAiPanel } from '@/features/ai';
import { AdminBadge, AdminLoginModal, AdminRequiredScreen } from '@/features/admin';
import { VisitorBadge, VisitorOnboarding } from '@/features/visitor';
import {
  CtaResourcePopupView,
  SharedVideoTextureUpdater,
  VideoEnabledHint,
} from '@/features/media';
import { BuyerQuestionnairePopup, isQuestionnaireDone, markQuestionnaireDone } from '@/features/questionnaire';
import { getDashboardPublicUrl, useVisitorTracking } from '@/dashboard';

/**
 * A single booth texture / GLB failure must not blank the whole expo.
 * Keeps hall + player alive so visitors still see the floor and can walk.
 */
class ExpoSceneErrorBoundary extends Component<
  { children: ReactNode; label?: string },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error(`[expo-scene] ${this.props.label ?? 'scene'} crashed:`, error);
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}
function openAnalyticsDashboard(setCmsPage: (page: 'analytics') => void) {
  const external = getDashboardPublicUrl();
  if (external) {
    window.open(external, '_blank', 'noopener,noreferrer');
    return;
  }
  window.history.pushState(null, '', '/analytics');
  setCmsPage('analytics');
}

const CmsDashboard = lazy(() =>
  import('@/features/cms').then((m) => ({ default: m.CmsDashboard })),
);
const AnalyticsDashboard = lazy(() =>
  import('@/dashboard').then((m) => ({ default: m.AnalyticsDashboard })),
);
const ExhibitorRoutePage = lazy(() =>
  import('@/features/exhibitorDashboard').then((m) => ({ default: m.ExhibitorRoutePage })),
);
const PageIndexPortal = lazy(() =>
  import('@/features/pageindex').then((m) => ({ default: m.PageIndexPortal })),
);

function AdminRouteFallback({ label }: { label: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f1118] text-[#d4af37] text-sm font-semibold tracking-widest uppercase">
      Loading {label}…
    </div>
  );
}

/** Hold ◀ / ▶ to strafe left and right (mobile + desktop). */
function StrafeButtons() {
  const setStrafeHold = useStore((s) => s.setStrafeHold);
  const inRegistration = useStore((s) => s.expoPhase) === 'registration';

  if (inRegistration) return null;

  const bind = (side: 'left' | 'right') => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      setStrafeHold({ left: side === 'left', right: side === 'right' });
    },
    onPointerUp: () => setStrafeHold({ left: false, right: false }),
    onPointerLeave: () => setStrafeHold({ left: false, right: false }),
    onPointerCancel: () => setStrafeHold({ left: false, right: false }),
  });

  const btnClass =
    'pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#d4af37]/35 bg-[#1a1a22]/85 text-xl font-bold text-[#d4af37] shadow-lg backdrop-blur-md active:bg-[#d4af37]/25';

  return (
    <div className="fixed bottom-14 left-48 z-50 flex gap-3 touch-none" data-expo-ui>
      <button type="button" className={btnClass} aria-label="Move left" {...bind('left')}>
        ◀
      </button>
      <button type="button" className={btnClass} aria-label="Move right" {...bind('right')}>
        ▶
      </button>
    </div>
  );
}

function Joystick() {
  const setJoystickData = useStore((state) => state.setJoystickData);
  const [active, setActive] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    setActive(true);
    handleMove(e);
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!active) return;
    const touch = 'touches' in e ? e.touches[0] : e;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
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
  const ctaResourcePopup = useStore((s) => s.ctaResourcePopup);
  const setCtaResourcePopup = useStore((s) => s.setCtaResourcePopup);
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
  const compressModels = sceneConfig.modelCompression === '30fps';
  const performanceBoost = sceneConfig.performanceBoost;
  const expoPhase = useStore((s) => s.expoPhase);
  const inRegistration = expoPhase === 'registration';
  const qualityPreset = useMemo(
    () => getRenderQualityPreset(sceneConfig.renderQuality),
    [sceneConfig.renderQuality],
  );
  const canvasDpr = useMemo(
    () => getEffectiveCanvasDpr(qualityPreset.dpr, { compressModels }),
    [qualityPreset.dpr, compressModels],
  );
  const useAntialias =
    sceneConfig.renderQuality === 'fullhd' && !compressModels && !inRegistration;
  const setHallLayoutEditMode = useStore((s) => s.setHallLayoutEditMode);
  const setHallLayoutSelection = useStore((s) => s.setHallLayoutSelection);
  const setHallLayoutGizmoMode = useStore((s) => s.setHallLayoutGizmoMode);
  const registrationUi = useStore((s) => s.registrationUi);
  const openRegistrationPopup = useStore((s) => s.openRegistrationPopup);
  const openLoginPopup = useStore((s) => s.openLoginPopup);
  const setAdminLoginOpen = useStore((s) => s.setAdminLoginOpen);
  const isAdmin = useStore((s) => s.isAdmin);
  const skipToMainExpo = useStore((s) => s.skipToMainExpo);
  const visitorProfile = useStore((s) => s.visitorProfile);
  const [isTouch, setIsTouch] = useState(false);
  const fullscreen = useFullscreen();
  const [showQuestionnaire, setShowQuestionnaire] = useState(false);
  const [isExhibitorRoute, setIsExhibitorRoute] = useState(() => {
    const p = window.location.pathname.replace(/\/$/, '') || '/';
    return p.toLowerCase() === '/exbidash';
  });

  useVisitorTracking();

  const needsOnboarding = !visitorProfile;

  const handleQuestionnaireClose = useCallback(() => {
    markQuestionnaireDone(visitorProfile?.id);
    setShowQuestionnaire(false);
  }, [visitorProfile?.id]);

  const sceneBg = inRegistration ? '#FAF7F0' : sceneConfig.bgColor || '#f5f2ec';
  const fogEnabled = sceneConfig.fogEnabled === true;
  const cameraFar = fogEnabled ? Math.max(sceneConfig.fogFar + 45, 160) : 400;

  const glConfig = useMemo(
    () => ({
      antialias: useAntialias,
      alpha: false,
      stencil: false,
      depth: true,
      powerPreference: 'high-performance' as const,
    }),
    [useAntialias],
  );

  useEffect(() => {
    setIsTouch('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  useEffect(() => {
    const syncRoute = () => {
      const p = window.location.pathname.replace(/\/$/, '') || '/';
      setIsExhibitorRoute(p.toLowerCase() === '/exbidash');
    };
    syncRoute();
    window.addEventListener('popstate', syncRoute);
    return () => window.removeEventListener('popstate', syncRoute);
  }, []);

  useEffect(() => {
    const normalized = window.location.pathname.replace(/\/$/, '') || '/';
    if (normalized.toLowerCase() === '/exbidash') return;
    if (normalized === '/cms') {
      setCmsPage('cms');
      window.history.replaceState(null, '', useStore.getState().cmsPage === 'cms' ? '/cms' : '/');
    } else if (normalized === '/pageindex') {
      setCmsPage('pageindex');
      window.history.replaceState(null, '', useStore.getState().cmsPage === 'pageindex' ? '/pageindex' : '/');
    } else if (normalized === '/analytics') {
      setCmsPage('analytics');
      window.history.replaceState(null, '', useStore.getState().cmsPage === 'analytics' ? '/analytics' : '/');
    }
  }, [setCmsPage]);

  useEffect(() => {
    const path = (window.location.pathname.replace(/\/$/, '') || '/').toLowerCase();
    const onExhibitorDash = path === '/exbidash' || isExhibitorRoute;

    if (onExhibitorDash) {
      if (document.pointerLockElement) document.exitPointerLock();
      if (path !== '/exbidash') window.history.replaceState(null, '', '/exbidash');
      return;
    }
    if (cmsPage === 'cms') {
      if (document.pointerLockElement) document.exitPointerLock();
      window.history.replaceState(null, '', '/cms');
    } else if (cmsPage === 'pageindex') {
      if (document.pointerLockElement) document.exitPointerLock();
      window.history.replaceState(null, '', '/pageindex');
    } else if (cmsPage === 'analytics') {
      if (document.pointerLockElement) document.exitPointerLock();
      window.history.replaceState(null, '', '/analytics');
    } else if (path === '/' || path === '') {
      window.history.replaceState(null, '', '/');
    }
  }, [cmsPage, isExhibitorRoute]);

  useEffect(() => {
    if (ctaResourcePopup && document.pointerLockElement) document.exitPointerLock();
  }, [ctaResourcePopup]);

  // Show questionnaire once when visitor enters the main expo floor
  useEffect(() => {
    if (expoPhase !== 'expo' || needsOnboarding || isQuestionnaireDone(visitorProfile?.id)) return;
    const t = window.setTimeout(() => setShowQuestionnaire(true), 1200);
    return () => window.clearTimeout(t);
  }, [expoPhase, needsOnboarding, visitorProfile?.id]);

  const pathNow = (window.location.pathname.replace(/\/$/, '') || '/').toLowerCase();
  const onExhibitorDash = pathNow === '/exbidash' || isExhibitorRoute;

  if (onExhibitorDash) {
    return (
      <Suspense fallback={<AdminRouteFallback label="Exhibitor Dashboard" />}>
        <ExhibitorRoutePage />
      </Suspense>
    );
  }

  if (cmsPage === 'cms') {
    return (
      <Suspense fallback={<AdminRouteFallback label="CMS" />}>
        <CmsDashboard />
        <AdminLoginModal />
      </Suspense>
    );
  }
  if (cmsPage === 'pageindex') {
    return (
      <Suspense fallback={<AdminRouteFallback label="PageIndex" />}>
        {isAdmin ? (
          <PageIndexPortal />
        ) : (
          <AdminRequiredScreen title="PageIndex" />
        )}
        <AdminLoginModal />
      </Suspense>
    );
  }
  if (cmsPage === 'analytics') {
    return (
      <Suspense fallback={<AdminRouteFallback label="Analytics" />}>
        {isAdmin ? (
          <AnalyticsDashboard />
        ) : (
          <AdminRequiredScreen title="Analytics" />
        )}
        <AdminLoginModal />
      </Suspense>
    );
  }

  return (
    <div
      className="w-full h-dvh bg-black overflow-hidden select-none font-sans"
      onClick={() => {
        if (showInstructions && !needsOnboarding) {
          if (isTouch && fullscreen.supported) void fullscreen.enter();
          setShowInstructions(false);
        }
      }}
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
          shadows={!compressModels}
          camera={{ fov: 65, near: 0.1, far: cameraFar }}
          dpr={canvasDpr}
          gl={glConfig}
        >
          <color attach="background" args={[sceneBg]} />
          {fogEnabled && !inRegistration && (
            <fog
              attach="fog"
              args={[
                sceneConfig.fogColor || '#f0ebe4',
                Math.max(sceneConfig.fogNear, 25),
                Math.max(sceneConfig.fogFar, 70),
              ]}
            />
          )}
          <Suspense fallback={null}>
            <SharedVideoTextureUpdater />
            {inRegistration ? (
              <RegistrationLobbyLighting compressedMode={compressModels} boost={performanceBoost} />
            ) : (
              <Lighting compressedMode={compressModels} boost={performanceBoost} />
            )}
            {inRegistration ? (
              <RegistrationHall />
            ) : (
              <>
                <ExpoHall showVideos={showVideos} />
                <Suspense fallback={null}>
                  <ExpoSceneErrorBoundary label="booths">
                    <Booths showVideos={showVideos} />
                  </ExpoSceneErrorBoundary>
                </Suspense>
                {showRoamingExecutive && (
                  <ExpoSceneErrorBoundary label="roaming-executive">
                    <RoamingExecutive />
                  </ExpoSceneErrorBoundary>
                )}
                {showBallroom && (
                  <Suspense fallback={null}>
                    <ExpoSceneErrorBoundary label="ballroom">
                      <Ballroom
                        showVideos={showVideos}
                        stageScreenUrl={sceneConfig.ballroomStageScreenUrl}
                      />
                    </ExpoSceneErrorBoundary>
                  </Suspense>
                )}
              </>
            )}
            <HallLayoutGizmos />
            <Player />
            {isAdmin && <RenderStatsProbe />}
            {postProcessing && <Effects />}
          </Suspense>
        </Canvas>
      </KeyboardControls>

      {needsOnboarding && <VisitorOnboarding />}
      {visitorProfile && <VisitorBadge />}
      <AdminLoginModal />
      <AdminBadge />
      <RegistrationLobbyHud />
      {visitorProfile && (
        <ExpoVisitorMenu onOpenAnalytics={() => openAnalyticsDashboard(setCmsPage)} />
      )}
      {isAdmin && (
        <>
          <ExpoAdminBottomBar onOpenAnalytics={() => openAnalyticsDashboard(setCmsPage)} />
          <CameraModeHud />
          <SceneQualityHud />
          <ExpoSceneSettingsHud />
          <FpsMeter />
        </>
      )}
      <VideoEnabledHint />
      {!inRegistration && <VertexEliteScreenHud />}
      <HallLayoutEditHud />

      {inRegistration && !showInstructions && registrationUi === 'none' && !needsOnboarding && (
        <>
          {isAdmin ? (
            <button
              type="button"
              className="fixed bottom-3 left-3 z-[55] rounded-lg border border-cyan-500/25 bg-cyan-950/75 px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-cyan-100 shadow-xl backdrop-blur-md pointer-events-auto hover:bg-cyan-900/90 transition-all"
              onClick={() => {
                setHallLayoutSelection('reg-registration-desk');
                setHallLayoutGizmoMode('translate');
                setHallLayoutEditMode(true);
              }}
            >
              Edit layout
            </button>
          ) : (
            <button
              type="button"
              className="fixed bottom-3 left-3 z-[55] rounded-lg border border-violet-500/35 bg-violet-950/80 px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-violet-100 shadow-xl backdrop-blur-md pointer-events-auto hover:bg-violet-900/90 transition-all"
              onClick={() => setAdminLoginOpen(true)}
            >
              Admin
            </button>
          )}
          <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-[55] flex flex-col sm:flex-row items-center gap-2 pointer-events-auto">
            <button
              type="button"
              className="rounded-lg border border-[#d4af37]/40 bg-[#1a1a22]/90 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-[#d4af37] shadow-xl backdrop-blur-md hover:bg-black transition-all"
              onClick={() => openRegistrationPopup()}
            >
              Register Now
            </button>
            <button
              type="button"
              className="rounded-lg border border-[#d4af37]/55 bg-[#d4af37]/15 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-[#f5e6c8] shadow-xl backdrop-blur-md hover:bg-[#d4af37]/25 transition-all"
              onClick={() => openLoginPopup()}
            >
              Login
            </button>
            <button
              type="button"
              className="rounded-lg border border-white/20 bg-[#1a1a22]/80 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-white/80 shadow-xl backdrop-blur-md hover:bg-black/90 transition-all"
              onClick={() => skipToMainExpo()}
            >
              Skip to expo
            </button>
          </div>
        </>
      )}

      {!needsOnboarding && (
        <>
          <AiChatbox />
          <HelpDeskAiPanel />
        </>
      )}

      {!showInstructions && !ctaResourcePopup && !needsOnboarding && !inRegistration && (
        <>
          <StrafeButtons />
          {isTouch && <Joystick />}
        </>
      )}

      {ctaResourcePopup && (
        <CtaResourcePopupView popup={ctaResourcePopup} onClose={() => setCtaResourcePopup(null)} />
      )}

      {showInstructions && !needsOnboarding && (
        <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-40 backdrop-blur-sm pointer-events-auto">
          <div className="text-center px-4">
            <h1 className="text-3xl md:text-5xl font-bold tracking-widest text-[#d4af37] mb-4">
              VIRTUAL EXPO
            </h1>
            <h2 className="text-lg md:text-2xl font-light text-black tracking-[0.2em] mb-4 md:mb-6">
              LUXURY RESIDENCES
            </h2>
            {visitorProfile && (
              <p className="text-sm text-[#8a7a5a] tracking-wide mb-2">
                Welcome,{' '}
                <span className="font-semibold text-black">{visitorProfile.displayName}</span> ·{' '}
                <span className="font-mono text-xs text-[#d4af37]">{visitorProfile.id}</span>
              </p>
            )}
            {inRegistration && (
              <p className="text-sm text-gray-600 tracking-wide mb-8 md:mb-10 max-w-md mx-auto">
                You are in the registration lobby. Check in at the counter, then enter the main
                exhibition hall.
              </p>
            )}
            {!inRegistration && <div className="mb-8 md:mb-12" />}
            <div className="bg-black/5 border border-black/10 p-6 md:p-8 rounded-2xl backdrop-blur-md inline-block">
              <p className="text-black text-base md:text-lg mb-6">
                {isTouch ? 'Tap to enter' : 'Click anywhere to enter'}
              </p>
              <div className="flex items-center justify-center gap-4 md:gap-8 text-gray-700">
                <div className="flex flex-col items-center">
                  <div className="p-2 md:p-3 border border-black/20 rounded-lg mb-2 text-black font-semibold text-xs md:text-sm">
                    {isTouch ? 'JOYSTICK' : 'WASD'}
                  </div>
                  <span className="text-[10px] md:text-xs uppercase tracking-widest">Move</span>
                </div>
                <div className="flex flex-col items-center">
                  <div className="p-2 md:p-3 border border-black/20 rounded-lg mb-2 text-black font-semibold text-xs md:text-sm">
                    {isTouch ? 'DRAG' : 'MOUSE'}
                  </div>
                  <span className="text-[10px] md:text-xs uppercase tracking-widest">Look</span>
                </div>
                <div className="flex flex-col items-center">
                  <div className="p-2 md:p-3 border border-black/20 rounded-lg mb-2 text-black font-semibold text-xs md:text-sm">
                    V
                  </div>
                  <span className="text-[10px] md:text-xs uppercase tracking-widest">Camera</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isTouch && fullscreen.supported && !showInstructions && !needsOnboarding && (
        <button
          type="button"
          aria-label={fullscreen.active ? 'Exit full screen' : 'Enter full screen'}
          className="fixed top-3 right-3 z-[60] rounded-lg border border-white/20 bg-black/60 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white/80 shadow-xl backdrop-blur-md pointer-events-auto"
          onClick={(e) => {
            e.stopPropagation();
            fullscreen.toggle();
          }}
        >
          {fullscreen.active ? 'Exit' : 'Full screen'}
        </button>
      )}

      {!isTouch && (
        <div className="absolute top-1/2 left-1/2 w-1.5 h-1.5 bg-black/50 rounded-full transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-30" />
      )}

      {showQuestionnaire && (
        <BuyerQuestionnairePopup onClose={handleQuestionnaireClose} />
      )}

      <ExpoLoadingScreen />
    </div>
  );
}
