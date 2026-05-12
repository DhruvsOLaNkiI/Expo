import { useTexture, useVideoTexture } from '@react-three/drei';
import { type ThreeElements, useThree } from '@react-three/fiber';
import { Suspense, useLayoutEffect } from 'react';
import * as THREE from 'three';

type LedVideoPlaneProps = {
  args: [number, number];
  url: string;
  /** Slight depth offset vs bezel to reduce z-fighting flicker */
  polygonOffset?: boolean;
} & Omit<ThreeElements['mesh'], 'args'>;

export function isScreenImageUrl(url: string): boolean {
  const u = url.trim().toLowerCase();
  if (u.startsWith('data:image/')) return true;
  const path = u.split('?')[0].toLowerCase();
  return /\.(png|jpe?g|webp|gif)$/.test(path);
}

function FallbackBlackPlane({
  args,
  polygonOffset = true,
  ...meshProps
}: Omit<LedVideoPlaneProps, 'url'>) {
  return (
    <mesh position={[0, 0, 0.1]} {...meshProps}>
      <planeGeometry args={args} />
      <meshBasicMaterial
        color="#030303"
        toneMapped
        depthWrite
        polygonOffset={polygonOffset}
        polygonOffsetFactor={polygonOffset ? -0.5 : 0}
        polygonOffsetUnits={polygonOffset ? -0.5 : 0}
      />
    </mesh>
  );
}

function LedImagePlane({ args, url, polygonOffset = true, ...meshProps }: LedVideoPlaneProps) {
  const gl = useThree((s) => s.gl);
  const tex = useTexture(url);

  useLayoutEffect(() => {
    tex.colorSpace = gl.outputColorSpace;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    const cap = gl.capabilities.getMaxAnisotropy?.() ?? 1;
    tex.anisotropy = Math.min(8, cap);
    tex.needsUpdate = true;
  }, [tex, gl]);

  return (
    <mesh position={[0, 0, 0.1]} {...meshProps}>
      <planeGeometry args={args} />
      <meshBasicMaterial
        map={tex}
        toneMapped
        depthWrite
        polygonOffset={polygonOffset}
        polygonOffsetFactor={polygonOffset ? -0.5 : 0}
        polygonOffsetUnits={polygonOffset ? -0.5 : 0}
      />
    </mesh>
  );
}

/**
 * Expo / ballroom LED surfaces: linear sampling, anisotropy, no mipmaps on video
 * (avoids macroblocking / glitch frames on compressed video).
 * `toneMapped` stays on so post Bloom does not “eat” the edges with HDR fringing.
 */
export function LedVideoPlane({ args, url, polygonOffset = true, ...meshProps }: LedVideoPlaneProps) {
  const gl = useThree((s) => s.gl);
  const texture = useVideoTexture(url, { unsuspend: 'canplay', crossOrigin: 'anonymous' });

  useLayoutEffect(() => {
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    const cap = gl.capabilities.getMaxAnisotropy?.() ?? 1;
    texture.anisotropy = Math.min(8, cap);
    texture.colorSpace = gl.outputColorSpace;
    texture.needsUpdate = true;
  }, [texture, gl]);

  return (
    <mesh position={[0, 0, 0.1]} {...meshProps}>
      <planeGeometry args={args} />
      <meshBasicMaterial
        map={texture}
        toneMapped
        depthWrite
        polygonOffset={polygonOffset}
        polygonOffsetFactor={polygonOffset ? -0.5 : 0}
        polygonOffsetUnits={polygonOffset ? -0.5 : 0}
      />
    </mesh>
  );
}

/**
 * Same placement as {@link LedVideoPlane}; uses a **still image** when the URL looks like an image
 * (file extension, `data:image/…`) and **video** otherwise.
 */
export function LedScreenSurface({ args, url, polygonOffset = true, ...meshProps }: LedVideoPlaneProps) {
  const trimmed = url?.trim() ?? '';
  if (!trimmed) {
    return <FallbackBlackPlane args={args} polygonOffset={polygonOffset} {...meshProps} />;
  }
  if (isScreenImageUrl(trimmed)) {
    return (
      <Suspense fallback={<FallbackBlackPlane args={args} polygonOffset={polygonOffset} {...meshProps} />}>
        <LedImagePlane key={trimmed} url={trimmed} args={args} polygonOffset={polygonOffset} {...meshProps} />
      </Suspense>
    );
  }
  return <LedVideoPlane url={trimmed} args={args} polygonOffset={polygonOffset} {...meshProps} />;
}
