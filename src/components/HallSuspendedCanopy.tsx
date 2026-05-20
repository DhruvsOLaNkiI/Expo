import { Text, Torus } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Suspense, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { LedScreenSurface } from './LedVideoPlane';

function TickerRing({
  radius,
  height,
  yPos,
  text,
  speed,
  reverse,
  color,
  bgColor,
}: {
  radius: number;
  height: number;
  yPos: number;
  text: string;
  speed: number;
  reverse: boolean;
  color: string;
  bgColor: string;
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.Texture();

    const fullText = `${text} • ${text} • ${text} • ${text} • `;
    canvas.width = 8192;
    canvas.height = 200;

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#d4af37';
    ctx.fillRect(0, 0, canvas.width, 10);
    ctx.fillRect(0, canvas.height - 10, canvas.width, 10);

    ctx.font = 'bold 118px "Inter", sans-serif';
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = color;
    ctx.shadowBlur = 28;

    ctx.fillText(fullText, canvas.width / 2, canvas.height / 2 + 2);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 1);
    tex.anisotropy = 16;
    return tex;
  }, [text, color, bgColor]);

  useFrame((state, delta) => {
    texture.offset.x += delta * speed * (reverse ? -1 : 1);
  });

  return (
    <mesh position={[0, yPos, 0]}>
      <cylinderGeometry args={[radius, radius, height, 64]} />
      <meshStandardMaterial
        map={texture}
        roughness={0.92}
        metalness={0.06}
        emissive="#d4af37"
        emissiveIntensity={0.12}
        envMapIntensity={0.08}
      />
    </mesh>
  );
}

function SuspendedExpoCanopy({
  position,
  name,
}: {
  position: [number, number, number];
  name: string;
}) {
  const graphicRingRef = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (graphicRingRef.current) {
      graphicRingRef.current.rotation.y += delta * 0.5;
    }
  });

  return (
    <group name={name} position={position}>
      {/* Support Cables */}
      <mesh position={[-5, 3, -5]}>
        <cylinderGeometry args={[0.03, 0.03, 15, 8]} />
        <meshStandardMaterial color="#d4af37" metalness={1} />
      </mesh>
      <mesh position={[5, 3, -5]}>
        <cylinderGeometry args={[0.03, 0.03, 15, 8]} />
        <meshStandardMaterial color="#d4af37" metalness={1} />
      </mesh>
      <mesh position={[-5, 3, 5]}>
        <cylinderGeometry args={[0.03, 0.03, 15, 8]} />
        <meshStandardMaterial color="#d4af37" metalness={1} />
      </mesh>
      <mesh position={[5, 3, 5]}>
        <cylinderGeometry args={[0.03, 0.03, 15, 8]} />
        <meshStandardMaterial color="#d4af37" metalness={1} />
      </mesh>

      <group>
        {/* Clean upper crown ring (text removed) */}
        <mesh position={[0, 3.5, 0]}>
          <cylinderGeometry args={[9.5, 9.5, 1.0, 96]} />
          <meshStandardMaterial color="#d4af37" metalness={0.2} roughness={0.75} envMapIntensity={0.08} />
        </mesh>

        {/* Main Displays (8-Sided) */}
        <group>
          {Array.from({ length: 8 }).map((_, i) => (
            <group key={i} rotation={[0, (i * Math.PI) / 4, 0]}>
              <group rotation={[0, Math.PI, 0]}>
                <mesh position={[0, 0, 8.2]}>
                  <boxGeometry args={[6.27, 4.8, 0.2]} />
                  <meshStandardMaterial color="#111" metalness={0.5} roughness={0.2} />
                </mesh>
                <Suspense fallback={<meshBasicMaterial color="#000" />}>
                  <LedScreenSurface
                    args={[6.1, 4.5]}
                    url="/13391496_3840_2160_60fps.mp4"
                    position={[0, 0, 8.31]}
                  />
                </Suspense>
                <mesh position={[3.5, 0, 8.1]}>
                  <boxGeometry args={[0.2, 4.8, 0.3]} />
                  <meshStandardMaterial color="#d4af37" />
                </mesh>
              </group>
            </group>
          ))}
        </group>

        {/* DIGITAL GRAPHIC RING - Re-aligned & Centered */}
        <group position={[0, -2.6, 0]}>
          <group ref={graphicRingRef}>
            <Torus args={[8.5, 0.03, 16, 128]} rotation={[Math.PI / 2, 0, 0]}>
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

        <TickerRing
          radius={8.5}
          height={1.55}
          yPos={-3.8}
          text="FUTURE OF SMART LIVING • DIGITAL PROPERTY SHOWCASE • INVEST IN PREMIUM LIVING • FUTURISTIC REAL ESTATE EXPERIENCE"
          speed={0.06}
          reverse={false}
          color="#d4af37"
          bgColor="#111111"
        />

        {/* --- BOTTOM DECORATION (Option 5: Combination) --- */}
        <group position={[0, -4.58, 0]}>
          {/* Main Bottom Plate */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <circleGeometry args={[8.5, 64]} />
            <meshStandardMaterial color="#111111" roughness={0.3} metalness={0.8} />
          </mesh>

          {/* Outer Decorative Gold Ring */}
          <mesh position={[0, -0.01, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[8.2, 8.5, 64]} />
            <meshStandardMaterial color="#d4af37" metalness={1} roughness={0.2} />
          </mesh>

          {/* Inner Decorative Gold Ring */}
          <mesh position={[0, -0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[6.5, 6.7, 64]} />
            <meshStandardMaterial color="#d4af37" metalness={1} roughness={0.2} />
          </mesh>

          {/* Subtle Backlighting / Glow Ring */}
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

          {/* Central Medallion */}
          <mesh position={[0, -0.04, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <circleGeometry args={[4.5, 64]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.2} metalness={0.9} />
          </mesh>

          {/* Central Logo / Text */}
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

          {/* Radial Spoke Pattern */}
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
        </group>
      </group>
    </group>
  );
}

/** Single suspended LED ring above the help desk. */
export const HALL_CANOPY_PLACEMENTS = [
  { name: 'hall-canopy-center', position: [0, 14, 0] as [number, number, number] },
];

export function HallSuspendedCanopies() {
  return (
    <>
      {HALL_CANOPY_PLACEMENTS.map((canopy) => (
        <SuspendedExpoCanopy key={canopy.name} name={canopy.name} position={canopy.position} />
      ))}
    </>
  );
}
