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

const LED_PANEL: [number, number] = [MAIN_SCREEN.width - 0.45, MAIN_SCREEN.height - 0.45];
const BACKDROP_Z = 0.06;
/** Hall gold trim — matches vertical pillars so the monitor frame reads clearly. */
const FRAME_GOLD = '#d4af37';
const FRAME_GOLD_DARK = '#8a7020';
const FRAME_T = 0.16;

function BallroomLedDisplay({
  showVideos,
  stageScreenUrl,
}: {
  showVideos: boolean;
  stageScreenUrl?: string;
}) {
  const [w, h] = LED_PANEL;
  const screenUrl = resolveBoothLedScreenUrl(stageScreenUrl, BALLROOM_LED.videoUrl, showVideos);
  const outerW = MAIN_SCREEN.width + 0.12;
  const outerH = MAIN_SCREEN.height + 0.12;
  const zFrame = 0.04;
  const zScreen = 0.08;
  const innerBezelT = 0.12;

  return (
    <group position={MAIN_SCREEN.position}>
      {/* Deep housing behind panel (stays behind the LED) */}
      <mesh position={[0, 0, -0.12]}>
        <boxGeometry args={[outerW + 0.08, outerH + 0.08, 0.16]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.35} metalness={0.75} />
      </mesh>

      {/* Inner charcoal frame only — not a solid plate (that was covering the video) */}
      <mesh position={[0, MAIN_SCREEN.height / 2 - innerBezelT / 2, 0]}>
        <boxGeometry args={[MAIN_SCREEN.width, innerBezelT, 0.06]} />
        <meshStandardMaterial color="#121212" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, -(MAIN_SCREEN.height / 2 - innerBezelT / 2), 0]}>
        <boxGeometry args={[MAIN_SCREEN.width, innerBezelT, 0.06]} />
        <meshStandardMaterial color="#121212" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[-(MAIN_SCREEN.width / 2 - innerBezelT / 2), 0, 0]}>
        <boxGeometry args={[innerBezelT, MAIN_SCREEN.height - innerBezelT * 2, 0.06]} />
        <meshStandardMaterial color="#121212" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[MAIN_SCREEN.width / 2 - innerBezelT / 2, 0, 0]}>
        <boxGeometry args={[innerBezelT, MAIN_SCREEN.height - innerBezelT * 2, 0.06]} />
        <meshStandardMaterial color="#121212" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Gold outer border — four rails */}
      <mesh position={[0, outerH / 2 - FRAME_T / 2, zFrame]}>
        <boxGeometry args={[outerW, FRAME_T, 0.1]} />
        <meshStandardMaterial
          color={FRAME_GOLD}
          metalness={0.9}
          roughness={0.22}
          emissive={FRAME_GOLD}
          emissiveIntensity={0.18}
        />
      </mesh>
      <mesh position={[0, -(outerH / 2 - FRAME_T / 2), zFrame]}>
        <boxGeometry args={[outerW, FRAME_T, 0.1]} />
        <meshStandardMaterial
          color={FRAME_GOLD}
          metalness={0.9}
          roughness={0.22}
          emissive={FRAME_GOLD}
          emissiveIntensity={0.22}
        />
      </mesh>
      <mesh position={[-(outerW / 2 - FRAME_T / 2), 0, zFrame]}>
        <boxGeometry args={[FRAME_T, outerH - FRAME_T * 2, 0.1]} />
        <meshStandardMaterial color={FRAME_GOLD} metalness={0.88} roughness={0.24} />
      </mesh>
      <mesh position={[outerW / 2 - FRAME_T / 2, 0, zFrame]}>
        <boxGeometry args={[FRAME_T, outerH - FRAME_T * 2, 0.1]} />
        <meshStandardMaterial color={FRAME_GOLD} metalness={0.88} roughness={0.24} />
      </mesh>

      {/* Corner accents */}
      {(
        [
          [-1, 1],
          [1, 1],
          [-1, -1],
          [1, -1],
        ] as const
      ).map(([sx, sy]) => (
        <mesh
          key={`c-${sx}-${sy}`}
          position={[(outerW / 2 - FRAME_T * 0.55) * sx, (outerH / 2 - FRAME_T * 0.55) * sy, zFrame + 0.02]}
        >
          <boxGeometry args={[FRAME_T * 1.35, FRAME_T * 1.35, 0.06]} />
          <meshStandardMaterial color={FRAME_GOLD_DARK} metalness={0.92} roughness={0.2} />
        </mesh>
      ))}

      {/* Active LED surface — in front of frame rails */}
      <Suspense fallback={<LedScreenSuspenseFallback args={LED_PANEL} />}>
        {screenUrl ? (
          <LedScreenSurface args={LED_PANEL} url={screenUrl} position={[0, 0, zScreen]} />
        ) : (
          <mesh position={[0, 0, zScreen]}>
            <planeGeometry args={LED_PANEL} />
            <meshStandardMaterial color="#050505" metalness={0.6} roughness={0.35} />
          </mesh>
        )}
      </Suspense>

      {/* Thin gold lip under screen */}
      <mesh position={[0, -h / 2 - 0.04, zFrame]}>
        <boxGeometry args={[w * 0.98, 0.04, 0.05]} />
        <meshStandardMaterial
          color={FRAME_GOLD}
          metalness={0.9}
          roughness={0.2}
          emissive={FRAME_GOLD}
          emissiveIntensity={0.15}
        />
      </mesh>

      <pointLight
        position={[0, 0, -0.15]}
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
