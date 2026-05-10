import { Text, Box, Cylinder, Torus, useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useStore } from '../store';
import { Suspense, useRef, useMemo, useLayoutEffect } from 'react';
import * as THREE from 'three';
import { clone as cloneSkinnedHierarchy } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { LedVideoPlane } from './LedVideoPlane';

const PROJECT_VIDEOS = [
  "/13391496_3840_2160_60fps.mp4",
  "/13391496_3840_2160_60fps.mp4",
  "/13391496_3840_2160_60fps.mp4",
  "/13391496_3840_2160_60fps.mp4",
  "/13391496_3840_2160_60fps.mp4",
  "/13391496_3840_2160_60fps.mp4"
];

/** File in `public/…` → URL starts with `/assets/…` */
const VERTEX_ELITE_MODEL_URL =
  '/assets/7ad7b4d9-2523-4285-9504-9b4ea81e8ca3/textured.glb';
/**
 * Hostess character: central help desk + every luxury booth (URL-encode spaces/parens).
 * Swap file under `public/assets/` and update `HOSTESS_MODEL_URL`.
 */
const HOSTESS_MODEL_URL = '/assets/scene%20(3).glb';
const HOSTESS_MAX_WIDTH = 2.25;
const HOSTESS_MAX_HEIGHT = 1.58;

/** Stable idle phase per booth / desk (desync motion). */
function stringToPhase(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 10000;
  return h * 0.001 * Math.PI;
}

/**
 * Luxury row booth definitions — one assistant is spawned per entry (see `Booth` + `BoothHostessGreeter`).
 * Vertex Elite custom plot is separate below.
 */
const EXPO_LUXURY_BOOTHS_LEFT: {
  position: [number, number, number];
  rotation: [number, number, number];
  id: string;
  name: string;
  color: string;
  videoIndex: number;
}[] = [
  { position: [-20, 0, -15], rotation: [0, Math.PI / 2 - 0.16, 0], id: 'builder-1', name: 'LUXE TOWERS', color: '#fcfaf5', videoIndex: 0 },
  { position: [-20, 0, 5], rotation: [0, Math.PI / 2, 0], id: 'builder-2', name: 'AURUM RESIDENCES', color: '#fcf9f2', videoIndex: 1 },
];

const EXPO_LUXURY_BOOTHS_RIGHT: {
  position: [number, number, number];
  rotation: [number, number, number];
  id: string;
  name: string;
  color: string;
  videoIndex: number;
}[] = [
  { position: [20, 0, -15], rotation: [0, -Math.PI / 2 + 0.16, 0], id: 'builder-4', name: 'CROWN ESTATES', color: '#fcfaf5', videoIndex: 3 },
  { position: [20, 0, 5], rotation: [0, -Math.PI / 2, 0], id: 'builder-5', name: 'THE MONARCH', color: '#fcf9f2', videoIndex: 4 },
  { position: [20, 0, 25], rotation: [0, -Math.PI / 2 - 0.16, 0], id: 'builder-6', name: 'HORIZON VISTAS', color: '#fdfbf5', videoIndex: 5 },
];
/** Longest axis of the GLB in world units after load (tune to fit the slot) */
const VERTEX_ELITE_MAX_DIM = 12;

/**
 * World position [ X, Y, Z ] — change these to slide your model on the floor:
 *
 *   X — LEFT ↔ RIGHT (birds-eye): smaller number = LEFT, larger = RIGHT
 *   Y — UP ↔ DOWN (keep 0 unless you want it floating or sunk)
 *   Z — along the hall: smaller Z (more negative) = deeper toward the FAR wall when you walk forward (W);
 *                       larger Z (more positive) = closer to the ENTRANCE lobby end
 *
 * Nudge in steps of ~2–5 to see the difference.
 */
const VERTEX_ELITE_HALL_POSITION: [number, number, number] = [-21.5, 0, 19];
/** Keep 0 for a level floor. Only use non-zero if you intentionally want pitch (forward/back tilt). */
const VERTEX_ELITE_ROTATION_X = 0;
/** Roll around Z — keep 0 so the model stays upright; use only Y for “spin” on the floor */
const VERTEX_ELITE_ROTATION_Z = 0;
/** Yaw: spin on the floor (face the aisle). Match other left-row booths (~90° + small tweak). */
const VERTEX_ELITE_ROTATION_Y = Math.PI / 2 + 0.06;

const VERTEX_ELITE_HALL_ROTATION: [number, number, number] = [
  VERTEX_ELITE_ROTATION_X,
  VERTEX_ELITE_ROTATION_Y,
  VERTEX_ELITE_ROTATION_Z,
];

export function Booths() {
  return (
    <group position={[0, 0, 0]}>
      {/* Central Featured Help Desk Zone */}
      <FeaturedProperty position={[0, 0, 0]} />

      {/* Main Path Decorative Plants */}
      <Plant position={[-5, 0, 15]} />
      <Plant position={[5, 0, 15]} />
      <Plant position={[-5, 0, 30]} />
      <Plant position={[5, 0, 30]} />

      {/* Row of Luxury Booths Left — definitions in EXPO_LUXURY_BOOTHS_LEFT */}
      {EXPO_LUXURY_BOOTHS_LEFT.map((b) => (
        <Booth
          key={b.id}
          position={b.position}
          rotation={b.rotation}
          id={b.id}
          name={b.name}
          color={b.color}
          accent="#d4af37"
          videoUrl={PROJECT_VIDEOS[b.videoIndex]}
        />
      ))}
      {/* Vertex Elite: no procedural stall — only your GLB (see VertexEliteCustomOnly) */}
      <Suspense fallback={null}>
        <VertexEliteCustomOnly
          position={VERTEX_ELITE_HALL_POSITION}
          rotation={VERTEX_ELITE_HALL_ROTATION}
        />
      </Suspense>

      {/* Row of Luxury Booths Right */}
      {EXPO_LUXURY_BOOTHS_RIGHT.map((b) => (
        <Booth
          key={b.id}
          position={b.position}
          rotation={b.rotation}
          id={b.id}
          name={b.name}
          color={b.color}
          accent="#d4af37"
          videoUrl={PROJECT_VIDEOS[b.videoIndex]}
        />
      ))}
    </group>
  );
}

/** Replaces the entire Vertex Elite procedural stall with only `VERTEX_ELITE_MODEL_URL`. */
function VertexEliteCustomOnly({
  position,
  rotation,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
}) {
  const setActiveBooth = useStore((state) => state.setActiveBooth);
  const { scene } = useGLTF(VERTEX_ELITE_MODEL_URL) as { scene: THREE.Object3D };

  const scaled = useMemo(() => {
    const root = scene.clone(true);
    // Drop baked root rotation/scale from the exporter so the booth sits level on the floor
    root.rotation.set(0, 0, 0);
    root.scale.set(1, 1, 1);
    root.updateMatrixWorld(true);
    root.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    box.getSize(size);
    const max = Math.max(size.x, size.y, size.z, 1e-6);
    root.scale.setScalar(VERTEX_ELITE_MAX_DIM / max);
    root.updateMatrixWorld(true);
    const box2 = new THREE.Box3().setFromObject(root);
    const center = new THREE.Vector3();
    box2.getCenter(center);
    root.position.sub(center);
    root.updateMatrixWorld(true);
    const box3 = new THREE.Box3().setFromObject(root);
    root.position.y -= box3.min.y;
    return root;
  }, [scene]);

  return (
    <group position={position} rotation={rotation}>
      <pointLight position={[0, 6, 0]} intensity={80} distance={35} decay={2} color="#ffffff" />
      <spotLight
        position={[4, 10, 4]}
        angle={0.65}
        penumbra={0.55}
        intensity={120}
        color="#fff5e6"
        distance={40}
        decay={2}
        castShadow
        target-position={[0, 2, 0]}
      />

      {/* Fine-tune offset after hall placement (small nudges only; main move = VERTEX_ELITE_HALL_POSITION) */}
      <group position={[0, 0, 0]} rotation={[0, 0, 0]}>
        <primitive object={scaled} />
      </group>

      <Suspense fallback={null}>
        <ExpoHostessAvatar
          position={[2.05, 0, 4.55]}
          rotation={[0, -0.76, 0]}
          idlePhase={stringToPhase('vertex-elite')}
        />
      </Suspense>

      <mesh
        position={[0, 2, 0]}
        visible={false}
        onClick={(e) => {
          e.stopPropagation();
          const offset = rotation[1] > 0 ? 6 : -6;
          setActiveBooth('VERTEX ELITE', [position[0] + offset, 1.7, position[2]]);
          document.exitPointerLock();
        }}
        onPointerOver={() => {
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'auto';
        }}
      >
        <boxGeometry args={[10, 5, 8]} />
      </mesh>
    </group>
  );
}

function Booth({ position, rotation, id, name, color, accent, videoUrl }: any) {
  const setActiveBooth = useStore((state) => state.setActiveBooth);

  return (
    <group position={position} rotation={rotation}>
      {/* Back Wall with Luxury Trim */}
      <mesh position={[0, 3, -4]} receiveShadow castShadow>
        <boxGeometry args={[12, 6, 0.5]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.6} />
      </mesh>
      
      {/* Gold Wall Accents */}
      <mesh position={[-5.8, 3, -3.9]}>
        <boxGeometry args={[0.2, 6.2, 0.6]} />
        <meshStandardMaterial color="#d4af37" metalness={1} roughness={0.1} />
      </mesh>
      <mesh position={[5.8, 3, -3.9]}>
        <boxGeometry args={[0.2, 6.2, 0.6]} />
        <meshStandardMaterial color="#d4af37" metalness={1} roughness={0.1} />
      </mesh>

      {/* Side Walls */}
      <mesh position={[-5.75, 3, -2]} receiveShadow castShadow>
        <boxGeometry args={[0.5, 6, 4]} />
        <meshStandardMaterial color={color} roughness={0.4} />
      </mesh>
      <mesh position={[5.75, 3, -2]} receiveShadow castShadow>
        <boxGeometry args={[0.5, 6, 4]} />
        <meshStandardMaterial color={color} roughness={0.4} />
      </mesh>

      {/* Floor Pad with Recessed LED Strip */}
      <mesh position={[0, 0.05, -1.5]} receiveShadow>
        <boxGeometry args={[12, 0.1, 5.5]} />
        <meshStandardMaterial color="#f0ede4" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.06, 1.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[12, 0.05]} />
        <meshStandardMaterial color="#d4af37" emissive="#d4af37" emissiveIntensity={2} />
      </mesh>

      {/* Header/Signage */}
      <mesh position={[0, 6.5, -4]} castShadow>
        <boxGeometry args={[12.5, 1.5, 0.6]} />
        <meshStandardMaterial color={color} metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Branding Text */}
      <Text
        position={[0, 6.5, -3.6]}
        fontSize={0.8}
        color={accent}
        anchorX="center"
        anchorY="middle"
        font="https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfMZhrib2Bg-4.ttf"
      >
        {name}
        <meshStandardMaterial attach="material" color={accent} emissive={accent} emissiveIntensity={0.15} />
      </Text>

      {/* Interactive Concierge Desk */}
      <group position={[0, 0.5, 0]}>
        <mesh position={[0, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[4, 1, 1]} />
          <meshStandardMaterial color="#ffffff" metalness={0.1} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
          <boxGeometry args={[4.2, 0.1, 1.2]} />
          <meshStandardMaterial color={accent} metalness={0.4} roughness={0.2} />
        </mesh>

        {/* Counter LED TV */}
        <group position={[1.2, 0.8, -0.2]} rotation={[-0.2, -0.3, 0]}>
          <mesh castShadow>
            <boxGeometry args={[1.6, 1.0, 0.1]} />
            <meshStandardMaterial color="#111" metalness={0.8} roughness={0.2} />
          </mesh>
          <Suspense fallback={<meshBasicMaterial color="#000" />}>
            <LedVideoPlane args={[1.5, 0.9]} url={videoUrl} position={[0, 0, 0.01]} />
          </Suspense>
          <mesh position={[0, -0.6, 0]}>
            <boxGeometry args={[0.4, 0.2, 0.2]} />
            <meshStandardMaterial color="#111" />
          </mesh>
        </group>

        {/* Invisible Click Target for UI Overlay */}
        <mesh
          position={[0, 1, 0]}
          visible={false}
          onClick={(e) => {
            e.stopPropagation();
            const offset = rotation[1] > 0 ? 6 : -6;
            const teleportPos: [number, number, number] = [position[0] + offset, 1.7, position[2]];
            setActiveBooth(name, teleportPos);
            document.exitPointerLock();
          }}
          onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
          onPointerOut={() => { document.body.style.cursor = 'auto'; }}
        >
          <boxGeometry args={[5, 3, 3]} />
        </mesh>
      </group>

      {/* Main Display Screen (Large TV) */}
      <group position={[0, 3, -3.8]}>
        <mesh castShadow>
          <boxGeometry args={[6.4, 3.6, 0.2]} />
          <meshStandardMaterial color="#111" metalness={0.9} roughness={0.1} />
        </mesh>
        <group position={[0, 0, 0.11]}>
          <Suspense fallback={<meshBasicMaterial color="#000" />}>
            <LedVideoPlane args={[6.2, 3.4]} url={videoUrl} />
          </Suspense>
        </group>
      </group>


      <spotLight
        position={[0, 7.5, -1.2]}
        angle={0.45}
        penumbra={0.7}
        intensity={55}
        color="#ffe7bf"
        distance={18}
        decay={2}
        target-position={[0, 3, -3.8]}
      />

      {/* Scale Model Pedestal */}
      <group position={[-3, 0.5, -1.5]}>
        <Cylinder args={[0.8, 0.8, 1, 32]} position={[0, 0, 0]} castShadow receiveShadow>
          <meshStandardMaterial color="#ffffff" roughness={0.1} metalness={0.1} />
        </Cylinder>
        <Box args={[0.5, 1.5, 0.5]} position={[0, 1.25, 0]} castShadow>
          <meshStandardMaterial color="#fff" roughness={0.1} metalness={0.1} />
        </Box>
      </group>

      <Suspense fallback={null}>
        <BoothHostessGreeter side={rotation[1] > 0 ? 'left' : 'right'} boothId={id} />
      </Suspense>

      {/* Promotional standee outside booth (aisle side, local +Z) */}
      <BoothStandee name={name} accent={accent} />
    </group>
  );
}

/** Roll-up style stand facing visitors approaching from the hall center */
function BoothStandee({ name, accent }: { name: string; accent: string }) {
  const w = 0.95;
  const h = 1.55;
  const frameT = 0.04;
  // Local +X = toward TV side of counter; +Z = aisle — matches standee beside desk edge
  const standeePosition: [number, number, number] = [2.76, 0, 3.4];
  return (
    <group position={standeePosition}>
      {/* Weighted base plate */}
      <mesh position={[0, 0.0, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.55, 0.08, 0.35]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.75} roughness={0.25} />
      </mesh>
      {/* Centre pole */}
      <mesh position={[0, 0.005, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.04, 1.55, 12]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.85} roughness={0.2} />
      </mesh>
      {/* Poster panel + gold frame */}
      <group position={[0, 1.02, 0]}>
        <mesh rotation={[0, 0, 0]}>
          <planeGeometry args={[w, h]} />
          <meshStandardMaterial color="#faf8f4" roughness={0.55} metalness={0.05} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, h / 2 + frameT / 2, 0.01]}>
          <boxGeometry args={[w + frameT * 2, frameT, 0.02]} />
          <meshStandardMaterial color={accent} metalness={0.9} roughness={0.2} />
        </mesh>
        <mesh position={[0, -h / 2 - frameT / 2, 0.01]}>
          <boxGeometry args={[w + frameT * 2, frameT, 0.02]} />
          <meshStandardMaterial color={accent} metalness={0.9} roughness={0.2} />
        </mesh>
        <mesh position={[-w / 2 - frameT / 2, 0, 0.01]}>
          <boxGeometry args={[frameT, h, 0.02]} />
          <meshStandardMaterial color={accent} metalness={0.9} roughness={0.2} />
        </mesh>
        <mesh position={[w / 2 + frameT / 2, 0, 0.01]}>
          <boxGeometry args={[frameT, h, 0.02]} />
          <meshStandardMaterial color={accent} metalness={0.9} roughness={0.2} />
        </mesh>
        <Text
          position={[0, 0.15, 0.02]}
          fontSize={0.11}
          color="#1a1a1a"
          anchorX="center"
          anchorY="middle"
          maxWidth={w - 0.12}
          textAlign="center"
          font="https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfMZhrib2Bg-4.ttf"
        >
          {name}
        </Text>
        <Text
          position={[0, -0.35, 0.02]}
          fontSize={0.055}
          color={accent}
          anchorX="center"
          anchorY="middle"
          maxWidth={w - 0.12}
          textAlign="center"
          font="https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfMZhrib2Bg-4.ttf"
        >
          LUXURY RESIDENCES
        </Text>
      </group>
    </group>
  );
}

function Plant({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <Cylinder args={[0.5, 0.4, 1, 16]} position={[0, 0.5, 0]} castShadow>
        <meshStandardMaterial color="#fcfcfc" roughness={0.2} metalness={0.1} />
      </Cylinder>
      <mesh position={[0, 1.5, 0]} castShadow>
        <sphereGeometry args={[0.8, 16, 16]} />
        <meshStandardMaterial color="#1a4d2e" roughness={0.9} />
      </mesh>
    </group>
  );
}

function TickerRing({ radius, height, yPos, text, speed, reverse, color, bgColor }: any) {
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
        emissiveMap={texture}
        emissive="#ffffff"
        emissiveIntensity={0.8}
        roughness={0.2}
        metalness={0.8}
      />
    </mesh>
  );
}

function FeaturedProperty({ position }: { position: [number, number, number] }) {
  const textGroupRef = useRef<any>(null);
  const graphicRingRef = useRef<any>(null);

  useFrame((state, delta) => {
    const time = state.clock.getElapsedTime();
    if (textGroupRef.current) {
      textGroupRef.current.rotation.y += delta * 0.15;
    }
    if (graphicRingRef.current) {
      graphicRingRef.current.rotation.y += delta * 0.5;
    }
  });

  return (
    <group position={position}>
      {/* --- RECESSED FLOOR ARCHITECTURE --- */}
      <group position={[0, 0, 0]}>
        {/* Large Outer Trim Ring */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]} receiveShadow>
          <ringGeometry args={[11.5, 12, 128]} />
          <meshStandardMaterial color="#d4af37" metalness={0.9} roughness={0.1} transparent opacity={0.6} />
        </mesh>

        {/* Recessed Marble Layer */}
        <mesh position={[0, 0.05, 0]} receiveShadow>
          <cylinderGeometry args={[11, 11.2, 0.1, 128]} />
          <meshStandardMaterial color="#fcf9f2" roughness={0.3} metalness={0.1} />
        </mesh>

        {/* Embedded Warm LED Ring */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.11, 0]}>
          <ringGeometry args={[10.5, 10.7, 128]} />
          <meshStandardMaterial color="#fff5e6" emissive="#fff5e6" emissiveIntensity={2} />
        </mesh>

        {/* Inner Floor Cutout Styling */}
        <mesh position={[0, 0.08, 0]} receiveShadow>
          <cylinderGeometry args={[10.3, 10.3, 0.05, 128]} />
          <meshStandardMaterial color="#ffffff" roughness={0.05} metalness={0.2} />
        </mesh>
      </group>

      {/* --- CIRCULAR HELP DESK (Recessed into Floor) --- */}
      <group position={[0, 0.08, 0]}>
        {/* Main Circular Counter Structure */}
        <group rotation={[0, -Math.PI / 6, 0]}>
          {/* Desk Body (Polished White Marble) */}
          <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[5.8, 5.8, 1.1, 128, 1, true, 0, Math.PI * 1.6]} />
            <meshStandardMaterial color="#ffffff" roughness={0.1} metalness={0.1} side={THREE.DoubleSide} />
          </mesh>

          {/* Champagne Gold Mid-Belt Detail */}
          <mesh position={[0, 0.55, 0]}>
            <cylinderGeometry args={[5.82, 5.82, 0.3, 128, 1, true, 0, Math.PI * 1.6]} />
            <meshStandardMaterial color="#d4af37" metalness={1} roughness={0.1} side={THREE.DoubleSide} />
          </mesh>

          {/* Desk Top Surface (Premium Marble) */}
          <mesh position={[0, 1.1, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <ringGeometry args={[5, 5.85, 128, 1, 0, Math.PI * 1.6]} />
            <meshStandardMaterial color="#ffffff" roughness={0.05} metalness={0.2} side={THREE.DoubleSide} />
          </mesh>

          {/* Under-counter LED Glow */}
          <mesh position={[0, 1.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[5.7, 5.8, 128, 1, 0, Math.PI * 1.6]} />
            <meshStandardMaterial color="#fff5e6" emissive="#fff5e6" emissiveIntensity={1.5} side={THREE.DoubleSide} />
          </mesh>

          {/* Front Branding & Concierge Panel */}
          <group position={[0, 0, 0]} rotation={[0, Math.PI * 0.8, 0]}>
            <mesh position={[0, 0.55, 5.85]} castShadow>
              <boxGeometry args={[3, 1.1, 0.1]} />
              <meshStandardMaterial color="#ffffff" roughness={0.1} />
            </mesh>
            <Text
              position={[0, 0.65, 5.96]}
              fontSize={0.28}
              color="#d4af37"
              font="https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfMZhrib2Bg-4.ttf"
              anchorX="center"
              anchorY="middle"
            >
              CONCIERGE
              <meshStandardMaterial attach="material" color="#d4af37" emissive="#d4af37" emissiveIntensity={0.5} />
            </Text>
            <Text
              position={[0, 0.4, 5.96]}
              fontSize={0.1}
              color="#333"
              font="https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfMZhrib2Bg-4.ttf"
              anchorX="center"
              anchorY="middle"
              letterSpacing={0.1}
            >
              PREMIUM REAL ESTATE SUMMIT
            </Text>
          </group>

          {/* Integrated iMac-style Stations */}
          {Array.from({ length: 5 }).map((_, i) => {
            const angle = 0.5 + i * 0.7;
            const x = 5.3 * Math.cos(angle);
            const z = 5.3 * Math.sin(angle);
            return (
              <group key={i} position={[x, 0.85, z]} rotation={[0, -angle - Math.PI/2, 0]}>
                <mesh position={[0, 0, 0]}>
                  <boxGeometry args={[0.6, 0.4, 0.02]} />
                  <meshStandardMaterial color="#111" metalness={0.9} roughness={0.1} />
                </mesh>
                <mesh position={[0, -0.25, -0.05]}>
                  <boxGeometry args={[0.1, 0.3, 0.05]} />
                  <meshStandardMaterial color="#d4af37" metalness={1} />
                </mesh>
              </group>
            );
          })}
          <Suspense fallback={null}>
            <HelpDeskCustomGirl />
          </Suspense>
        </group>
      </group>

      {/* --- GIANT SUSPENDED JUMBOTRON --- */}
      <group position={[0, 14, 0]}>
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
            <meshStandardMaterial color="#d4af37" metalness={0.95} roughness={0.2} />
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
                    <LedVideoPlane
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

          <pointLight position={[0, -5, 0]} intensity={150} color="#d4af37" distance={40} decay={2} />
        </group>
      </group>

      {/* Main Center Area Spotlight */}
      <spotLight
        position={[0, 17, 0]}
        angle={0.9}
        penumbra={0.6}
        intensity={250}
        color="#ffffff"
        castShadow
      />
    </group>
  );
}

function hasFoldableArmRig(root: THREE.Object3D) {
  let found = false;
  root.traverse((o) => {
    const b = o as THREE.Bone;
    if (b.isBone && /^LeftArm_/.test(b.name)) found = true;
  });
  return found;
}

/** Optional reception pose for rigs that match office-girl bone names. */
function applyFoldedHandsPose(root: THREE.Object3D) {
  const apply = (re: RegExp, rx: number, ry: number, rz: number) => {
    root.traverse((o) => {
      const b = o as THREE.Bone;
      if (b.isBone && re.test(b.name)) {
        b.rotation.set(rx, ry, rz, 'XYZ');
      }
    });
  };
  apply(/^LeftShoulder_/, 0.07, 0.14, -0.14);
  apply(/^RightShoulder_/, 0.07, -0.14, 0.14);
  apply(/^LeftArm_/, 1.22, -0.22, -0.58);
  apply(/^LeftForeArm_/, 0.55, 0.1, 0.08);
  apply(/^RightArm_/, 1.22, 0.22, 0.58);
  apply(/^RightForeArm_/, 0.55, -0.1, -0.08);
  apply(/^LeftHand_[0-9]/, 0.22, -0.38, 0.12);
  apply(/^RightHand_[0-9]/, 0.22, 0.38, -0.12);
}

function prepareHostessModel(sourceScene: THREE.Object3D) {
  const root = cloneSkinnedHierarchy(sourceScene) as THREE.Object3D;
  root.rotation.set(0, 0, 0);
  root.scale.set(1, 1, 1);
  root.updateMatrixWorld(true);
  root.traverse((obj) => {
    const m = obj as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = true;
    }
  });
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  const horiz = Math.max(size.x, size.z, 1e-6);
  const sy = Math.max(size.y, 1e-6);
  const s = Math.min(HOSTESS_MAX_WIDTH / horiz, HOSTESS_MAX_HEIGHT / sy);
  root.scale.setScalar(s);
  root.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(root);
  const c = new THREE.Vector3();
  box2.getCenter(c);
  root.position.sub(c);
  root.updateMatrixWorld(true);
  if (hasFoldableArmRig(root)) {
    applyFoldedHandsPose(root);
    root.updateMatrixWorld(true);
  }
  const box3 = new THREE.Box3().setFromObject(root);
  root.position.y -= box3.min.y;
  root.updateMatrixWorld(true);
  return root;
}

function ExpoHostessAvatar({
  position,
  rotation,
  idlePhase = 0,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  idlePhase?: number;
}) {
  const breathingRef = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(HOSTESS_MODEL_URL) as {
    scene: THREE.Object3D;
    animations: THREE.AnimationClip[];
  };

  const model = useMemo(() => prepareHostessModel(scene), [scene]);

  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const idleBonesRef = useRef<{
    head?: THREE.Bone;
    spine?: THREE.Bone;
    lFore?: THREE.Bone;
    rFore?: THREE.Bone;
    baseHead?: THREE.Euler;
    baseSpine?: THREE.Euler;
    baseLFore?: THREE.Euler;
    baseRFore?: THREE.Euler;
  }>({});

  useLayoutEffect(() => {
    const rec = idleBonesRef.current;
    rec.head = undefined;
    rec.spine = undefined;
    rec.lFore = undefined;
    rec.rFore = undefined;
    model.traverse((o) => {
      const b = o as THREE.Bone;
      if (!b.isBone) return;
      if (/^Head_[0-9]/.test(b.name)) rec.head = b;
      if (/^Spine2_/.test(b.name)) rec.spine = b;
      if (/^LeftForeArm_[0-9]/.test(b.name)) rec.lFore = b;
      if (/^RightForeArm_[0-9]/.test(b.name)) rec.rFore = b;
    });
    if (rec.head) rec.baseHead = rec.head.rotation.clone();
    if (rec.spine) rec.baseSpine = rec.spine.rotation.clone();
    if (rec.lFore) rec.baseLFore = rec.lFore.rotation.clone();
    if (rec.rFore) rec.baseRFore = rec.rFore.rotation.clone();
  }, [model]);

  useLayoutEffect(() => {
    if (!animations?.length) {
      mixerRef.current = null;
      return;
    }
    const mixer = new THREE.AnimationMixer(model);
    mixerRef.current = mixer;
    const clip = animations[0];
    const action = mixer.clipAction(clip);
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.clampWhenFinished = false;
    action.play();
    return () => {
      action.stop();
      mixer.stopAllAction();
      mixerRef.current = null;
    };
  }, [model, animations]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const ph = idlePhase;
    const rec = idleBonesRef.current;
    const mixer = mixerRef.current;

    if (mixer && animations?.length) {
      mixer.update(delta);
    }

    if (breathingRef.current) {
      const br = Math.sin(t * 2.12 + ph) * 0.007;
      breathingRef.current.scale.set(1 + br * 0.35, 1 + br, 1 + br * 0.35);
    }

    const procedural = !animations?.length;
    if (procedural) {
      if (rec.head && rec.baseHead) {
        rec.head.rotation.x = rec.baseHead.x + Math.sin(t * 0.92 + ph) * 0.028;
        rec.head.rotation.y = rec.baseHead.y + Math.sin(t * 0.71 + ph * 1.7) * 0.048;
      }
      if (rec.spine && rec.baseSpine) {
        rec.spine.rotation.x = rec.baseSpine.x + Math.sin(t * 2.05 + ph) * 0.017;
      }
      if (rec.lFore && rec.baseLFore) {
        rec.lFore.rotation.x = rec.baseLFore.x + Math.sin(t * 1.22 + ph) * 0.032;
        rec.lFore.rotation.z = rec.baseLFore.z + Math.sin(t * 1.04 + ph * 0.5) * 0.036;
      }
      if (rec.rFore && rec.baseRFore) {
        rec.rFore.rotation.x = rec.baseRFore.x + Math.sin(t * 1.19 + ph * 1.08) * 0.032;
        rec.rFore.rotation.z = rec.baseRFore.z + Math.sin(t * 1.06 + ph * 0.55) * 0.036;
      }
    }
  });

  return (
    <group position={position} rotation={rotation}>
      <group ref={breathingRef}>
        <primitive object={model} />
      </group>
    </group>
  );
}

/**
 * Reception-side hostess: between concierge desk (+Z) and standee, offset from TV / back wall,
 * rotated toward the main aisle (visitor path).
 */
function BoothHostessGreeter({ side, boothId }: { side: 'left' | 'right'; boothId: string }) {
  const yawTowardAisle = side === 'left' ? 0.24 : -0.24;
  const baseFace = side === 'left' ? Math.PI : 0;
  return (
    <ExpoHostessAvatar
      position={[-1.02, 0, 2.66]}
      rotation={[0, baseFace + yawTowardAisle, 0]}
      idlePhase={stringToPhase(boothId)}
    />
  );
}

function HelpDeskCustomGirl() {
  return (
    <ExpoHostessAvatar
      position={[1.72, 0, 3.28]}
      rotation={[0, -0.8, 0]}
      idlePhase={stringToPhase('concierge-desk')}
    />
  );
}

useGLTF.preload(VERTEX_ELITE_MODEL_URL);
useGLTF.preload(HOSTESS_MODEL_URL);
