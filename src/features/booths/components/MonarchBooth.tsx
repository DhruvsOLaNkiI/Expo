import { Suspense } from 'react';
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
import {
  resolveBoothHeaderBranding,
  resolveFasciaLayout,
} from '@/features/shared/data/boothLayouts';
import { sanitizeBoothLogoUrlForWebGL } from '@/features/exhibitorDashboard/exhibitorLogo';
import { BoothHostessGreeter, BoothStandee } from './Booths';
import { BOOTH_ACCENT_LIGHT_RANGE } from './ProximityLight';
import { PooledBoothLight } from './BoothLightPool';
import { BoothSignageFascia } from './BoothSignageFascia';
import { BoothPlacementImages } from './BoothPlacementImages';
import { BoothWallLogos } from './BoothWallLogos';
import { BoothSideWallAssembly } from './BoothSideWallAssembly';
import { BoothLayoutRoot } from './BoothLayoutRoot';
import { BoothDisplayEditable } from './BoothDisplayEditable';
import { LUXURY_BOOTH_DISPLAY_DEFAULTS, type BoothDisplayLayout } from '@/features/shared/data/boothDisplayLayout';
import {
  isScreenImageUrl,
  LedScreenSurface,
  LedScreenSuspenseFallback,
  resolveBoothLedScreenUrl,
} from '@/features/media/components/LedVideoPlane';
import { VertexEliteProximityPanels } from './VertexEliteProximityPanels';
import type { BoothWallPlacementAdjustments } from './boothWallMetrics';

/** Default Monarch palette when exhibitor has not overridden colors. */
const MONARCH_DEFAULT = {
  wall: '#3c1015',
  wallDark: '#230a0d',
  trim: '#e0ceaa',
  floor: '#f6f3eb',
  headerText: '#f5e6c8',
} as const;

function pickWallColor(color: string | undefined): string {
  const c = color?.trim();
  if (!c || c === '#fcf9f2' || c === '#fcfaf5') return MONARCH_DEFAULT.wall;
  return c;
}

export function MonarchBooth({
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
  projectLogoUrl,
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
  projectLogoUrl?: string;
  headerBranding?: BoothHeaderBranding;
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

  const wallColor = pickWallColor(color);
  const wallDark = color?.trim() && color.trim() !== '#fcf9f2' && color.trim() !== '#fcfaf5'
    ? wallColor
    : MONARCH_DEFAULT.wallDark;
  const trim = accent?.trim() || MONARCH_DEFAULT.trim;
  const floorPad = wallColor === MONARCH_DEFAULT.wall ? MONARCH_DEFAULT.floor : wallColor;
  const deskBody = counterColor?.trim() || wallColor;
  const fasciaColor = wallDark;
  const { hideCenterText } = resolveFasciaLayout(headerBranding);
  const headerTitle = resolveBoothHeaderBranding({
    name,
    headerBranding,
    companyTagline: company?.tagline,
  }).projectName;
  const safeHeaderLogo = sanitizeBoothLogoUrlForWebGL(headerLogoUrl);

  return (
    <BoothLayoutRoot id={id} position={position} rotation={rotation} scale={boothScale}>
      <mesh position={[0, 0.05, -1.5]} receiveShadow>
        <boxGeometry args={[12.2, 0.1, 5.5]} />
        <meshStandardMaterial color={floorPad} roughness={0.4} metalness={0.1} />
      </mesh>
      <mesh position={[0, 0.06, 1.25]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[12.2, 0.05]} />
        <meshStandardMaterial
          color={lighting.ledStripColor || trim}
          emissive={lighting.ledStripColor || trim}
          emissiveIntensity={lighting.ledStripIntensity ?? 2}
        />
      </mesh>

      <mesh position={[0, 3, -4]} receiveShadow castShadow>
        <boxGeometry args={[12, 6, 0.5]} />
        <meshStandardMaterial color={wallDark} roughness={0.7} metalness={0.2} />
      </mesh>

      <mesh position={[-5.8, 3, -3.8]}>
        <boxGeometry args={[0.3, 6.2, 0.6]} />
        <meshStandardMaterial color={trim} metalness={0.7} roughness={0.3} emissive={trim} emissiveIntensity={0.08} />
      </mesh>
      <mesh position={[5.8, 3, -3.8]}>
        <boxGeometry args={[0.3, 6.2, 0.6]} />
        <meshStandardMaterial color={trim} metalness={0.7} roughness={0.3} emissive={trim} emissiveIntensity={0.08} />
      </mesh>

      <mesh position={[0, 6.05, -3.8]}>
        <boxGeometry args={[12, 0.1, 0.6]} />
        <meshStandardMaterial color={trim} metalness={0.7} roughness={0.3} />
      </mesh>

      <BoothSideWallAssembly color={wallColor} />

      <mesh position={[-5.65, 3, 0]}>
        <boxGeometry args={[0.1, 6, 0.1]} />
        <meshStandardMaterial color={trim} metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[5.65, 3, 0]}>
        <boxGeometry args={[0.1, 6, 0.1]} />
        <meshStandardMaterial color={trim} metalness={0.8} roughness={0.2} />
      </mesh>

      <BoothSignageFascia
        boothName={name}
        accent={trim}
        headerLogoUrl={safeHeaderLogo || undefined}
        projectLogoUrl={sanitizeBoothLogoUrlForWebGL(projectLogoUrl) || undefined}
        headerBranding={headerBranding}
        companyTagline={company?.tagline}
        fasciaColor={fasciaColor}
        subtitleColor="#d4c4a8"
        width={12.5}
        height={1.5}
        depth={0.72}
        position={[0, 6.5, -3.64]}
      />

      <mesh position={[0, 5.8, -3.58]}>
        <boxGeometry args={[12.5, 0.05, 0.05]} />
        <meshStandardMaterial color={trim} emissive={trim} emissiveIntensity={1.5} />
      </mesh>

      <group position={[0, 0.5, 0]}>
        <mesh position={[0, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[4, 1, 1]} />
          <meshStandardMaterial color={deskBody} metalness={0.2} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
          <boxGeometry args={[4.2, 0.1, 1.2]} />
          <meshStandardMaterial color={trim} metalness={0.6} roughness={0.2} />
        </mesh>

        {!hideCenterText ? (
          <Text
            position={[0, 0, 0.51]}
            fontSize={0.25}
            color={trim}
            anchorX="center"
            anchorY="middle"
          >
            {headerTitle}
            <meshStandardMaterial attach="material" color={trim} metalness={0.8} roughness={0.2} />
          </Text>
        ) : null}

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
          <meshStandardMaterial color="#ffedd6" emissive="#ffedd6" emissiveIntensity={0.5} />
        </mesh>
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
        targetPosition={[0, 0, 0]}
        angle={0.5}
        penumbra={0.8}
        intensity={lighting.spotlightIntensity ?? 65}
        color={lighting.spotlightColor ?? '#fff4e6'}
        distance={20}
        range={BOOTH_ACCENT_LIGHT_RANGE}
      />
      <PooledBoothLight kind="point" position={[-4, 4, -3]} intensity={20} color="#ffedd6" distance={8} range={BOOTH_ACCENT_LIGHT_RANGE} />
      <PooledBoothLight kind="point" position={[4, 4, -3]} intensity={20} color="#ffedd6" distance={8} range={BOOTH_ACCENT_LIGHT_RANGE} />

      <BoothStandee name={name} accent={trim} boothId={id} displayLayout={displayLayout} />

      <VertexEliteProximityPanels
        boothId={id}
        glow={trim}
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
            <meshStandardMaterial color="#f7f2e8" roughness={0.4} metalness={0.1} />
          </mesh>
        </group>
      ))}
    </BoothLayoutRoot>
  );
}
