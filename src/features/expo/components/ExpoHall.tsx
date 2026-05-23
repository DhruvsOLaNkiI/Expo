import { Torus } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '@/store';
import { Suspense, useState, useRef, useLayoutEffect, useMemo } from 'react';
import { LedScreenSurface, LedScreenSuspenseFallback } from '@/features/media/components/LedVideoPlane';
import { mergeHallLayout, mergeSceneConfig } from '@/features/shared/data/boothLayouts';

/** Main entrance LED — use an asset that exists in /public */
const RECEPTION_LED_VIDEO = '/13391496_3840_2160_60fps.mp4';
const RECEPTION_LED_SIZE: [number, number] = [16.2, 9.2];

/** Cream-whitish convention hall palette (matches live expo look) */
const HALL_CREAM_WALL = '#f6f3ec';
const HALL_CREAM_CEILING = '#ebe8e2';
const HALL_CREAM_CARPET = '#7a1228';

export function ExpoHall({ showVideos = false }: { showVideos?: boolean }) {
  const teleportPlayer = useStore((state) => state.teleportPlayer);
  const hallLayoutOv = useStore((state) => state.sceneOverrides.hallLayout);
  const sceneOverrides = useStore((state) => state.sceneOverrides);
  const sceneCfg = useMemo(() => mergeSceneConfig(sceneOverrides), [sceneOverrides]);
  const compressModels = sceneCfg.modelCompression === '30fps';
  const perfLite = compressModels;
  const hallLayout = useMemo(() => mergeHallLayout(hallLayoutOv), [hallLayoutOv]);
  const [hoverPos, setHoverPos] = useState<THREE.Vector3 | null>(null);
  const hallSize = 90;
  const halfHall = hallSize / 2;
  const wallHeight = 18;
  const ceilingY = 18;
  const entranceZ = halfHall - 2;
  const gridStep = 15;
  const gridLineCount = Math.floor(hallSize / gridStep) + 1;
  const [ox, oy, oz] = hallLayout.entranceLobbyOffset;
  const [bx, by, bz] = hallLayout.receptionBannerOffset;

  return (
    <group>
      {/* ======= RED CARPET FLOORING ======= */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        receiveShadow
        onClick={(e) => {
          e.stopPropagation();
          teleportPlayer([e.point.x, 1.7, e.point.z]);
        }}
        onPointerMove={(e) => setHoverPos(e.point)}
        onPointerOut={() => setHoverPos(null)}
      >
        <planeGeometry args={[hallSize, hallSize]} />
        <meshStandardMaterial
          color={HALL_CREAM_CARPET}
          roughness={0.92}
          metalness={0}
          envMapIntensity={0.25}
        />
      </mesh>

      {/* Subtle carpet nap / panel lines (darker pile) — simplified in compressed mode */}
      {!compressModels && Array.from({ length: gridLineCount }).map((_, i) => (
        <group key={`floor-grid-${i}`}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-halfHall + i * gridStep, 0.002, 0]}>
            <planeGeometry args={[0.045, hallSize]} />
            <meshStandardMaterial color="#4a0a18" roughness={0.96} metalness={0} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, -halfHall + i * gridStep]}>
            <planeGeometry args={[hallSize, 0.045]} />
            <meshStandardMaterial color="#4a0a18" roughness={0.96} metalness={0} />
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

      {/* ======= CEILING ======= (slightly darker to avoid glowing through fog) */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, ceilingY, 0]} receiveShadow>
        <planeGeometry args={[hallSize, hallSize]} />
        <meshStandardMaterial
          color={HALL_CREAM_CEILING}
          roughness={0.92}
          metalness={0.01}
          polygonOffset
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
        />
      </mesh>

      {/* Architectural Ceiling Rings — skip in perf mode (heavy torus meshes) */}
      {!perfLite && (
        <group position={[0, ceilingY - 1.4, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <Torus args={[12, 0.25, 12, 48]}>
            <meshStandardMaterial color="#d4af37" metalness={0.55} roughness={0.35} />
          </Torus>
          <Torus args={[18.5, 0.25, 12, 48]}>
            <meshStandardMaterial color="#d4af37" metalness={0.5} roughness={0.38} />
          </Torus>
          <Torus args={[25.5, 0.25, 12, 48]}>
            <meshStandardMaterial color="#e8dcc0" metalness={0.2} roughness={0.45} />
          </Torus>
        </group>
      )}

      {/* Recessed Ceiling Cove Light Ring — very subtle, blends with ceiling */}
      {!perfLite && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, ceilingY - 0.45, 0]}>
          <ringGeometry args={[11.5, 12.3, 64]} />
          <meshStandardMaterial color="#f0ebe4" emissive="#f5f2ec" emissiveIntensity={0.08} />
        </mesh>
      )}

      {/* Hidden warm LED cove — strip sits in ceiling recess; only soft wash reads on panels */}
      <HallPerimeterCoveWash
        halfHall={halfHall}
        ceilingY={ceilingY}
        wallHeight={wallHeight}
        hallSize={hallSize}
        lite={perfLite}
      />

      {/* ======= OUTER WALLS ======= */}
      <Wall position={[0, wallHeight / 2, -halfHall]} rotation={[0, 0, 0]} wallWidth={hallSize} wallHeight={wallHeight} lite={perfLite} />
      <Wall position={[0, wallHeight / 2, halfHall]} rotation={[0, Math.PI, 0]} wallWidth={hallSize} wallHeight={wallHeight} lite={perfLite} />
      <Wall position={[-halfHall, wallHeight / 2, 0]} rotation={[0, Math.PI / 2, 0]} wallWidth={hallSize} wallHeight={wallHeight} lite={perfLite} />
      <Wall position={[halfHall, wallHeight / 2, 0]} rotation={[0, -Math.PI / 2, 0]} wallWidth={hallSize} wallHeight={wallHeight} lite={perfLite} />

      {/* Corner fills — skipped in perf mode (4 extra light evaluations per frame) */}
      {!perfLite && (
        <>
          <pointLight position={[-38, 9, -38]} intensity={32} distance={70} decay={2} color="#fffaf4" />
          <pointLight position={[38, 9, -38]} intensity={32} distance={70} decay={2} color="#fffaf4" />
          <pointLight position={[-38, 9, 38]} intensity={32} distance={70} decay={2} color="#fffaf4" />
          <pointLight position={[38, 9, 38]} intensity={32} distance={70} decay={2} color="#fffaf4" />
        </>
      )}

      {/* ======= ENTRANCE LOBBY ======= */}
      <group name="hall-entrance-lobby" position={[ox, oy, entranceZ + oz]}>
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

        {/* Large reception LED — faces visitors at south entrance (Reception & LED) */}
        <group name="hall-reception-banner" position={[bx, 6 + by, -4.5 + bz]} rotation={[0, Math.PI, 0]}>
          <ReceptionLedWall showVideos={showVideos} />
        </group>
      </group>
      {/* Vertex Elite + luxury stalls are defined in Booths.tsx */}
    </group>
  );
}

/** Premium LED wall with dark bezel so the panel never blows out to flat white */
function ReceptionLedWall({ showVideos }: { showVideos: boolean }) {
  const [w, h] = RECEPTION_LED_SIZE;
  return (
    <group>
      <mesh position={[-8.1, -3, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 12, 16]} />
        <meshStandardMaterial color="#d4af37" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[8.1, -3, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 12, 16]} />
        <meshStandardMaterial color="#d4af37" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Deep housing — always dark */}
      <mesh position={[0, 0, -0.14]}>
        <boxGeometry args={[w + 0.5, h + 0.5, 0.22]} />
        <meshStandardMaterial color="#0a0a10" metalness={0.85} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0, -0.06]}>
        <boxGeometry args={[w + 0.22, h + 0.22, 0.08]} />
        <meshStandardMaterial color="#1a1a22" emissive="#d4af37" emissiveIntensity={0.2} metalness={0.9} roughness={0.15} />
      </mesh>

      {showVideos ? (
        <Suspense fallback={<LedScreenSuspenseFallback args={RECEPTION_LED_SIZE} />}>
          <LedScreenSurface args={RECEPTION_LED_SIZE} url={RECEPTION_LED_VIDEO} position={[0, 0, -0.02]} />
        </Suspense>
      ) : (
        <mesh position={[0, 0, -0.02]}>
          <planeGeometry args={RECEPTION_LED_SIZE} />
          <meshStandardMaterial color="#08080c" metalness={0.7} roughness={0.25} />
        </mesh>
      )}

      <mesh position={[0, 4.6, 0]}>
        <boxGeometry args={[w + 0.3, 0.2, 0.2]} />
        <meshStandardMaterial color="#d4af37" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[0, -4.6, 0]}>
        <boxGeometry args={[w + 0.3, 0.2, 0.2]} />
        <meshStandardMaterial color="#d4af37" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Soft accent — not a flood (old 95 intensity washed the whole hall white) */}
      <spotLight
        position={[0, 3, 2.5]}
        angle={0.55}
        penumbra={0.85}
        intensity={22}
        color="#ffe8c8"
        distance={28}
        decay={2}
      />
    </group>
  );
}

const COVE_SOFFIT_MAT = {
  color: '#e0dcd4',
  roughness: 0.96,
  metalness: 0.02,
} as const;

const COVE_LIP_MAT = {
  color: '#d4d0c8',
  roughness: 0.95,
  metalness: 0.03,
} as const;

/** Satin gold wall trim — low specular so cove lights don't bloom on vertical plates. */
const WALL_GOLD_PLATE_MAT = {
  color: '#c9a227',
  roughness: 0.82,
  metalness: 0.18,
  envMapIntensity: 0.12,
} as const;

const WALL_GOLD_TRIM_MAT = {
  color: '#c9a227',
  roughness: 0.78,
  metalness: 0.2,
  envMapIntensity: 0.1,
} as const;

/** Recessed perimeter cove + hidden RectAreaLights — warm wash on wall panels only */
function HallPerimeterCoveWash({
  halfHall,
  ceilingY,
  wallHeight,
  hallSize,
  lite = false,
}: {
  halfHall: number;
  ceilingY: number;
  wallHeight: number;
  hallSize: number;
  lite?: boolean;
}) {
  const stripLen = hallSize - 2.4;
  const ly = ceilingY - 0.11;
  const inset = 0.095;
  const warm = '#fff8ee';
  /** Soft cove wash on cream walls */
  const intensity = lite ? 48 : 62;
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
        lite={lite}
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
        lite={lite}
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
        lite={lite}
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
        lite={lite}
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
  lite = false,
}: {
  position: [number, number, number];
  target: [number, number, number];
  color: string;
  lite?: boolean;
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
        intensity={lite ? 36 : 48}
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
  lite = false,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  wallWidth: number;
  wallHeight: number;
  lite?: boolean;
}) {
  const panelCount = lite ? Math.max(5, Math.floor(wallWidth / 18)) : Math.floor(wallWidth / 10);
  const panelGap = wallWidth / panelCount;
  return (
    <group position={position} rotation={rotation}>
      <mesh receiveShadow={!lite} castShadow={!lite}>
        <planeGeometry args={[wallWidth, wallHeight]} />
        <meshStandardMaterial
          color={HALL_CREAM_WALL}
          roughness={0.9}
          metalness={0.01}
          envMapIntensity={lite ? 0.12 : 0.28}
        />
      </mesh>

      {/* Decorative Vertical Gold Panels */}
      {Array.from({ length: panelCount }).map((_, i) => (
        <mesh key={i} position={[-wallWidth / 2 + panelGap / 2 + i * panelGap, 0, 0.1]} castShadow={!lite} receiveShadow={!lite}>
          <boxGeometry args={[0.8, wallHeight - 2, 0.15]} />
          <meshStandardMaterial {...WALL_GOLD_PLATE_MAT} />
        </mesh>
      ))}

      {/* Gold Trim */}
      <mesh position={[0, wallHeight / 2 - 0.5, 0.1]} castShadow receiveShadow>
        <boxGeometry args={[wallWidth, 0.5, 0.2]} />
        <meshStandardMaterial {...WALL_GOLD_TRIM_MAT} />
      </mesh>

      {/* Bottom Gold Skirting */}
      <mesh position={[0, -wallHeight / 2 + 0.2, 0.1]} castShadow receiveShadow>
        <boxGeometry args={[wallWidth, 0.4, 0.15]} />
        <meshStandardMaterial {...WALL_GOLD_TRIM_MAT} />
      </mesh>
    </group>
  );
}
