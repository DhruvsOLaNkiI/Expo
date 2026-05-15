import { useKeyboardControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { PointerLockControls } from 'three-stdlib';
import { useStore } from '../store';
import { regBounds, REG_SPAWN } from '../data/registrationHall';
import { HALL_HALF_EXTENT } from '../data/boothLayouts';

/** Walk speed (m/s) — comfortable expo pace (was 12, felt uncontrollable). */
const MOVE_SPEED = 6.5;
/** Avoid huge position jumps after a frame hitch. */
const MAX_DELTA = 0.08;
/** Must match `ExpoHall` `halfHall` (90 / 2) — keep camera inside walls with margin. */
const PLAYER_MARGIN = 3.5;
const EXPO_BOUND = HALL_HALF_EXTENT - PLAYER_MARGIN;
/** Joystick magnitude below this = no intentional move (avoids drift + bad normalize). */
const JOY_DEAD = 0.14;

const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _wish = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

export function Player() {
  const { camera, gl } = useThree();
  const controlsRef = useRef<PointerLockControls | null>(null);
  const [, get] = useKeyboardControls();
  const setShowInstructions = useStore((state) => state.setShowInstructions);
  const activeBooth = useStore((state) => state.activeBooth);
  const ctaResourcePopup = useStore((state) => state.ctaResourcePopup);
  const playerPosition = useStore((state) => state.playerPosition);
  const setPlayerPosition = useStore((state) => state.setPlayerPosition);
  const joystickData = useStore((state) => state.joystickData);
  const hallLayoutEditMode = useStore((state) => state.hallLayoutEditMode);
  const expoPhase = useStore((state) => state.expoPhase);
  const registrationUi = useStore((state) => state.registrationUi);

  const isLocked = useRef(false);
  const spawnedRef = useRef(false);
  const [isTouch, setIsTouch] = useState(false);

  const touchStart = useRef({ x: 0, y: 0 });
  const cameraRotation = useRef({ x: 0, y: 0 });

  useEffect(() => {
    setIsTouch('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  useEffect(() => {
    if (playerPosition) {
      camera.position.set(playerPosition[0], playerPosition[1], playerPosition[2]);
      setPlayerPosition(null);
    }
  }, [playerPosition, camera, setPlayerPosition]);

  useEffect(() => {
    if (spawnedRef.current) return;
    spawnedRef.current = true;
    if (expoPhase === 'registration') {
      camera.position.set(REG_SPAWN[0], REG_SPAWN[1], REG_SPAWN[2]);
    }
  }, [camera, expoPhase]);

  useEffect(() => {
    if (isTouch) return;

    const controls = new PointerLockControls(camera, gl.domElement);
    controlsRef.current = controls;

    const onLock = () => {
      isLocked.current = true;
      setShowInstructions(false);
    };
    const onUnlock = () => {
      isLocked.current = false;
    };

    controls.addEventListener('lock', onLock);
    controls.addEventListener('unlock', onUnlock);

    return () => {
      controls.removeEventListener('lock', onLock);
      controls.removeEventListener('unlock', onUnlock);
      controls.dispose();
      controlsRef.current = null;
    };
  }, [camera, gl.domElement, setShowInstructions, isTouch]);

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

          cameraRotation.current.x -= dy * 0.005;
          cameraRotation.current.y -= dx * 0.005;

          cameraRotation.current.x = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, cameraRotation.current.x));

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

    const handleClick = () => {
      if (hallLayoutEditMode) return;
      if (
        !activeBooth &&
        !ctaResourcePopup &&
        registrationUi === 'none' &&
        controlsRef.current &&
        !isLocked.current
      ) {
        controlsRef.current.lock();
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [activeBooth, ctaResourcePopup, registrationUi, isTouch, camera, hallLayoutEditMode]);

  useFrame((_, delta) => {
    if (activeBooth || ctaResourcePopup || hallLayoutEditMode || registrationUi !== 'none') return;

    const canMoveDesktop = !isTouch && isLocked.current;
    const canMoveTouch = isTouch;
    if (!canMoveDesktop && !canMoveTouch) return;

    const keys = get();

    let lx = 0;
    let lz = 0;

    if (isTouch) {
      const jx = joystickData.x;
      const jy = joystickData.y;
      const mag = Math.hypot(jx, jy);
      if (mag >= JOY_DEAD) {
        lx = jx / mag;
        lz = jy / mag;
      }
    } else {
      lx = Number(keys.right) - Number(keys.left);
      lz = Number(keys.forward) - Number(keys.backward);
      const mag = Math.hypot(lx, lz);
      if (mag > 1e-6) {
        lx /= mag;
        lz /= mag;
      }
    }

    if (lx * lx + lz * lz < 1e-8) return;

    /* Horizontal basis from where the camera actually looks (works with PointerLock XYZ + touch YXZ). */
    camera.getWorldDirection(_forward);
    _forward.y = 0;
    if (_forward.lengthSq() < 1e-10) _forward.set(0, 0, -1);
    else _forward.normalize();

    _right.crossVectors(_forward, _up);
    if (_right.lengthSq() < 1e-10) _right.set(1, 0, 0);
    else _right.normalize();

    _wish.set(0, 0, 0);
    _wish.addScaledVector(_forward, lz);
    _wish.addScaledVector(_right, lx);
    _wish.y = 0;
    if (_wish.lengthSq() < 1e-8) return;
    _wish.normalize();

    const dt = Math.min(delta, MAX_DELTA);
    const step = MOVE_SPEED * dt;
    camera.position.addScaledVector(_wish, step);

    if (expoPhase === 'registration') {
      const b = regBounds();
      camera.position.x = THREE.MathUtils.clamp(camera.position.x, b.minX, b.maxX);
      camera.position.z = THREE.MathUtils.clamp(camera.position.z, b.minZ, b.maxZ);
    } else {
      camera.position.x = THREE.MathUtils.clamp(camera.position.x, -EXPO_BOUND, EXPO_BOUND);
      camera.position.z = THREE.MathUtils.clamp(camera.position.z, -EXPO_BOUND, EXPO_BOUND);
    }
    camera.position.y = 1.7;
  });

  return null;
}
