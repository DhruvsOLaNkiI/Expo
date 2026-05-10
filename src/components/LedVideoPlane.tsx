import { useVideoTexture } from '@react-three/drei';
import { type ThreeElements, useThree } from '@react-three/fiber';
import { useLayoutEffect } from 'react';
import * as THREE from 'three';

type LedVideoPlaneProps = {
  args: [number, number];
  url: string;
  /** Slight depth offset vs bezel to reduce z-fighting flicker */
  polygonOffset?: boolean;
} & Omit<ThreeElements['mesh'], 'args'>;

/**
 * Expo / ballroom LED surfaces: linear sampling, sRGB, anisotropy, no mipmaps
 * (avoids macroblocking and black glitch frames on compressed video).
 */
export function LedVideoPlane({ args, url, polygonOffset = true, ...meshProps }: LedVideoPlaneProps) {
  const gl = useThree((s) => s.gl);
  const texture = useVideoTexture(url);

  useLayoutEffect(() => {
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    const cap = gl.capabilities.getMaxAnisotropy?.() ?? 1;
    texture.anisotropy = Math.min(16, cap);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
  }, [texture, gl]);

  return (
    <mesh position={[0, 0, 0.1]} {...meshProps}>
      <planeGeometry args={args} />
      <meshBasicMaterial
        map={texture}
        toneMapped={false}
        depthWrite
        polygonOffset={polygonOffset}
        polygonOffsetFactor={polygonOffset ? -0.5 : 0}
        polygonOffsetUnits={polygonOffset ? -0.5 : 0}
      />
    </mesh>
  );
}
