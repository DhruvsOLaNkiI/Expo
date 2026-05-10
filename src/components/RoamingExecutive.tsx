import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, useLayoutEffect, useEffect } from 'react';
import * as THREE from 'three';
import { clone as cloneSkinnedHierarchy } from 'three/examples/jsm/utils/SkeletonUtils.js';

const ROAMING_NPC_MODEL_URL = '/assets/scanned_animated_walking_man.glb';
const EXECUTIVE_MAX_HEIGHT = 1.82;
const EXECUTIVE_MAX_WIDTH = 2.2;

/** Max world speed (m/s) after smoothing */
const WALK_MAX_SPEED = 1.55;
const ACCEL = 5.2;
const ROT_ACCEL = 7.5;
const ARRIVE_EPS = 0.48;
const WAIT_MIN = 3.2;
const WAIT_MAX = 7.5;
/** Next waypoint must be at least this far (XZ) from current position — stops A→B→A ping-pong */
const MIN_NEXT_TARGET_DIST = 5.5;
/** Meters of forward travel per walk cycle at timeScale 1 — tune if feet slip vs animation */
const METERS_PER_WALK_CYCLE = 1.18;
const MAX_DELTA = 0.055;
/** Procedural sway when no separate walk clip (reduces rigid “ice skate” read) */
const SWAY_FREQ_Y = 9.2;
const SWAY_FREQ_XZ = 4.6;
const SWAY_AMP_Y = 0.018;
const SWAY_AMP_Z = 0.032;
const SWAY_AMP_X = 0.012;

const HALL_PATROL_POINTS: [number, number, number][] = [
  [0, 0, 14],
  [-4, 0, 20],
  [4, 0, 20],
  [0, 0, 28],
  [-6, 0, 32],
  [6, 0, 32],
  [-3, 0, 38],
  [3, 0, 10],
];

function buildBoothVisitPoints(): THREE.Vector3[] {
  const rows: {
    position: [number, number, number];
    rotation: [number, number, number];
  }[] = [
    { position: [-20, 0, -15], rotation: [0, Math.PI / 2 - 0.16, 0] },
    { position: [-20, 0, 5], rotation: [0, Math.PI / 2, 0] },
    { position: [-21.5, 0, 19], rotation: [0, Math.PI / 2 + 0.06, 0] },
    { position: [20, 0, -15], rotation: [0, -Math.PI / 2 + 0.16, 0] },
    { position: [20, 0, 5], rotation: [0, -Math.PI / 2, 0] },
    { position: [20, 0, 25], rotation: [0, -Math.PI / 2 - 0.16, 0] },
  ];
  const out: THREE.Vector3[] = [];
  for (const b of rows) {
    const offset = b.rotation[1] > 0 ? 6 : -6;
    out.push(new THREE.Vector3(b.position[0] + offset, 0, b.position[2]));
  }
  return out;
}

function pickClip(animations: THREE.AnimationClip[], patterns: RegExp[]) {
  for (const re of patterns) {
    const c = animations.find((a) => re.test(a.name));
    if (c) return c;
  }
  return null;
}

function prepareExecutiveModel(source: THREE.Object3D) {
  const root = cloneSkinnedHierarchy(source) as THREE.Object3D;
  root.rotation.set(0, 0, 0);
  root.scale.set(1, 1, 1);
  root.updateMatrixWorld(true);
  root.traverse((obj) => {
    const m = obj as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = true;
    }
  });
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  const horiz = Math.max(size.x, size.z, 1e-6);
  const sy = Math.max(size.y, 1e-6);
  const s = Math.min(EXECUTIVE_MAX_WIDTH / horiz, EXECUTIVE_MAX_HEIGHT / sy);
  root.scale.setScalar(s);
  root.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(root);
  const c = new THREE.Vector3();
  box2.getCenter(c);
  root.position.sub(c);
  root.updateMatrixWorld(true);
  const box3 = new THREE.Box3().setFromObject(root);
  root.position.y -= box3.min.y;
  root.updateMatrixWorld(true);
  return root;
}

const tmpDir = new THREE.Vector3();

export function RoamingExecutive() {
  const groupRef = useRef<THREE.Group>(null);
  const swayRef = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(ROAMING_NPC_MODEL_URL) as {
    scene: THREE.Object3D;
    animations: THREE.AnimationClip[];
  };

  const model = useMemo(() => prepareExecutiveModel(scene), [scene]);

  const destinations = useMemo(() => {
    const booths = buildBoothVisitPoints();
    const patrol = HALL_PATROL_POINTS.map(([x, y, z]) => new THREE.Vector3(x, y, z));
    // One entry per booth — duplicating the same points doubled random weight and used two
    // indices for the same spot, so "pick different index" still sent him back to the same place.
    return [...booths, ...patrol];
  }, []);

  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const idleActionRef = useRef<THREE.AnimationAction | null>(null);
  const walkActionRef = useRef<THREE.AnimationAction | null>(null);
  const walkClipRef = useRef<THREE.AnimationClip | null>(null);
  const hasSeparateWalkRef = useRef(false);
  /** Single clip in file — treat as locomotion; pause while waiting at a booth */
  const onlyOneAnimationClipRef = useRef(false);
  const animBlendRef = useRef(0);

  const stateRef = useRef({
    phase: 'walk' as 'walk' | 'wait',
    pos: new THREE.Vector3(0, 0, 16),
    target: new THREE.Vector3(0, 0, 22),
    waitUntil: 0,
    lastIndex: -1,
    speed: 0,
    yaw: 0,
    targetYaw: 0,
  });

  useLayoutEffect(() => {
    idleActionRef.current = null;
    walkActionRef.current = null;
    walkClipRef.current = null;
    hasSeparateWalkRef.current = false;
    onlyOneAnimationClipRef.current = false;
    mixerRef.current = null;
    animBlendRef.current = 0;

    if (!animations?.length) return;

    onlyOneAnimationClipRef.current = animations.length === 1;

    const mixer = new THREE.AnimationMixer(model);
    mixerRef.current = mixer;

    const idleClip =
      pickClip(animations, [/idle|stand|phone|neutral|breath|talk|type|hip/i]) ?? animations[0];
    const walkClip =
      pickClip(animations, [
        /walk|jog|run|stride|move|locomotion|scan|animated|man|take/i,
      ]) ?? null;

    const idle = mixer.clipAction(idleClip);
    idle.setLoop(THREE.LoopRepeat, Infinity);
    idle.clampWhenFinished = false;
    idle.enabled = true;
    idle.setEffectiveWeight(1);
    idle.play();
    idleActionRef.current = idle;

    if (walkClip && walkClip !== idleClip) {
      const walk = mixer.clipAction(walkClip);
      walk.setLoop(THREE.LoopRepeat, Infinity);
      walk.clampWhenFinished = false;
      walk.enabled = true;
      walk.setEffectiveWeight(0);
      walk.play();
      walkActionRef.current = walk;
      walkClipRef.current = walkClip;
      hasSeparateWalkRef.current = true;
    }

    return () => {
      mixer.stopAllAction();
      mixerRef.current = null;
      idleActionRef.current = null;
      walkActionRef.current = null;
    };
  }, [model, animations]);

  const pickNextTarget = () => {
    const st = stateRef.current;
    const n = destinations.length;
    if (n === 0) return;
    const pos = st.pos;
    const minSq = MIN_NEXT_TARGET_DIST * MIN_NEXT_TARGET_DIST;

    const candidates: number[] = [];
    for (let i = 0; i < n; i++) {
      if (i === st.lastIndex && n > 1) continue;
      const dx = destinations[i].x - pos.x;
      const dz = destinations[i].z - pos.z;
      if (dx * dx + dz * dz >= minSq) candidates.push(i);
    }

    if (candidates.length > 0) {
      st.lastIndex = candidates[Math.floor(Math.random() * candidates.length)];
    } else {
      // All points too close (rare) — pick farthest from current position except last index
      let bestI = st.lastIndex === 0 ? Math.min(1, n - 1) : 0;
      let bestD = -1;
      for (let i = 0; i < n; i++) {
        if (i === st.lastIndex && n > 1) continue;
        const d = pos.distanceToSquared(destinations[i]);
        if (d > bestD) {
          bestD = d;
          bestI = i;
        }
      }
      st.lastIndex = bestI;
    }

    st.target.copy(destinations[st.lastIndex]);
  };

  useEffect(() => {
    pickNextTarget();
    if (groupRef.current) {
      groupRef.current.position.copy(stateRef.current.pos);
    }
  }, [destinations]);

  useFrame((state, delta) => {
    // Must use `delta` from useFrame — the loop already called clock.getDelta();
    // calling getDelta() here again yields ~0 and the AnimationMixer never advances.
    const dt = Math.min(delta, MAX_DELTA);
    const st = stateRef.current;
    const mixer = mixerRef.current;
    const idle = idleActionRef.current;
    const walk = walkActionRef.current;
    const t = state.clock.elapsedTime;

    if (mixer && animations?.length) {
      mixer.update(dt);
    }

    const g = groupRef.current;
    const sway = swayRef.current;
    if (!g) return;

    const applyAnimWeights = (walkWeight: number) => {
      animBlendRef.current = THREE.MathUtils.lerp(
        animBlendRef.current,
        walkWeight,
        1 - Math.exp(-11 * dt)
      );
      const b = animBlendRef.current;
      if (idle) idle.setEffectiveWeight(1 - b);
      if (walk) {
        walk.setEffectiveWeight(b);
        const clip = walkClipRef.current;
        if (clip && clip.duration > 1e-6 && st.speed > 0.06) {
          const ts = THREE.MathUtils.clamp(
            (st.speed * clip.duration) / METERS_PER_WALK_CYCLE,
            0.35,
            2.5
          );
          walk.setEffectiveTimeScale(ts);
        } else if (walk) {
          walk.setEffectiveTimeScale(1);
        }
      }
    };

    if (st.phase === 'wait') {
      st.speed = THREE.MathUtils.lerp(st.speed, 0, 1 - Math.exp(-ACCEL * dt));
      applyAnimWeights(0);
      if (idle) {
        if (onlyOneAnimationClipRef.current) {
          idle.paused = true;
        } else {
          idle.setEffectiveTimeScale(1);
        }
      }
      if (walk) walk.paused = true;

      if (state.clock.elapsedTime >= st.waitUntil) {
        st.phase = 'walk';
        if (idle) idle.paused = false;
        if (walk) walk.paused = false;
        pickNextTarget();
      }

      if (sway) {
        sway.position.set(0, 0, 0);
        sway.rotation.set(0, 0, 0);
      }
      return;
    }

    tmpDir.subVectors(st.target, st.pos);
    const dist = tmpDir.length();
    if (dist < ARRIVE_EPS) {
      st.phase = 'wait';
      st.waitUntil = state.clock.elapsedTime + WAIT_MIN + Math.random() * (WAIT_MAX - WAIT_MIN);
      st.speed = THREE.MathUtils.lerp(st.speed, 0, 1 - Math.exp(-ACCEL * 2 * dt));
      applyAnimWeights(0);
      if (idle) idle.paused = onlyOneAnimationClipRef.current;
      if (walk) walk.paused = true;
      return;
    }

    tmpDir.multiplyScalar(1 / dist);
    st.targetYaw = Math.atan2(tmpDir.x, tmpDir.z);

    let dy = st.targetYaw - st.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    st.yaw += dy * (1 - Math.exp(-ROT_ACCEL * dt));
    g.rotation.y = st.yaw;

    st.speed = THREE.MathUtils.lerp(st.speed, WALK_MAX_SPEED, 1 - Math.exp(-ACCEL * dt));

    const move = Math.min(st.speed * dt, Math.max(0, dist - 0.02));
    st.pos.addScaledVector(tmpDir, move);
    g.position.copy(st.pos);

    applyAnimWeights(hasSeparateWalkRef.current ? 1 : 0);

    if (idle && onlyOneAnimationClipRef.current && !walk) {
      idle.paused = false;
      const clip = idle.getClip();
      if (clip.duration > 1e-6 && st.speed > 0.06) {
        idle.setEffectiveTimeScale(
          THREE.MathUtils.clamp(
            (st.speed * clip.duration) / METERS_PER_WALK_CYCLE,
            0.35,
            2.5
          )
        );
      } else {
        idle.setEffectiveTimeScale(1);
      }
    }

    if (!hasSeparateWalkRef.current && sway) {
      const s = st.speed / WALK_MAX_SPEED;
      sway.position.y = Math.sin(t * SWAY_FREQ_Y) * SWAY_AMP_Y * s;
      sway.rotation.z = Math.sin(t * SWAY_FREQ_XZ) * SWAY_AMP_Z * s;
      sway.rotation.x = Math.sin(t * SWAY_FREQ_XZ * 0.5) * SWAY_AMP_X * s;
    } else if (sway) {
      const s = animBlendRef.current * (st.speed / WALK_MAX_SPEED);
      sway.position.y = Math.sin(t * SWAY_FREQ_Y) * SWAY_AMP_Y * 0.5 * s;
      sway.rotation.z = Math.sin(t * SWAY_FREQ_XZ) * SWAY_AMP_Z * 0.42 * s;
      sway.rotation.x = Math.sin(t * SWAY_FREQ_XZ * 0.5) * SWAY_AMP_X * 0.42 * s;
    }
  });

  return (
    <group ref={groupRef} position={[0, 0, 16]}>
      <group ref={swayRef}>
        <primitive object={model} />
      </group>
    </group>
  );
}

useGLTF.preload(ROAMING_NPC_MODEL_URL);
