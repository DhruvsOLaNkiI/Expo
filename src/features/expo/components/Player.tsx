import { useKeyboardControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { PointerLockControls } from 'three-stdlib';
import { CAMERA_MODES } from '@/features/expo/camera/cameraModes';
import { useStore } from '@/store';
import {
  EXPO_AISLE_EAST_X,
  EXPO_AISLE_WEST_X,
  HALL_HALF_DEPTH,
  HALL_HALF_WIDTH,
} from '@/features/shared/data/boothLayouts';
import {
  regBounds,
  REG_SPAWN,
  resolveMainExpoSpawn,
  resolveMainExpoSpawnYaw,
} from '@/features/shared/data/registrationHall';
import { LocalVisitorAvatar } from './LocalVisitorAvatar';

/** Realistic walking speed ~4.5 km/h = ~1.25 m/s. Expo feel is slightly faster. */
const WALK_SPEED = 4.2;
/** Cap frame delta to avoid teleporting on a lag spike. */
const MAX_DELTA = 0.1;
const PLAYER_MARGIN_X = 2;
const PLAYER_MARGIN_Z = 3.5;
const EXPO_BOUND_X = HALL_HALF_WIDTH - PLAYER_MARGIN_X;
const EXPO_BOUND_Z = HALL_HALF_DEPTH - PLAYER_MARGIN_Z;
/** Joystick dead-zone. */
const JOY_DEAD = 0.14;
/** FOV smoothing factor per frame. */
const FOV_LERP = 0.12;
/** Acceleration / deceleration smoothing (0 = instant, 1 = never). */
const MOVE_SMOOTHING = 0.82;

const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _wish = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _velocity = new THREE.Vector3();

/** Survives React Strict Mode remounts so spawn only runs once per page load. */
let globalPlayerSpawned = false;

function applyCameraFromFeet(
  camera: THREE.PerspectiveCamera,
  feet: THREE.Vector3,
  mode: keyof typeof CAMERA_MODES,
) {
  const preset = CAMERA_MODES[mode];
  if (preset.distance > 0) {
    const yaw = camera.rotation.y;
    camera.position.set(
      feet.x + Math.sin(yaw + Math.PI) * preset.distance,
      feet.y + preset.heightOffset,
      feet.z + Math.cos(yaw + Math.PI) * preset.distance,
    );
  } else {
    camera.position.set(feet.x, feet.y + preset.eyeHeight, feet.z);
  }
}

/** Level view — avoids staring at the floor (common when spawn/rotation was never reset). */
function resetCameraView(
  camera: THREE.PerspectiveCamera,
  mode: keyof typeof CAMERA_MODES,
  yaw = 0,
) {
  camera.rotation.set(0, yaw, 0, 'YXZ');
  const preset = CAMERA_MODES[mode];
  camera.fov = preset.fov;
  camera.updateProjectionMatrix();
}

export function Player() {
  const { gl } = useThree();
  const camera = useThree((s) => s.camera as THREE.PerspectiveCamera);
  const controlsRef = useRef<PointerLockControls | null>(null);
  const hallLayoutOv = useStore((s) => s.sceneOverrides.hallLayout);
  const mainSpawn = useMemo(
    () => resolveMainExpoSpawn(hallLayoutOv),
    [
      hallLayoutOv?.mainExpoSpawn?.[0],
      hallLayoutOv?.mainExpoSpawn?.[1],
      hallLayoutOv?.mainExpoSpawn?.[2],
    ],
  );
  const mainSpawnYaw = useMemo(
    () => resolveMainExpoSpawnYaw(hallLayoutOv),
    [hallLayoutOv?.mainExpoSpawnYaw],
  );
  const feetRef = useRef(new THREE.Vector3(mainSpawn[0], 0, mainSpawn[2]));
  const velocityRef = useRef(new THREE.Vector3());
  const [, get] = useKeyboardControls();
  const setShowInstructions = useStore((state) => state.setShowInstructions);
  const activeBooth = useStore((state) => state.activeBooth);
  const ctaResourcePopup = useStore((state) => state.ctaResourcePopup);
  const teleportNonce = useStore((state) => state.teleportNonce);
  const joystickData = useStore((state) => state.joystickData);
  const strafeHold = useStore((state) => state.strafeHold);
  const teleportPlayer = useStore((state) => state.teleportPlayer);
  const hallLayoutEditMode = useStore((state) => state.hallLayoutEditMode);
  const expoPhase = useStore((state) => state.expoPhase);
  const registrationUi = useStore((state) => state.registrationUi);
  const cameraMode = useStore((state) => state.cameraMode);
  const cycleCameraMode = useStore((state) => state.cycleCameraMode);
  const setPlayerFacingYaw = useStore((state) => state.setPlayerFacingYaw);

  const isLocked = useRef(false);
  const [isTouch, setIsTouch] = useState(false);

  const touchStart = useRef({ x: 0, y: 0 });
  const cameraRotation = useRef({ x: 0, y: 0 });

  /* ── detect touch ─────────────────────────────────────────── */
  useEffect(() => {
    setIsTouch('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  /* ── fast travel / floor click teleport (nonce — reliable in dev Strict Mode) ── */
  useLayoutEffect(() => {
    const target = useStore.getState().teleportTarget;
    if (!target) return;
    feetRef.current.set(target[0], 0, target[2]);
    velocityRef.current.set(0, 0, 0);
    const atEntry =
      Math.abs(target[0] - mainSpawn[0]) < 0.25 && Math.abs(target[2] - mainSpawn[2]) < 0.25;
    resetCameraView(camera, cameraMode, atEntry ? mainSpawnYaw : 0);
    applyCameraFromFeet(camera, feetRef.current, cameraMode);
    useStore.setState({ teleportTarget: null, playerPosition: null });
  }, [teleportNonce, camera, cameraMode, mainSpawnYaw]);

  /* ── initial spawn (once per page load) ── */
  useLayoutEffect(() => {
    if (globalPlayerSpawned) return;
    globalPlayerSpawned = true;
    if (expoPhase === 'registration') {
      feetRef.current.set(REG_SPAWN[0], 0, REG_SPAWN[2]);
    } else {
      feetRef.current.set(mainSpawn[0], 0, mainSpawn[2]);
    }
    resetCameraView(camera, cameraMode, expoPhase === 'expo' ? mainSpawnYaw : 0);
    applyCameraFromFeet(camera, feetRef.current, cameraMode);
  }, [camera, expoPhase, cameraMode, mainSpawn, mainSpawnYaw]);

  /* ── snap spawn only when switching lobby ↔ main expo (not on camera mode change) ── */
  const prevExpoPhaseRef = useRef(expoPhase);
  useEffect(() => {
    if (prevExpoPhaseRef.current === expoPhase) return;
    prevExpoPhaseRef.current = expoPhase;
    if (expoPhase === 'registration') {
      feetRef.current.set(REG_SPAWN[0], 0, REG_SPAWN[2]);
    } else {
      feetRef.current.set(mainSpawn[0], 0, mainSpawn[2]);
    }
    velocityRef.current.set(0, 0, 0);
    const mode = useStore.getState().cameraMode;
    resetCameraView(camera, mode, expoPhase === 'expo' ? mainSpawnYaw : 0);
    applyCameraFromFeet(camera, feetRef.current, mode);
  }, [expoPhase, camera, mainSpawn, mainSpawnYaw]);

  /* ── pointer lock (desktop) ───────────────────────────────── */
  useEffect(() => {
    if (isTouch) return;
    const controls = new PointerLockControls(camera, gl.domElement);
    controlsRef.current = controls;

    const onLock = () => { isLocked.current = true; setShowInstructions(false); };
    const onUnlock = () => { isLocked.current = false; };
    controls.addEventListener('lock', onLock);
    controls.addEventListener('unlock', onUnlock);

    return () => {
      controls.removeEventListener('lock', onLock);
      controls.removeEventListener('unlock', onUnlock);
      controls.dispose();
      controlsRef.current = null;
    };
  }, [camera, gl.domElement, setShowInstructions, isTouch]);

  /* ── touch look + click-to-lock ───────────────────────────── */
  useEffect(() => {
    if (isTouch) {
      const handleTouchStart = (e: TouchEvent) => {
        if (e.touches[0].clientX > window.innerWidth / 2) {
          touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
      };
      const handleTouchMove = (e: TouchEvent) => {
        if (e.touches[0].clientX > window.innerWidth / 2) {
          const dx = e.touches[0].clientX - touchStart.current.x;
          const dy = e.touches[0].clientY - touchStart.current.y;
          cameraRotation.current.x -= dy * 0.004;
          cameraRotation.current.y -= dx * 0.004;
          cameraRotation.current.x = THREE.MathUtils.clamp(
            cameraRotation.current.x, -Math.PI / 2.5, Math.PI / 2.5,
          );
          camera.rotation.set(cameraRotation.current.x, cameraRotation.current.y, 0, 'YXZ');
          touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
      };
      window.addEventListener('touchstart', handleTouchStart);
      window.addEventListener('touchmove', handleTouchMove);
      return () => {
        window.removeEventListener('touchstart', handleTouchStart);
        window.removeEventListener('touchmove', handleTouchMove);
      };
    }

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-expo-ui]')) return;
      if (hallLayoutEditMode) return;
      if (!activeBooth && !ctaResourcePopup && registrationUi === 'none' && controlsRef.current && !isLocked.current) {
        controlsRef.current.lock();
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [activeBooth, ctaResourcePopup, registrationUi, isTouch, camera, hallLayoutEditMode]);

  /* ── V key to cycle camera mode ───────────────────────────── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (expoPhase === 'expo' && !hallLayoutEditMode) {
        if (e.code === 'KeyQ') {
          teleportPlayer([EXPO_AISLE_WEST_X, 1.7, 0]);
          return;
        }
        if (e.code === 'KeyE') {
          teleportPlayer([EXPO_AISLE_EAST_X, 1.7, 0]);
          return;
        }
      }
      if (e.code === 'KeyV') {
        cycleCameraMode();
        const next = useStore.getState().cameraMode;
        resetCameraView(camera, next);
        applyCameraFromFeet(camera, feetRef.current, next);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [camera, cycleCameraMode, expoPhase, teleportPlayer, hallLayoutEditMode]);

  /* ── react to mode switch (position unchanged — only FOV / third-person offset) ── */
  useEffect(() => {
    const preset = CAMERA_MODES[cameraMode];
    camera.fov = preset.fov;
    camera.updateProjectionMatrix();
    applyCameraFromFeet(camera, feetRef.current, cameraMode);
  }, [cameraMode, camera]);

  /* ── per-frame movement ───────────────────────────────────── */
  useFrame((_, rawDelta) => {
    /* Smooth FOV transitions */
    const preset = CAMERA_MODES[cameraMode];
    if (Math.abs(camera.fov - preset.fov) > 0.15) {
      camera.fov = THREE.MathUtils.lerp(camera.fov, preset.fov, FOV_LERP);
      camera.updateProjectionMatrix();
    }

    if (activeBooth || ctaResourcePopup || hallLayoutEditMode || registrationUi !== 'none') {
      applyCameraFromFeet(camera, feetRef.current, cameraMode);
      return;
    }

    const canMoveDesktop = !isTouch && isLocked.current;
    const canMoveTouch = isTouch;
    if (!canMoveDesktop && !canMoveTouch) {
      applyCameraFromFeet(camera, feetRef.current, cameraMode);
      return;
    }

    const keys = get();
    let lx = 0;
    let lz = 0;

    if (isTouch) {
      const jx = joystickData.x + (strafeHold.right ? 1 : 0) - (strafeHold.left ? 1 : 0);
      const jy = joystickData.y;
      const mag = Math.hypot(jx, jy);
      if (mag >= JOY_DEAD) { lx = jx / mag; lz = jy / mag; }
      else if (strafeHold.left || strafeHold.right) {
        lx = strafeHold.right ? 1 : -1;
        lz = 0;
      }
    } else {
      lx =
        Number(keys.right) -
        Number(keys.left) +
        (strafeHold.right ? 1 : 0) -
        (strafeHold.left ? 1 : 0);
      lz = Number(keys.forward) - Number(keys.backward);
      const mag = Math.hypot(lx, lz);
      if (mag > 1e-6) { lx /= mag; lz /= mag; }
    }

    /* Build wish direction relative to camera facing */
    camera.getWorldDirection(_forward);
    _forward.y = 0;
    if (_forward.lengthSq() < 1e-10) _forward.set(0, 0, -1);
    else _forward.normalize();

    _right.crossVectors(_forward, _up).normalize();

    _wish.set(0, 0, 0);
    _wish.addScaledVector(_forward, lz);
    _wish.addScaledVector(_right, lx);
    _wish.y = 0;

    const wantMove = _wish.lengthSq() > 1e-8;
    if (wantMove) _wish.normalize();

    /* Smooth acceleration / deceleration */
    const dt = Math.min(rawDelta, MAX_DELTA);
    const target = wantMove ? _wish.clone().multiplyScalar(WALK_SPEED) : _velocity.set(0, 0, 0);
    velocityRef.current.lerp(target, 1 - Math.pow(MOVE_SMOOTHING, dt * 60));

    if (velocityRef.current.lengthSq() > 1e-6) {
      feetRef.current.addScaledVector(velocityRef.current, dt);
    }

    /* Clamp to world bounds */
    if (expoPhase === 'registration') {
      const b = regBounds();
      feetRef.current.x = THREE.MathUtils.clamp(feetRef.current.x, b.minX, b.maxX);
      feetRef.current.z = THREE.MathUtils.clamp(feetRef.current.z, b.minZ, b.maxZ);
    } else {
      feetRef.current.x = THREE.MathUtils.clamp(feetRef.current.x, -EXPO_BOUND_X, EXPO_BOUND_X);
      feetRef.current.z = THREE.MathUtils.clamp(feetRef.current.z, -EXPO_BOUND_Z, EXPO_BOUND_Z);
    }

    /* Always grounded at y=0 */
    feetRef.current.y = 0;

    const speed = velocityRef.current.length();
    setPlayerFacingYaw(camera.rotation.y);
    useStore.getState().setPlayerSpeed(speed);
    if (hallLayoutEditMode && expoPhase === 'expo') {
      const x = feetRef.current.x;
      const z = feetRef.current.z;
      const y = mainSpawn[1];
      const prev = useStore.getState().playerPosition;
      if (!prev || Math.abs(prev[0] - x) > 0.02 || Math.abs(prev[2] - z) > 0.02) {
        useStore.setState({ playerPosition: [x, y, z] });
      }
    }
    applyCameraFromFeet(camera, feetRef.current, cameraMode);
  });

  return <LocalVisitorAvatar feetRef={feetRef} />;
}
