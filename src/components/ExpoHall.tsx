import { Torus } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../store';
import { useState, Suspense, useRef, useLayoutEffect } from 'react';
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

      {/* ======= CEILING ======= (slightly deeper tone vs walls; polygonOffset avoids z-fight with cove soffit) */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, ceilingY, 0]} receiveShadow>
        <planeGeometry args={[hallSize, hallSize]} />
        <meshStandardMaterial
          color="#ebe6df"
          roughness={0.92}
          metalness={0.04}
          polygonOffset
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
        />
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

      {/* Hidden warm LED cove — strip sits in ceiling recess; only soft wash reads on panels */}
      <HallPerimeterCoveWash
        halfHall={halfHall}
        ceilingY={ceilingY}
        wallHeight={wallHeight}
        hallSize={hallSize}
      />

      {/* ======= OUTER WALLS ======= */}
      <Wall position={[0, wallHeight / 2, -halfHall]} rotation={[0, 0, 0]} wallWidth={hallSize} wallHeight={wallHeight} />
      <Wall position={[0, wallHeight / 2, halfHall]} rotation={[0, Math.PI, 0]} wallWidth={hallSize} wallHeight={wallHeight} />
      <Wall position={[-halfHall, wallHeight / 2, 0]} rotation={[0, Math.PI / 2, 0]} wallWidth={hallSize} wallHeight={wallHeight} />
      <Wall position={[halfHall, wallHeight / 2, 0]} rotation={[0, -Math.PI / 2, 0]} wallWidth={hallSize} wallHeight={wallHeight} />

      {/* ======= ENTRANCE LOBBY ======= */}
      <group position={[0, 0, entranceZ]}>
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

        {/* Large Reception Banner (Single Premium Display) */}
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

          {/* Main LED Video Panel */}
          <Suspense fallback={
            <mesh position={[0, 0, -0.1]}>
              <planeGeometry args={[16.2, 9.2]} />
              <meshStandardMaterial color="#080808" metalness={0.8} roughness={0.2} />
            </mesh>
          }>
            <LedVideoPlane args={[16.2, 9.2]} url="/expo-led-video.mp4" position={[0, 0, -0.1]} />
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

const COVE_SOFFIT_MAT = {
  color: '#9c958c',
  roughness: 0.98,
  metalness: 0.02,
} as const;

const COVE_LIP_MAT = {
  color: '#8a847b',
  roughness: 0.97,
  metalness: 0.03,
} as const;

/** Recessed perimeter cove + hidden RectAreaLights — warm wash on wall panels only */
function HallPerimeterCoveWash({
  halfHall,
  ceilingY,
  wallHeight,
  hallSize,
}: {
  halfHall: number;
  ceilingY: number;
  wallHeight: number;
  hallSize: number;
}) {
  const stripLen = hallSize - 2.4;
  const ly = ceilingY - 0.11;
  const inset = 0.095;
  const warm = '#ffecd8';
  /** Nits — was too low vs hall floods (300+ spot + 0.48 ambient); needs headroom to read on walls */
  const intensity = 88;
  const narrow = 0.14;
  const soffitT = 0.11;
  const soffitD = 0.42;
  const lipH = 0.28;
  const lipT = 0.078;
  const edgeTrim = 1.2;
  const span = hallSize - edgeTrim * 2;

  return (
    <group>
      {/* North (+Z into hall) */}
      <mesh castShadow receiveShadow position={[0, ceilingY - soffitT / 2, -halfHall + soffitD / 2 + 0.02]}>
        <boxGeometry args={[span, soffitT, soffitD]} />
        <meshStandardMaterial {...COVE_SOFFIT_MAT} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, ceilingY - soffitT - lipH / 2, -halfHall + soffitD - lipT / 2 + 0.02]}>
        <boxGeometry args={[span, lipH, lipT]} />
        <meshStandardMaterial {...COVE_LIP_MAT} />
      </mesh>
      <CoveStripLight
        position={[0, ly, -halfHall + inset]}
        target={[0, ly - wallHeight * 0.22, -halfHall]}
        width={stripLen}
        height={narrow}
        color={warm}
        intensity={intensity}
      />
      <CoveWallSpot
        position={[0, ceilingY - 0.14, -halfHall + 0.26]}
        target={[0, ceilingY - 2.35, -halfHall]}
        color={warm}
      />

      {/* South */}
      <mesh castShadow receiveShadow position={[0, ceilingY - soffitT / 2, halfHall - soffitD / 2 - 0.02]}>
        <boxGeometry args={[span, soffitT, soffitD]} />
        <meshStandardMaterial {...COVE_SOFFIT_MAT} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, ceilingY - soffitT - lipH / 2, halfHall - soffitD + lipT / 2 - 0.02]}>
        <boxGeometry args={[span, lipH, lipT]} />
        <meshStandardMaterial {...COVE_LIP_MAT} />
      </mesh>
      <CoveStripLight
        position={[0, ly, halfHall - inset]}
        target={[0, ly - wallHeight * 0.22, halfHall]}
        width={stripLen}
        height={narrow}
        color={warm}
        intensity={intensity}
      />
      <CoveWallSpot
        position={[0, ceilingY - 0.14, halfHall - 0.26]}
        target={[0, ceilingY - 2.35, halfHall]}
        color={warm}
      />

      {/* West */}
      <mesh castShadow receiveShadow position={[-halfHall + soffitD / 2 + 0.02, ceilingY - soffitT / 2, 0]}>
        <boxGeometry args={[soffitD, soffitT, span]} />
        <meshStandardMaterial {...COVE_SOFFIT_MAT} />
      </mesh>
      <mesh castShadow receiveShadow position={[-halfHall + soffitD - lipT / 2 + 0.02, ceilingY - soffitT - lipH / 2, 0]}>
        <boxGeometry args={[lipT, lipH, span]} />
        <meshStandardMaterial {...COVE_LIP_MAT} />
      </mesh>
      <CoveStripLight
        position={[-halfHall + inset, ly, 0]}
        target={[-halfHall, ly - wallHeight * 0.22, 0]}
        width={stripLen}
        height={narrow}
        color={warm}
        intensity={intensity}
      />
      <CoveWallSpot
        position={[-halfHall + 0.26, ceilingY - 0.14, 0]}
        target={[-halfHall, ceilingY - 2.35, 0]}
        color={warm}
      />

      {/* East */}
      <mesh castShadow receiveShadow position={[halfHall - soffitD / 2 - 0.02, ceilingY - soffitT / 2, 0]}>
        <boxGeometry args={[soffitD, soffitT, span]} />
        <meshStandardMaterial {...COVE_SOFFIT_MAT} />
      </mesh>
      <mesh castShadow receiveShadow position={[halfHall - soffitD + lipT / 2 - 0.02, ceilingY - soffitT - lipH / 2, 0]}>
        <boxGeometry args={[lipT, lipH, span]} />
        <meshStandardMaterial {...COVE_LIP_MAT} />
      </mesh>
      <CoveStripLight
        position={[halfHall - inset, ly, 0]}
        target={[halfHall, ly - wallHeight * 0.22, 0]}
        width={stripLen}
        height={narrow}
        color={warm}
        intensity={intensity}
      />
      <CoveWallSpot
        position={[halfHall - 0.26, ceilingY - 0.14, 0]}
        target={[halfHall, ceilingY - 2.35, 0]}
        color={warm}
      />
    </group>
  );
}

/** Wide warm spot from cove — RectArea alone was drowned by hall floods; strip stays hidden in recess */
function CoveWallSpot({
  position,
  target,
  color,
}: {
  position: [number, number, number];
  target: [number, number, number];
  color: string;
}) {
  const lightRef = useRef<THREE.SpotLight>(null);
  const targetRef = useRef<THREE.Group>(null);
  const [px, py, pz] = position;
  const [tx, ty, tz] = target;
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
        position={[px, py, pz]}
        color={color}
        intensity={78}
        distance={56}
        decay={2}
        angle={0.72}
        penumbra={0.96}
        castShadow={false}
      />
      <group ref={targetRef} position={[tx, ty, tz]} />
    </>
  );
}

function CoveStripLight({
  position,
  target,
  width,
  height,
  color,
  intensity,
}: {
  position: [number, number, number];
  target: [number, number, number];
  width: number;
  height: number;
  color: string;
  intensity: number;
}) {
  const ref = useRef<THREE.RectAreaLight>(null);
  const [px, py, pz] = position;
  const [tx, ty, tz] = target;
  useLayoutEffect(() => {
    const L = ref.current;
    if (!L) return;
    L.position.set(px, py, pz);
    L.lookAt(tx, ty, tz);
  }, [px, py, pz, tx, ty, tz, width, height, color, intensity]);
  return <rectAreaLight ref={ref} args={[color, intensity, width, height]} />;
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
      <mesh receiveShadow castShadow>
        <planeGeometry args={[wallWidth, wallHeight]} />
        <meshStandardMaterial
          color="#e4e0d8"
          roughness={0.96}
          metalness={0.02}
          envMapIntensity={0.38}
        />
      </mesh>

      {/* Decorative Vertical Gold Panels */}
      {Array.from({ length: panelCount }).map((_, i) => (
        <mesh key={i} position={[-wallWidth / 2 + panelGap / 2 + i * panelGap, 0, 0.1]} castShadow receiveShadow>
          <boxGeometry args={[0.8, wallHeight - 2, 0.15]} />
          <meshStandardMaterial color="#d4af37" metalness={0.85} roughness={0.15} envMapIntensity={1.1} />
        </mesh>
      ))}

      {/* Gold Trim */}
      <mesh position={[0, wallHeight / 2 - 0.5, 0.1]} castShadow receiveShadow>
        <boxGeometry args={[wallWidth, 0.5, 0.2]} />
        <meshStandardMaterial color="#d4af37" metalness={0.8} roughness={0.2} envMapIntensity={1.05} />
      </mesh>

      {/* Bottom Gold Skirting */}
      <mesh position={[0, -wallHeight / 2 + 0.2, 0.1]} castShadow receiveShadow>
        <boxGeometry args={[wallWidth, 0.4, 0.15]} />
        <meshStandardMaterial color="#d4af37" metalness={0.8} roughness={0.2} envMapIntensity={1.05} />
      </mesh>
    </group>
  );
}
