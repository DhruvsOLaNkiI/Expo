import { Torus } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../store';
import { useState, Suspense } from 'react';
import { LedVideoPlane } from './LedVideoPlane';

export function ExpoHall() {
  const setPlayerPosition = useStore((state) => state.setPlayerPosition);
  const [hoverPos, setHoverPos] = useState<THREE.Vector3 | null>(null);
  const hallSize = 90;
  const halfHall = hallSize / 2;
  const wallHeight = 18;
  const ceilingY = 18;
  const entranceZ = halfHall - 2;
  const gridStep = 10;
  const gridLineCount = Math.floor(hallSize / gridStep) + 1;

  return (
    <group>
      {/* ======= PREMIUM MARBLE FLOOR ======= */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        receiveShadow
        onClick={(e) => {
          e.stopPropagation();
          setPlayerPosition([e.point.x, 1.7, e.point.z]);
        }}
        onPointerMove={(e) => setHoverPos(e.point)}
        onPointerOut={() => setHoverPos(null)}
      >
        <planeGeometry args={[hallSize, hallSize]} />
        <meshStandardMaterial
          color="#f0ede6"
          roughness={0.15}
          metalness={0.05}
        />
      </mesh>

      {/* Subtle Floor Grid Lines (Marble Tile Effect) */}
      {Array.from({ length: gridLineCount }).map((_, i) => (
        <group key={`floor-grid-${i}`}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-halfHall + i * gridStep, 0.002, 0]}>
            <planeGeometry args={[0.03, hallSize]} />
            <meshStandardMaterial color="#d4d0c8" roughness={0.5} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, -halfHall + i * gridStep]}>
            <planeGeometry args={[hallSize, 0.03]} />
            <meshStandardMaterial color="#d4d0c8" roughness={0.5} />
          </mesh>
        </group>
      ))}

      {/* Move Here Indicator */}
      {hoverPos && (
        <mesh position={[hoverPos.x, 0.01, hoverPos.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.5, 0.6, 32]} />
          <meshBasicMaterial color="#d4af37" transparent opacity={0.5} />
        </mesh>
      )}

      {/* ======= CEILING ======= */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, ceilingY, 0]} receiveShadow>
        <planeGeometry args={[hallSize, hallSize]} />
        <meshStandardMaterial color="#fdfaf5" roughness={0.9} />
      </mesh>

      {/* Architectural Ceiling Rings (Bharat Mandapam vibe) */}
      <group position={[0, ceilingY - 1.4, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <Torus args={[12, 0.25, 16, 100]}>
          <meshStandardMaterial color="#d4af37" metalness={0.9} roughness={0.1} emissive="#d4af37" emissiveIntensity={0.2} />
        </Torus>
        <Torus args={[18.5, 0.25, 16, 100]}>
          <meshStandardMaterial color="#d4af37" metalness={0.9} roughness={0.1} emissive="#d4af37" emissiveIntensity={0.1} />
        </Torus>
        <Torus args={[25.5, 0.25, 16, 100]}>
          <meshStandardMaterial color="#fdfaf5" metalness={0.1} roughness={0.4} />
        </Torus>
      </group>

      {/* Recessed Ceiling Cove Light Ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, ceilingY - 0.45, 0]}>
        <ringGeometry args={[11.5, 12.3, 128]} />
        <meshStandardMaterial color="#fff5e6" emissive="#fff5e6" emissiveIntensity={0.6} />
      </mesh>

      {/* ======= OUTER WALLS ======= */}
      <Wall position={[0, wallHeight / 2, -halfHall]} rotation={[0, 0, 0]} wallWidth={hallSize} wallHeight={wallHeight} />
      <Wall position={[0, wallHeight / 2, halfHall]} rotation={[0, Math.PI, 0]} wallWidth={hallSize} wallHeight={wallHeight} />
      <Wall position={[-halfHall, wallHeight / 2, 0]} rotation={[0, Math.PI / 2, 0]} wallWidth={hallSize} wallHeight={wallHeight} />
      <Wall position={[halfHall, wallHeight / 2, 0]} rotation={[0, -Math.PI / 2, 0]} wallWidth={hallSize} wallHeight={wallHeight} />

      {/* ======= ENTRANCE LOBBY ======= */}
      <group position={[0, 0, entranceZ]}>
        {/* Signage Screen with Video */}
        <group position={[0, 8, 1.9]} rotation={[0, Math.PI, 0]}>
          <mesh>
            <planeGeometry args={[20, 5]} />
            <meshStandardMaterial color="#111" roughness={0.2} metalness={0.8} />
          </mesh>
          <Suspense fallback={<meshBasicMaterial color="#111" />}>
            <LedVideoPlane args={[19.8, 4.8]} url="/expo-led-video.mp4" />
          </Suspense>
        </group>

        {/* Reception Desk */}
        <group position={[0, 0.5, -4]}>
          <mesh position={[0, 0, 0]} castShadow>
            <boxGeometry args={[8, 1, 1]} />
            <meshStandardMaterial color="#fdfaf5" metalness={0.05} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.6, 0.2]} castShadow>
            <boxGeometry args={[8.4, 0.2, 1.4]} />
            <meshStandardMaterial color="#d4af37" metalness={0.9} roughness={0.1} />
          </mesh>
        </group>

        {/* Large Reception Banner */}
        <group position={[0, 6, -4.5]} rotation={[0, Math.PI, 0]}>
          {/* Support Pillars */}
          <mesh position={[-8.1, -3, 0]}>
            <cylinderGeometry args={[0.1, 0.1, 12, 16]} />
            <meshStandardMaterial color="#d4af37" metalness={0.8} roughness={0.2} />
          </mesh>
          <mesh position={[8.1, -3, 0]}>
            <cylinderGeometry args={[0.1, 0.1, 12, 16]} />
            <meshStandardMaterial color="#d4af37" metalness={0.8} roughness={0.2} />
          </mesh>

          <mesh position={[0, 0, -0.1]}>
            <planeGeometry args={[16.2, 9.2]} />
            <meshStandardMaterial color="#000" metalness={1} roughness={0.1} />
          </mesh>
          <Suspense fallback={<meshBasicMaterial color="#111" />}>
            <LedVideoPlane args={[16, 9]} url="/expo-led-video.mp4" />
          </Suspense>

          {/* Decorative frame */}
          <mesh position={[0, 4.6, 0]}>
            <boxGeometry args={[16.5, 0.2, 0.2]} />
            <meshStandardMaterial color="#d4af37" metalness={0.8} roughness={0.2} />
          </mesh>
          <mesh position={[0, -4.6, 0]}>
            <boxGeometry args={[16.5, 0.2, 0.2]} />
            <meshStandardMaterial color="#d4af37" metalness={0.8} roughness={0.2} />
          </mesh>
        </group>
        <spotLight
          position={[0, 12, -10]}
          angle={0.42}
          penumbra={0.75}
          intensity={95}
          color="#ffe8c4"
          distance={45}
          decay={2}
          target-position={[0, 6, -4.5]}
        />
      </group>
      {/* Vertex Elite + luxury stalls are defined in Booths.tsx */}
    </group>
  );
}

function Wall({
  position,
  rotation,
  wallWidth,
  wallHeight,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  wallWidth: number;
  wallHeight: number;
}) {
  const panelCount = Math.floor(wallWidth / 10);
  const panelGap = wallWidth / panelCount;
  return (
    <group position={position} rotation={rotation}>
      <mesh receiveShadow>
        <planeGeometry args={[wallWidth, wallHeight]} />
        <meshStandardMaterial color="#fcf9f2" roughness={0.9} metalness={0.05} />
      </mesh>

      {/* Decorative Vertical Gold Panels */}
      {Array.from({ length: panelCount }).map((_, i) => (
        <mesh key={i} position={[-wallWidth / 2 + panelGap / 2 + i * panelGap, 0, 0.1]} castShadow receiveShadow>
          <boxGeometry args={[0.8, wallHeight - 2, 0.15]} />
          <meshStandardMaterial color="#d4af37" metalness={0.85} roughness={0.15} />
        </mesh>
      ))}

      {/* Gold Trim */}
      <mesh position={[0, wallHeight / 2 - 0.5, 0.1]} castShadow>
        <boxGeometry args={[wallWidth, 0.5, 0.2]} />
        <meshStandardMaterial color="#d4af37" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Bottom Gold Skirting */}
      <mesh position={[0, -wallHeight / 2 + 0.2, 0.1]}>
        <boxGeometry args={[wallWidth, 0.4, 0.15]} />
        <meshStandardMaterial color="#d4af37" metalness={0.8} roughness={0.2} />
      </mesh>
    </group>
  );
}
