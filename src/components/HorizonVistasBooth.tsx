import { Suspense } from 'react';
import { Text } from '@react-three/drei';
import type { CompanyProfile, MediaItem, PlacedImage, BoothLighting, HostessQuickReply } from '../data/boothLayouts';
import { isScreenImageUrl, LedScreenSurface } from './LedVideoPlane';
import { BoothHeaderLogo, BoothHostessGreeter, BoothStandee } from './Booths';
import { VertexEliteProximityPanels } from './VertexEliteProximityPanels';

/** Matte trim — no mirror hotspots. */
function trimMat(color: string) {
  return (
    <meshStandardMaterial color={color} roughness={0.55} metalness={0.25} envMapIntensity={0.15} />
  );
}

/** Royal wall panels — rich blue, fully matte. */
function royalMat(color: string, emissive?: string, emissiveIntensity = 0) {
  return (
    <meshStandardMaterial
      color={color}
      roughness={0.92}
      metalness={0.04}
      emissive={emissive ?? color}
      emissiveIntensity={emissiveIntensity}
    />
  );
}

export function HorizonVistasBooth({
  position,
  rotation,
  boothScale,
  id,
  name,
  videoUrl,
  headerLogoUrl,
  placedImages,
  brochureUrl = '',
  priceListUrl = '',
  unitLayoutUrl = '',
  siteMapUrls = [],
  media = [],
  company,
  hostessQuickReplies,
  showVideos = true,
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
  headerLogoUrl?: string;
  lighting: BoothLighting;
  placedImages: PlacedImage[];
  brochureUrl?: string;
  priceListUrl?: string;
  unitLayoutUrl?: string;
  siteMapUrls?: string[];
  media?: MediaItem[];
  company?: CompanyProfile;
  hostessQuickReplies: HostessQuickReply[];
  showVideos?: boolean;
}) {
  const effectiveVideoUrl = showVideos || isScreenImageUrl(videoUrl) ? videoUrl : '';

  // Royal blue palette — deep, saturated, no harsh chrome
  const royalDeep = '#142454';
  const royalMid = '#1e3a7a';
  const royalAccent = '#4a6fd4';
  const royalSoft = '#8fa8e8';
  const platinum = '#d4dff5';
  const iceFloor = '#eef2fc';
  const uiGlow = '#6b8fd4';

  return (
    <group name={`booth-root-${id}`} position={position} rotation={rotation} scale={boothScale}>
      {/* Floor */}
      <mesh position={[0, 0.05, -1.5]} receiveShadow>
        <boxGeometry args={[12.2, 0.1, 5.5]} />
        <meshStandardMaterial color={iceFloor} roughness={0.45} metalness={0.05} />
      </mesh>
      {/* Subtle entrance threshold — not a bright LED */}
      <mesh position={[0, 0.061, 1.25]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[12.2, 0.04]} />
        <meshStandardMaterial
          color={royalAccent}
          emissive={royalAccent}
          emissiveIntensity={0.22}
          roughness={0.9}
          metalness={0}
        />
      </mesh>

      {/* Back wall — unified royal blue (no white panel) */}
      <mesh position={[0, 3, -4]} receiveShadow castShadow>
        <boxGeometry args={[12, 6, 0.5]} />
        {royalMat(royalMid, '#2a4a9e', 0.08)}
      </mesh>
      {/* Soft center lift behind screen — painted glow, not a light bulb */}
      <mesh position={[0, 3, -3.72]}>
        <planeGeometry args={[7.2, 4.1]} />
        <meshStandardMaterial
          color={royalAccent}
          emissive="#5a7ee8"
          emissiveIntensity={0.14}
          roughness={1}
          metalness={0}
          transparent
          opacity={0.35}
        />
      </mesh>

      {/* Side wall panels — deep royal */}
      <mesh position={[-5.85, 3, -2]} receiveShadow castShadow>
        <boxGeometry args={[0.3, 6, 4]} />
        {royalMat(royalDeep)}
      </mesh>
      <mesh position={[5.85, 3, -2]} receiveShadow castShadow>
        <boxGeometry args={[0.3, 6, 4]} />
        {royalMat(royalDeep)}
      </mesh>

      {/* Matte platinum trims (no mirror glare) */}
      <mesh position={[-5.8, 3, -3.8]}>
        <boxGeometry args={[0.22, 6.2, 0.5]} />
        {trimMat(platinum)}
      </mesh>
      <mesh position={[5.8, 3, -3.8]}>
        <boxGeometry args={[0.22, 6.2, 0.5]} />
        {trimMat(platinum)}
      </mesh>
      <mesh position={[0, 6.05, -3.8]}>
        <boxGeometry args={[12, 0.08, 0.55]} />
        {trimMat(platinum)}
      </mesh>
      <mesh position={[-5.65, 3, 0]}>
        <boxGeometry args={[0.06, 6, 0.06]} />
        {trimMat(royalSoft)}
      </mesh>
      <mesh position={[5.65, 3, 0]}>
        <boxGeometry args={[0.06, 6, 0.06]} />
        {trimMat(royalSoft)}
      </mesh>

      {/* Header fascia */}
      <mesh position={[0, 6.5, -4]} castShadow>
        <boxGeometry args={[12.5, 1.5, 0.8]} />
        {royalMat(royalDeep)}
      </mesh>
      {/* Thin trim under header — matte, no emissive strip dots on wall */}
      <mesh position={[0, 5.78, -3.62]}>
        <boxGeometry args={[12.4, 0.04, 0.04]} />
        {trimMat(royalAccent)}
      </mesh>

      {headerLogoUrl ? (
        <Suspense fallback={null}>
          <BoothHeaderLogo url={headerLogoUrl} tagline={name} accent={platinum} />
        </Suspense>
      ) : (
        <Text
          position={[0, 6.5, -3.55]}
          fontSize={0.78}
          color={platinum}
          anchorX="center"
          anchorY="middle"
          font="https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfMZhrib2Bg-4.ttf"
        >
          {name}
          <meshStandardMaterial attach="material" color={platinum} roughness={0.5} metalness={0.15} />
        </Text>
      )}

      {/* Reception desk */}
      <group position={[0, 0.5, 0]}>
        <mesh position={[0, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[4, 1, 1]} />
          {royalMat(royalDeep)}
        </mesh>
        <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
          <boxGeometry args={[4.2, 0.1, 1.2]} />
          {trimMat(platinum)}
        </mesh>
        <Text position={[0, 0, 0.51]} fontSize={0.24} color={platinum} anchorX="center" anchorY="middle">
          {name}
          <meshStandardMaterial attach="material" color={platinum} roughness={0.45} metalness={0.2} />
        </Text>

        <group position={[1.2, 0.8, -0.2]} rotation={[-0.2, -0.3, 0]}>
          <mesh castShadow>
            <boxGeometry args={[1.6, 1.0, 0.1]} />
            <meshStandardMaterial color="#0c1028" roughness={0.85} metalness={0.1} />
          </mesh>
          <Suspense fallback={<meshBasicMaterial color="#000" />}>
            <LedScreenSurface args={[1.5, 0.9]} url={effectiveVideoUrl} position={[0, 0, 0.01]} />
          </Suspense>
          <mesh position={[0, -0.6, 0]}>
            <boxGeometry args={[0.4, 0.2, 0.2]} />
            <meshStandardMaterial color="#0c1028" />
          </mesh>
        </group>

        <Suspense fallback={null}>
          <BoothHostessGreeter boothId={id} hostessQuickReplies={hostessQuickReplies} />
        </Suspense>
      </group>

      {/* Main LED — matte royal frame */}
      <group position={[0, 3, -3.7]}>
        <mesh castShadow>
          <boxGeometry args={[6.65, 3.85, 0.18]} />
          {royalMat(royalDeep)}
        </mesh>
        <mesh position={[0, 0, 0.02]}>
          <boxGeometry args={[6.72, 3.92, 0.02]} />
          {trimMat(royalAccent)}
        </mesh>
        <group position={[0, 0, 0.1]}>
          <Suspense fallback={<meshBasicMaterial color="#000" />}>
            <LedScreenSurface args={[6.4, 3.6]} url={effectiveVideoUrl} />
          </Suspense>
        </group>
      </group>

      <BoothStandee name={name} accent={uiGlow} />

      <VertexEliteProximityPanels
        boothId={id}
        glow={uiGlow}
        brochureUrl={brochureUrl}
        priceListUrl={priceListUrl}
        unitLayoutUrl={unitLayoutUrl}
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
            {trimMat(platinum)}
          </mesh>
        </group>
      ))}
    </group>
  );
}
