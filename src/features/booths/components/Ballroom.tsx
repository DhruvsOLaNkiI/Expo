import { Suspense, useRef, useLayoutEffect } from 'react';
import * as THREE from 'three';
import { HALL_HALF_WIDTH, HALL_HEIGHT } from '@/features/shared/data/boothLayouts';
import { LedScreenSurface, LedScreenSuspenseFallback } from '@/features/media/components/LedVideoPlane';

/** East width wall — anchor slightly inside the hall so stage/screen are not past the perimeter. */
const BALLROOM_WALL_X = HALL_HALF_WIDTH - 1.5;
const BALLROOM_FACE_YAW = -Math.PI / 2;

export const BALLROOM_LED = {
  videoUrl: '/13391496_3840_2160_60fps.mp4',
} as const;

/** Main center LED + wood-tone stage on east wall. */
const STAGE_WIDTH = 14;
const STAGE_DEPTH = 2.6;
const MAIN_SCREEN = {
  position: [0, HALL_HEIGHT * 0.46, 0.6] as [number, number, number],
  width: 13,
  height: 5.5,
};

const STAGE_BROWN = '#6b4423';
const STAGE_BROWN_DARK = '#4a3020';
const STAGE_BROWN_LIGHT = '#7a5230';

const LED_PANEL: [number, number] = [MAIN_SCREEN.width - 0.25, MAIN_SCREEN.height - 0.25];

/** Local +Z extends from east wall westward into the hall. */
const STAGE_Z = STAGE_DEPTH / 2;
const BACKDROP_Z = 0.06;
const STAGE_TOP_Y = 1;
const PODIUM_Z = STAGE_Z + STAGE_DEPTH * 0.35;

function BallroomLedDisplay({ showVideos }: { showVideos: boolean }) {
  const [w, h] = LED_PANEL;

  return (
    <group position={MAIN_SCREEN.position}>
      {/* Deep housing behind panel */}
      <mesh position={[0, 0, -0.06]}>
        <boxGeometry args={[MAIN_SCREEN.width + 0.2, MAIN_SCREEN.height + 0.2, 0.14]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.35} metalness={0.75} />
      </mesh>
      {/* Black bezel frame */}
      <mesh position={[0, 0, -0.02]}>
        <boxGeometry args={[MAIN_SCREEN.width + 0.1, MAIN_SCREEN.height + 0.1, 0.06]} />
        <meshStandardMaterial color="#0c0c0c" metalness={0.85} roughness={0.25} />
      </mesh>
      {/* Active LED surface */}
      <Suspense fallback={<LedScreenSuspenseFallback args={LED_PANEL} />}>
        {showVideos ? (
          <LedScreenSurface args={LED_PANEL} url={BALLROOM_LED.videoUrl} position={[0, 0, 0.02]} />
        ) : (
          <mesh position={[0, 0, 0.02]}>
            <planeGeometry args={LED_PANEL} />
            <meshStandardMaterial color="#050505" metalness={0.6} roughness={0.35} />
          </mesh>
        )}
      </Suspense>
      {/* Bottom bezel lip */}
      <mesh position={[0, -h / 2 - 0.06, 0.03]}>
        <boxGeometry args={[w * 0.92, 0.05, 0.03]} />
        <meshStandardMaterial color="#080808" metalness={0.8} roughness={0.3} />
      </mesh>
    </group>
  );
}

function StagePodium() {
  const bodyH = 1.2;
  const topH = 0.08;
  const topY = bodyH + topH / 2;
  const micPoleH = 1.15;

  return (
    <group position={[0, STAGE_TOP_Y, PODIUM_Z]}>
      <mesh position={[0, bodyH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.95, bodyH, 0.7]} />
        <meshStandardMaterial color={STAGE_BROWN_LIGHT} roughness={0.55} metalness={0.08} />
      </mesh>
      <mesh position={[0, topY, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.05, topH, 0.8]} />
        <meshStandardMaterial color="#d4af37" roughness={0.55} metalness={0.35} envMapIntensity={0.1} />
      </mesh>
      <group position={[0, bodyH + topH, 0]}>
        <mesh position={[0, 0.02, 0]} castShadow>
          <cylinderGeometry args={[0.13, 0.15, 0.04, 18]} />
          <meshStandardMaterial color={STAGE_BROWN_DARK} metalness={0.35} roughness={0.72} />
        </mesh>
        <mesh position={[0, micPoleH / 2 + 0.04, 0]} castShadow>
          <cylinderGeometry args={[0.012, 0.016, micPoleH, 10]} />
          <meshStandardMaterial color={STAGE_BROWN} metalness={0.25} roughness={0.78} />
        </mesh>
        <mesh position={[0, micPoleH + 0.08, 0.07]} castShadow>
          <sphereGeometry args={[0.055, 12, 12]} />
          <meshStandardMaterial color={STAGE_BROWN_DARK} metalness={0.45} roughness={0.55} />
        </mesh>
      </group>
    </group>
  );
}

export function Ballroom({ showVideos = true }: { showVideos?: boolean } = {}) {
  return (
    <group position={[BALLROOM_WALL_X, 0, 0]} rotation={[0, BALLROOM_FACE_YAW, 0]}>
      <mesh position={[0, 0.5, STAGE_Z]} receiveShadow castShadow>
        <boxGeometry args={[STAGE_WIDTH, 1, STAGE_DEPTH]} />
        <meshStandardMaterial color={STAGE_BROWN} roughness={0.62} metalness={0.06} />
      </mesh>

      <BallroomLedDisplay showVideos={showVideos} />

      <StagePodium />

      <pointLight position={[0, 4.5, BACKDROP_Z + 4]} intensity={14} distance={18} decay={2} color="#f5f0e8" />

      <BallroomSpot
        position={[-8, 6, 6]}
        target={[0, MAIN_SCREEN.position[1], BACKDROP_Z + 0.15]}
        intensity={32}
      />
      <BallroomSpot
        position={[8, 6, 6]}
        target={[0, MAIN_SCREEN.position[1], BACKDROP_Z + 0.15]}
        intensity={32}
      />
    </group>
  );
}

function BallroomSpot({
  position,
  target,
  intensity,
}: {
  position: [number, number, number];
  target: [number, number, number];
  intensity: number;
}) {
  const lightRef = useRef<THREE.SpotLight>(null);
  const targetRef = useRef<THREE.Group>(null);
  useLayoutEffect(() => {
    const L = lightRef.current;
    const T = targetRef.current;
    if (!L || !T) return;
    L.target = T;
    L.target.updateMatrixWorld();
  }, []);
  return (
    <>
      <spotLight
        ref={lightRef}
        position={position}
        angle={Math.PI / 5.5}
        penumbra={0.78}
        intensity={intensity}
        color="#ffddaa"
        distance={55}
        decay={2}
        castShadow={false}
      />
      <group ref={targetRef} position={target} />
    </>
  );
}
