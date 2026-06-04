import { Component, Suspense, useLayoutEffect, type ReactNode } from 'react';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { resolveTextureUrlForWebGL } from '@/config/webglTextureUrl';
import type { PlacedImage } from '@/features/shared/data/boothLayouts';

class PlacedImageErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

function PlacedImageMeshInner({ item }: { item: PlacedImage }) {
  const tex = useTexture(item.url);
  useLayoutEffect(() => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
  }, [tex]);

  return (
    <mesh position={item.position} rotation={item.rotation}>
      <planeGeometry args={item.size} />
      <meshStandardMaterial
        map={tex}
        transparent
        alphaTest={0.05}
        toneMapped={false}
        roughness={0.5}
        depthWrite
        polygonOffset
        polygonOffsetFactor={-2}
        polygonOffsetUnits={-2}
      />
    </mesh>
  );
}

/** Static placed image — R2 URLs load via same-origin proxy; failures do not crash WebGL. */
export function BoothPlacedImage({ item }: { item: PlacedImage }) {
  const safeUrl = resolveTextureUrlForWebGL(item.url);
  if (!safeUrl) return null;

  const safeItem = safeUrl === item.url ? item : { ...item, url: safeUrl };

  return (
    <PlacedImageErrorBoundary>
      <Suspense fallback={null}>
        <PlacedImageMeshInner item={safeItem} />
      </Suspense>
    </PlacedImageErrorBoundary>
  );
}

export { PlacedImageErrorBoundary };
