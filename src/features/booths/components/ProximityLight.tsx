import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';

type Props = {
  /** Light is active within this camera distance (meters). */
  range?: number;
  /** Hysteresis band — light only switches off past `range + margin` to avoid flicker. */
  margin?: number;
  /** Check every Nth frame (cheap; lights don't need per-frame distance checks). */
  everyNthFrame?: number;
  children: ReactNode;
};

/**
 * Distance-gates expensive real-time lights.
 *
 * WebGL forward rendering evaluates EVERY enabled light for EVERY lit pixel of EVERY
 * material, so a hall full of per-booth spot/point lights tanks the framerate even with
 * no video. Booth accent lights barely contribute once you're several meters away, so we
 * unmount them when the camera is far and restore them as you approach. The booths nearest
 * the player — the ones you actually look at — stay fully lit, so perceived quality holds.
 *
 * Hysteresis (`margin`) prevents on/off flicker when hovering near the boundary. The active
 * light count stays roughly constant as you walk (only nearby booths lit), so three.js
 * caches the shader variants after a brief warmup and stops recompiling.
 */
export function ProximityLight({
  range = 24,
  margin = 6,
  everyNthFrame = 6,
  children,
}: Props) {
  const ref = useRef<THREE.Group>(null);
  const [active, setActive] = useState(true);
  const tick = useRef(0);
  const worldPos = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ camera }) => {
    tick.current = (tick.current + 1) % everyNthFrame;
    if (tick.current !== 0) return;
    const g = ref.current;
    if (!g) return;
    g.getWorldPosition(worldPos);
    const d = worldPos.distanceTo(camera.position);
    setActive((prev) => {
      if (prev && d > range + margin) return false;
      if (!prev && d <= range) return true;
      return prev;
    });
  });

  return <group ref={ref}>{active ? children : null}</group>;
}
