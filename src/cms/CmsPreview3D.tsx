import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text, useTexture, Grid, GizmoHelper, GizmoViewport } from '@react-three/drei';
import { Suspense, useLayoutEffect, useCallback } from 'react';
import * as THREE from 'three';
import { LedScreenSurface } from '../components/LedVideoPlane';
import { BoothPlacedImageInteractive } from '../components/BoothPlacedImageInteractive';
import { VertexEliteBooth } from '../components/Booths';
import type { BoothLighting, PlacedImage, HostessQuickReply } from '../data/boothLayouts';
import { siteMapUrlsFromConfig } from '../data/boothLayouts';

const FONT =
  'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfMZhrib2Bg-4.ttf';

export type PreviewProps = {
  boothId: string;
  name: string;
  color: string;
  accent: string;
  counterColor: string;
  videoUrl: string;
  headerLogoUrl: string;
  lighting: BoothLighting;
  placedImages: PlacedImage[];
  placingImageUrl: string | null;
  onSurfaceClick: (pos: [number, number, number], normal: [number, number, number]) => void;
  selectedImageId: string | null;
  onSelectImage: (id: string | null) => void;
  onDragImage: (id: string, pos: [number, number, number]) => void;
  brochureUrl?: string;
  priceListUrl?: string;
  siteMapUrl?: string;
  siteMapGallery?: string[];
  hostessQuickReplies?: HostessQuickReply[];
};

/* ─── Clickable surface that reports intersection point + normal ─── */
function ClickableSurface({
  children,
  active,
  onHit,
  ...props
}: {
  children: React.ReactNode;
  active: boolean;
  onHit: (pos: [number, number, number], normal: [number, number, number]) => void;
} & React.ComponentProps<'mesh'>) {
  return (
    <mesh
      {...props}
      onClick={(e) => {
        if (!active) return;
        e.stopPropagation();
        const p = e.point;
        const n = e.face?.normal ?? new THREE.Vector3(0, 0, 1);
        const worldNormal = n.clone().transformDirection(e.object.matrixWorld);
        onHit(
          [parseFloat(p.x.toFixed(3)), parseFloat(p.y.toFixed(3)), parseFloat(p.z.toFixed(3))],
          [parseFloat(worldNormal.x.toFixed(3)), parseFloat(worldNormal.y.toFixed(3)), parseFloat(worldNormal.z.toFixed(3))]
        );
      }}
      onPointerOver={(e) => { if (active) { e.stopPropagation(); document.body.style.cursor = 'crosshair'; } }}
      onPointerOut={() => { if (active) document.body.style.cursor = 'auto'; }}
    >
      {children}
    </mesh>
  );
}

/* ─── Header logo ─── */
function PreviewHeaderLogo({ url, accent, tagline }: { url: string; accent: string; tagline: string }) {
  const tex = useTexture(url);
  useLayoutEffect(() => { tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; tex.needsUpdate = true; }, [tex]);
  const img = tex.image as { width?: number; height?: number } | undefined;
  const aspect = img?.width && img?.height && img.height > 0 ? img.width / img.height : 3.4;
  const logoH = 0.55; const logoW = logoH * aspect;

  return (
    <group position={[0, 6.48, -3.62]}>
      <mesh position={[0, 0, 0.06]}>
        <planeGeometry args={[logoW, logoH]} />
        <meshStandardMaterial map={tex} emissiveMap={tex} emissive="#f4fff8" emissiveIntensity={1.2} color="#ffffff" transparent alphaTest={0.06} roughness={0.55} toneMapped={false} />
      </mesh>
      <Text position={[0, -0.42, 0.08]} fontSize={0.2} color={accent} anchorX="center" anchorY="middle" font={FONT}>
        {tagline}
        <meshStandardMaterial attach="material" color={accent} emissive={accent} emissiveIntensity={0.5} toneMapped={false} />
      </Text>
    </group>
  );
}

/* ─── Booth geometry ─── */
function BoothScene({
  boothId, name, color, accent, counterColor, videoUrl, headerLogoUrl, lighting,
  placedImages, placingImageUrl, onSurfaceClick, selectedImageId, onSelectImage, onDragImage,
  brochureUrl = '',
  priceListUrl = '',
  siteMapUrl = '',
  siteMapGallery = [],
  hostessQuickReplies = [],
}: PreviewProps) {
  const isVertexElite = boothId === 'vertex-elite';
  const siteMapUrls = siteMapUrlsFromConfig({ siteMapUrl, siteMapGallery });
  const hasLogo = Boolean(headerLogoUrl?.trim()) && !isVertexElite;
  const placing = Boolean(placingImageUrl);

  const handleHit = useCallback((pos: [number, number, number], normal: [number, number, number]) => {
    onSurfaceClick(pos, normal);
  }, [onSurfaceClick]);

  const clearHitMat = <meshStandardMaterial transparent opacity={0} depthWrite={false} />;

  if (isVertexElite) {
    return (
      <group
        onClick={(e) => {
          if (!placing && selectedImageId) { e.stopPropagation(); onSelectImage(null); }
        }}
      >
        <Suspense fallback={null}>
          <VertexEliteBooth
            position={[0, 0, 0]}
            rotation={[0, 0, 0]}
            boothScale={[1, 1, 1]}
            id={boothId}
            name={name}
            color={color}
            accent={accent}
            counterColor={counterColor}
            videoUrl={videoUrl}
            lighting={lighting}
            placedImages={placedImages}
            brochureUrl={brochureUrl}
            priceListUrl={priceListUrl}
            siteMapUrls={siteMapUrls}
            hostessQuickReplies={hostessQuickReplies}
            cmsPreview
            cmsPlacedImageEdit={{
              selectedImageId,
              onSelectImage,
              onDragImage,
            }}
          />
        </Suspense>
        {placing && (
          <>
            <ClickableSurface active={placing} onHit={handleHit} position={[0, 0.15, -1.5]} receiveShadow>
              <boxGeometry args={[13, 0.28, 7]} />
              {clearHitMat}
            </ClickableSurface>
            <ClickableSurface active={placing} onHit={handleHit} position={[0, 3.2, -4.35]} receiveShadow castShadow>
              <boxGeometry args={[13, 6.4, 0.55]} />
              {clearHitMat}
            </ClickableSurface>
            <ClickableSurface active={placing} onHit={handleHit} position={[-6.2, 3.2, -1.5]} receiveShadow castShadow>
              <boxGeometry args={[0.32, 6.4, 6]} />
              {clearHitMat}
            </ClickableSurface>
            <ClickableSurface active={placing} onHit={handleHit} position={[6.2, 3.2, -1.5]} receiveShadow castShadow>
              <boxGeometry args={[0.32, 6.4, 6]} />
              {clearHitMat}
            </ClickableSurface>
            <ClickableSurface active={placing} onHit={handleHit} position={[0, 3.2, -4.08]} receiveShadow castShadow>
              <boxGeometry args={[8.6, 4.6, 0.35]} />
              {clearHitMat}
            </ClickableSurface>
            <ClickableSurface active={placing} onHit={handleHit} position={[0, 6.84, -4.38]} castShadow>
              <boxGeometry args={[13.2, 1.12, 0.78]} />
              {clearHitMat}
            </ClickableSurface>
            <ClickableSurface active={placing} onHit={handleHit} position={[0, 1.08, 0.8]} receiveShadow>
              <boxGeometry args={[5.2, 0.2, 1.05]} />
              {clearHitMat}
            </ClickableSurface>
          </>
        )}
      </group>
    );
  }

  return (
    <group
      onClick={(e) => {
        if (!placing && selectedImageId) { e.stopPropagation(); onSelectImage(null); }
      }}
    >
      {/* Back wall */}
      <ClickableSurface active={placing} onHit={handleHit} position={[0, 3, -4]} receiveShadow castShadow>
        <boxGeometry args={[12, 6, 0.5]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.5} />
      </ClickableSurface>

      {/* Accent pillars */}
      <mesh position={[-5.8, 3, -3.9]}><boxGeometry args={[0.2, 6.2, 0.6]} /><meshStandardMaterial color={accent} metalness={0.85} roughness={0.15} /></mesh>
      <mesh position={[5.8, 3, -3.9]}><boxGeometry args={[0.2, 6.2, 0.6]} /><meshStandardMaterial color={accent} metalness={0.85} roughness={0.15} /></mesh>

      {/* Side walls */}
      <ClickableSurface active={placing} onHit={handleHit} position={[-5.75, 3, -2]} receiveShadow castShadow>
        <boxGeometry args={[0.5, 6, 4]} />
        <meshStandardMaterial color={color} roughness={0.45} />
      </ClickableSurface>
      <ClickableSurface active={placing} onHit={handleHit} position={[5.75, 3, -2]} receiveShadow castShadow>
        <boxGeometry args={[0.5, 6, 4]} />
        <meshStandardMaterial color={color} roughness={0.45} />
      </ClickableSurface>

      {/* Floor */}
      <ClickableSurface active={placing} onHit={handleHit} position={[0, 0.05, -1.5]} receiveShadow>
        <boxGeometry args={[12, 0.1, 5.5]} />
        <meshStandardMaterial color="#f0ede4" roughness={0.6} />
      </ClickableSurface>
      <mesh position={[0, 0.06, 1.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[12, 0.05]} />
        <meshStandardMaterial color={lighting.ledStripColor} emissive={lighting.ledStripColor} emissiveIntensity={lighting.ledStripIntensity} />
      </mesh>

      {/* Header fascia */}
      <>
        <ClickableSurface active={placing} onHit={handleHit} position={[0, 6.5, -4]} castShadow>
          <boxGeometry args={[12.5, 1.5, 0.6]} />
          <meshPhysicalMaterial color="#fcfcfc" roughness={0.25} metalness={0} clearcoat={0.4} clearcoatRoughness={0.25} />
        </ClickableSurface>
        {hasLogo ? (
          <Suspense fallback={null}>
            <PreviewHeaderLogo url={headerLogoUrl.trim()} accent={accent} tagline={name || 'Booth'} />
          </Suspense>
        ) : (
          <Text position={[0, 6.5, -3.58]} fontSize={0.6} color={accent} anchorX="center" anchorY="middle" font={FONT}>
            {name || 'Booth'}
            <meshStandardMaterial attach="material" color={accent} emissive={accent} emissiveIntensity={lighting.emissiveGlow} toneMapped={false} />
          </Text>
        )}
      </>

      {/* Desk */}
      <group position={[0, 0.5, 0]}>
        <ClickableSurface active={placing} onHit={handleHit} castShadow receiveShadow>
          <boxGeometry args={[4, 1, 1]} />
          <meshStandardMaterial color={counterColor} roughness={0.25} metalness={0.08} />
        </ClickableSurface>
        <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
          <boxGeometry args={[4.2, 0.1, 1.2]} />
          <meshStandardMaterial color={accent} metalness={0.35} roughness={0.25} />
        </mesh>
        <group position={[1.2, 0.8, -0.2]} rotation={[-0.2, -0.3, 0]}>
          <mesh castShadow><boxGeometry args={[1.6, 1.0, 0.1]} /><meshStandardMaterial color="#111" metalness={0.8} roughness={0.2} /></mesh>
          <LedScreenSurface args={[1.5, 0.9]} url={videoUrl} position={[0, 0, 0.01]} />
        </group>
      </group>

      {/* Main TV */}
      <group position={[0, 3, -3.8]}>
        <mesh castShadow><boxGeometry args={[6.4, 3.6, 0.2]} /><meshStandardMaterial color="#111" metalness={0.85} roughness={0.12} /></mesh>
        <group position={[0, 0, 0.11]}><LedScreenSurface args={[6.2, 3.4]} url={videoUrl} /></group>
      </group>

      {/* Pedestal */}
      <group position={[-3, 0.5, -1.5]}>
        <mesh castShadow receiveShadow><cylinderGeometry args={[0.8, 0.8, 1, 32]} /><meshStandardMaterial color="#ffffff" roughness={0.1} metalness={0.1} /></mesh>
        <mesh position={[0, 1.25, 0]} castShadow><boxGeometry args={[0.5, 1.5, 0.5]} /><meshStandardMaterial color="#fff" roughness={0.1} metalness={0.1} /></mesh>
      </group>

      {/* Spotlight */}
      <spotLight position={[0, 7.5, -1.2]} angle={0.45} penumbra={0.7} intensity={lighting.spotlightIntensity} color={lighting.spotlightColor} distance={18} decay={2} castShadow />
      <hemisphereLight intensity={lighting.ambientIntensity} color="#f5f0ff" groundColor="#8a8578" />

      {/* Placed images */}
      {placedImages.map((img) => (
        <Suspense key={img.id} fallback={null}>
          <BoothPlacedImageInteractive
            item={img}
            selected={img.id === selectedImageId}
            onSelect={() => onSelectImage(img.id)}
            onDrag={(pos) => onDragImage(img.id, pos)}
          />
        </Suspense>
      ))}
    </group>
  );
}

/* ─── Exported preview wrapper ─── */
export function CmsPreview3D(props: PreviewProps) {
  const placing = Boolean(props.placingImageUrl);

  return (
    <div className="absolute inset-0">
      <Canvas shadows dpr={[1, 2]} gl={{ antialias: true, alpha: false }} camera={{ position: [0, 4, 12], fov: 42, near: 0.1, far: 100 }}>
        <color attach="background" args={['#111118']} />
        <OrbitControls
          makeDefault
          target={[0, 2.8, -2]}
          enablePan
          minDistance={3}
          maxDistance={22}
          minPolarAngle={0.2}
          maxPolarAngle={Math.PI / 2 + 0.1}
          enabled={!placing}
        />
        <ambientLight intensity={0.15} />
        <directionalLight position={[8, 14, 10]} intensity={0.65} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
        <Grid position={[0, -0.01, 0]} args={[40, 40]} cellSize={1} cellThickness={0.5} cellColor="#ffffff" sectionSize={5} sectionThickness={1} sectionColor="#d4af37" fadeDistance={30} fadeStrength={1.5} followCamera={false} infiniteGrid />
        <GizmoHelper alignment="bottom-right" margin={[80, 80]}><GizmoViewport axisColors={['#ff4444', '#44ff44', '#4444ff']} labelColor="white" /></GizmoHelper>
        <Suspense fallback={null}>
          <BoothScene {...props} />
        </Suspense>
      </Canvas>

      <div className="absolute bottom-4 left-4 flex items-center gap-3 rounded-xl border border-white/[0.08] bg-black/60 px-4 py-2 backdrop-blur-lg">
        {placing ? (
          <span className="text-[10px] text-[#d4af37] font-semibold animate-pulse">Click on a booth surface to place image</span>
        ) : (
          <>
            <span className="text-[10px] text-white/30">LMB: Orbit</span>
            <span className="text-[10px] text-white/20">|</span>
            <span className="text-[10px] text-white/30">RMB: Pan</span>
            <span className="text-[10px] text-white/20">|</span>
            <span className="text-[10px] text-white/30">Scroll: Zoom</span>
            {props.selectedImageId && (
              <>
                <span className="text-[10px] text-white/20">|</span>
                <span className="text-[10px] text-[#d4af37]">Drag image to move</span>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
