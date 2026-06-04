import { Component, type ReactNode, Suspense, useLayoutEffect, useMemo } from 'react';
import { Text, useTexture } from '@react-three/drei';
import type { Loader } from 'three';
import * as THREE from 'three';
import { sanitizeBoothLogoUrlForWebGL } from '@/features/exhibitorDashboard/exhibitorLogo';
import {
  normalizePlacementAdjust,
  type BoothPlacementAdjust,
} from './boothWallMetrics';

const FONT =
  'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfMZhrib2Bg-4.ttf';

function configureTextureLoader(loader: Loader, url: string) {
  if (/^https?:\/\//i.test(url.trim())) {
    (loader as THREE.ImageLoader).setCrossOrigin?.('anonymous');
  }
}

function ImagePlaceholder({ label = 'IMAGE' }: { label?: string }) {
  return (
    <Text fontSize={0.14} color="#9ca3af" anchorX="center" anchorY="middle" font={FONT}>
      {label}
    </Text>
  );
}

class FixedImageErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) return <ImagePlaceholder />;
    return this.props.children;
  }
}

function FixedImagePlane({
  url,
  maxW,
  maxH,
}: {
  url: string;
  maxW: number;
  maxH: number;
}) {
  const tex = useTexture(url, undefined, (loader) => configureTextureLoader(loader, url));
  useLayoutEffect(() => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    tex.needsUpdate = true;
  }, [tex]);

  const { planeW, planeH } = useMemo(() => {
    const img = tex.image as { width?: number; height?: number } | undefined;
    const aspect =
      img?.width && img?.height && img.height > 0 ? img.width / img.height : 0.75;
    let planeH = maxH;
    let planeW = planeH * aspect;
    if (planeW > maxW) {
      planeW = maxW;
      planeH = planeW / aspect;
    }
    return { planeW, planeH };
  }, [maxH, maxW, tex]);

  return (
    <mesh position={[0, 0, 0]}>
      <planeGeometry args={[planeW, planeH]} />
      <meshStandardMaterial
        map={tex}
        emissiveMap={tex}
        emissive="#fff8f0"
        emissiveIntensity={0.9}
        color="#ffffff"
        transparent
        alphaTest={0.06}
        toneMapped={false}
        polygonOffset
        polygonOffsetFactor={-2}
        polygonOffsetUnits={-2}
      />
    </mesh>
  );
}

/** Wall-mounted poster — group position + rotation define the wall face; no Z offset (prevents floating). */
export function BoothFixedImageSlot({
  url,
  position,
  rotation = [0, 0, 0],
  maxW,
  maxH,
  adjust,
}: {
  url?: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  maxW: number;
  maxH: number;
  adjust?: BoothPlacementAdjust;
}) {
  const safeUrl = sanitizeBoothLogoUrlForWebGL(url);
  if (!safeUrl) return null;

  const { offsetX, offsetY, scale } = normalizePlacementAdjust(adjust);

  return (
    <group position={position} rotation={rotation}>
      <FixedImageErrorBoundary key={safeUrl}>
        <Suspense fallback={<ImagePlaceholder />}>
          <group position={[offsetX, offsetY, 0]} scale={[scale, scale, 1]}>
            <FixedImagePlane url={safeUrl} maxW={maxW} maxH={maxH} />
          </group>
        </Suspense>
      </FixedImageErrorBoundary>
    </group>
  );
}

/** Counter / front-facing slot — small offset toward viewer. */
export function BoothFixedImageSlotFront({
  url,
  position,
  maxW,
  maxH,
  adjust,
}: {
  url?: string;
  position: [number, number, number];
  maxW: number;
  maxH: number;
  adjust?: BoothPlacementAdjust;
}) {
  const safeUrl = sanitizeBoothLogoUrlForWebGL(url);
  if (!safeUrl) return null;

  const { offsetX, offsetY, scale } = normalizePlacementAdjust(adjust);

  return (
    <group position={position}>
      <FixedImageErrorBoundary key={safeUrl}>
        <Suspense fallback={<ImagePlaceholder />}>
          <group position={[offsetX, offsetY, 0.02]} scale={[scale, scale, 1]}>
            <FixedImagePlane url={safeUrl} maxW={maxW} maxH={maxH} />
          </group>
        </Suspense>
      </FixedImageErrorBoundary>
    </group>
  );
}
