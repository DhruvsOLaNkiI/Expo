import { Text, Box, useGLTF } from '@react-three/drei';
import { Suspense, useMemo, useRef, useLayoutEffect } from 'react';
import * as THREE from 'three';
import schoolChairUrl from '../../school-chair/school_chair.glb?url';
import { LedVideoPlane } from './LedVideoPlane';

function ConferenceChair({ position }: { position: [number, number, number] }) {
  const { scene } = useGLTF(schoolChairUrl);
  const chairScene = useMemo(() => {
    const cloned = scene.clone(true);
    cloned.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = false;
        mesh.receiveShadow = true;
      }
    });
    return cloned;
  }, [scene]);

  return (
    <group position={position} scale={[0.18, 0.18, 0.18]} rotation={[0, 0, 0]}>
      <primitive object={chairScene} />
    </group>
  );
}

export function Ballroom({ showVideos = true }: { showVideos?: boolean }) {
  return (
    <group position={[0, 0, -30]}>
      {/* Stage */}
      <mesh position={[0, 0.5, -4]} receiveShadow castShadow>
        <boxGeometry args={[40, 1, 10]} />
        <meshStandardMaterial color="#fdfaf5" roughness={0.3} metalness={0.05} />
      </mesh>

      {/* Giant LED Wall */}
      <mesh position={[0, 6, -8.5]}>
        <planeGeometry args={[30, 10]} />
        <meshStandardMaterial color="#fdfaf5" roughness={0.3} metalness={0.05} />
      </mesh>
      {/* Main stage backdrop — solid panel only; video plays on side LEDs */}
      <mesh position={[0, 6, -8.4]}>
        <planeGeometry args={[29.5, 9.5]} />
        <meshStandardMaterial color="#080808" roughness={0.4} metalness={0.2} />
      </mesh>

      {/* Futuristic pattern lines on screen */}
      <mesh position={[0, 6, -8.35]}>
        <planeGeometry args={[29.5, 9.5]} />
        <meshBasicMaterial color="#d4af37" wireframe transparent opacity={0.1} />
      </mesh>

      {/* Massive Side Wall LED Presentation Panels */}
      {[-1, 1].map((side) => (
        <group key={`massive-side-led-${side}`} position={[side * 25, 6.1, -8.18]}>
          {/* Recessed architectural niche (near floor-to-ceiling proportion) */}
          <mesh position={[0, 0, -0.22]} receiveShadow>
            <boxGeometry args={[10.9, 7.8, 0.5]} />
            <meshStandardMaterial color="#e8e2d7" roughness={0.75} metalness={0.06} />
          </mesh>

          {/* Soft warm ambient backlight */}
          <mesh position={[0, 0, -0.06]}>
            <planeGeometry args={[10.4, 7.3]} />
            <meshStandardMaterial
              color="#fff0cf"
              emissive="#fff0cf"
              emissiveIntensity={0.26}
              transparent
              opacity={0.22}
            />
          </mesh>

          {/* Champagne architectural frame (thin premium bezel) */}
          <mesh castShadow>
            <boxGeometry args={[10.1, 7, 0.2]} />
            <meshStandardMaterial color="#d4af37" metalness={0.95} roughness={0.18} />
          </mesh>

          {/* Glossy black built-in LED wall housing */}
          <mesh position={[0, 0, 0.045]} castShadow>
            <boxGeometry args={[9.84, 6.74, 0.15]} />
            <meshStandardMaterial color="#0b0b0b" metalness={0.88} roughness={0.14} />
          </mesh>

          {/* Cinematic giant side display content */}
          {showVideos ? (
            <Suspense fallback={<meshBasicMaterial color="#111" />}>
              <LedVideoPlane
                args={[9.62, 6.52]}
                url="/expo-led-video.mp4"
                position={[0, 0, 0.12]}
              />
            </Suspense>
          ) : (
            <meshBasicMaterial color="#111" />
          )}

          {/* Side LED glow for presentation mood */}
          <rectAreaLight
            position={[0, 0, 0.5]}
            width={8.8}
            height={5.8}
            intensity={3}
            color="#ffe8c2"
          />
        </group>
      ))}

      <Text
        position={[0, 8, -8.3]}
        fontSize={1.2}
        color="#d4af37"
        sdfGlyphSize={192}
        font="https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfMZhrib2Bg-4.ttf"
      >
        Yamuna Expressway DIGITAL Property Expo
      </Text>
      <Text
        position={[0, 5, -8.28]}
        fontSize={1.5}
        color="#ebe8e2"
        maxWidth={28}
        textAlign="center"
        sdfGlyphSize={256}
        outlineWidth={0}
        strokeWidth={0}
        font="https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfMZhrib2Bg-4.ttf"
      >
        Digital Broker.in
      </Text>

      {/* Podium */}
      <group position={[0, 1, -1]}>
        <Box args={[1, 1.5, 0.8]} position={[0, 0.75, 0]} castShadow>
          <meshStandardMaterial color="#ffffff" roughness={0.1} />
        </Box>
        <Box args={[1.2, 0.1, 1]} position={[0, 1.55, 0]} castShadow>
          <meshStandardMaterial color="#d4af37" />
        </Box>
      </group>

      {/* Premium conference seating with central aisle */}
      {Array.from({ length: 5 }).map((_, row) => {
        const z = 4.8 + row * 2.25;
        const leftCols = Array.from({ length: 5 }).map((__, col) => -9.5 + col * 1.55);
        const rightCols = Array.from({ length: 5 }).map((__, col) => 2.3 + col * 1.55);
        return (
          <group key={`chair-row-${row}`}>
            {leftCols.map((x) => (
              <ConferenceChair key={`chair-left-${row}-${x}`} position={[x, 0, z]} />
            ))}
            {rightCols.map((x) => (
              <ConferenceChair key={`chair-right-${row}-${x}`} position={[x, 0, z]} />
            ))}
          </group>
        );
      })}

      {/* Soft fill on backdrop — reduces harsh under-screen shadows */}
      <pointLight position={[0, 6.2, -6]} intensity={14} distance={22} decay={2} color="#f5f0e8" />

      {/* Stage Lighting — aimed at screen (invalid target-position was ignored before) */}
      <BallroomSpot
        position={[-15, 12, 5]}
        target={[0, 6, -8.2]}
        intensity={38}
      />
      <BallroomSpot
        position={[15, 12, 5]}
        target={[0, 6, -8.2]}
        intensity={38}
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

useGLTF.preload(schoolChairUrl);
