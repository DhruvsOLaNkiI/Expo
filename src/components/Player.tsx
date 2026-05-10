import { useKeyboardControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { PointerLockControls } from 'three-stdlib';
import { useStore } from '../store';

const SPEED = 12;
const BOUNDS = { x: 42, z: 42 };

export function Player() {
  const { camera, gl } = useThree();
  const controlsRef = useRef<PointerLockControls>(null);
  const [, get] = useKeyboardControls();
  const setShowInstructions = useStore((state) => state.setShowInstructions);
  const activeBooth = useStore((state) => state.activeBooth);
  const playerPosition = useStore((state) => state.playerPosition);
  const setPlayerPosition = useStore((state) => state.setPlayerPosition);
  const joystickData = useStore((state) => state.joystickData);
  
  const velocity = useRef(new THREE.Vector3());
  const direction = useRef(new THREE.Vector3());
  const isLocked = useRef(false);
  const [isTouch, setIsTouch] = useState(false);

  // Mobile rotation state
  const touchStart = useRef({ x: 0, y: 0 });
  const cameraRotation = useRef({ x: 0, y: 0 });

  useEffect(() => {
    setIsTouch('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  // Handle Teleport
  useEffect(() => {
    if (playerPosition) {
      camera.position.set(playerPosition[0], playerPosition[1], playerPosition[2]);
      velocity.current.set(0, 0, 0);
      setPlayerPosition(null);
    }
  }, [playerPosition, camera, setPlayerPosition]);

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
      setShowInstructions(true);
    };
    
    controls.addEventListener('lock', onLock);
    controls.addEventListener('unlock', onUnlock);

    return () => {
      controls.removeEventListener('lock', onLock);
      controls.removeEventListener('unlock', onUnlock);
      controls.dispose();
    };
  }, [camera, gl.domElement, setShowInstructions, isTouch]);

  useEffect(() => {
    if (isTouch) {
      const handleTouchStart = (e: TouchEvent) => {
        // Only rotate if not touching the joystick (left side of screen)
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
          
          cameraRotation.current.x = Math.max(-Math.PI/2.5, Math.min(Math.PI/2.5, cameraRotation.current.x));
          
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
    } else {
      const handleClick = () => {
        if (!activeBooth && controlsRef.current && !isLocked.current) {
          controlsRef.current.lock();
        }
      };
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [activeBooth, isTouch, camera]);

  useFrame((state, delta) => {
    // On desktop, we need lock. On mobile, we move if joystick is active.
    const isMoving = isTouch ? (Math.abs(joystickData.x) > 0.1 || Math.abs(joystickData.y) > 0.1) : isLocked.current;
    if (!isMoving && !isLocked.current) return;

    const keys = get();
    
    velocity.current.x -= velocity.current.x * 10.0 * delta;
    velocity.current.z -= velocity.current.z * 10.0 * delta;

    if (isTouch) {
      direction.current.z = -joystickData.y;
      direction.current.x = joystickData.x;
    } else {
      direction.current.z = Number(keys.forward) - Number(keys.backward);
      direction.current.x = Number(keys.right) - Number(keys.left);
    }
    
    direction.current.normalize();

    if (isTouch) {
      if (Math.abs(joystickData.y) > 0.1) velocity.current.z -= direction.current.z * SPEED * delta;
      if (Math.abs(joystickData.x) > 0.1) velocity.current.x -= direction.current.x * SPEED * delta;
    } else {
      if (keys.forward || keys.backward) velocity.current.z -= direction.current.z * SPEED * delta;
      if (keys.left || keys.right) velocity.current.x -= direction.current.x * SPEED * delta;
    }

    if (isTouch) {
      // Manual move logic for mobile since PointerLockControls.moveRight/Forward isn't active
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
      forward.y = 0;
      right.y = 0;
      forward.normalize();
      right.normalize();

      camera.position.add(forward.multiplyScalar(-velocity.current.z * delta * 10));
      camera.position.add(right.multiplyScalar(-velocity.current.x * delta * 10));
    } else {
      controlsRef.current?.moveRight(-velocity.current.x * delta * 10);
      controlsRef.current?.moveForward(-velocity.current.z * delta * 10);
    }

    if (camera.position.x < -BOUNDS.x) camera.position.x = -BOUNDS.x;
    if (camera.position.x > BOUNDS.x) camera.position.x = BOUNDS.x;
    if (camera.position.z < -BOUNDS.z) camera.position.z = -BOUNDS.z;
    if (camera.position.z > BOUNDS.z) camera.position.z = BOUNDS.z;

    camera.position.y = 1.7;
  });

  return null;
}
