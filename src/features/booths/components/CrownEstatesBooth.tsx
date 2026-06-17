import { Suspense, useMemo } from 'react';
import { Text } from '@react-three/drei';
import type {
  BoothHeaderBranding,
  CompanyProfile,
  MediaItem,
  PlacedImage,
  BoothLighting,
  HostessQuickReply,
  UnitLayoutItem,
} from '@/features/shared/data/boothLayouts';
import { resolveFasciaLayout } from '@/features/shared/data/boothLayouts';
import { sanitizeBoothLogoUrlForWebGL } from '@/features/exhibitorDashboard/exhibitorLogo';
import { isScreenImageUrl, LedScreenSurface, LedScreenSuspenseFallback, resolveBoothLedScreenUrl } from '@/features/media/components/LedVideoPlane';
import { BoothHostessGreeter, BoothStandee } from './Booths';
import { ProximityLight } from './ProximityLight';
import { BoothManagedHeader } from './BoothManagedHeader';
import { BoothPlacementImages } from './BoothPlacementImages';
import { BOOTH_WALL, boothSideWallContinuousArgs, type BoothWallPlacementAdjustments } from './boothWallMetrics';
import { BoothLayoutRoot } from './BoothLayoutRoot';
import { BoothDisplayEditable } from './BoothDisplayEditable';
import { LUXURY_BOOTH_DISPLAY_DEFAULTS, type BoothDisplayLayout } from '@/features/shared/data/boothDisplayLayout';
import { VertexEliteProximityPanels } from './VertexEliteProximityPanels';

/** Shared Crown Estates blue–lavender palette (walls, header, desk). */
export const CROWN_ESTATES_THEME = {
  gradientMid: '#a690f0',
  floor: '#f0ecfa',
  glow: '#b592f6',
} as const;

export function CrownEstatesBooth({
  position,
  rotation,
  boothScale,
  id,
  name,
  color,
  accent,
  counterColor,
  videoUrl,
  stageScreenUrl,
  headerLogoUrl,
  headerBranding,
  headerFasciaColor,
  wallLogoLeftUrl,
  wallLogoRightUrl,
  sideWallLeftImageUrl,
  sideWallRightImageUrl,
  exteriorWallLeftImageUrl,
  exteriorWallRightImageUrl,
  counterFrontImageUrl,
  wallPlacementAdjustments,
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
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  boothScale: [number, number, number];
  id: string;
  name: string;
  color: string;
  accent: string;
  counterColor: string;
  videoUrl: string;
  stageScreenUrl?: string;
  headerLogoUrl?: string;
  headerBranding?: BoothHeaderBranding;
  headerFasciaColor?: string;
  wallLogoLeftUrl?: string;
  wallLogoRightUrl?: string;
  sideWallLeftImageUrl?: string;
  sideWallRightImageUrl?: string;
  exteriorWallLeftImageUrl?: string;
  exteriorWallRightImageUrl?: string;
  counterFrontImageUrl?: string;
  wallPlacementAdjustments?: BoothWallPlacementAdjustments;
  lighting: BoothLighting;
  placedImages: PlacedImage[];
  brochureUrl?: string;
  priceListUrl?: string;
  unitLayoutUrl?: string;
  unitLayouts?: UnitLayoutItem[];
  floorPlanUrl?: string;
  floorPlans?: UnitLayoutItem[];
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
  
  const safeHeaderLogo = sanitizeBoothLogoUrlForWebGL(headerLogoUrl);
  const effectiveHeaderBranding = useMemo((): BoothHeaderBranding => {
    const hb = headerBranding ?? {};
    if (!safeHeaderLogo) return hb;
    return {
      ...hb,
      centerHeaderLogo: hb.centerHeaderLogo ?? true,
      hideCenterText: hb.hideCenterText ?? true,
      hideRera: hb.hideRera ?? true,
    };
  }, [headerBranding, safeHeaderLogo]);
  const { hideCenterText } = resolveFasciaLayout(effectiveHeaderBranding);

  const champagneGold = accent?.trim() || '#dcb670';
  const glowColor = CROWN_ESTATES_THEME.glow;

  /** Solid wall color — one piece per side (no panel seam at the entrance wing). */
  const wallMat = (
    <meshStandardMaterial
      color={CROWN_ESTATES_THEME.gradientMid}
      roughness={0.18}
      metalness={0.1}
    />
  );
  const goldMat = <meshStandardMaterial color={champagneGold} roughness={0.2} metalness={0.85} />;
  const { args: sideWallArgs, centerZ: sideWallCenterZ } = boothSideWallContinuousArgs();
  const floorMat = (
    <meshStandardMaterial color={CROWN_ESTATES_THEME.floor} roughness={0.4} metalness={0.05} />
  );

  return (
    <BoothLayoutRoot id={id} position={position} rotation={rotation} scale={boothScale}>
      {/* Floor Pad */}
      <mesh position={[0, 0.05, -1.5]} receiveShadow>
        <boxGeometry args={[12.2, 0.1, 5.5]} />
        {floorMat}
      </mesh>
      
      {/* Edge LED Strip (Gold) */}
      <mesh position={[0, 0.06, 1.25]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[12.2, 0.05]} />
        <meshStandardMaterial color={champagneGold} emissive={champagneGold} emissiveIntensity={1.5} />
      </mesh>

      {/* Back wall — slight overlap into sides to hide corner gaps */}
      <mesh position={[0, BOOTH_WALL.wallCenterY, -3.98]} receiveShadow castShadow>
        <boxGeometry args={[12.35, BOOTH_WALL.sideHeight, 0.54]} />
        {wallMat}
      </mesh>

      {/* Back wall top trim */}
      <mesh position={[0, 6.05, -3.75]} castShadow>
        <boxGeometry args={[12.35, 0.1, 0.1]} />
        {goldMat}
      </mesh>

      {/* Continuous side walls (single panel per side — no seam at entrance wing) */}
      <mesh
        position={[-BOOTH_WALL.sideCenterX, BOOTH_WALL.wallCenterY, sideWallCenterZ]}
        receiveShadow
        castShadow
      >
        <boxGeometry args={sideWallArgs} />
        {wallMat}
      </mesh>
      <mesh
        position={[BOOTH_WALL.sideCenterX, BOOTH_WALL.wallCenterY, sideWallCenterZ]}
        receiveShadow
        castShadow
      >
        <boxGeometry args={sideWallArgs} />
        {wallMat}
      </mesh>

      <BoothManagedHeader
        boothId={id}
        accent={champagneGold}
        headerLogoUrl={safeHeaderLogo || undefined}
        headerBranding={effectiveHeaderBranding}
        companyTagline={company?.tagline}
        fasciaColor={headerFasciaColor?.trim() || CROWN_ESTATES_THEME.gradientMid}
        subtitleColor="#f5f0ff"
        position={[0, 6.5, -3.64]}
      />

      <mesh position={[0, 5.75, -3.6]}>
        <boxGeometry args={[12.5, 0.05, 0.05]} />
        {goldMat}
      </mesh>

      {/* Interactive Concierge Desk */}
      <group position={[0, 0.5, 0]}>
        {/* Main Base (Gradient) */}
        <mesh position={[0, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[4, 1, 1]} />
          {wallMat}
        </mesh>
        {/* Gold Top Slab */}
        <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
          <boxGeometry args={[4.2, 0.1, 1.2]} />
          {goldMat}
        </mesh>
        
        {!hideCenterText ? (
          <Text
            position={[0, 0, 0.51]}
            fontSize={0.25}
            color={champagneGold}
            anchorX="center"
            anchorY="middle"
          >
            {name}
            <meshStandardMaterial attach="material" color={champagneGold} metalness={0.9} roughness={0.1} />
          </Text>
        ) : null}

        {/* Counter LED TV */}
        <BoothDisplayEditable
          boothId={id}
          slot="counter"
          layout={displayLayout}
          defaults={LUXURY_BOOTH_DISPLAY_DEFAULTS.counter}
        >
          <mesh castShadow>
            <boxGeometry args={[1.6, 1.0, 0.1]} />
            <meshStandardMaterial color="#111" metalness={0.8} roughness={0.2} />
          </mesh>
          <Suspense fallback={<LedScreenSuspenseFallback args={[1.5, 0.9]} />}>
            <LedScreenSurface args={[1.5, 0.9]} url={stageLedUrl} position={[0, 0, 0.01]} />
          </Suspense>
          <mesh position={[0, -0.6, 0]}>
            <boxGeometry args={[0.4, 0.2, 0.2]} />
            <meshStandardMaterial color="#111" />
          </mesh>
        </BoothDisplayEditable>

        <Suspense fallback={null}>
          <BoothHostessGreeter boothId={id} hostessQuickReplies={hostessQuickReplies} />
        </Suspense>
      </group>

      {/* Main Display Screen (Large TV) */}
      <BoothDisplayEditable
        boothId={id}
        slot="main"
        layout={displayLayout}
        defaults={{ ...LUXURY_BOOTH_DISPLAY_DEFAULTS.main, position: [0, 3, -3.7] }}
      >
        <mesh castShadow>
          <boxGeometry args={[6.6, 3.8, 0.2]} />
          <meshStandardMaterial color="#0a0a0a" metalness={0.9} roughness={0.1} />
        </mesh>
        <group position={[0, 0, 0.11]}>
          <Suspense fallback={<LedScreenSuspenseFallback args={[6.4, 3.6]} />}>
            <LedScreenSurface args={[6.4, 3.6]} url={stageLedUrl} />
          </Suspense>
        </group>
        <mesh position={[0, 0, -0.1]}>
          <planeGeometry args={[7, 4.2]} />
          <meshStandardMaterial color={glowColor} emissive={glowColor} emissiveIntensity={0.6} />
        </mesh>
      </BoothDisplayEditable>

      <Suspense fallback={null}>
        <BoothPlacementImages
          sideWallLeftImageUrl={sideWallLeftImageUrl}
          sideWallRightImageUrl={sideWallRightImageUrl}
          exteriorWallLeftImageUrl={exteriorWallLeftImageUrl}
          exteriorWallRightImageUrl={exteriorWallRightImageUrl}
          counterFrontImageUrl={counterFrontImageUrl}
          wallPlacementAdjustments={wallPlacementAdjustments}
        />
      </Suspense>

      {/* Cinematic Spotlight */}
      <ProximityLight range={26}>
        <spotLight
          position={[0, 7.5, -1.2]}
          angle={0.5}
          penumbra={0.8}
          intensity={60}
          color="#ffffff"
          distance={20}
          decay={2}
          target-position={[0, 3, -3.8]}
          castShadow
        />
      </ProximityLight>

      <BoothStandee name={name} accent={champagneGold} boothId={id} displayLayout={displayLayout} />

      <VertexEliteProximityPanels
        boothId={id}
        glow={champagneGold}
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

      {placedImages.map((img) => (
        <group key={img.id} position={img.position} rotation={img.rotation}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[1.2, 0.8, 0.04]} />
            {goldMat}
          </mesh>
        </group>
      ))}
    </BoothLayoutRoot>
  );
}
