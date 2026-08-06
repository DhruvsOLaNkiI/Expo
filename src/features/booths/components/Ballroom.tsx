import { Suspense, useRef, useLayoutEffect } from 'react';
import * as THREE from 'three';
import { HALL_HALF_WIDTH, HALL_HEIGHT } from '@/features/shared/data/boothLayouts';
import {
  LedScreenSurface,
  LedScreenSuspenseFallback,
  resolveBoothLedScreenUrl,
} from '@/features/media/components/LedVideoPlane';

/** East width wall — anchor slightly inside the hall so the screen is not past the perimeter. */
export const BALLROOM_WALL_X = HALL_HALF_WIDTH - 1.5;
const BALLROOM_FACE_YAW = -Math.PI / 2;

export const BALLROOM_LED = {
  videoUrl: '/13391496_3840_2160_60fps.mp4',
} as const;

/** Main center LED on east wall (stage platform + podium removed). */
const MAIN_SCREEN = {
  position: [0, HALL_HEIGHT * 0.46, 0.6] as [number, number, number],
  width: 13,
  height: 5.5,
};

const LED_PANEL: [number, number] = [MAIN_SCREEN.width - 0.25, MAIN_SCREEN.height - 0.25];
const BACKDROP_Z = 0.06;

function BallroomLedDisplay({
  showVideos,
  stageScreenUrl,
}: {
  showVideos: boolean;
  stageScreenUrl?: string;
}) {
  const [w, h] = LED_PANEL;
  const screenUrl = resolveBoothLedScreenUrl(stageScreenUrl, BALLROOM_LED.videoUrl, showVideos);

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
        {screenUrl ? (
          <LedScreenSurface args={LED_PANEL} url={screenUrl} position={[0, 0, 0.02]} />
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
      {/* LED backlight glow effect */}
      <pointLight
        position={[0, 0, -0.1]}
        intensity={18}
        distance={6}
        decay={2}
        color="#e8f0ff"
      />
    </group>
  );
}

export function Ballroom({
  showVideos = true,
  stageScreenUrl,
}: {
  showVideos?: boolean;
  stageScreenUrl?: string;
} = {}) {
  return (
    <group position={[BALLROOM_WALL_X, 0, 0]} rotation={[0, BALLROOM_FACE_YAW, 0]}>
      <BallroomLedDisplay showVideos={showVideos} stageScreenUrl={stageScreenUrl} />

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
