import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * Fixed-count booth light system — eliminates the booth-to-booth stutter.
 *
 * Previously every booth mounted/unmounted its own spot + point lights via `ProximityLight`
 * as you approached. WebGL keys each material's compiled shader by the number of lights in
 * the scene, so every time that count changed (walking between booths), three.js recompiled
 * materials and reallocated GPU state — a frame hitch on every transition.
 *
 * Here a *constant* small pool of lights is mounted once and never added/removed. Each frame
 * the pool is reassigned to the nearest registered booth anchors, so the light count never
 * changes (no recompiles) while only a handful of lights are ever active.
 */

type LightKind = 'spot' | 'point';

type LightDef = {
  kind: LightKind;
  pos: THREE.Vector3;
  target?: THREE.Vector3;
  color: THREE.Color;
  intensity: number;
  distance: number;
  angle: number;
  penumbra: number;
  decay: number;
  /** Camera distance (m) within which this light should be lit. */
  range: number;
};

const registry = new Map<string, LightDef>();

function setBoothLight(key: string, def: LightDef) {
  registry.set(key, def);
}
function removeBoothLight(key: string) {
  registry.delete(key);
}

let autoId = 0;

/**
 * Drop-in replacement for a booth's `<ProximityLight><spotLight/></ProximityLight>`. Renders
 * no light itself — it registers an anchor (measured in world space) that {@link BoothLightPool}
 * lights up when the camera is near. Place it exactly where the old light lived so it inherits
 * the booth transform.
 */
export function PooledBoothLight({
  kind = 'spot',
  position,
  targetPosition,
  color = '#fff4e6',
  intensity = 60,
  distance = 20,
  angle = 0.5,
  penumbra = 0.8,
  decay = 2,
  range = 9,
}: {
  kind?: LightKind;
  position: [number, number, number];
  targetPosition?: [number, number, number];
  color?: string;
  intensity?: number;
  distance?: number;
  angle?: number;
  penumbra?: number;
  decay?: number;
  range?: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const targetRef = useRef<THREE.Object3D>(null);
  const keyRef = useRef(`bl-${autoId++}`);
  const defRef = useRef<LightDef | null>(null);

  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    g.updateWorldMatrix(true, false);
    const pos = new THREE.Vector3();
    g.getWorldPosition(pos);
    let target: THREE.Vector3 | undefined;
    if (targetRef.current) {
      targetRef.current.updateWorldMatrix(true, false);
      target = new THREE.Vector3();
      targetRef.current.getWorldPosition(target);
    }
    const def: LightDef = {
      kind,
      pos,
      target,
      color: new THREE.Color(color),
      intensity,
      distance,
      angle,
      penumbra,
      decay,
      range,
    };
    defRef.current = def;
    const key = keyRef.current;
    setBoothLight(key, def);
    return () => removeBoothLight(key);
    // Position is static per booth instance; measured once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep mutable params fresh without re-measuring world position.
  useEffect(() => {
    const def = defRef.current;
    if (!def) return;
    def.color.set(color);
    def.intensity = intensity;
    def.distance = distance;
    def.angle = angle;
    def.penumbra = penumbra;
    def.decay = decay;
    def.range = range;
  }, [color, intensity, distance, angle, penumbra, decay, range]);

  return (
    <>
      <group ref={groupRef} position={position} />
      {targetPosition ? <object3D ref={targetRef} position={targetPosition} /> : null}
    </>
  );
}

/** Pool sizes — max booth lights of each type that can be lit at once. */
const SPOT_POOL = 3;
const POINT_POOL = 4;

const camPos = new THREE.Vector3();
const spotDefs: LightDef[] = [];
const pointDefs: LightDef[] = [];

/**
 * Mount once inside the hall. Holds a constant set of spot + point lights and reassigns them
 * to the nearest booth anchors every frame. Unused pool lights stay mounted at intensity 0 so
 * the scene's light count — and therefore every material's shader — never changes.
 */
export function BoothLightPool() {
  const spotRefs = useRef<(THREE.SpotLight | null)[]>([]);
  const spotTargets = useRef<(THREE.Object3D | null)[]>([]);
  const pointRefs = useRef<(THREE.PointLight | null)[]>([]);

  useFrame(({ camera }) => {
    camera.getWorldPosition(camPos);

    spotDefs.length = 0;
    pointDefs.length = 0;
    for (const def of registry.values()) {
      (def.kind === 'spot' ? spotDefs : pointDefs).push(def);
    }
    spotDefs.sort((a, b) => a.pos.distanceToSquared(camPos) - b.pos.distanceToSquared(camPos));
    pointDefs.sort((a, b) => a.pos.distanceToSquared(camPos) - b.pos.distanceToSquared(camPos));

    for (let i = 0; i < SPOT_POOL; i++) {
      const light = spotRefs.current[i];
      if (!light) continue;
      const def = spotDefs[i];
      if (def && def.pos.distanceTo(camPos) <= def.range) {
        light.position.copy(def.pos);
        light.color.copy(def.color);
        light.intensity = def.intensity;
        light.distance = def.distance;
        light.angle = def.angle;
        light.penumbra = def.penumbra;
        light.decay = def.decay;
        const t = spotTargets.current[i];
        if (t && def.target) {
          t.position.copy(def.target);
          t.updateMatrixWorld();
          light.target = t;
        }
      } else {
        light.intensity = 0;
      }
    }

    for (let i = 0; i < POINT_POOL; i++) {
      const light = pointRefs.current[i];
      if (!light) continue;
      const def = pointDefs[i];
      if (def && def.pos.distanceTo(camPos) <= def.range) {
        light.position.copy(def.pos);
        light.color.copy(def.color);
        light.intensity = def.intensity;
        light.distance = def.distance;
        light.decay = def.decay;
      } else {
        light.intensity = 0;
      }
    }
  });

  return (
    <group name="booth-light-pool">
      {Array.from({ length: SPOT_POOL }).map((_, i) => (
        <group key={`spot-${i}`}>
          <spotLight
            ref={(el) => {
              spotRefs.current[i] = el;
            }}
            intensity={0}
            decay={2}
            angle={0.5}
            penumbra={0.8}
          />
          <object3D
            ref={(el) => {
              spotTargets.current[i] = el;
            }}
          />
        </group>
      ))}
      {Array.from({ length: POINT_POOL }).map((_, i) => (
        <pointLight
          key={`point-${i}`}
          ref={(el) => {
            pointRefs.current[i] = el;
          }}
          intensity={0}
          decay={2}
        />
      ))}
    </group>
  );
}
