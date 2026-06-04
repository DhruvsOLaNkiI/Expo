import { Component, type ReactNode, Suspense, useLayoutEffect, useMemo } from 'react';
import { Text, useTexture } from '@react-three/drei';
import type { Loader } from 'three';
import * as THREE from 'three';
import { sanitizeBoothLogoUrlForWebGL } from '@/features/exhibitorDashboard/exhibitorLogo';

const FONT =
  'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfMZhrib2Bg-4.ttf';

function configureTextureLoader(loader: Loader, url: string) {
  if (/^https?:\/\//i.test(url.trim())) {
    (loader as THREE.ImageLoader).setCrossOrigin?.('anonymous');
  }
}

function WallLogoPlaceholder() {
  return (
    <Text fontSize={0.18} color="#9ca3af" anchorX="center" anchorY="middle" font={FONT}>
      LOGO
    </Text>
  );
}

class WallLogoErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) return <WallLogoPlaceholder />;
    return this.props.children;
  }
}

function WallLogoPlane({ url }: { url: string }) {
  const tex = useTexture(url, undefined, (loader) => configureTextureLoader(loader, url));
  useLayoutEffect(() => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    tex.needsUpdate = true;
  }, [tex]);

  const { logoW, logoH } = useMemo(() => {
    const img = tex.image as { width?: number; height?: number } | undefined;
    const aspect =
      img?.width && img?.height && img.height > 0 ? img.width / img.height : 1.4;
    const maxH = 1.15;
    const maxW = 1.65;
    let logoH = maxH;
    let logoW = logoH * aspect;
    if (logoW > maxW) {
      logoW = maxW;
      logoH = logoW / aspect;
    }
    return { logoW, logoH };
  }, [tex]);

  return (
    <mesh position={[0, 0, 0.04]}>
      <planeGeometry args={[logoW, logoH]} />
      <meshStandardMaterial
        map={tex}
        emissiveMap={tex}
        emissive="#fff8f0"
        emissiveIntensity={1.2}
        color="#ffffff"
        transparent
        alphaTest={0.06}
        toneMapped={false}
      />
    </mesh>
  );
}

function WallLogoSlot({ url }: { url: string }) {
  return (
    <WallLogoErrorBoundary key={url}>
      <Suspense fallback={<WallLogoPlaceholder />}>
        <WallLogoPlane url={url} />
      </Suspense>
    </WallLogoErrorBoundary>
  );
}

/** Logos on the back wall flanking the main LED screen (left + right). */
export function BoothWallLogos({
  wallLogoLeftUrl,
  wallLogoRightUrl,
  y = 3,
  z = -3.55,
  leftX = -4.25,
  rightX = 4.25,
}: {
  wallLogoLeftUrl?: string;
  wallLogoRightUrl?: string;
  y?: number;
  z?: number;
  leftX?: number;
  rightX?: number;
}) {
  const left = sanitizeBoothLogoUrlForWebGL(wallLogoLeftUrl);
  const right = sanitizeBoothLogoUrlForWebGL(wallLogoRightUrl);
  if (!left && !right) return null;

  return (
    <>
      {left ? (
        <group position={[leftX, y, z]}>
          <WallLogoSlot url={left} />
        </group>
      ) : null}
      {right ? (
        <group position={[rightX, y, z]}>
          <WallLogoSlot url={right} />
        </group>
      ) : null}
    </>
  );
}
