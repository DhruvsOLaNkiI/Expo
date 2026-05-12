import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text, useTexture } from '@react-three/drei';
import { Suspense, useLayoutEffect } from 'react';
import * as THREE from 'three';
import { LedScreenSurface } from './LedVideoPlane';
import { VertexEliteCanopyBranding } from './VertexEliteCanopyBranding';

const FONT =
  'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfMZhrib2Bg-4.ttf';

type BoothCmsPreviewProps = {
  boothId?: string;
  name: string;
  color: string;
  accent: string;
  videoUrl: string;
  headerLogoUrl: string;
};

function PreviewHeaderLogo({ url, accent, tagline }: { url: string; accent: string; tagline: string }) {
  const tex = useTexture(url);
  useLayoutEffect(() => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    tex.needsUpdate = true;
  }, [tex]);

  const { logoW, logoH } = (() => {
    const img = tex.image as { width?: number; height?: number } | undefined;
    const aspect =
      img?.width && img?.height && img.height > 0 ? img.width / img.height : 3.4;
    const logoH = 0.55;
    return { logoW: logoH * aspect, logoH };
  })();

  return (
    <group position={[0, 6.48, -3.62]}>
      <mesh position={[0, 0, 0.06]}>
        <planeGeometry args={[logoW, logoH]} />
        <meshStandardMaterial
          map={tex}
          emissiveMap={tex}
          emissive="#f4fff8"
          emissiveIntensity={1.2}
          color="#ffffff"
          transparent
          alphaTest={0.06}
          roughness={0.55}
          metalness={0}
          toneMapped={false}
        />
      </mesh>
      <Text
        position={[0, -0.42, 0.08]}
        fontSize={0.2}
        color={accent}
        anchorX="center"
        anchorY="middle"
        font={FONT}
      >
        {tagline}
        <meshStandardMaterial
          attach="material"
          color={accent}
          emissive={accent}
          emissiveIntensity={0.5}
          toneMapped={false}
        />
      </Text>
    </group>
  );
}

function PreviewBoothScene({ boothId = '', name, color, accent, videoUrl, headerLogoUrl }: BoothCmsPreviewProps) {
  const isVertexElite = boothId === 'vertex-elite';
  const hasLogo = Boolean(headerLogoUrl?.trim()) && !isVertexElite;

  return (
    <group position={[0, 0, 0]}>
      <mesh position={[0, 3, -4]} receiveShadow castShadow>
        <boxGeometry args={[12, 6, 0.5]} />
        <meshStandardMaterial color={color} roughness={0.45} metalness={0.45} />
      </mesh>

      <mesh position={[-5.8, 3, -3.9]}>
        <boxGeometry args={[0.2, 6.2, 0.6]} />
        <meshStandardMaterial color={accent} metalness={0.85} roughness={0.15} />
      </mesh>
      <mesh position={[5.8, 3, -3.9]}>
        <boxGeometry args={[0.2, 6.2, 0.6]} />
        <meshStandardMaterial color={accent} metalness={0.85} roughness={0.15} />
      </mesh>

      <mesh position={[-5.75, 3, -2]} receiveShadow castShadow>
        <boxGeometry args={[0.5, 6, 4]} />
        <meshStandardMaterial color={color} roughness={0.45} />
      </mesh>
      <mesh position={[5.75, 3, -2]} receiveShadow castShadow>
        <boxGeometry args={[0.5, 6, 4]} />
        <meshStandardMaterial color={color} roughness={0.45} />
      </mesh>

      <mesh position={[0, 0.05, -1.5]} receiveShadow>
        <boxGeometry args={[12, 0.1, 5.5]} />
        <meshStandardMaterial color="#f0ede4" roughness={0.65} />
      </mesh>

      {isVertexElite ? (
        <>
          {/* Back canopy slab (structural) */}
          <mesh position={[0, 6.52, -4.15]} castShadow>
            <boxGeometry args={[12.5, 1.08, 0.7]} />
            <meshPhysicalMaterial color="#08080f" roughness={0.08} metalness={0.92} clearcoat={1} clearcoatRoughness={0.04} envMapIntensity={0.58} />
          </mesh>

          {/* FRONT ENTRANCE FASCIA — sign at booth entrance, visible from outside */}
          <mesh position={[0, 5.9, 0.94]} castShadow>
            <boxGeometry args={[12.5, 1.18, 0.3]} />
            <meshPhysicalMaterial color="#08080f" roughness={0.07} metalness={0.93} clearcoat={1} clearcoatRoughness={0.04} envMapIntensity={0.62} />
          </mesh>
          <mesh position={[0, 6.5, 0.94]}>
            <boxGeometry args={[12.42, 0.052, 0.32]} />
            <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.0} metalness={0.96} roughness={0.05} toneMapped={false} />
          </mesh>
          <mesh position={[0, 5.3, 0.94]}>
            <boxGeometry args={[12.42, 0.052, 0.32]} />
            <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.0} metalness={0.96} roughness={0.05} toneMapped={false} />
          </mesh>
          {[-6.18, 6.18].map((x, i) => (
            <mesh key={`bcms-pv-${i}`} position={[x, 5.9, 0.94]}>
              <boxGeometry args={[0.052, 1.14, 0.32]} />
              <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.88} metalness={0.96} roughness={0.05} toneMapped={false} />
            </mesh>
          ))}
          <Suspense fallback={null}>
            <VertexEliteCanopyBranding glow={accent} position={[0, 5.9, 1.18]} />
          </Suspense>
        </>
      ) : (
        <>
          <mesh position={[0, 6.5, -4]} castShadow>
            <boxGeometry args={[12.5, 1.5, 0.6]} />
            <meshPhysicalMaterial
              color="#fcfcfc"
              roughness={0.25}
              metalness={0}
              clearcoat={0.4}
              clearcoatRoughness={0.25}
            />
          </mesh>
          {hasLogo ? (
            <Suspense fallback={null}>
              <PreviewHeaderLogo url={headerLogoUrl.trim()} accent={accent} tagline={name || 'Booth'} />
            </Suspense>
          ) : (
            <Text
              position={[0, 6.5, -3.58]}
              fontSize={0.55}
              color={accent}
              anchorX="center"
              anchorY="middle"
              font={FONT}
            >
              {name || 'Booth'}
              <meshStandardMaterial
                attach="material"
                color={accent}
                emissive={accent}
                emissiveIntensity={0.2}
                toneMapped={false}
              />
            </Text>
          )}
        </>
      )}

      <group position={[0, 0.5, 0]}>
        <mesh position={[0, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[4, 1, 1]} />
          <meshStandardMaterial color="#ffffff" roughness={0.25} metalness={0.08} />
        </mesh>
        <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
          <boxGeometry args={[4.2, 0.1, 1.2]} />
          <meshStandardMaterial color={accent} metalness={0.35} roughness={0.25} />
        </mesh>
        <group position={[1.2, 0.8, -0.2]} rotation={[-0.2, -0.3, 0]}>
          <mesh castShadow>
            <boxGeometry args={[1.6, 1.0, 0.1]} />
            <meshStandardMaterial color="#111" metalness={0.8} roughness={0.2} />
          </mesh>
          <LedScreenSurface args={[1.5, 0.9]} url={videoUrl} position={[0, 0, 0.01]} />
        </group>
      </group>

      <group position={[0, 3, -3.8]}>
        <mesh castShadow>
          <boxGeometry args={[6.4, 3.6, 0.2]} />
          <meshStandardMaterial color="#111" metalness={0.85} roughness={0.12} />
        </mesh>
        <group position={[0, 0, 0.11]}>
          <LedScreenSurface args={[6.2, 3.4]} url={videoUrl} />
        </group>
      </group>

      <spotLight
        position={[0, 7.5, -1.2]}
        angle={0.5}
        penumbra={0.75}
        intensity={42}
        color="#ffe7bf"
        distance={20}
        decay={2}
        castShadow
        target-position={[0, 3, -3.8]}
      />
      <hemisphereLight intensity={0.35} color="#f5f0ff" groundColor="#8a8578" />
    </group>
  );
}

export function BoothCmsPreview(props: BoothCmsPreviewProps) {
  return (
    <div className="mb-3 h-[min(240px,38vh)] w-full overflow-hidden rounded-lg border border-black/12 bg-[#0e0e12] shadow-inner touch-none">
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: false }}
        camera={{ position: [0, 2.35, 6.4], fov: 38, near: 0.1, far: 80 }}
      >
        <color attach="background" args={['#0e0e12']} />
        <OrbitControls
          makeDefault
          target={[0, 2.85, -2.2]}
          enablePan={false}
          minPolarAngle={0.35}
          maxPolarAngle={Math.PI / 2}
          minDistance={4.2}
          maxDistance={12}
        />
        <ambientLight intensity={0.22} />
        <directionalLight
          position={[5, 11, 8]}
          intensity={0.85}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <Suspense fallback={null}>
          <PreviewBoothScene {...props} />
        </Suspense>
      </Canvas>
      <p className="border-t border-white/10 bg-black/40 px-2 py-1 text-center text-[10px] text-white/55">
        Drag to orbit · same media as main / counter LEDs
      </p>
    </div>
  );
}
