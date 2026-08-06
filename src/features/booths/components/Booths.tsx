import { Html, Text, Box, Cylinder, useGLTF, useTexture } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useStore } from '@/store';
import { Suspense, useRef, useMemo, useLayoutEffect, useEffect, useState, Component, type ReactNode } from 'react';
import * as THREE from 'three';
import { clone as cloneSkinnedHierarchy } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { LedScreenSurface, LedScreenSuspenseFallback, isScreenImageUrl, resolveBoothLedScreenUrl } from '@/features/media/components/LedVideoPlane';
import { VertexEliteCanopyBranding } from './VertexEliteCanopyBranding';
import { LuxuryBoothHeaderCanopy } from './LuxuryBoothHeaderCanopy';
import { BoothNumberBadge, BoothSignageFascia } from './BoothSignageFascia';
import { BoothCeilingHangingBoard } from './BoothCeilingHangingBoard';
import {
  resolveBoothHeaderBranding,
  resolveBoothWallColors,
  resolveHeaderTextColor,
} from '@/features/shared/data/boothLayouts';
import { BOOTH_CMS_PERSIST_EVENT } from '@/store/persist/boothCms';
import { BoothWallLogos } from './BoothWallLogos';
import { BoothPlacementImages } from './BoothPlacementImages';
import { BoothSideWallAssembly } from './BoothSideWallAssembly';
import { VertexEliteCtaKiosk } from './VertexEliteCtaKiosk';
import { VertexEliteProximityPanels } from './VertexEliteProximityPanels';
import { HallAisleStandees } from './HallAisleStandees';
import { HallSuspendedCanopies } from './HallSuspendedCanopy.tsx';
import { SideExpoBooths } from './SideExpoBooths';
import { BOOTH_ACCENT_LIGHT_RANGE, CONCIERGE_LIGHT_RANGE } from './ProximityLight';
import { BoothLayoutRoot } from './BoothLayoutRoot';
import { BoothDisplayEditable } from './BoothDisplayEditable';
import { LUXURY_BOOTH_DISPLAY_DEFAULTS, VERTEX_ELITE_DISPLAY_DEFAULTS, type BoothDisplayLayout } from '@/features/shared/data/boothDisplayLayout';
import { sanitizeBoothLogoUrlForWebGL } from '@/features/exhibitorDashboard/exhibitorLogo';
import { BoothPlacedImageInteractive } from './BoothPlacedImageInteractive';
import { BoothPlacedImage } from './BoothPlacedImageMesh';
import {
  applyBoothOverrides,
  buildDefaultBoothLayoutList,
  DEFAULT_SCENE_CONFIG,
  HELP_DESK_COUNTER_HEIGHT,
  HELP_DESK_RADIUS,
  siteMapUrlsFromConfig,
  mergeHallLayout,
  mergeSceneConfig,
  resolveEcoBoothSurfaceColors,
  type PlacedImage,
  type HostessQuickReply,
  type MediaItem,
  type CompanyProfile,
} from '@/features/shared/data/boothLayouts';
import {
  buildExpoTeleportDestinations,
  buildHelpDeskHostessReplies,
  REGISTRATION_LOBBY_DESTINATION,
} from '@/features/shared/data/expoTeleportDestinations';
import { MonarchBooth } from './MonarchBooth';
import { CrownEstatesBooth } from './CrownEstatesBooth';
import { useModelCompression } from '@/hooks/useModelCompression';
import { usePerformanceBoost } from '@/hooks/usePerformanceBoost';
import { BoothLightPool, PooledBoothLight } from './BoothLightPool';
import { optimizeGlbRoot, shouldHideDecorativeGlbInstances } from '@/utils/glbPerformance';

const EMPTY_HOSTESS_REPLIES: HostessQuickReply[] = [];

/**
 * Vertex Elite uses the same procedural `Booth` shell as other luxury stalls; defaults live in `src/data/boothLayouts.ts` (overridable via Booth CMS + `public/booth-cms.json`).
 * Hostess: `public/assets/indian_office_woman.glb` (Mixamo rig + idle clip).
 */
const HOSTESS_MODEL_URL = '/assets/indian_office_woman.glb';
const HOSTESS_MAX_WIDTH = 2.25;
const HOSTESS_MAX_HEIGHT = 1.58;

/** Hallway decorative trees — Maple (`public/assets/maple1_MZRT.glb`) */
const HALL_TREE_MODEL_URL = '/assets/maple1_MZRT.glb';
/** World-space height after uniform scale (meters); multiplied by each `<Plant scale={…} />` */
const HALL_TREE_TARGET_HEIGHT = 5.15;

/**
 * Procedural `Booth` local space: +Y up, +Z toward main aisle / visitors, −Z back wall.
 * Reception desk lives in `<group position={[0, 0.5, 0]}>`; body is box 4×1×1 centered → back face at z = −0.5 in that group.
 */
const BOOTH_DESK_GROUP_Y = 0.5;
const BOOTH_COUNTER_HALF_DEPTH_Z = 0.5;
/** Space between counter back plane and avatar anchor (collision-safe). */
const BOOTH_HOSTESS_BACK_CLEARANCE = 0.42;
/** Slight −X shifts hostess away from the small counter TV (+X side of desk). */
const BOOTH_HOSTESS_DESK_LOCAL_X = -0.36;
/**
 * Extra **up** (meters) so shoes sit on the floor — animated GLBs often need a small nudge vs `prepareHostessModel`’s bind pose.
 * Increase if feet clip **into** the floor; decrease if she floats.
 */
const BOOTH_HOSTESS_FLOOR_LIFT = 0.075;
/**
 * Yaw (radians) around Y: turn the hostess so she faces visitors on the aisle.
 * - `0` and `Math.PI` differ by 180° — use whichever matches your GLB’s forward axis.
 * - Add small values (e.g. `±0.15`) for a slight angle toward the hall center.
 */
const BOOTH_HOSTESS_YAW = 0;
/**
 * Position inside desk group: feet near hall floor (booth y≈0 → desk-local y ≈ −BOOTH_DESK_GROUP_Y + lift).
 * z = behind counter back edge.
 */
const BOOTH_HOSTESS_DESK_LOCAL: [number, number, number] = [
  BOOTH_HOSTESS_DESK_LOCAL_X,
  -BOOTH_DESK_GROUP_Y + BOOTH_HOSTESS_FLOOR_LIFT,
  -(BOOTH_COUNTER_HALF_DEPTH_Z + BOOTH_HOSTESS_BACK_CLEARANCE),
];

/** World-space head anchor for speech bubble + proximity (meters above desk-local feet). */
const BOOTH_HOSTESS_BUBBLE_LOCAL_Y = BOOTH_HOSTESS_DESK_LOCAL[1] + 1.74;

/** Hall camera must be within this horizontal-ish distance to trigger greeting. */
const HOSTESS_GREETING_PROXIMITY_M = 5.15;
/** Avoid overlapping SpeechSynthesis when several hostesses could fire at once. */
let lastGlobalHostessSpeechAt = 0;
const HOSTESS_SPEECH_GLOBAL_GAP_MS = 9000;

const _hostessHeadWorld = new THREE.Vector3();

function trySpeakHostessGreeting() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const now = Date.now();
  if (now - lastGlobalHostessSpeechAt < HOSTESS_SPEECH_GLOBAL_GAP_MS) return;
  lastGlobalHostessSpeechAt = now;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance('How can I help you?');
    u.rate = 0.9;
    u.pitch = 1.02;
    window.speechSynthesis.speak(u);
  } catch {
    /* ignore */
  }
}

function speakHostessReply(text: string) {
  const t = text.trim();
  if (!t || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(t);
    u.rate = 0.9;
    u.pitch = 1;
    window.speechSynthesis.speak(u);
  } catch {
    /* ignore */
  }
}

function HostessGreetingBubble({
  localPosition,
  quickReplies,
}: {
  localPosition: [number, number, number];
  quickReplies: HostessQuickReply[];
}) {
  const groupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const activeBooth = useStore((s) => s.activeBooth);
  const helpDeskOpen = useStore((s) => s.helpDeskOpen);
  const ctaResourcePopup = useStore((s) => s.ctaResourcePopup);
  const openAiChat = useStore((s) => s.openAiChat);
  const setHelpDeskOpen = useStore((s) => s.setHelpDeskOpen);
  const teleportPlayer = useStore((s) => s.teleportPlayer);
  const enterRegistrationLobby = useStore((s) => s.enterRegistrationLobby);
  const boothOverrides = useStore((s) => s.boothOverrides);
  const teleportDestinations = useMemo(
    () => buildExpoTeleportDestinations(boothOverrides),
    [boothOverrides],
  );
  const [visible, setVisible] = useState(false);
  const wasNearRef = useRef(false);
  const showRef = useRef(false);
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);

  const shownOptions = useMemo(
    () =>
      quickReplies.filter(
        (r) =>
          r.label.trim() &&
          (r.response.trim() ||
            r.action === 'askAi' ||
            r.action === 'helpDesk' ||
            (r.action === 'teleport' && r.teleportId)),
      ),
    [quickReplies],
  );
  const hasTeleportOptions = shownOptions.some((r) => r.action === 'teleport');
  const hasHelpDeskOption = shownOptions.some((r) => r.action === 'helpDesk');

  useFrame(() => {
    if (activeBooth || helpDeskOpen || ctaResourcePopup) {
      wasNearRef.current = false;
      if (showRef.current) {
        showRef.current = false;
        setVisible(false);
      }
      setActiveReplyId((id) => (id !== null ? null : id));
      return;
    }
    if (!groupRef.current) return;
    groupRef.current.getWorldPosition(_hostessHeadWorld);
    const d = _hostessHeadWorld.distanceTo(camera.position);
    const near = d < HOSTESS_GREETING_PROXIMITY_M;
    if (near !== showRef.current) {
      showRef.current = near;
      setVisible(near);
    }
    if (!near) setActiveReplyId((id) => (id !== null ? null : id));
    if (near && !wasNearRef.current) trySpeakHostessGreeting();
    wasNearRef.current = near;
  });

  const activeReply = activeReplyId ? shownOptions.find((o) => o.id === activeReplyId) : undefined;

  return (
    <group ref={groupRef} position={localPosition}>
      <Html
        center
        distanceFactor={7}
        zIndexRange={[16777271, 16777271]}
        style={{
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.22s ease',
          pointerEvents: visible && shownOptions.length > 0 ? 'auto' : 'none',
          userSelect: 'none',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
            gap: 6,
            width: 'max-content',
            maxWidth: 'min(92vw, 280px)',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              width: 'max-content',
              maxWidth: 'min(92vw, 280px)',
              whiteSpace: 'nowrap',
              padding: '8px 14px',
              borderRadius: 12,
              background: '#ffffff',
              border: '1.5px solid #111111',
              boxShadow: '0 6px 18px rgba(0,0,0,0.22)',
              color: '#111111',
              fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: '0.01em',
              lineHeight: 1.2,
              textAlign: 'center',
              alignSelf: 'center',
            }}
          >
            {hasHelpDeskOption
              ? 'How can I help you?'
              : hasTeleportOptions
                ? 'Where would you like to go?'
                : 'How can I help you?'}
          </div>

          {shownOptions.length > 0 && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                pointerEvents: 'auto',
                maxHeight: hasTeleportOptions ? 220 : undefined,
                overflowY: hasTeleportOptions ? 'auto' : undefined,
                paddingRight: hasTeleportOptions ? 4 : 0,
              }}
            >
              {shownOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (opt.action === 'askAi') {
                      openAiChat(hasHelpDeskOption ? 'expo-concierge' : undefined);
                      setActiveReplyId(null);
                      return;
                    }
                    if (opt.action === 'helpDesk') {
                      setHelpDeskOpen(true, { pane: opt.helpDeskPane ?? 'welcome' });
                      setActiveReplyId(null);
                      return;
                    }
                    if (opt.action === 'teleport' && opt.teleportId) {
                      if (opt.teleportId === REGISTRATION_LOBBY_DESTINATION.id) {
                        enterRegistrationLobby();
                      } else {
                        const dest = teleportDestinations.find((d) => d.id === opt.teleportId);
                        if (dest) teleportPlayer(dest.position);
                      }
                      setActiveReplyId(null);
                      return;
                    }
                    setActiveReplyId(opt.id);
                    speakHostessReply(opt.response);
                  }}
                  style={{
                    cursor: 'pointer',
                    padding: '6px 10px',
                    borderRadius: 8,
                    border: '1px solid rgba(212,175,55,0.55)',
                    background: 'rgba(20,20,28,0.92)',
                    color: '#f5e6bc',
                    fontSize: 12,
                    fontWeight: 600,
                    textAlign: 'left',
                    lineHeight: 1.25,
                  }}
                >
                  {opt.label.trim()}
                </button>
              ))}
            </div>
          )}

          {activeReply && (
            <div
              style={{
                maxHeight: 120,
                overflowY: 'auto',
                padding: '8px 10px',
                borderRadius: 10,
                background: 'rgba(255,255,255,0.96)',
                border: '1px solid #111',
                color: '#1a1520',
                fontSize: 12,
                fontWeight: 500,
                lineHeight: 1.35,
                textAlign: 'left',
                pointerEvents: 'auto',
              }}
            >
              {activeReply.response.trim()}
            </div>
          )}
        </div>
      </Html>
    </group>
  );
}

/** Stable idle phase per booth / desk (desync motion). */
function stringToPhase(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 10000;
  return h * 0.001 * Math.PI;
}

export function Booths({ showVideos = true }: { showVideos?: boolean }) {
  const boothOverrides = useStore((s) => s.boothOverrides);
  const sceneOverrides = useStore((s) => s.sceneOverrides);
  const hallLayout = useMemo(() => mergeHallLayout(sceneOverrides.hallLayout), [sceneOverrides.hallLayout]);
  const initBoothCms = useStore((s) => s.initBoothCms);
  const syncBoothOverridesFromPersistence = useStore((s) => s.syncBoothOverridesFromPersistence);
  const syncSceneOverridesFromPersistence = useStore(
    (s) => (s as unknown as { syncSceneOverridesFromPersistence?: () => void }).syncSceneOverridesFromPersistence,
  );

  const showStandardBooths = sceneOverrides.showStandardBooths ?? DEFAULT_SCENE_CONFIG.showStandardBooths;
  const showHallCanopy = sceneOverrides.showHallCanopy ?? DEFAULT_SCENE_CONFIG.showHallCanopy;
  const hallCanopyScreenUrl = sceneOverrides.hallCanopyScreenUrl ?? DEFAULT_SCENE_CONFIG.hallCanopyScreenUrl;
  const showHallPlants = sceneOverrides.showHallPlants ?? DEFAULT_SCENE_CONFIG.showHallPlants;
  const showVertexEliteCtaKiosk =
    sceneOverrides.showVertexEliteCtaKiosk ?? DEFAULT_SCENE_CONFIG.showVertexEliteCtaKiosk;
  const showHallAisleStandees =
    sceneOverrides.showHallAisleStandees ?? DEFAULT_SCENE_CONFIG.showHallAisleStandees;
  const showBoothStandee = sceneOverrides.showBoothStandee ?? DEFAULT_SCENE_CONFIG.showBoothStandee;
  const modelCompression = useModelCompression();
  const hideDecorativeGlbs = shouldHideDecorativeGlbInstances(modelCompression);
  const hiddenBoothIds = sceneOverrides.hiddenBooths ?? DEFAULT_SCENE_CONFIG.hiddenBooths;
  const hiddenBooths = useMemo(() => new Set(hiddenBoothIds), [hiddenBoothIds]);

  useEffect(() => {
    void initBoothCms();
  }, [initBoothCms]);

  useEffect(() => {
    const syncFromPersistence = () => {
      void syncBoothOverridesFromPersistence();
      if (typeof syncSceneOverridesFromPersistence === 'function') {
        syncSceneOverridesFromPersistence();
      }
    };

    syncFromPersistence();

    const onStorage = () => syncFromPersistence();
    const onFocus = () => syncFromPersistence();
    const onVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        syncFromPersistence();
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', onStorage);
      window.addEventListener('focus', onFocus);
      window.addEventListener(BOOTH_CMS_PERSIST_EVENT, onStorage);
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', onStorage);
        window.removeEventListener('focus', onFocus);
        window.removeEventListener(BOOTH_CMS_PERSIST_EVENT, onStorage);
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility);
      }
    };
  }, [syncBoothOverridesFromPersistence, syncSceneOverridesFromPersistence]);

  const layouts = useMemo(
    () => applyBoothOverrides(buildDefaultBoothLayoutList(), boothOverrides),
    [boothOverrides]
  );

  const layoutsToRender = useMemo(
    () => {
      const base = showStandardBooths ? layouts : layouts.filter((b) => b.id === 'vertex-elite');
      return base.filter((b) => !hiddenBooths.has(b.id));
    },
    [layouts, showStandardBooths, hiddenBooths],
  );

  return (
    <group position={[0, 0, 0]}>
      {/* Constant-count light pool — reassigned to the nearest booths each frame so the scene's
          light count never changes (no shader recompiles / stutter when moving between booths). */}
      <BoothLightPool />

      {/* Central Featured Help Desk Zone */}
      <FeaturedProperty position={[0, 0, 0]} />

      {/* Main path trees (`tree.glb`) — off by default (heavy); also skipped in model-compression mode */}
      {showHallPlants && !hideDecorativeGlbs && hallLayout.plantPositions.length > 0 && (
        <Suspense fallback={null}>
          {hallLayout.plantPositions.map((pos, i) => (
            <Plant key={`hall-plant-${i}`} name={`hall-plant-${i}`} position={pos} scale={hallLayout.plantScales[i] ?? 1} />
          ))}
        </Suspense>
      )}

      {showHallAisleStandees && !hideDecorativeGlbs && (
        <HallAisleStandees layouts={layoutsToRender} aisleStandeeTransforms={hallLayout.aisleStandeeTransforms} />
      )}

      {/* Single suspended LED ring above help desk */}
      {showHallCanopy && (
        <HallSuspendedCanopies showVideos={showVideos} screenUrl={hallCanopyScreenUrl} />
      )}

      {/* Side expo booths (6 total) — using full luxury booth shell */}
      <SideExpoBooths layouts={layouts} showVideos={showVideos} BoothComponent={StandardLuxuryBooth} hiddenBooths={hiddenBooths} />

      {layoutsToRender.map((b) => {
        if (b.id === 'vertex-elite') {
          return (
            <VertexEliteBooth
              key={b.id}
              position={b.position}
              rotation={b.rotation}
              boothScale={b.scale}
              id={b.id}
              name={b.name}
              color={b.color}
              accent={b.accent}
              counterColor={b.counterColor}
              backWallColor={b.backWallColor}
              headerTextColor={b.headerTextColor}
              headerLogoUrl={sanitizeBoothLogoUrlForWebGL(b.headerLogoUrl) || undefined}
              projectLogoUrl={sanitizeBoothLogoUrlForWebGL(b.projectLogoUrl) || undefined}
              headerBranding={b.headerBranding}
              wallLogoLeftUrl={sanitizeBoothLogoUrlForWebGL(b.wallLogoLeftUrl) || undefined}
              wallLogoRightUrl={sanitizeBoothLogoUrlForWebGL(b.wallLogoRightUrl) || undefined}
              sideWallLeftImageUrl={sanitizeBoothLogoUrlForWebGL(b.sideWallLeftImageUrl) || undefined}
              sideWallRightImageUrl={sanitizeBoothLogoUrlForWebGL(b.sideWallRightImageUrl) || undefined}
              exteriorWallLeftImageUrl={sanitizeBoothLogoUrlForWebGL(b.exteriorWallLeftImageUrl) || undefined}
              exteriorWallRightImageUrl={sanitizeBoothLogoUrlForWebGL(b.exteriorWallRightImageUrl) || undefined}
              counterFrontImageUrl={sanitizeBoothLogoUrlForWebGL(b.counterFrontImageUrl) || undefined}
              standeeImageUrl={sanitizeBoothLogoUrlForWebGL(b.standeeImageUrl) || undefined}
              wallPlacementAdjustments={b.wallPlacementAdjustments}
              company={b.company}
              videoUrl={b.videoUrl}
              stageScreenUrl={b.stageScreenUrl}
              lighting={b.lighting}
              placedImages={b.placedImages}
              brochureUrl={b.brochureUrl}
              priceListUrl={b.priceListUrl}
              unitLayoutUrl={b.unitLayoutUrl}
              unitLayouts={b.unitLayouts}
              floorPlanUrl={b.floorPlanUrl}
              floorPlans={b.floorPlans}
              faqUrl={b.faqUrl}
              customFaqQuestions={b.customFaqQuestions}
              siteMapUrls={siteMapUrlsFromConfig({ siteMapUrl: b.siteMapUrl, siteMapGallery: b.siteMapGallery })}
              hostessQuickReplies={b.hostessQuickReplies ?? EMPTY_HOSTESS_REPLIES}
              showVideos={showVideos}
              showCtaKiosk={showVertexEliteCtaKiosk}
              displayLayout={b.displayLayout}
              media={b.media}
            />
          );
        } else if (b.id === 'builder-8') {
          return (
            <EcoEdenBooth
              key={b.id}
              position={b.position}
              rotation={b.rotation}
              boothScale={b.scale}
              id={b.id}
              name={b.name}
              color={b.color}
              accent={b.accent}
              counterColor={b.counterColor}
              backWallColor={b.backWallColor}
              tvWallColor={b.tvWallColor}
              headerFasciaColor={b.headerFasciaColor}
              counterTopColor={b.counterTopColor}
              headerTextColor={b.headerTextColor}
              videoUrl={b.videoUrl}
              stageScreenUrl={b.stageScreenUrl}
              headerLogoUrl={sanitizeBoothLogoUrlForWebGL(b.headerLogoUrl) || undefined}
              projectLogoUrl={sanitizeBoothLogoUrlForWebGL(b.projectLogoUrl) || undefined}
              headerBranding={b.headerBranding}
              wallLogoLeftUrl={sanitizeBoothLogoUrlForWebGL(b.wallLogoLeftUrl) || undefined}
              wallLogoRightUrl={sanitizeBoothLogoUrlForWebGL(b.wallLogoRightUrl) || undefined}
              sideWallLeftImageUrl={sanitizeBoothLogoUrlForWebGL(b.sideWallLeftImageUrl) || undefined}
              sideWallRightImageUrl={sanitizeBoothLogoUrlForWebGL(b.sideWallRightImageUrl) || undefined}
              exteriorWallLeftImageUrl={sanitizeBoothLogoUrlForWebGL(b.exteriorWallLeftImageUrl) || undefined}
              exteriorWallRightImageUrl={sanitizeBoothLogoUrlForWebGL(b.exteriorWallRightImageUrl) || undefined}
              counterFrontImageUrl={sanitizeBoothLogoUrlForWebGL(b.counterFrontImageUrl) || undefined}
              standeeImageUrl={sanitizeBoothLogoUrlForWebGL(b.standeeImageUrl) || undefined}
              wallPlacementAdjustments={b.wallPlacementAdjustments}
              lighting={b.lighting}
              placedImages={b.placedImages}
              brochureUrl={b.brochureUrl}
              priceListUrl={b.priceListUrl}
              unitLayoutUrl={b.unitLayoutUrl}
              unitLayouts={b.unitLayouts}
              floorPlanUrl={b.floorPlanUrl}
              floorPlans={b.floorPlans}
              faqUrl={b.faqUrl}
              signageImageUrl={b.signageImageUrl}
              siteMapUrls={siteMapUrlsFromConfig({ siteMapUrl: b.siteMapUrl, siteMapGallery: b.siteMapGallery })}
              media={b.media}
              company={b.company}
              hostessQuickReplies={b.hostessQuickReplies ?? EMPTY_HOSTESS_REPLIES}
              showVideos={showVideos}
              displayLayout={b.displayLayout}
            />
          );
        } else if (b.id === 'builder-5') {
          return (
            <MonarchBooth
              key={b.id}
              position={b.position}
              rotation={b.rotation}
              boothScale={b.scale}
              id={b.id}
              name={b.name}
              color={b.color}
              accent={b.accent}
              counterColor={b.counterColor}
              backWallColor={b.backWallColor}
              headerTextColor={b.headerTextColor}
              videoUrl={b.videoUrl}
              stageScreenUrl={b.stageScreenUrl}
              headerLogoUrl={sanitizeBoothLogoUrlForWebGL(b.headerLogoUrl) || undefined}
              projectLogoUrl={sanitizeBoothLogoUrlForWebGL(b.projectLogoUrl) || undefined}
              headerBranding={b.headerBranding}
              wallLogoLeftUrl={sanitizeBoothLogoUrlForWebGL(b.wallLogoLeftUrl) || undefined}
              wallLogoRightUrl={sanitizeBoothLogoUrlForWebGL(b.wallLogoRightUrl) || undefined}
              sideWallLeftImageUrl={sanitizeBoothLogoUrlForWebGL(b.sideWallLeftImageUrl) || undefined}
              sideWallRightImageUrl={sanitizeBoothLogoUrlForWebGL(b.sideWallRightImageUrl) || undefined}
              exteriorWallLeftImageUrl={sanitizeBoothLogoUrlForWebGL(b.exteriorWallLeftImageUrl) || undefined}
              exteriorWallRightImageUrl={sanitizeBoothLogoUrlForWebGL(b.exteriorWallRightImageUrl) || undefined}
              counterFrontImageUrl={sanitizeBoothLogoUrlForWebGL(b.counterFrontImageUrl) || undefined}
              standeeImageUrl={sanitizeBoothLogoUrlForWebGL(b.standeeImageUrl) || undefined}
              wallPlacementAdjustments={b.wallPlacementAdjustments}
              lighting={b.lighting}
              placedImages={b.placedImages}
              brochureUrl={b.brochureUrl}
              priceListUrl={b.priceListUrl}
              unitLayoutUrl={b.unitLayoutUrl}
              unitLayouts={b.unitLayouts}
              floorPlanUrl={b.floorPlanUrl}
              floorPlans={b.floorPlans}
              faqUrl={b.faqUrl}
              siteMapUrls={siteMapUrlsFromConfig({ siteMapUrl: b.siteMapUrl, siteMapGallery: b.siteMapGallery })}
              media={b.media}
              company={b.company}
              hostessQuickReplies={b.hostessQuickReplies ?? EMPTY_HOSTESS_REPLIES}
              showVideos={showVideos}
              displayLayout={b.displayLayout}
            />
          );
        } else if (b.id === 'builder-4') {
          return (
            <CrownEstatesBooth
              key={b.id}
              position={b.position}
              rotation={b.rotation}
              boothScale={b.scale}
              id={b.id}
              name={b.name}
              color={b.color}
              accent={b.accent}
              counterColor={b.counterColor}
              backWallColor={b.backWallColor}
              headerTextColor={b.headerTextColor}
              videoUrl={b.videoUrl}
              stageScreenUrl={b.stageScreenUrl}
              headerLogoUrl={sanitizeBoothLogoUrlForWebGL(b.headerLogoUrl) || undefined}
              projectLogoUrl={sanitizeBoothLogoUrlForWebGL(b.projectLogoUrl) || undefined}
              headerBranding={b.headerBranding}
              headerFasciaColor={b.headerFasciaColor}
              wallLogoLeftUrl={sanitizeBoothLogoUrlForWebGL(b.wallLogoLeftUrl) || undefined}
              wallLogoRightUrl={sanitizeBoothLogoUrlForWebGL(b.wallLogoRightUrl) || undefined}
              sideWallLeftImageUrl={sanitizeBoothLogoUrlForWebGL(b.sideWallLeftImageUrl) || undefined}
              sideWallRightImageUrl={sanitizeBoothLogoUrlForWebGL(b.sideWallRightImageUrl) || undefined}
              exteriorWallLeftImageUrl={sanitizeBoothLogoUrlForWebGL(b.exteriorWallLeftImageUrl) || undefined}
              exteriorWallRightImageUrl={sanitizeBoothLogoUrlForWebGL(b.exteriorWallRightImageUrl) || undefined}
              counterFrontImageUrl={sanitizeBoothLogoUrlForWebGL(b.counterFrontImageUrl) || undefined}
              standeeImageUrl={sanitizeBoothLogoUrlForWebGL(b.standeeImageUrl) || undefined}
              wallPlacementAdjustments={b.wallPlacementAdjustments}
              lighting={b.lighting}
              placedImages={b.placedImages}
              brochureUrl={b.brochureUrl}
              priceListUrl={b.priceListUrl}
              unitLayoutUrl={b.unitLayoutUrl}
              unitLayouts={b.unitLayouts}
              floorPlanUrl={b.floorPlanUrl}
              floorPlans={b.floorPlans}
              faqUrl={b.faqUrl}
              siteMapUrls={siteMapUrlsFromConfig({ siteMapUrl: b.siteMapUrl, siteMapGallery: b.siteMapGallery })}
              media={b.media}
              company={b.company}
              hostessQuickReplies={b.hostessQuickReplies ?? EMPTY_HOSTESS_REPLIES}
              showVideos={showVideos}
              displayLayout={b.displayLayout}
            />
          );
        } else {
          return (
            <StandardLuxuryBooth
              key={b.id}
              position={b.position}
              rotation={b.rotation}
              boothScale={b.scale}
              id={b.id}
              name={b.name}
              color={b.color}
              accent={b.accent}
              counterColor={b.counterColor}
              backWallColor={b.backWallColor}
              headerTextColor={b.headerTextColor}
              videoUrl={b.videoUrl}
              stageScreenUrl={b.stageScreenUrl}
              headerLogoUrl={sanitizeBoothLogoUrlForWebGL(b.headerLogoUrl) || undefined}
              projectLogoUrl={sanitizeBoothLogoUrlForWebGL(b.projectLogoUrl) || undefined}
              headerBranding={b.headerBranding}
              wallLogoLeftUrl={sanitizeBoothLogoUrlForWebGL(b.wallLogoLeftUrl) || undefined}
              wallLogoRightUrl={sanitizeBoothLogoUrlForWebGL(b.wallLogoRightUrl) || undefined}
              sideWallLeftImageUrl={sanitizeBoothLogoUrlForWebGL(b.sideWallLeftImageUrl) || undefined}
              sideWallRightImageUrl={sanitizeBoothLogoUrlForWebGL(b.sideWallRightImageUrl) || undefined}
              exteriorWallLeftImageUrl={sanitizeBoothLogoUrlForWebGL(b.exteriorWallLeftImageUrl) || undefined}
              exteriorWallRightImageUrl={sanitizeBoothLogoUrlForWebGL(b.exteriorWallRightImageUrl) || undefined}
              counterFrontImageUrl={sanitizeBoothLogoUrlForWebGL(b.counterFrontImageUrl) || undefined}
              standeeImageUrl={sanitizeBoothLogoUrlForWebGL(b.standeeImageUrl) || undefined}
              wallPlacementAdjustments={b.wallPlacementAdjustments}
              lighting={b.lighting}
              placedImages={b.placedImages}
              brochureUrl={b.brochureUrl}
              priceListUrl={b.priceListUrl}
              unitLayoutUrl={b.unitLayoutUrl}
              unitLayouts={b.unitLayouts}
              floorPlanUrl={b.floorPlanUrl}
              floorPlans={b.floorPlans}
              faqUrl={b.faqUrl}
              siteMapUrls={siteMapUrlsFromConfig({ siteMapUrl: b.siteMapUrl, siteMapGallery: b.siteMapGallery })}
              media={b.media}
              company={b.company}
              hostessQuickReplies={b.hostessQuickReplies ?? EMPTY_HOSTESS_REPLIES}
              showVideos={showVideos}
              displayLayout={b.displayLayout}
            />
          );
        }
      })}
    </group>
  );
}

export function BoothHeaderLogo({
  url,
  tagline,
  accent,
}: {
  url: string;
  tagline: string;
  accent: string;
}) {
  const tex = useTexture(url);
  useLayoutEffect(() => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    tex.needsUpdate = true;
  }, [tex]);

  const { logoW, logoH } = useMemo(() => {
    const img = tex.image as { width?: number; height?: number } | undefined;
    const aspect =
      img?.width && img?.height && img.height > 0 ? img.width / img.height : 3.4;
    const logoH = 0.7;
    return { logoW: logoH * aspect, logoH };
  }, [tex]);

  const padX = 0.52;
  const padY = 0.26;
  const boardW = logoW + padX;
  const boardH = logoH + padY;
  const trim = 0.038;
  const gold = '#d4af37';
  const warmWhite = '#fffaf4';
  const haloEmissive = '#fff8f0';

  return (
    <group position={[0, 6.5, -3.58]}>
      {/* Soft wash toward wall — mall-style backlit halo (near-field only) */}
      <PooledBoothLight kind="point" position={[0, 0, -0.28]} intensity={2.2} distance={5.5} color={haloEmissive} range={18} />
      <PooledBoothLight kind="point" position={[0, 0.15, -0.22]} intensity={0.85} distance={4} color="#fff5e6" range={18} />

      {/* Deep lightbox — warm emissive “LED wash” behind graphic */}
      <mesh position={[0, 0, -0.14]}>
        <planeGeometry args={[boardW * 0.98, boardH * 0.98]} />
        <meshStandardMaterial
          color={warmWhite}
          emissive={haloEmissive}
          emissiveIntensity={2.4}
          roughness={1}
          metalness={0}
          toneMapped={false}
        />
      </mesh>

      {/* Satin acrylic face — PBR white, very soft env read */}
      <mesh position={[0, 0, -0.055]}>
        <planeGeometry args={[boardW, boardH]} />
        <meshPhysicalMaterial
          color="#fdfdfd"
          roughness={0.72}
          metalness={0}
          clearcoat={0.1}
          clearcoatRoughness={0.8}
          envMapIntensity={0.08}
          reflectivity={0.02}
        />
      </mesh>

      {/* Perimeter “LED” strips — soft gold + white */}
      <mesh position={[0, boardH / 2 + trim / 2, 0.012]}>
        <boxGeometry args={[boardW + trim * 2.2, trim, 0.028]} />
        <meshStandardMaterial
          color={gold}
          emissive="#fff4dc"
          emissiveIntensity={0.55}
          metalness={0.35}
          roughness={0.38}
        />
      </mesh>
      <mesh position={[0, -boardH / 2 - trim / 2, 0.012]}>
        <boxGeometry args={[boardW + trim * 2.2, trim, 0.028]} />
        <meshStandardMaterial
          color={gold}
          emissive="#fff4dc"
          emissiveIntensity={0.55}
          metalness={0.35}
          roughness={0.38}
        />
      </mesh>
      <mesh position={[-boardW / 2 - trim / 2, 0, 0.012]}>
        <boxGeometry args={[trim, boardH + trim * 2, 0.028]} />
        <meshStandardMaterial
          color={gold}
          emissive="#fff4dc"
          emissiveIntensity={0.5}
          metalness={0.35}
          roughness={0.38}
        />
      </mesh>
      <mesh position={[boardW / 2 + trim / 2, 0, 0.012]}>
        <boxGeometry args={[trim, boardH + trim * 2, 0.028]} />
        <meshStandardMaterial
          color={gold}
          emissive="#fff4dc"
          emissiveIntensity={0.5}
          metalness={0.35}
          roughness={0.38}
        />
      </mesh>

      {/* Inner rim glow — subtle white/gold edge wash on acrylic */}
      <mesh position={[0, 0, 0.018]}>
        <planeGeometry args={[boardW * 0.94, boardH * 0.94]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#fffdf8"
          emissiveIntensity={0.35}
          transparent
          opacity={0.45}
          depthWrite={false}
          roughness={1}
          metalness={0}
          toneMapped={false}
        />
      </mesh>

      {/* Logo — strong emissive for backlit + bloom; sits proud of face */}
      <mesh castShadow position={[0, 0, 0.078]}>
        <planeGeometry args={[logoW, logoH]} />
        <meshStandardMaterial
          map={tex}
          emissiveMap={tex}
          emissive="#f4fff8"
          emissiveIntensity={2.15}
          color="#ffffff"
          transparent
          alphaTest={0.06}
          roughness={0.55}
          metalness={0}
          envMapIntensity={0.08}
          toneMapped={false}
          polygonOffset
          polygonOffsetFactor={-1}
        />
      </mesh>

      <Text
        position={[0, -0.52, 0.095]}
        fontSize={0.26}
        color={accent}
        anchorX="center"
        anchorY="middle"
        font="https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfMZhrib2Bg-4.ttf"
      >
        {tagline}
        <meshStandardMaterial
          attach="material"
          color={accent}
          emissive={accent}
          emissiveIntensity={0.75}
          toneMapped={false}
        />
      </Text>
    </group>
  );
}

export function StandardLuxuryBooth({
  position,
  rotation,
  boothScale,
  id,
  name,
  color,
  accent,
  counterColor,
  backWallColor,
  headerTextColor,
  videoUrl,
  stageScreenUrl,
  headerLogoUrl,
  headerBranding,
  wallLogoLeftUrl,
  wallLogoRightUrl,
  sideWallLeftImageUrl,
  sideWallRightImageUrl,
  exteriorWallLeftImageUrl,
  exteriorWallRightImageUrl,
  counterFrontImageUrl,
  wallPlacementAdjustments,
  lighting,
  placedImages,
  brochureUrl = '',
  priceListUrl = '',
  unitLayoutUrl = '',
  unitLayouts = [],
  floorPlanUrl = '',
  floorPlans = [],
  faqUrl = '',
  siteMapUrls = [],
  media = [],
  company,
  hostessQuickReplies,
  showVideos = true,
  displayLayout,
  projectLogoUrl,
  standeeImageUrl,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  boothScale: [number, number, number];
  id: string;
  name: string;
  color: string;
  accent: string;
  counterColor: string;
  backWallColor?: string;
  headerTextColor?: string;
  videoUrl: string;
  stageScreenUrl?: string;
  headerLogoUrl?: string;
  projectLogoUrl?: string;
  headerBranding?: import('@/features/shared/data/boothLayouts').BoothHeaderBranding;
  wallLogoLeftUrl?: string;
  wallLogoRightUrl?: string;
  sideWallLeftImageUrl?: string;
  sideWallRightImageUrl?: string;
  exteriorWallLeftImageUrl?: string;
  exteriorWallRightImageUrl?: string;
  counterFrontImageUrl?: string;
  standeeImageUrl?: string;
  wallPlacementAdjustments?: import('./boothWallMetrics').BoothWallPlacementAdjustments;
  lighting: import('@/features/shared/data/boothLayouts').BoothLighting;
  placedImages: PlacedImage[];
  brochureUrl?: string;
  priceListUrl?: string;
  unitLayoutUrl?: string;
  unitLayouts?: import('@/features/shared/data/boothLayouts').UnitLayoutItem[];
  floorPlanUrl?: string;
  floorPlans?: import('@/features/shared/data/boothLayouts').UnitLayoutItem[];
  faqUrl?: string;
  siteMapUrls?: string[];
  media?: MediaItem[];
  company?: CompanyProfile;
  hostessQuickReplies: HostessQuickReply[];
  showVideos?: boolean;
  displayLayout?: BoothDisplayLayout;
}) {
  const effectiveVideoUrl = showVideos || isScreenImageUrl(videoUrl) ? videoUrl : '';
  const stageLedUrl = resolveBoothLedScreenUrl(stageScreenUrl, videoUrl, showVideos);
  const glow = accent || '#d4af37';
  const { sideWallColor: wallColor, backWallColor: rearWallColor } = resolveBoothWallColors({
    color,
    backWallColor,
  });
  const headerTitleColor = resolveHeaderTextColor({ accent: glow, headerTextColor });
  const floorPadColor = wallColor;

  return (
    <BoothLayoutRoot id={id} position={position} rotation={rotation} scale={boothScale}>
      {/* Back Wall with Luxury Trim */}
      <mesh position={[0, 3, -4]} receiveShadow castShadow>
        <boxGeometry args={[12, 6, 0.5]} />
        <meshStandardMaterial color={rearWallColor} roughness={0.4} metalness={0.6} />
      </mesh>
      
      {/* Accent Wall Pillars */}
      <mesh position={[-5.8, 3, -3.9]}>
        <boxGeometry args={[0.2, 6.2, 0.6]} />
        <meshStandardMaterial color={glow} metalness={0.85} roughness={0.15} emissive={glow} emissiveIntensity={0.12} />
      </mesh>
      <mesh position={[5.8, 3, -3.9]}>
        <boxGeometry args={[0.2, 6.2, 0.6]} />
        <meshStandardMaterial color={glow} metalness={0.85} roughness={0.15} emissive={glow} emissiveIntensity={0.12} />
      </mesh>

      {/* Side walls + entrance wings (image-placable white panels) */}
      <BoothSideWallAssembly color={wallColor} />

      {/* Floor Pad with Recessed LED Strip */}
      <mesh position={[0, 0.05, -1.5]} receiveShadow>
        <boxGeometry args={[12, 0.1, 5.5]} />
        <meshStandardMaterial color={floorPadColor} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.06, 1.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[12, 0.05]} />
        <meshStandardMaterial color={lighting.ledStripColor} emissive={lighting.ledStripColor} emissiveIntensity={lighting.ledStripIntensity} />
      </mesh>

      {/* Attached booth top bar (logo + project name) — not the hanging ceiling board */}
      <BoothSignageFascia
        boothId={id}
        boothName={name}
        accent={glow}
        headerLogoUrl={
          sanitizeBoothLogoUrlForWebGL(headerLogoUrl) ||
          sanitizeBoothLogoUrlForWebGL(wallLogoLeftUrl) ||
          sanitizeBoothLogoUrlForWebGL(wallLogoRightUrl) ||
          undefined
        }
        projectLogoUrl={sanitizeBoothLogoUrlForWebGL(projectLogoUrl) || undefined}
        headerBranding={headerBranding}
        companyTagline={company?.tagline}
        fasciaColor={wallColor}
        width={12.5}
        height={1.5}
        depth={0.72}
        position={[0, 6.5, -3.64]}
      />

      {/* Hanging ceiling name board (project name only) */}
      <BoothDisplayEditable
        boothId={id}
        slot="ceilingBoard"
        layout={displayLayout}
        defaults={LUXURY_BOOTH_DISPLAY_DEFAULTS.ceilingBoard}
      >
        <BoothCeilingHangingBoard
          boothName={name}
          headerBranding={headerBranding}
          companyTagline={company?.tagline}
          accent={glow}
          textColor={headerTitleColor}
        />
      </BoothDisplayEditable>

      {/* Interactive Concierge Desk */}
      <group position={[0, 0.5, 0]}>
        <mesh position={[0, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[4, 1, 1]} />
          <meshStandardMaterial color={counterColor} metalness={0.1} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
          <boxGeometry args={[4.2, 0.1, 1.2]} />
          <meshStandardMaterial color={accent} metalness={0.4} roughness={0.2} />
        </mesh>

        {/* Hostess: behind reception counter, facing aisle (+Z booth local); anchored to desk group */}
        <Suspense fallback={null}>
          <BoothHostessGreeter boothId={id} hostessQuickReplies={hostessQuickReplies} />
        </Suspense>
      </group>

      {/* Main Display Screen (Large TV) */}
      <BoothDisplayEditable
        boothId={id}
        slot="main"
        layout={displayLayout}
        defaults={LUXURY_BOOTH_DISPLAY_DEFAULTS.main}
      >
        <mesh castShadow>
          <boxGeometry args={[6.4, 3.6, 0.2]} />
          <meshStandardMaterial color="#111" metalness={0.9} roughness={0.1} />
        </mesh>
        <group position={[0, 0, 0.11]}>
          <Suspense fallback={<LedScreenSuspenseFallback args={[6.2, 3.4]} />}>
            <LedScreenSurface args={[6.2, 3.4]} url={stageLedUrl} />
          </Suspense>
        </group>
        {/* Screen glow only matters when the panel is actually lit, and only up close. */}
        {stageLedUrl ? (
          <PooledBoothLight
            kind="point"
            position={[0, 0, -0.15]}
            intensity={12}
            distance={4}
            color="#e8f0ff"
            range={16}
          />
        ) : null}
      </BoothDisplayEditable>

      <Suspense fallback={null}>
        <BoothWallLogos
          wallLogoLeftUrl={wallLogoLeftUrl}
          wallLogoRightUrl={wallLogoRightUrl}
        />
        <BoothPlacementImages
          sideWallLeftImageUrl={sideWallLeftImageUrl}
          sideWallRightImageUrl={sideWallRightImageUrl}
          exteriorWallLeftImageUrl={exteriorWallLeftImageUrl}
          exteriorWallRightImageUrl={exteriorWallRightImageUrl}
          counterFrontImageUrl={counterFrontImageUrl}
          wallPlacementAdjustments={wallPlacementAdjustments}
        />
      </Suspense>


      <PooledBoothLight
        kind="spot"
        position={[0, 7.5, -1.2]}
        targetPosition={[0, 3, -3.8]}
        angle={0.45}
        penumbra={0.7}
        intensity={lighting.spotlightIntensity}
        color={lighting.spotlightColor}
        distance={18}
        range={BOOTH_ACCENT_LIGHT_RANGE}
      />

      <BoothStandee
        name={name}
        accent={accent}
        boothId={id}
        displayLayout={displayLayout}
        headerBranding={headerBranding}
        companyTagline={company?.tagline}
        standeeImageUrl={standeeImageUrl}
        projectLogoUrl={projectLogoUrl}
      />

      <VertexEliteProximityPanels
        boothId={id}
        glow={glow}
        brochureUrl={brochureUrl}
        priceListUrl={priceListUrl}
        unitLayoutUrl={unitLayoutUrl}
        unitLayouts={unitLayouts}
        floorPlanUrl={floorPlanUrl}
        floorPlans={floorPlans}
        faqUrl={faqUrl}
        siteMapUrls={siteMapUrls}
        videoUrl={effectiveVideoUrl}
        media={media}
        placedImages={placedImages}
        company={company}
        entranceLocal={[0, 0, 2.5]}
      />

      {/* CMS-placed custom images */}
      {placedImages.map((img) => (
        <Suspense key={img.id} fallback={null}>
          <BoothPlacedImage item={img} />
        </Suspense>
      ))}
    </BoothLayoutRoot>
  );
}

export { BoothPlacedImage } from './BoothPlacedImageMesh';

export function EcoSignageImage({ url }: { url: string }) {
  const tex = useTexture(url);
  useLayoutEffect(() => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
  }, [tex]);
  return (
    <mesh>
      <planeGeometry args={[1.1, 2.3]} />
      <meshStandardMaterial map={tex} transparent alphaTest={0.05} toneMapped={false} />
    </mesh>
  );
}

/* ─── Eco luxury booth (builder-8) — white + green palette ─── */
export function EcoEdenBooth({
  position, rotation, boothScale, id, name, color, accent, counterColor,
  backWallColor, tvWallColor, headerFasciaColor, counterTopColor, headerTextColor,
  videoUrl, stageScreenUrl, headerLogoUrl, headerBranding, projectLogoUrl, wallLogoLeftUrl, wallLogoRightUrl,
  sideWallLeftImageUrl, sideWallRightImageUrl, exteriorWallLeftImageUrl, exteriorWallRightImageUrl, counterFrontImageUrl,
  standeeImageUrl,
  wallPlacementAdjustments,
  lighting, placedImages, brochureUrl, priceListUrl, unitLayoutUrl, unitLayouts = [], floorPlanUrl = '', floorPlans = [], faqUrl = '', siteMapUrls,
  signageImageUrl,
  media = [],
  company,
  hostessQuickReplies,
  showVideos = true,
  displayLayout,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  boothScale: [number, number, number];
  id: string;
  name: string;
  color: string;
  accent: string;
  counterColor: string;
  backWallColor?: string;
  tvWallColor?: string;
  headerFasciaColor?: string;
  counterTopColor?: string;
  headerTextColor?: string;
  videoUrl: string;
  stageScreenUrl?: string;
  headerLogoUrl?: string;
  projectLogoUrl?: string;
  headerBranding?: import('@/features/shared/data/boothLayouts').BoothHeaderBranding;
  wallLogoLeftUrl?: string;
  wallLogoRightUrl?: string;
  sideWallLeftImageUrl?: string;
  sideWallRightImageUrl?: string;
  exteriorWallLeftImageUrl?: string;
  exteriorWallRightImageUrl?: string;
  counterFrontImageUrl?: string;
  /** Same dashboard “Standee poster” field other booths use — drives this standing board. */
  standeeImageUrl?: string;
  wallPlacementAdjustments?: import('./boothWallMetrics').BoothWallPlacementAdjustments;
  lighting: import('@/features/shared/data/boothLayouts').BoothLighting;
  placedImages: PlacedImage[];
  brochureUrl?: string;
  priceListUrl?: string;
  unitLayoutUrl?: string;
  unitLayouts?: import('@/features/shared/data/boothLayouts').UnitLayoutItem[];
  floorPlanUrl?: string;
  floorPlans?: import('@/features/shared/data/boothLayouts').UnitLayoutItem[];
  faqUrl?: string;
  siteMapUrls?: string[];
  signageImageUrl?: string;
  media?: MediaItem[];
  company?: CompanyProfile;
  hostessQuickReplies: HostessQuickReply[];
  showVideos?: boolean;
  displayLayout?: BoothDisplayLayout;
}) {
  const effectiveVideoUrl = showVideos || isScreenImageUrl(videoUrl) ? videoUrl : '';
  const stageLedUrl = resolveBoothLedScreenUrl(stageScreenUrl, videoUrl, showVideos);
  const surfaces = resolveEcoBoothSurfaceColors({
    color,
    accent,
    counterColor,
    backWallColor,
    tvWallColor,
    headerFasciaColor,
    counterTopColor,
  });
  const { wallColor, backWallColor: rearWallColor, tvWallColor: tvPanelColor, counterTopColor: deskTopColor, accent: darkGreen, counterColor: deskBodyColor } = surfaces;
  const leafGreen = company?.brandPrimary?.trim() || '#3d9a5a';
  /** Standing signage screen — fixed so wall-color themes do not repaint this panel. */
  const signageScreenColor = '#fafaf8';
  const glow = leafGreen;
  // Dashboard “Standee poster” + project logo + legacy signageImageUrl drive this board.
  const standingPosterUrl = sanitizeBoothLogoUrlForWebGL(standeeImageUrl || projectLogoUrl || signageImageUrl);
  const standingTitle = resolveBoothHeaderBranding({
    name,
    headerBranding,
    companyTagline: company?.tagline,
  }).projectName;
  // Prefer standee slot (Edit layout → Roll-up standee); keep old signage transforms if saved.
  const standingLayout: BoothDisplayLayout | undefined = displayLayout?.standee
    ? displayLayout
    : displayLayout?.signage
      ? { ...displayLayout, standee: displayLayout.signage }
      : displayLayout;

  return (
    <BoothLayoutRoot id={id} position={position} rotation={rotation} scale={boothScale}>
      {/* ── Main Structure ── */}
      {/* Back Wall */}
      <mesh position={[0, 3, -4]} receiveShadow castShadow>
        <boxGeometry args={[12, 6, 0.5]} />
        <meshStandardMaterial color={rearWallColor} roughness={0.55} metalness={0.08} />
      </mesh>

      {/* TV bay panel — behind main LED (separate from rear wall & side wings) */}
      <mesh position={[0, 3, -3.82]} receiveShadow>
        <planeGeometry args={[7.2, 4.1]} />
        <meshStandardMaterial color={tvPanelColor} roughness={0.5} metalness={0.06} />
      </mesh>

      {/* Side walls + entrance wings */}
      <BoothSideWallAssembly color={wallColor} />

      {/* Dark Green Premium Trims */}
      {/* Vertical pillars */}
      {[-5.8, 5.8].map((x, i) => (
        <mesh key={`pillar-${i}`} position={[x, 3, -3.9]}>
          <boxGeometry args={[0.2, 6.2, 0.6]} />
          <meshStandardMaterial color={darkGreen} metalness={0.8} roughness={0.2} />
        </mesh>
      ))}
      {/* Top horizontal trim */}
      <mesh position={[0, 6.1, -3.9]}>
        <boxGeometry args={[12.2, 0.2, 0.6]} />
        <meshStandardMaterial color={darkGreen} metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Floor Pad with Hidden LED Strip */}
      <mesh position={[0, 0.05, -1.5]} receiveShadow>
        <boxGeometry args={[12, 0.1, 5.5]} />
        <meshStandardMaterial color="#f4f6f4" roughness={0.6} />
      </mesh>
      {/* Subtle floor lighting under platform edge */}
      <mesh position={[0, 0.06, 1.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[12, 0.05]} />
        <meshStandardMaterial color="#fff4d6" emissive="#fff4d6" emissiveIntensity={1.5} />
      </mesh>

      <BoothSignageFascia
        boothId={id}
        boothName={name}
        accent={darkGreen}
        headerLogoUrl={
          sanitizeBoothLogoUrlForWebGL(headerLogoUrl) ||
          sanitizeBoothLogoUrlForWebGL(wallLogoLeftUrl) ||
          sanitizeBoothLogoUrlForWebGL(wallLogoRightUrl) ||
          undefined
        }
        projectLogoUrl={sanitizeBoothLogoUrlForWebGL(projectLogoUrl) || undefined}
        headerBranding={headerBranding}
        companyTagline={company?.tagline}
        fasciaColor={headerFasciaColor?.trim() || wallColor}
        subtitleColor={leafGreen}
        width={12.5}
        height={1.5}
        depth={0.72}
        position={[0, 6.5, -3.64]}
      />

      <BoothDisplayEditable
        boothId={id}
        slot="ceilingBoard"
        layout={displayLayout}
        defaults={LUXURY_BOOTH_DISPLAY_DEFAULTS.ceilingBoard}
      >
        <BoothCeilingHangingBoard
          boothName={name}
          headerBranding={headerBranding}
          companyTagline={company?.tagline}
          accent={darkGreen}
          textColor={resolveHeaderTextColor({ accent: darkGreen, headerTextColor })}
        />
      </BoothDisplayEditable>

      {/* Premium Reception Desk — white body + green top cap (same layout as Luxe Towers gold trim) */}
      <group position={[0, 0.5, 0]}>
        <mesh position={[0, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[4, 1, 1]} />
          <meshStandardMaterial
            color={deskBodyColor}
            metalness={0.1}
            roughness={0.2}
          />
        </mesh>
        <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
          <boxGeometry args={[4.2, 0.1, 1.2]} />
          <meshStandardMaterial
            color={deskTopColor}
            metalness={0.42}
            roughness={0.22}
            emissive={leafGreen}
            emissiveIntensity={0.08}
          />
        </mesh>
        {/* Hostess */}
        <Suspense fallback={null}>
          <BoothHostessGreeter boothId={id} hostessQuickReplies={hostessQuickReplies} />
        </Suspense>
      </group>

      {/* Main Display Screen (Large TV) */}
      <BoothDisplayEditable
        boothId={id}
        slot="main"
        layout={displayLayout}
        defaults={LUXURY_BOOTH_DISPLAY_DEFAULTS.main}
      >
        <mesh castShadow>
          <boxGeometry args={[6.4, 3.6, 0.2]} />
          <meshStandardMaterial color="#111" metalness={0.9} roughness={0.1} />
        </mesh>
        <group position={[0, 0, 0.11]}>
          <Suspense fallback={<LedScreenSuspenseFallback args={[6.2, 3.4]} />}>
            <LedScreenSurface args={[6.2, 3.4]} url={stageLedUrl} />
          </Suspense>
        </group>
        {stageLedUrl ? (
          <PooledBoothLight
            kind="point"
            position={[0, 0, -0.15]}
            intensity={12}
            distance={4}
            color="#e8f0ff"
            range={16}
          />
        ) : null}
      </BoothDisplayEditable>

      <Suspense fallback={null}>
        <BoothWallLogos
          wallLogoLeftUrl={wallLogoLeftUrl}
          wallLogoRightUrl={wallLogoRightUrl}
        />
        <BoothPlacementImages
          sideWallLeftImageUrl={sideWallLeftImageUrl}
          sideWallRightImageUrl={sideWallRightImageUrl}
          exteriorWallLeftImageUrl={exteriorWallLeftImageUrl}
          exteriorWallRightImageUrl={exteriorWallRightImageUrl}
          counterFrontImageUrl={counterFrontImageUrl}
          wallPlacementAdjustments={wallPlacementAdjustments}
        />
      </Suspense>

      {/* Standing board — same Edit-layout + standee-poster controls as other booths */}
      <BoothDisplayEditable
        boothId={id}
        slot="standee"
        layout={standingLayout}
        defaults={LUXURY_BOOTH_DISPLAY_DEFAULTS.signage}
      >
        <mesh position={[0, 1.2, 0]} castShadow>
          <boxGeometry args={[1.2, 2.4, 0.1]} />
          <meshStandardMaterial color="#111" metalness={0.8} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0.05, 0]}>
          <boxGeometry args={[1.4, 0.1, 0.4]} />
          <meshStandardMaterial color="#222" />
        </mesh>
        <group position={[0, 1.2, 0.06]}>
          <mesh>
            <planeGeometry args={[1.1, 2.3]} />
            <meshStandardMaterial color={signageScreenColor} />
          </mesh>
          {standingPosterUrl ? (
            <Suspense fallback={null}>
              <EcoSignageImage url={standingPosterUrl} />
            </Suspense>
          ) : (
            <>
              <Text position={[0, 0.8, 0.01]} fontSize={0.12} color={darkGreen} maxWidth={1} textAlign="center">
                {standingTitle}
              </Text>
              {company?.tagline?.trim() ? (
                <Text position={[0, 0.65, 0.01]} fontSize={0.06} color={leafGreen} maxWidth={1} textAlign="center">
                  {company.tagline.trim()}
                </Text>
              ) : null}
              <mesh position={[0, -0.1, 0.01]}>
                <planeGeometry args={[0.4, 0.4]} />
                <meshStandardMaterial color={leafGreen} transparent opacity={0.8} />
              </mesh>
            </>
          )}
        </group>
      </BoothDisplayEditable>

      <PooledBoothLight
        kind="spot"
        position={[0, 7.5, -1.2]}
        targetPosition={[0, 3, -3.8]}
        angle={0.45}
        penumbra={0.7}
        intensity={lighting.spotlightIntensity}
        color="#fff8ef"
        distance={18}
        range={BOOTH_ACCENT_LIGHT_RANGE}
      />

      <VertexEliteProximityPanels
        boothId={id}
        glow={glow}
        brochureUrl={brochureUrl}
        priceListUrl={priceListUrl}
        unitLayoutUrl={unitLayoutUrl}
        unitLayouts={unitLayouts}
        floorPlanUrl={floorPlanUrl}
        floorPlans={floorPlans}
        faqUrl={faqUrl}
        siteMapUrls={siteMapUrls}
        videoUrl={effectiveVideoUrl}
        media={media}
        placedImages={placedImages}
        company={company}
        entranceLocal={[0, 0, 2.5]}
      />

      {/* CMS-placed custom images */}
      {placedImages.map((img) => (
        <Suspense key={img.id} fallback={null}>
          <BoothPlacedImage item={img} />
        </Suspense>
      ))}
    </BoothLayoutRoot>
  );
}

/* ─── Futuristic Vertex Elite Studio Booth ─── */
export function VertexEliteBooth({
  position, rotation, boothScale, id, name, color, accent, counterColor,
  backWallColor,
  headerTextColor,
  headerLogoUrl,
  headerBranding,
  projectLogoUrl,
  wallLogoLeftUrl,
  wallLogoRightUrl,
  sideWallLeftImageUrl,
  sideWallRightImageUrl,
  exteriorWallLeftImageUrl,
  exteriorWallRightImageUrl,
  counterFrontImageUrl,
  standeeImageUrl,
  wallPlacementAdjustments,
  videoUrl, stageScreenUrl, lighting, placedImages, brochureUrl, priceListUrl, unitLayoutUrl, unitLayouts = [], floorPlanUrl = '', floorPlans = [], faqUrl = '', customFaqQuestions = [], siteMapUrls,
  media = [],
  company,
  hostessQuickReplies,
  cmsPreview,
  cmsPlacedImageEdit,
  showVideos = true,
  showCtaKiosk = true,
  displayLayout,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  boothScale: [number, number, number];
  id: string;
  name: string;
  color: string;
  accent: string;
  counterColor: string;
  backWallColor?: string;
  headerTextColor?: string;
  headerLogoUrl?: string;
  headerBranding?: import('@/features/shared/data/boothLayouts').BoothHeaderBranding;
  projectLogoUrl?: string;
  wallLogoLeftUrl?: string;
  wallLogoRightUrl?: string;
  sideWallLeftImageUrl?: string;
  sideWallRightImageUrl?: string;
  exteriorWallLeftImageUrl?: string;
  exteriorWallRightImageUrl?: string;
  counterFrontImageUrl?: string;
  standeeImageUrl?: string;
  wallPlacementAdjustments?: import('@/features/booths/components/boothWallMetrics').BoothWallPlacementAdjustments;
  videoUrl: string;
  stageScreenUrl?: string;
  lighting: import('@/features/shared/data/boothLayouts').BoothLighting;
  placedImages: PlacedImage[];
  brochureUrl?: string;
  priceListUrl?: string;
  unitLayoutUrl?: string;
  unitLayouts?: import('@/features/shared/data/boothLayouts').UnitLayoutItem[];
  floorPlanUrl?: string;
  floorPlans?: import('@/features/shared/data/boothLayouts').UnitLayoutItem[];
  faqUrl?: string;
  customFaqQuestions?: import('@/features/shared/data/boothLayouts').CustomFaqQuestion[];
  siteMapUrls: string[];
  media?: MediaItem[];
  company?: CompanyProfile;
  hostessQuickReplies?: HostessQuickReply[];
  /** When true, skip the invisible “enter booth” hitbox (expo hall only). */
  cmsPreview?: boolean;
  cmsPlacedImageEdit?: {
    selectedImageId: string | null;
    onSelectImage: (id: string | null) => void;
    onDragImage: (id: string, pos: [number, number, number]) => void;
  };
  showVideos?: boolean;
  showCtaKiosk?: boolean;
  displayLayout?: BoothDisplayLayout;
}) {
  const glow = accent;
  const { sideWallColor: wallColor, backWallColor: rearWallColor } = resolveBoothWallColors({
    color,
    backWallColor,
  });
  const headerTitleColor = resolveHeaderTextColor({ accent: glow, headerTextColor });
  const deskBodyColor = counterColor?.trim() || '#ffffff';
  const floorPadColor = '#efede6';
  const hq = hostessQuickReplies ?? EMPTY_HOSTESS_REPLIES;
  const effectiveVideoUrl = showVideos || isScreenImageUrl(videoUrl) ? videoUrl : '';
  const stageLedUrl = resolveBoothLedScreenUrl(stageScreenUrl, videoUrl, showVideos);

  return (
    <BoothLayoutRoot id={id} position={position} rotation={rotation} scale={boothScale}>
      <mesh position={[0, 3, -4]} receiveShadow castShadow>
        <boxGeometry args={[12, 6, 0.5]} />
        <meshStandardMaterial color={rearWallColor} roughness={0.55} metalness={0.08} />
      </mesh>

      <BoothSideWallAssembly color={wallColor} />

      {[-5.8, 5.8].map((x, i) => (
        <mesh key={`pillar-${i}`} position={[x, 3, -3.9]}>
          <boxGeometry args={[0.2, 6.2, 0.6]} />
          <meshStandardMaterial color={glow} metalness={0.8} roughness={0.25} />
        </mesh>
      ))}
      <mesh position={[0, 6.08, -3.9]}>
        <boxGeometry args={[12.2, 0.2, 0.6]} />
        <meshStandardMaterial color={glow} metalness={0.8} roughness={0.25} />
      </mesh>

      <mesh position={[0, 0.05, -1.5]} receiveShadow>
        <boxGeometry args={[12, 0.1, 5.5]} />
        <meshStandardMaterial color={floorPadColor} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.06, 1.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[12, 0.05]} />
        <meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={1.25} />
      </mesh>

      <BoothSignageFascia
        boothId={id}
        boothName={name}
        accent={glow}
        headerLogoUrl={
          sanitizeBoothLogoUrlForWebGL(headerLogoUrl) ||
          sanitizeBoothLogoUrlForWebGL(wallLogoLeftUrl) ||
          sanitizeBoothLogoUrlForWebGL(wallLogoRightUrl) ||
          undefined
        }
        projectLogoUrl={sanitizeBoothLogoUrlForWebGL(projectLogoUrl) || undefined}
        headerBranding={headerBranding}
        companyTagline={company?.tagline}
        fasciaColor={wallColor}
        width={12.5}
        height={1.5}
        depth={0.72}
        position={[0, 6.5, -3.64]}
      />

      <BoothDisplayEditable
        boothId={id}
        slot="ceilingBoard"
        layout={displayLayout}
        defaults={LUXURY_BOOTH_DISPLAY_DEFAULTS.ceilingBoard}
      >
        <BoothCeilingHangingBoard
          boothName={name}
          headerBranding={headerBranding}
          companyTagline={company?.tagline}
          accent={glow}
          textColor={headerTitleColor}
        />
      </BoothDisplayEditable>

      <BoothNumberBadge
        boothId={id}
        accent={glow}
        position={[0, 0.45, -0.53]}
        rotation={[0, Math.PI, 0]}
        scale={1.15}
      />

      <BoothDisplayEditable
        boothId={id}
        slot="main"
        layout={displayLayout}
        defaults={{ ...VERTEX_ELITE_DISPLAY_DEFAULTS.main, position: [0, 3, -3.7] }}
      >
        <mesh castShadow>
          <boxGeometry args={[6.6, 3.8, 0.2]} />
          <meshStandardMaterial color="#0b0b12" metalness={0.85} roughness={0.15} />
        </mesh>
        <group position={[0, 0, 0.11]}>
          <Suspense fallback={<LedScreenSuspenseFallback args={[6.4, 3.6]} />}>
            <LedScreenSurface args={[6.4, 3.6]} url={stageLedUrl} />
          </Suspense>
        </group>
        <mesh position={[0, 0, -0.1]}>
          <planeGeometry args={[7, 4.2]} />
          <meshStandardMaterial color="#f6f2e8" emissive="#f6f2e8" emissiveIntensity={0.38} />
        </mesh>
      </BoothDisplayEditable>

      <group position={[0, 0.5, 0]}>
        <mesh position={[0, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[4, 1, 1]} />
          <meshStandardMaterial color={deskBodyColor} metalness={0.2} roughness={0.45} />
        </mesh>
        <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
          <boxGeometry args={[4.2, 0.1, 1.2]} />
          <meshStandardMaterial color={glow} metalness={0.55} roughness={0.22} />
        </mesh>
        <Suspense fallback={null}>
          <BoothHostessGreeter boothId={id} cmsPreview={cmsPreview} hostessQuickReplies={hq} />
        </Suspense>
      </group>

      {showCtaKiosk && (
        <BoothDisplayEditable
          boothId={id}
          slot="kiosk"
          layout={displayLayout}
          defaults={VERTEX_ELITE_DISPLAY_DEFAULTS.kiosk}
        >
          <VertexEliteCtaKiosk
            glow={glow}
            brochureUrl={brochureUrl}
            priceListUrl={priceListUrl}
            siteMapUrls={siteMapUrls}
          />
        </BoothDisplayEditable>
      )}

      <Suspense fallback={null}>
        <BoothWallLogos
          wallLogoLeftUrl={wallLogoLeftUrl}
          wallLogoRightUrl={wallLogoRightUrl}
        />
        <BoothPlacementImages
          sideWallLeftImageUrl={sideWallLeftImageUrl}
          sideWallRightImageUrl={sideWallRightImageUrl}
          exteriorWallLeftImageUrl={exteriorWallLeftImageUrl}
          exteriorWallRightImageUrl={exteriorWallRightImageUrl}
          counterFrontImageUrl={counterFrontImageUrl}
          wallPlacementAdjustments={wallPlacementAdjustments}
        />
      </Suspense>

      <BoothStandee
        name={name}
        accent={glow}
        boothId={id}
        displayLayout={displayLayout}
        headerBranding={headerBranding}
        companyTagline={company?.tagline}
        standeeImageUrl={standeeImageUrl}
        projectLogoUrl={projectLogoUrl}
      />

      <VertexEliteProximityPanels
        boothId={id}
        glow={glow}
        brochureUrl={brochureUrl}
        priceListUrl={priceListUrl}
        unitLayoutUrl={unitLayoutUrl}
        unitLayouts={unitLayouts}
        floorPlanUrl={floorPlanUrl}
        floorPlans={floorPlans}
        faqUrl={faqUrl}
        customFaqQuestions={customFaqQuestions}
        siteMapUrls={siteMapUrls}
        videoUrl={videoUrl}
        media={media}
        placedImages={placedImages}
        company={company}
        cmsPreview={cmsPreview}
        entranceLocal={[0, 0, 2.2]}
      />

      {/* No invisible “open booth card” hitbox: canopy / interior clicks should not open the legacy center modal (HUD + kiosk handle CTAs). */}

      {placedImages.map((img) => (
        <Suspense key={img.id} fallback={null}>
          {cmsPlacedImageEdit ? (
            <BoothPlacedImageInteractive
              item={img}
              selected={img.id === cmsPlacedImageEdit.selectedImageId}
              onSelect={() => cmsPlacedImageEdit.onSelectImage(img.id)}
              onDrag={(pos) => cmsPlacedImageEdit.onDragImage(img.id, pos)}
            />
          ) : (
            <BoothPlacedImage item={img} />
          )}
        </Suspense>
      ))}
    </BoothLayoutRoot>
  );
}

/** Roll-up style stand facing visitors approaching from the hall center */
export function BoothStandee({
  name,
  accent,
  boothId,
  displayLayout,
  headerBranding,
  companyTagline,
  standeeImageUrl,
  projectLogoUrl,
}: {
  name: string;
  accent: string;
  boothId: string;
  displayLayout?: BoothDisplayLayout;
  headerBranding?: import('@/features/shared/data/boothLayouts').BoothHeaderBranding;
  companyTagline?: string;
  standeeImageUrl?: string;
  /** Used on the standee when no dedicated standee poster is uploaded. */
  projectLogoUrl?: string;
}) {
  const showBoothStandee = useStore(
    (s) => mergeSceneConfig(s.sceneOverrides).showBoothStandee,
  );
  if (!showBoothStandee) return null;

  const w = 1.45;
  const h = 2.4;
  const frameT = 0.05;
  // Prefer dedicated standee art; otherwise show the project logo on every booth standee.
  const posterUrl = sanitizeBoothLogoUrlForWebGL(standeeImageUrl || projectLogoUrl);
  // Standee follows the project name set in Booth Setup, not the built-in booth name.
  const standeeTitle = resolveBoothHeaderBranding({ name, headerBranding, companyTagline }).projectName;
  return (
    <BoothDisplayEditable
      boothId={boothId}
      slot="standee"
      layout={displayLayout}
      defaults={LUXURY_BOOTH_DISPLAY_DEFAULTS.standee}
    >
      {/* Weighted base plate */}
      <mesh position={[0, 0.0, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.72, 0.1, 0.45]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.75} roughness={0.25} />
      </mesh>
      {/* Centre pole */}
      <mesh position={[0, 0.005, 0]} castShadow>
        <cylinderGeometry args={[0.045, 0.05, 2.35, 12]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.85} roughness={0.2} />
      </mesh>
      {/* Poster panel + gold frame */}
      <group position={[0, 1.58, 0]}>
        <mesh rotation={[0, 0, 0]}>
          <planeGeometry args={[w, h]} />
          <meshStandardMaterial color="#faf8f4" roughness={0.55} metalness={0.05} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, h / 2 + frameT / 2, 0.01]}>
          <boxGeometry args={[w + frameT * 2, frameT, 0.02]} />
          <meshStandardMaterial color={accent} metalness={0.9} roughness={0.2} />
        </mesh>
        <mesh position={[0, -h / 2 - frameT / 2, 0.01]}>
          <boxGeometry args={[w + frameT * 2, frameT, 0.02]} />
          <meshStandardMaterial color={accent} metalness={0.9} roughness={0.2} />
        </mesh>
        <mesh position={[-w / 2 - frameT / 2, 0, 0.01]}>
          <boxGeometry args={[frameT, h, 0.02]} />
          <meshStandardMaterial color={accent} metalness={0.9} roughness={0.2} />
        </mesh>
        <mesh position={[w / 2 + frameT / 2, 0, 0.01]}>
          <boxGeometry args={[frameT, h, 0.02]} />
          <meshStandardMaterial color={accent} metalness={0.9} roughness={0.2} />
        </mesh>
        {posterUrl ? (
          <StandeePosterErrorBoundary key={posterUrl}>
            <Suspense fallback={null}>
              <StandeePoster url={posterUrl} maxW={w - 0.08} maxH={h - 0.08} />
            </Suspense>
          </StandeePosterErrorBoundary>
        ) : (
          <Text
            position={[0, 0.22, 0.02]}
            fontSize={0.16}
            color="#1a1a1a"
            anchorX="center"
            anchorY="middle"
            maxWidth={w - 0.12}
            textAlign="center"
            font="https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfMZhrib2Bg-4.ttf"
          >
            {standeeTitle}
          </Text>
        )}
      </group>
    </BoothDisplayEditable>
  );
}

/**
 * A failed poster texture must never unmount the whole Canvas — without this the
 * booth (and every booth after it) disappears and the expo renders blank.
 */
class StandeePosterErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

/** Standee poster artwork — fits inside the roll-up frame, preserving aspect ratio. */
function StandeePoster({ url, maxW, maxH }: { url: string; maxW: number; maxH: number }) {
  const tex = useTexture(url);
  useLayoutEffect(() => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    tex.needsUpdate = true;
  }, [tex]);

  const { planeW, planeH } = useMemo(() => {
    const img = tex.image as { width?: number; height?: number } | undefined;
    const aspect = img?.width && img?.height && img.height > 0 ? img.width / img.height : maxW / maxH;
    let h = maxH;
    let w = h * aspect;
    if (w > maxW) {
      w = maxW;
      h = w / aspect;
    }
    return { planeW: w, planeH: h };
  }, [tex, maxW, maxH]);

  return (
    <mesh position={[0, 0, 0.02]}>
      <planeGeometry args={[planeW, planeH]} />
      <meshStandardMaterial map={tex} transparent alphaTest={0.05} toneMapped={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

function prepareHallTreeModel(source: THREE.Object3D, heightScale: number) {
  const root = source.clone(true) as THREE.Object3D;
  root.rotation.set(0, 0, 0);
  root.scale.set(1, 1, 1);
  root.updateMatrixWorld(true);
  root.traverse((obj) => {
    const m = obj as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = true;
    }
  });
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  const h = Math.max(size.y, 1e-6);
  root.scale.setScalar((HALL_TREE_TARGET_HEIGHT / h) * heightScale);
  root.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(root);
  const c = new THREE.Vector3();
  box2.getCenter(c);
  root.position.sub(c);
  root.updateMatrixWorld(true);
  const box3 = new THREE.Box3().setFromObject(root);
  root.position.y -= box3.min.y;
  root.updateMatrixWorld(true);
  return root;
}

function Plant({
  name,
  position,
  scale = 1,
}: {
  name: string;
  position: [number, number, number];
  scale?: number;
}) {
  const modelCompression = useModelCompression();
  const boost = usePerformanceBoost();
  const { scene } = useGLTF(HALL_TREE_MODEL_URL) as { scene: THREE.Object3D };
  const model = useMemo(() => {
    const root = prepareHallTreeModel(scene, scale);
    return optimizeGlbRoot(root, modelCompression, { boost });
  }, [scene, scale, modelCompression, boost]);
  return (
    <group name={name} position={position}>
      <primitive object={model} />
    </group>
  );
}

function FeaturedProperty({ position }: { position: [number, number, number] }) {
  const r = HELP_DESK_RADIUS;
  const deskH = HELP_DESK_COUNTER_HEIGHT / 2;
  const topY = HELP_DESK_COUNTER_HEIGHT;
  const panelZ = r * 1.01;
  const stationR = r * 0.92;

  return (
    <group position={position}>
      <group position={[0, 0, 0]}>
        <group rotation={[0, -Math.PI / 6, 0]}>
          <mesh position={[0, deskH, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[r, r, deskH * 2, 64, 1, true, 0, Math.PI * 2]} />
            <meshStandardMaterial color="#ffffff" roughness={0.1} metalness={0.1} side={THREE.DoubleSide} />
          </mesh>

          <mesh position={[0, deskH, 0]}>
            <cylinderGeometry args={[r + 0.02, r + 0.02, deskH * 0.55, 64, 1, true, 0, Math.PI * 2]} />
            <meshStandardMaterial color="#d4af37" metalness={0.25} roughness={0.65} envMapIntensity={0.08} side={THREE.DoubleSide} />
          </mesh>

          <mesh position={[0, topY, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <ringGeometry args={[r * 0.86, r + 0.02, 64, 1, 0, Math.PI * 2]} />
            <meshStandardMaterial color="#ffffff" roughness={0.05} metalness={0.2} side={THREE.DoubleSide} />
          </mesh>

          <mesh position={[0, topY - 0.03, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[r * 0.97, r, 64, 1, 0, Math.PI * 2]} />
            <meshStandardMaterial color="#fff5e6" emissive="#fff5e6" emissiveIntensity={0.35} roughness={0.9} metalness={0} side={THREE.DoubleSide} />
          </mesh>

          <group position={[0, 0, 0]} rotation={[0, Math.PI * 0.8, 0]}>
            <mesh position={[0, deskH, panelZ]} castShadow>
              <boxGeometry args={[r * 1.15, deskH * 2.2, 0.04]} />
              <meshStandardMaterial color="#0a0a0f" roughness={0.25} metalness={0.6} />
            </mesh>
            <Text
              position={[0, deskH * 1.35, panelZ + 0.05]}
              fontSize={0.18}
              color="#ffd700"
              font="https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfMZhrib2Bg-4.ttf"
              anchorX="center"
              anchorY="middle"
              letterSpacing={0.08}
            >
              HELP DESK
              <meshStandardMaterial attach="material" color="#ffd700" emissive="#ffd700" emissiveIntensity={0.55} />
            </Text>
            <Text
              position={[0, deskH * 0.92, panelZ + 0.05]}
              fontSize={0.058}
              maxWidth={r * 1.05}
              color="#e0ddd5"
              font="https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfMZhrib2Bg-4.ttf"
              anchorX="center"
              anchorY="middle"
              letterSpacing={0.03}
            >
              Digital Property Expo (NOIDA)
            </Text>
            <Text
              position={[0, deskH * 0.62, panelZ + 0.05]}
              fontSize={0.04}
              color="#999"
              font="https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfMZhrib2Bg-4.ttf"
              anchorX="center"
              anchorY="middle"
              letterSpacing={0.14}
            >
              Powered By
            </Text>
          </group>

          <Suspense fallback={null}>
            <HelpDeskCustomGirl />
          </Suspense>

          {Array.from({ length: 4 }).map((_, i) => {
            const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 4;
            const x = stationR * Math.cos(angle);
            const z = stationR * Math.sin(angle);
            return (
              <group key={i} position={[x, topY * 0.75, z]} rotation={[0, -angle - Math.PI / 2, 0]}>
                <mesh position={[0, 0, 0]}>
                  <boxGeometry args={[0.22, 0.14, 0.012]} />
                  <meshStandardMaterial color="#111" metalness={0.9} roughness={0.1} />
                </mesh>
                <mesh position={[0, -0.09, -0.018]}>
                  <boxGeometry args={[0.04, 0.1, 0.018]} />
                  <meshStandardMaterial color="#d4af37" metalness={1} />
                </mesh>
              </group>
            );
          })}
        </group>
      </group>
    </group>
  );
}

/** Sketchfab / numbered bones like `LeftArm_013`, `Hips_01` (see `scene (3).glb`). */
function hasScene3HostRig(root: THREE.Object3D) {
  let found = false;
  root.traverse((o) => {
    const b = o as THREE.Bone;
    if (b.isBone && (b.name === 'Hips_01' || /^LeftForeArm1_/.test(b.name))) found = true;
  });
  return found;
}

function hasFoldableArmRig(root: THREE.Object3D) {
  let found = false;
  root.traverse((o) => {
    const b = o as THREE.Bone;
    if (b.isBone && /^LeftArm_/.test(b.name)) found = true;
  });
  return found;
}

/**
 * Reception pose for `scene (3).glb`: small **additive** Euler deltas on the main arm chain only.
 * Do not touch forearm *twist* bones (`LeftForeArm1_` …) — they are chest-weighted and cause tearing.
 * Do not use broad regexes (they can hit unintended nodes on dense rigs).
 */
function applyScene3ReceptionPose(root: THREE.Object3D) {
  const addAllNamed = (name: string, dx: number, dy: number, dz: number) => {
    root.traverse((o) => {
      const b = o as THREE.Bone;
      if (b.isBone && b.name === name) {
        b.rotation.x += dx;
        b.rotation.y += dy;
        b.rotation.z += dz;
      }
    });
  };

  // “Hands low, modest clasp” — symmetric; keeps wrists below chest to avoid stop-gesture / behind-back look
  addAllNamed('LeftShoulder_012', 0.025, 0.07, -0.035);
  addAllNamed('RightShoulder_038', 0.025, -0.07, 0.035);
  addAllNamed('LeftArm_013', 0.42, 0.04, -0.14);
  addAllNamed('RightArm_039', 0.42, -0.04, 0.14);
  addAllNamed('LeftForeArm_014', 0.4, 0, 0.02);
  addAllNamed('RightForeArm_040', 0.4, 0, -0.02);
  addAllNamed('LeftHand_017', 0.06, -0.12, 0.04);
  addAllNamed('RightHand_043', 0.06, 0.12, -0.04);
}

/** Optional reception pose for rigs that match older office-girl bone names (absolute rotations). */
function applyFoldedHandsPose(root: THREE.Object3D) {
  const apply = (re: RegExp, rx: number, ry: number, rz: number) => {
    root.traverse((o) => {
      const b = o as THREE.Bone;
      if (b.isBone && re.test(b.name)) {
        b.rotation.set(rx, ry, rz, 'XYZ');
      }
    });
  };
  apply(/^LeftShoulder_/, 0.07, 0.14, -0.14);
  apply(/^RightShoulder_/, 0.07, -0.14, 0.14);
  apply(/^LeftArm_/, 1.22, -0.22, -0.58);
  apply(/^LeftForeArm_/, 0.55, 0.1, 0.08);
  apply(/^RightArm_/, 1.22, 0.22, 0.58);
  apply(/^RightForeArm_/, 0.55, -0.1, -0.08);
  apply(/^LeftHand_[0-9]/, 0.22, -0.38, 0.12);
  apply(/^RightHand_[0-9]/, 0.22, 0.38, -0.12);
}

function prepareHostessModel(
  sourceScene: THREE.Object3D,
  opts?: { skipManualArmPose?: boolean }
) {
  const root = cloneSkinnedHierarchy(sourceScene) as THREE.Object3D;
  root.rotation.set(0, 0, 0);
  root.scale.set(1, 1, 1);
  root.updateMatrixWorld(true);
  root.traverse((obj) => {
    const m = obj as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = true;
    }
  });
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  const horiz = Math.max(size.x, size.z, 1e-6);
  const sy = Math.max(size.y, 1e-6);
  const s = Math.min(HOSTESS_MAX_WIDTH / horiz, HOSTESS_MAX_HEIGHT / sy);
  root.scale.setScalar(s);
  root.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(root);
  const c = new THREE.Vector3();
  box2.getCenter(c);
  root.position.sub(c);
  root.updateMatrixWorld(true);
  if (!opts?.skipManualArmPose) {
    if (hasScene3HostRig(root)) {
      applyScene3ReceptionPose(root);
      root.updateMatrixWorld(true);
    } else if (hasFoldableArmRig(root)) {
      applyFoldedHandsPose(root);
      root.updateMatrixWorld(true);
    }
  }
  const box3 = new THREE.Box3().setFromObject(root);
  root.position.y -= box3.min.y;
  root.updateMatrixWorld(true);
  return root;
}

function applyLuxuryNavyOutfit(root: THREE.Object3D) {
  const navy = new THREE.Color('#0f1a3d');
  const navyLight = new THREE.Color('#1a2d52');
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      if (!(mat instanceof THREE.MeshStandardMaterial)) continue;
      const { r, g, b } = mat.color;
      const isSkinOrHair =
        (r > 0.42 && g > 0.28 && b > 0.22 && r > g) ||
        (r > 0.55 && g > 0.45 && b > 0.38);
      if (isSkinOrHair) continue;
      mat.color.copy(r + g + b > 0.55 ? navyLight : navy);
      mat.metalness = 0.22;
      mat.roughness = 0.58;
    }
  });
}

/** Beyond this camera distance (m) a hostess stops its idle animation — too far to notice. */
const HOSTESS_ANIM_RANGE = 18;
const HOSTESS_ANIM_RANGE_SQ = HOSTESS_ANIM_RANGE * HOSTESS_ANIM_RANGE;
/** Beyond this distance the whole skinned hostess mesh is hidden (no draw call / skinning). */
const HOSTESS_RENDER_RANGE = 24;
const HOSTESS_RENDER_RANGE_SQ = HOSTESS_RENDER_RANGE * HOSTESS_RENDER_RANGE;
const hostessGateTmp = new THREE.Vector3();

function ExpoHostessAvatar({
  position,
  rotation,
  idlePhase = 0,
  navyOutfit = false,
  subtleIdleLoop = false,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  idlePhase?: number;
  navyOutfit?: boolean;
  subtleIdleLoop?: boolean;
}) {
  const breathingRef = useRef<THREE.Group>(null);
  const rootGroupRef = useRef<THREE.Group>(null);
  const modelCompression = useModelCompression();
  const boost = usePerformanceBoost();
  const { scene, animations } = useGLTF(HOSTESS_MODEL_URL) as {
    scene: THREE.Object3D;
    animations: THREE.AnimationClip[];
  };

  const animCount = animations?.length ?? 0;
  const model = useMemo(() => {
    const root = prepareHostessModel(scene, { skipManualArmPose: animCount > 0 });
    if (navyOutfit) applyLuxuryNavyOutfit(root);
    return optimizeGlbRoot(root, modelCompression, { boost });
  }, [scene, animCount, navyOutfit, modelCompression, boost]);

  /** #1 Distance-gate the per-frame idle work — far hostesses skip animation entirely. */
  const animActiveRef = useRef(true);
  const gateFrameRef = useRef(0);

  /** Hips_01 / Mixamo-style rig: without a baked clip, skip spine/forearm procedural idle. */
  const isScene3Hostess = useMemo(() => {
    let ok = false;
    model.traverse((o) => {
      if (o.name === 'Hips_01') ok = true;
    });
    return ok;
  }, [model]);

  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  /** Paused clip holds a natural pose; stopping the action resets the rig to bind pose (T-pose). */
  const freezePoseActiveRef = useRef(false);
  const idleBonesRef = useRef<{
    head?: THREE.Bone;
    spine?: THREE.Bone;
    lFore?: THREE.Bone;
    rFore?: THREE.Bone;
    baseHead?: THREE.Euler;
    baseSpine?: THREE.Euler;
    baseLFore?: THREE.Euler;
    baseRFore?: THREE.Euler;
  }>({});

  useLayoutEffect(() => {
    const rec = idleBonesRef.current;
    rec.head = undefined;
    rec.spine = undefined;
    rec.lFore = undefined;
    rec.rFore = undefined;
    model.traverse((o) => {
      const b = o as THREE.Bone;
      if (!b.isBone) return;
      if (/^Head_[0-9]/.test(b.name)) rec.head = b;
      if (/^Spine2_/.test(b.name)) rec.spine = b;
      if (/^LeftForeArm_[0-9]/.test(b.name)) rec.lFore = b;
      if (/^RightForeArm_[0-9]/.test(b.name)) rec.rFore = b;
    });
    if (rec.head) rec.baseHead = rec.head.rotation.clone();
    if (rec.spine) rec.baseSpine = rec.spine.rotation.clone();
    if (rec.lFore) rec.baseLFore = rec.lFore.rotation.clone();
    if (rec.rFore) rec.baseRFore = rec.rFore.rotation.clone();
  }, [model]);

  useLayoutEffect(() => {
    freezePoseActiveRef.current = false;
    if (!animations?.length) {
      mixerRef.current = null;
      return;
    }
    const mixer = new THREE.AnimationMixer(model);
    mixerRef.current = mixer;
    const clip = animations[0];
    const action = mixer.clipAction(clip);
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.clampWhenFinished = false;
    action.setEffectiveWeight(1);
    action.play();
    const dur = clip.duration > 1e-6 ? clip.duration : 1;
    if (subtleIdleLoop) {
      action.timeScale = 0.42;
      freezePoseActiveRef.current = false;
      return () => {
        freezePoseActiveRef.current = false;
        action.stop();
        mixer.stopAllAction();
        mixerRef.current = null;
      };
    }
    const seekT = Math.min(Math.max(dur * 0.18, 0.12), dur * 0.95);
    mixer.update(seekT);
    action.paused = true;
    freezePoseActiveRef.current = true;
    return () => {
      freezePoseActiveRef.current = false;
      action.stop();
      mixer.stopAllAction();
      mixerRef.current = null;
    };
  }, [model, animations, subtleIdleLoop]);

  useFrame((state) => {
    if (boost) {
      gateFrameRef.current = (gateFrameRef.current + 1) % 12;
      if (gateFrameRef.current === 0 && rootGroupRef.current) {
        rootGroupRef.current.getWorldPosition(hostessGateTmp);
        const dSq = hostessGateTmp.distanceToSquared(state.camera.position);
        const visible = dSq <= HOSTESS_RENDER_RANGE_SQ;
        if (rootGroupRef.current.visible !== visible) rootGroupRef.current.visible = visible;
        animActiveRef.current = dSq <= HOSTESS_ANIM_RANGE_SQ;
      }
      if (!animActiveRef.current) return;
    } else if (rootGroupRef.current && !rootGroupRef.current.visible) {
      rootGroupRef.current.visible = true;
    }

    const t = state.clock.elapsedTime;
    const ph = idlePhase;

    if (breathingRef.current) {
      const br = Math.sin(t * 2.12 + ph) * 0.007;
      breathingRef.current.scale.set(1 + br * 0.35, 1 + br, 1 + br * 0.35);
    }

    if (freezePoseActiveRef.current) return;

    const rec = idleBonesRef.current;
    const procedural = !animations?.length;
    if (procedural) {
      const headAmp = isScene3Hostess ? 0.35 : 1;
      if (rec.head && rec.baseHead) {
        rec.head.rotation.x = rec.baseHead.x + Math.sin(t * 0.92 + ph) * 0.028 * headAmp;
        rec.head.rotation.y = rec.baseHead.y + Math.sin(t * 0.71 + ph * 1.7) * 0.048 * headAmp;
      }
      if (!isScene3Hostess && rec.spine && rec.baseSpine) {
        rec.spine.rotation.x = rec.baseSpine.x + Math.sin(t * 2.05 + ph) * 0.017;
      }
      if (!isScene3Hostess && rec.lFore && rec.baseLFore) {
        rec.lFore.rotation.x = rec.baseLFore.x + Math.sin(t * 1.22 + ph) * 0.032;
        rec.lFore.rotation.z = rec.baseLFore.z + Math.sin(t * 1.04 + ph * 0.5) * 0.036;
      }
      if (!isScene3Hostess && rec.rFore && rec.baseRFore) {
        rec.rFore.rotation.x = rec.baseRFore.x + Math.sin(t * 1.19 + ph * 1.08) * 0.032;
        rec.rFore.rotation.z = rec.baseRFore.z + Math.sin(t * 1.06 + ph * 0.55) * 0.036;
      }
    }
  });

  return (
    <group ref={rootGroupRef} position={position} rotation={rotation}>
      <group ref={breathingRef}>
        <primitive object={model} />
      </group>
    </group>
  );
}

/**
 * Behind the procedural reception counter (parent = desk group). Faces +Z booth local (aisle).
 */
export function BoothHostessGreeter({
  boothId,
  cmsPreview,
  hostessQuickReplies,
}: {
  boothId: string;
  cmsPreview?: boolean;
  hostessQuickReplies: HostessQuickReply[];
}) {
  const showHostess = useStore((s) => mergeSceneConfig(s.sceneOverrides).showBoothHostess);
  if (!showHostess) return null;

  const bubbleLocal: [number, number, number] = [
    BOOTH_HOSTESS_DESK_LOCAL[0],
    BOOTH_HOSTESS_BUBBLE_LOCAL_Y,
    BOOTH_HOSTESS_DESK_LOCAL[2],
  ];
  return (
    <>
      <ExpoHostessAvatar
        position={BOOTH_HOSTESS_DESK_LOCAL}
        rotation={[0, BOOTH_HOSTESS_YAW, 0]}
        idlePhase={stringToPhase(boothId)}
      />
      {!cmsPreview && <HostessGreetingBubble localPosition={bubbleLocal} quickReplies={hostessQuickReplies} />}
    </>
  );
}

/** Same yaw as the CONCIERGE branding panel (`FeaturedProperty` front group). */
const CONCIERGE_PANEL_YAW = Math.PI * 0.8;
/** Just inside the help-desk branding panel. */
const CONCIERGE_HOSTESS_RADIUS = HELP_DESK_RADIUS * 0.82;
const CONCIERGE_HOSTESS_POS: [number, number, number] = [
  CONCIERGE_HOSTESS_RADIUS * Math.sin(CONCIERGE_PANEL_YAW),
  0,
  CONCIERGE_HOSTESS_RADIUS * Math.cos(CONCIERGE_PANEL_YAW),
];
/** GLB forward is +Z — yaw aligns with radial line toward visitors (same as booth hostesses). */
const CONCIERGE_HOSTESS_ROT: [number, number, number] = [0, CONCIERGE_PANEL_YAW, 0];
const CONCIERGE_HOSTESS_BUBBLE_Y = HELP_DESK_COUNTER_HEIGHT + 0.95;

function HelpDeskCustomGirl() {
  const showHostess = useStore((s) => mergeSceneConfig(s.sceneOverrides).showBoothHostess);
  const boothOverrides = useStore((s) => s.boothOverrides);
  const hostessReplies = useMemo(() => {
    const base = buildHelpDeskHostessReplies();
    const dests = buildExpoTeleportDestinations(boothOverrides);
    const boothTeleports: HostessQuickReply[] = dests
      .filter((d) => d.id !== 'help-desk' && d.id !== 'center' && d.id !== 'registration-lobby')
      .filter((d) => d.id.startsWith('builder-') || d.id === 'vertex-elite')
      .map((d) => ({
        id: `help-desk-tp-${d.id}`,
        label: `Go to ${d.label}`,
        response: '',
        action: 'teleport' as const,
        teleportId: d.id,
      }));
    return [...base, ...boothTeleports];
  }, [boothOverrides]);
  if (!showHostess) return null;
  const [px, , pz] = CONCIERGE_HOSTESS_POS;
  const bubblePos: [number, number, number] = [px, CONCIERGE_HOSTESS_BUBBLE_Y, pz];

  return (
    <group name="concierge-desk-hostess">
      <PooledBoothLight
        kind="spot"
        position={[px, 5.2, pz + 1.5]}
        targetPosition={[px, 0, pz]}
        angle={0.48}
        penumbra={0.88}
        intensity={52}
        color="#fff6e8"
        distance={14}
        range={CONCIERGE_LIGHT_RANGE}
      />
      <PooledBoothLight kind="point" position={[px, 2.8, pz + 1.2]} intensity={14} color="#ffe8c8" distance={8} range={CONCIERGE_LIGHT_RANGE} />

      <ExpoHostessAvatar
        position={CONCIERGE_HOSTESS_POS}
        rotation={CONCIERGE_HOSTESS_ROT}
        idlePhase={stringToPhase('concierge-desk')}
        navyOutfit
      />
      <HostessGreetingBubble localPosition={bubblePos} quickReplies={hostessReplies} />
    </group>
  );
}

useGLTF.preload(HOSTESS_MODEL_URL);
