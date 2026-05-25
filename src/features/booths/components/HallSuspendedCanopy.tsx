import { Text, Torus } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Suspense, useMemo, useRef } from 'react';
import * as THREE from 'three';
import {
  LedScreenSurface,
  LedScreenSuspenseFallback,
  resolveBoothLedScreenUrl,
} from '@/features/media/components/LedVideoPlane';

import { HELP_DESK_RADIUS, HALL_HEIGHT } from '@/features/shared/data/boothLayouts';

const DEFAULT_CANOPY_VIDEO = '/13391496_3840_2160_60fps.mp4';

/** Original canopy was sized for ~11.6 m desk; scale to match {@link HELP_DESK_RADIUS}. */
export const HELP_DESK_CANOPY_SCALE = HELP_DESK_RADIUS / 5.8;

function TickerRing({
  radius,
  height,
  yPos,
  text,
  speed,
  reverse,
  color,
  bgColor,
  lite = false,
}: {
  radius: number;
  height: number;
  yPos: number;
  text: string;
  speed: number;
  reverse: boolean;
  color: string;
  bgColor: string;
  lite?: boolean;
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.Texture();

    const fullText = lite ? `${text} • ${text} • ` : `${text} • ${text} • ${text} • ${text} • `;
    canvas.width = lite ? 4096 : 8192;
    canvas.height = lite ? 128 : 200;

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#d4af37';
    ctx.fillRect(0, 0, canvas.width, lite ? 6 : 10);
    ctx.fillRect(0, canvas.height - (lite ? 6 : 10), canvas.width, lite ? 6 : 10);

    ctx.font = lite ? 'bold 72px "Inter", sans-serif' : 'bold 118px "Inter", sans-serif';
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (!lite) ctx.shadowBlur = 28;

    ctx.fillText(fullText, canvas.width / 2, canvas.height / 2 + 2);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 1);
    tex.anisotropy = lite ? 1 : 8;
    return tex;
  }, [text, color, bgColor, lite]);

  const tickAccum = useRef(0);

  useFrame((_, delta) => {
    tickAccum.current += delta;
    if (lite && tickAccum.current < 0.04) return;
    if (lite) tickAccum.current = 0;
    texture.offset.x += delta * speed * (reverse ? -1 : 1);
  });

  const segments = lite ? 32 : 64;

  return (
    <mesh position={[0, yPos, 0]}>
      <cylinderGeometry args={[radius, radius, height, segments]} />
      <meshStandardMaterial
        map={texture}
        roughness={0.92}
        metalness={0.06}
        emissive="#d4af37"
        emissiveIntensity={lite ? 0.06 : 0.12}
        envMapIntensity={0.08}
      />
    </mesh>
  );
}

function SuspendedExpoCanopy({
  position,
  name,
  showVideos = false,
  screenUrl,
  lite = false,
  scale = 1,
}: {
  position: [number, number, number];
  name: string;
  showVideos?: boolean;
  screenUrl?: string;
  lite?: boolean;
  scale?: number;
}) {
  const ledUrl = resolveBoothLedScreenUrl(screenUrl, DEFAULT_CANOPY_VIDEO, showVideos);
  const graphicRingRef = useRef<THREE.Group>(null);
  const spinAccum = useRef(0);
  const screenCount = lite ? 4 : 8;
  const screenStep = (Math.PI * 2) / screenCount;

  useFrame((_, delta) => {
    if (!graphicRingRef.current || lite) return;
    graphicRingRef.current.rotation.y += delta * 0.5;
  });

  useFrame((_, delta) => {
    if (!lite || !graphicRingRef.current) return;
    spinAccum.current += delta;
    if (spinAccum.current < 0.05) return;
    spinAccum.current = 0;
    graphicRingRef.current.rotation.y += 0.025;
  });

  const torusSegments = lite ? [8, 48] : [16, 128];

  return (
    <group name={name} position={position} scale={[scale, scale, scale]}>
      <mesh position={[-5, 3, -5]}>
        <cylinderGeometry args={[0.03, 0.03, 15, 6]} />
        <meshStandardMaterial color="#d4af37" metalness={1} />
      </mesh>
      <mesh position={[5, 3, -5]}>
        <cylinderGeometry args={[0.03, 0.03, 15, 6]} />
        <meshStandardMaterial color="#d4af37" metalness={1} />
      </mesh>
      <mesh position={[-5, 3, 5]}>
        <cylinderGeometry args={[0.03, 0.03, 15, 6]} />
        <meshStandardMaterial color="#d4af37" metalness={1} />
      </mesh>
      <mesh position={[5, 3, 5]}>
        <cylinderGeometry args={[0.03, 0.03, 15, 6]} />
        <meshStandardMaterial color="#d4af37" metalness={1} />
      </mesh>

      <group>
        <mesh position={[0, 3.5, 0]}>
          <cylinderGeometry args={[9.5, 9.5, 1.0, lite ? 48 : 96]} />
          <meshStandardMaterial color="#d4af37" metalness={0.2} roughness={0.75} envMapIntensity={0.08} />
        </mesh>

        <group>
          {Array.from({ length: screenCount }).map((_, i) => (
            <group key={i} rotation={[0, i * screenStep, 0]}>
              <group rotation={[0, Math.PI, 0]}>
                <mesh position={[0, 0, 8.2]}>
                  <boxGeometry args={[6.27, 4.8, 0.2]} />
                  <meshStandardMaterial color="#111" metalness={0.5} roughness={0.2} />
                </mesh>
                {ledUrl ? (
                  <Suspense fallback={<LedScreenSuspenseFallback args={[6.1, 4.5]} />}>
                    <LedScreenSurface
                      args={[6.1, 4.5]}
                      url={ledUrl}
                      position={[0, 0, 8.31]}
                      maxPlayDistance={lite ? 38 : 55}
                    />
                  </Suspense>
                ) : (
                  <mesh position={[0, 0, 8.31]}>
                    <planeGeometry args={[6.1, 4.5]} />
                    <meshBasicMaterial color="#0a0a0a" toneMapped />
                  </mesh>
                )}
                {!lite && (
                  <mesh position={[3.5, 0, 8.1]}>
                    <boxGeometry args={[0.2, 4.8, 0.3]} />
                    <meshStandardMaterial color="#d4af37" />
                  </mesh>
                )}
              </group>
            </group>
          ))}
        </group>

        {!lite && (
          <group position={[0, -2.6, 0]}>
            <group ref={graphicRingRef}>
              <Torus args={[8.5, 0.03, torusSegments[0], torusSegments[1]]} rotation={[Math.PI / 2, 0, 0]}>
                <meshStandardMaterial
                  color="#d4af37"
                  emissive="#d4af37"
                  emissiveIntensity={1.5}
                  transparent
                  opacity={0.3}
                  wireframe
                />
              </Torus>
            </group>
          </group>
        )}

        <TickerRing
          radius={8.5}
          height={1.55}
          yPos={-3.8}
          text="FUTURE OF SMART LIVING • DIGITAL PROPERTY SHOWCASE • INVEST IN PREMIUM LIVING • FUTURISTIC REAL ESTATE EXPERIENCE"
          speed={lite ? 0.04 : 0.06}
          reverse={false}
          color="#d4af37"
          bgColor="#111111"
          lite={lite}
        />

        <group position={[0, -4.58, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <circleGeometry args={[8.5, lite ? 32 : 64]} />
            <meshStandardMaterial color="#111111" roughness={0.3} metalness={0.8} />
          </mesh>

          <mesh position={[0, -0.01, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[8.2, 8.5, lite ? 32 : 64]} />
            <meshStandardMaterial color="#d4af37" metalness={1} roughness={0.2} />
          </mesh>

          {!lite && (
            <>
              <mesh position={[0, -0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <ringGeometry args={[6.5, 6.7, 64]} />
                <meshStandardMaterial color="#d4af37" metalness={1} roughness={0.2} />
              </mesh>
              <mesh position={[0, -0.03, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <ringGeometry args={[4.8, 5.2, 64]} />
                <meshStandardMaterial
                  color="#fff5e6"
                  emissive="#fff5e6"
                  emissiveIntensity={0.8}
                  transparent
                  opacity={0.6}
                />
              </mesh>
            </>
          )}

          <mesh position={[0, -0.04, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <circleGeometry args={[4.5, lite ? 24 : 64]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.2} metalness={0.9} />
          </mesh>

          {!lite && (
            <>
              <Text
                position={[0, -0.06, 0]}
                rotation={[Math.PI / 2, 0, Math.PI]}
                fontSize={0.8}
                color="#d4af37"
                font="https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfMZhrib2Bg-4.ttf"
                anchorX="center"
                anchorY="middle"
                letterSpacing={0.1}
              >
                PREMIUM EXPO
                <meshStandardMaterial attach="material" color="#d4af37" emissive="#d4af37" emissiveIntensity={0.4} />
              </Text>

              {Array.from({ length: 12 }).map((_, i) => (
                <mesh
                  key={i}
                  position={[0, -0.02, 0]}
                  rotation={[Math.PI / 2, 0, (i * Math.PI) / 6]}
                >
                  <boxGeometry args={[0.05, 1.8, 0.01]} />
                  <meshStandardMaterial color="#d4af37" metalness={1} roughness={0.2} />
                </mesh>
              ))}
            </>
          )}
        </group>
      </group>
    </group>
  );
}

/** Single suspended LED ring above the help desk (8 m ceiling). */
export const HALL_CANOPY_PLACEMENTS = [
  { name: 'hall-canopy-center', position: [0, HALL_HEIGHT * 0.68, 0] as [number, number, number] },
];

export function HallSuspendedCanopies({
  showVideos = false,
  screenUrl,
  lite = false,
}: {
  showVideos?: boolean;
  screenUrl?: string;
  lite?: boolean;
}) {
  return (
    <>
      {HALL_CANOPY_PLACEMENTS.map((canopy) => (
        <SuspendedExpoCanopy
          key={canopy.name}
          name={canopy.name}
          position={canopy.position}
          scale={HELP_DESK_CANOPY_SCALE}
          showVideos={showVideos}
          screenUrl={screenUrl}
          lite={lite}
        />
      ))}
    </>
  );
}
