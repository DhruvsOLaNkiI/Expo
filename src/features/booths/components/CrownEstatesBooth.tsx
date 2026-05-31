import { Suspense, useMemo } from 'react';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import type { CompanyProfile, MediaItem, PlacedImage, BoothLighting, HostessQuickReply, UnitLayoutItem } from '@/features/shared/data/boothLayouts';
import { isScreenImageUrl, LedScreenSurface, LedScreenSuspenseFallback, resolveBoothLedScreenUrl } from '@/features/media/components/LedVideoPlane';
import { BoothHeaderLogo, BoothHostessGreeter, BoothStandee } from './Booths';
import { BoothLayoutRoot } from './BoothLayoutRoot';
import { BoothDisplayEditable } from './BoothDisplayEditable';
import { LUXURY_BOOTH_DISPLAY_DEFAULTS, type BoothDisplayLayout } from '@/features/shared/data/boothDisplayLayout';
import { VertexEliteProximityPanels } from './VertexEliteProximityPanels';

function useBoothGradient() {
  return useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Soft blue-purple gradient across diagonal
      const grd = ctx.createLinearGradient(0, 0, 1024, 1024);
      grd.addColorStop(0, '#5a8bed'); // Electric blue
      grd.addColorStop(0.35, '#a690f0'); // Lavender
      grd.addColorStop(0.65, '#e0b4ee'); // Light violet / pinkish glow
      grd.addColorStop(1, '#5a8bed'); // Soft blue
      
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, 1024, 1024);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);
}

export function CrownEstatesBooth({
  position,
  rotation,
  boothScale,
  id,
  name,
  videoUrl,
  stageScreenUrl,
  headerLogoUrl,
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
  
  const gradTex = useBoothGradient();
  
  // Premium Crown Estates color palette
  const champagneGold = '#dcb670';
  const glowColor = '#b592f6';
  
  // Materials
  const gradMat = <meshPhysicalMaterial map={gradTex} roughness={0.15} metalness={0.1} clearcoat={0.3} clearcoatRoughness={0.2} />;
  const goldMat = <meshStandardMaterial color={champagneGold} roughness={0.2} metalness={0.85} />;
  const floorMat = <meshStandardMaterial color="#fcfcfc" roughness={0.4} metalness={0.05} />;

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

      {/* Back Wall Edge Glow */}
      <mesh position={[0, 3, -4.2]}>
        <boxGeometry args={[12.4, 6.2, 0.1]} />
        <meshStandardMaterial color={glowColor} emissive={glowColor} emissiveIntensity={0.8} />
      </mesh>

      {/* Back Wall (Gradient) */}
      <mesh position={[0, 3, -4]} receiveShadow castShadow>
        <boxGeometry args={[12, 6, 0.5]} />
        {gradMat}
      </mesh>

      {/* Back Wall Top Trim (Gold) */}
      <mesh position={[0, 6.05, -3.75]} castShadow>
        <boxGeometry args={[12, 0.1, 0.1]} />
        {goldMat}
      </mesh>

      {/* Side Walls (Gradient) */}
      <mesh position={[-5.85, 3, -2]} receiveShadow castShadow>
        <boxGeometry args={[0.3, 6, 4]} />
        {gradMat}
      </mesh>
      <mesh position={[5.85, 3, -2]} receiveShadow castShadow>
        <boxGeometry args={[0.3, 6, 4]} />
        {gradMat}
      </mesh>

      {/* Side Wall Vertical Edge Trims (Gold) */}
      <mesh position={[-5.68, 3, 0.01]}>
        <boxGeometry args={[0.04, 6, 0.04]} />
        {goldMat}
      </mesh>
      <mesh position={[5.68, 3, 0.01]}>
        <boxGeometry args={[0.04, 6, 0.04]} />
        {goldMat}
      </mesh>
      
      {/* Side Wall Inner Vertical Trims (Gold) */}
      <mesh position={[-5.68, 3, -3.75]}>
        <boxGeometry args={[0.04, 6, 0.04]} />
        {goldMat}
      </mesh>
      <mesh position={[5.68, 3, -3.75]}>
        <boxGeometry args={[0.04, 6, 0.04]} />
        {goldMat}
      </mesh>

      {/* Header Canopy (Gradient) */}
      <mesh position={[0, 6.5, -4]} castShadow>
        <boxGeometry args={[12.5, 1.5, 0.8]} />
        {gradMat}
      </mesh>
      
      {/* Header Canopy Bottom Trim (Gold) */}
      <mesh position={[0, 5.75, -3.6]}>
        <boxGeometry args={[12.5, 0.05, 0.05]} />
        {goldMat}
      </mesh>

      {/* Branding */}
      {headerLogoUrl ? (
        <Suspense fallback={null}>
          <BoothHeaderLogo url={headerLogoUrl} tagline={name} accent={champagneGold} />
        </Suspense>
      ) : (
        <Text
          position={[0, 6.5, -3.55]}
          fontSize={0.8}
          color={champagneGold}
          anchorX="center"
          anchorY="middle"
          font="https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfMZhrib2Bg-4.ttf"
        >
          {name}
          <meshStandardMaterial attach="material" color={champagneGold} metalness={0.8} roughness={0.1} emissive={champagneGold} emissiveIntensity={0.15} />
        </Text>
      )}

      {/* Interactive Concierge Desk */}
      <group position={[0, 0.5, 0]}>
        {/* Main Base (Gradient) */}
        <mesh position={[0, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[4, 1, 1]} />
          {gradMat}
        </mesh>
        {/* Gold Top Slab */}
        <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
          <boxGeometry args={[4.2, 0.1, 1.2]} />
          {goldMat}
        </mesh>
        
        {/* Desk Front Logo text */}
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

      {/* Cinematic Spotlight */}
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
        <group key={img.id} position={img.position} rotation={img.rotation} scale={img.scale}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[1.2, 0.8, 0.04]} />
            {goldMat}
          </mesh>
        </group>
      ))}
    </BoothLayoutRoot>
  );
}
