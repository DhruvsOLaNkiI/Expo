import { Suspense } from 'react';
import { Text } from '@react-three/drei';
import type { CompanyProfile, MediaItem, PlacedImage, BoothLighting, HostessQuickReply, UnitLayoutItem } from '@/features/shared/data/boothLayouts';
import { BoothHostessGreeter } from './Booths';
import { BoothLayoutRoot } from './BoothLayoutRoot';
import { BoothDisplayEditable } from './BoothDisplayEditable';
import { LUXURY_BOOTH_DISPLAY_DEFAULTS, type BoothDisplayLayout } from '@/features/shared/data/boothDisplayLayout';
import { isScreenImageUrl, LedScreenSurface, LedScreenSuspenseFallback, resolveBoothLedScreenUrl } from '@/features/media/components/LedVideoPlane';
import { VertexEliteProximityPanels } from './VertexEliteProximityPanels';

export function MonarchBooth({
  position,
  rotation,
  boothScale,
  id,
  name,
  videoUrl,
  stageScreenUrl,
  headerLogoUrl,
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
  
  // Premium Monarch color palette
  const maroon = '#3c1015'; // Deep rich maroon
  const darkMaroon = '#230a0d';
  const champagneGold = '#e0ceaa'; // Matte champagne gold
  const lightBeige = '#f6f3eb'; // Clean light beige for floor/canopy

  return (
    <BoothLayoutRoot id={id} position={position} rotation={rotation} scale={boothScale}>
      {/* Floor Pad with Recessed LED Strip */}
      <mesh position={[0, 0.05, -1.5]} receiveShadow>
        <boxGeometry args={[12.2, 0.1, 5.5]} />
        <meshStandardMaterial color={lightBeige} roughness={0.4} metalness={0.1} />
      </mesh>
      {/* Edge LED Strip */}
      <mesh position={[0, 0.06, 1.25]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[12.2, 0.05]} />
        <meshStandardMaterial color={champagneGold} emissive={champagneGold} emissiveIntensity={2} />
      </mesh>

      {/* Back Wall (Maroon Textured) */}
      <mesh position={[0, 3, -4]} receiveShadow castShadow>
        <boxGeometry args={[12, 6, 0.5]} />
        <meshStandardMaterial color={darkMaroon} roughness={0.7} metalness={0.2} />
      </mesh>

      {/* Accent Wall Pillars (Champagne Gold) */}
      <mesh position={[-5.8, 3, -3.8]}>
        <boxGeometry args={[0.3, 6.2, 0.6]} />
        <meshStandardMaterial color={champagneGold} metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[5.8, 3, -3.8]}>
        <boxGeometry args={[0.3, 6.2, 0.6]} />
        <meshStandardMaterial color={champagneGold} metalness={0.7} roughness={0.3} />
      </mesh>
      
      {/* Back Wall Top Trim (Champagne Gold) */}
      <mesh position={[0, 6.05, -3.8]}>
        <boxGeometry args={[12, 0.1, 0.6]} />
        <meshStandardMaterial color={champagneGold} metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Side Walls (Deep Maroon) */}
      <mesh position={[-5.85, 3, -2]} receiveShadow castShadow>
        <boxGeometry args={[0.3, 6, 4]} />
        <meshStandardMaterial color={maroon} roughness={0.6} metalness={0.1} />
      </mesh>
      <mesh position={[5.85, 3, -2]} receiveShadow castShadow>
        <boxGeometry args={[0.3, 6, 4]} />
        <meshStandardMaterial color={maroon} roughness={0.6} metalness={0.1} />
      </mesh>

      {/* Side Wall Vertical Edge Trims (Champagne Gold) */}
      <mesh position={[-5.65, 3, 0]}>
        <boxGeometry args={[0.1, 6, 0.1]} />
        <meshStandardMaterial color={champagneGold} metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[5.65, 3, 0]}>
        <boxGeometry args={[0.1, 6, 0.1]} />
        <meshStandardMaterial color={champagneGold} metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Header sign board — dark maroon so gold lettering reads clearly */}
      <mesh position={[0, 6.5, -4]} castShadow>
        <boxGeometry args={[12.5, 1.5, 0.8]} />
        <meshStandardMaterial color={darkMaroon} roughness={0.55} metalness={0.12} />
      </mesh>
      {/* Champagne gold frame on sign face */}
      <mesh position={[0, 6.5, -3.58]}>
        <boxGeometry args={[12.5, 1.42, 0.04]} />
        <meshStandardMaterial color={champagneGold} metalness={0.75} roughness={0.28} />
      </mesh>
      <mesh position={[0, 6.5, -3.56]}>
        <boxGeometry args={[12.1, 1.22, 0.02]} />
        <meshStandardMaterial color={maroon} roughness={0.6} metalness={0.1} />
      </mesh>

      {/* Front edge lighting for Header Canopy */}
      <mesh position={[0, 5.8, -3.58]}>
        <boxGeometry args={[12.5, 0.05, 0.05]} />
        <meshStandardMaterial color={champagneGold} emissive={champagneGold} emissiveIntensity={1.5} />
      </mesh>

      {/* Branding */}
      <Text
        position={[0, 6.5, -3.52]}
        fontSize={0.72}
        color="#f5e6c8"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.04}
        font="https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfMZhrib2Bg-4.ttf"
      >
        {name}
        <meshStandardMaterial
          attach="material"
          color="#f5e6c8"
          emissive="#e0ceaa"
          emissiveIntensity={0.85}
          metalness={0.35}
          roughness={0.4}
        />
      </Text>

      {/* Interactive Concierge Desk (Maroon & Gold) */}
      <group position={[0, 0.5, 0]}>
        {/* Main Base */}
        <mesh position={[0, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[4, 1, 1]} />
          <meshStandardMaterial color={maroon} metalness={0.2} roughness={0.5} />
        </mesh>
        {/* Gold Top Slab */}
        <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
          <boxGeometry args={[4.2, 0.1, 1.2]} />
          <meshStandardMaterial color={champagneGold} metalness={0.6} roughness={0.2} />
        </mesh>
        
        {/* Desk Front Gold Logo text */}
        <Text
          position={[0, 0, 0.51]}
          fontSize={0.25}
          color={champagneGold}
          anchorX="center"
          anchorY="middle"
        >
          THE MONARCH
          <meshStandardMaterial attach="material" color={champagneGold} metalness={0.8} roughness={0.2} />
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
          <meshStandardMaterial color="#ffedd6" emissive="#ffedd6" emissiveIntensity={0.5} />
        </mesh>
      </BoothDisplayEditable>

      {/* Cinematic Lighting */}
      <spotLight
        position={[0, 7.5, -1.2]}
        angle={0.5}
        penumbra={0.8}
        intensity={65}
        color="#fff4e6"
        distance={20}
        decay={2}
        target-position={[0, 3, -3.8]}
        castShadow
      />
      {/* Wall wash lights for maroon texture */}
      <pointLight position={[-4, 4, -3]} intensity={20} color="#ffedd6" distance={8} decay={2} />
      <pointLight position={[4, 4, -3]} intensity={20} color="#ffedd6" distance={8} decay={2} />

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
            <meshStandardMaterial color="#f7f2e8" roughness={0.4} metalness={0.1} />
          </mesh>
        </group>
      ))}
    </BoothLayoutRoot>
  );
}
