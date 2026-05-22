import { REG_HALL, REG_RECEPTION_Z } from '../data/registrationHall';
import {
  applyBoothOverrides,
  buildDefaultBoothLayoutList,
  mergeRegistrationLayout,
  PROJECT_VIDEOS,
  type RegistrationImportedModel,
  type RegistrationLayoutConfig,
} from '../data/boothLayouts';
import { LayoutEditableGroup } from './LayoutEditableGroup';
import { LedScreenSurface } from './LedVideoPlane';
import { Text, useGLTF } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import { Suspense, useMemo } from 'react';
import { useStore } from '../store';
import * as THREE from 'three';

const { halfW, halfD, height, centerZ } = REG_HALL;
const cz = centerZ;
const floorW = halfW * 2;
const floorD = halfD * 2;
/** Reception zone — compact boutique counter. */
const BACKDROP_W = 13;
const DESK_W = 9.5;
// Color palette
const FLOOR_DARK = '#1a1a1a';
const WALL_CREAM = '#FAF7F0';
const BLACK_GRID = '#0a0a0a';
const GOLD = '#d4af37';
const LED_WHITE = '#f0f8ff';
const RECEPTION_Z = REG_RECEPTION_Z;
const FONT =
  'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfMZhrib2Bg-4.ttf';

/** Imported reception desk GLB (FBX converted). */
const RECEPTION_DESK_GLB_URL = '/assets/3d%20model/Reception_Desk_1_fbx.glb';
/** Visible span in meters (larger than legacy procedural desk so visitors can read the model clearly). */
const RECEPTION_DESK_TARGET_WIDTH = DESK_W * 3.0;

const MAT_GOLD = {
  color: GOLD,
  roughness: 0.15,
  metalness: 0.92,
  emissive: GOLD,
  emissiveIntensity: 1.4,
} as const;

/**
 * High-end futuristic expo registration hall with black hexagon LED ceiling
 */
export function RegistrationHall() {
  return (
    <group name="registration-hall">
      <DarkPolishedFloor />
      <PremiumWalls />
      <NorthWallVideoDisplays />
      <HexagonLEDCeiling />
      <PremiumEventReception />
    </group>
  );
}

/** Dark polished marble floor with reflective properties */
function DarkPolishedFloor() {
  return (
    <group name="reg-floor">
      {/* Main floor - highly reflective dark marble */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, cz]} receiveShadow>
        <planeGeometry args={[floorW - 0.5, floorD - 0.5]} />
        <meshStandardMaterial
          color={FLOOR_DARK}
          roughness={0.42}
          metalness={0.28}
          envMapIntensity={0.12}
        />
      </mesh>
      
    </group>
  );
}

/** Premium wall paneling with LED strips and gold accents */
function PremiumWalls() {
  return (
    <group name="reg-walls">
      {/* North wall (front entrance side) */}
      <mesh position={[0, height / 2, cz - halfD + 0.2]} receiveShadow castShadow>
        <boxGeometry args={[floorW, height, 0.4]} />
        <meshStandardMaterial color={WALL_CREAM} roughness={0.92} metalness={0.04} />
      </mesh>
      <WallLEDStrips position={[0, 2, cz - halfD + 0.45]} width={floorW - 4} />
      <WallLEDStrips position={[0, height - 2, cz - halfD + 0.45]} width={floorW - 4} />
      
      {/* South wall (back) */}
      <mesh position={[0, height / 2, cz + halfD - 0.2]} receiveShadow castShadow>
        <boxGeometry args={[floorW, height, 0.4]} />
        <meshStandardMaterial color={WALL_CREAM} roughness={0.92} metalness={0.04} />
      </mesh>
      <WallLEDStrips position={[0, 2, cz + halfD - 0.45]} width={floorW - 4} />
      
      {/* West wall (left) */}
      <mesh position={[-halfW + 0.2, height / 2, cz]} receiveShadow castShadow>
        <boxGeometry args={[0.4, height, floorD]} />
        <meshStandardMaterial color={WALL_CREAM} roughness={0.92} metalness={0.04} />
      </mesh>
      
      {/* East wall (right) */}
      <mesh position={[halfW - 0.2, height / 2, cz]} receiveShadow castShadow>
        <boxGeometry args={[0.4, height, floorD]} />
        <meshStandardMaterial color={WALL_CREAM} roughness={0.92} metalness={0.04} />
      </mesh>
    </group>
  );
}

/** LED strip accent on walls */
function WallLEDStrips({ position, width }: { position: [number, number, number]; width: number }) {
  return (
    <mesh position={position} castShadow>
      <boxGeometry args={[width, 0.08, 0.15]} />
      <meshStandardMaterial
        color={LED_WHITE}
        emissive={LED_WHITE}
        emissiveIntensity={0.65}
        roughness={0.3}
        metalness={0.8}
        toneMapped={false}
      />
    </mesh>
  );
}

/** BLACK HEXAGON LED CEILING - Primary design element */
function HexagonLEDCeiling() {
  const hexRadius = 1.28;
  const gridSpacing = 2.65;
  const numX = Math.ceil(floorW / gridSpacing) + 2;
  const numZ = Math.ceil(floorD / gridSpacing) + 2;
  const startX = -halfW + 1.2;
  const startZ = -halfD + 1.2;
  
  return (
    <group name="hexagon-ceiling" position={[0, height - 0.2, cz]}>
      {/* Black ceiling base */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.25, 0]} receiveShadow>
        <planeGeometry args={[floorW, floorD]} />
        <meshStandardMaterial color={BLACK_GRID} roughness={0.75} metalness={0.25} />
      </mesh>
      
      {/* Hexagon LED panels grid — denser for smaller hall */}
      {Array.from({ length: numX }).map((_, i) =>
        Array.from({ length: numZ }).map((_, j) => {
          const offsetX = (j % 2) * (gridSpacing / 2);
          const x = startX + i * gridSpacing + offsetX;
          const z = startZ + j * (gridSpacing * 0.87);
          
          if (Math.abs(x) > halfW - 1.8 || Math.abs(z) > halfD - 1.8) return null;
          
          return (
            <HexagonPanel
              key={`hex-${i}-${j}`}
              position={[x, 0, z]}
              radius={hexRadius}
              glowIntensity={0.85 + ((i * 7 + j) % 5) * 0.12}
            />
          );
        })
      )}
      
    </group>
  );
}

/** Individual hexagon LED panel */
function HexagonPanel({
  position,
  radius,
  glowIntensity,
}: {
  position: [number, number, number];
  radius: number;
  glowIntensity: number;
}) {
  const hexShape = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i;
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);
    if (i === 0) hexShape.moveTo(x, y);
    else hexShape.lineTo(x, y);
  }
  hexShape.closePath();
  
  return (
    <group position={position}>
      {/* Black hexagon frame */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, 0]}>
        <extrudeGeometry
          args={[
            hexShape,
            {
              depth: 0.15,
              bevelEnabled: false,
            },
          ]}
        />
        <meshStandardMaterial color="#0d0d0d" roughness={0.6} metalness={0.4} />
      </mesh>
      
      {/* White LED glow center */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
        <extrudeGeometry
          args={[
            hexShape,
            {
              depth: 0.02,
              bevelEnabled: false,
            },
          ]}
        />
        <meshStandardMaterial
          color={LED_WHITE}
          emissive={LED_WHITE}
          emissiveIntensity={glowIntensity}
          roughness={0.35}
          metalness={0.4}
          toneMapped
        />
      </mesh>
    </group>
  );
}

/** Full premium convention-center registration zone */
function PremiumEventReception() {
  const regLayout = useStore((s) => s.sceneOverrides.registrationLayout);
  const layout = useMemo(() => mergeRegistrationLayout(regLayout), [regLayout]);
  const rootPos: [number, number, number] = [
    layout.receptionOffset[0],
    layout.receptionOffset[1],
    RECEPTION_Z + layout.receptionOffset[2],
  ];

  return (
    <LayoutEditableGroup
      name="reg-reception-root"
      position={rootPos}
      rotation={lobbyRotation(layout, 'reg-reception-root')}
    >
      <LayoutEditableGroup
        name="reg-expo-backdrop"
        position={layout.backdropOffset}
        rotation={lobbyRotation(layout, 'reg-expo-backdrop')}
      >
        <ExpoBackdropWall />
      </LayoutEditableGroup>
      <LayoutEditableGroup
        name="reg-registration-desk"
        position={layout.deskOffset}
        rotation={lobbyRotation(layout, 'reg-registration-desk')}
      >
        <RegistrationCounterDesk />
      </LayoutEditableGroup>
      <ReceptionZoneLighting />
      <RegistrationImportedModels models={layout.importedModels} />
    </LayoutEditableGroup>
  );
}

/** Strong wash on desk + backdrop; softer elsewhere */
function ReceptionZoneLighting() {
  return (
    <group name="reception-lights">
      <pointLight position={[0, height - 1.2, 1.5]} intensity={28} distance={16} decay={2} color="#fff8ee" />
      <pointLight position={[0, 5.5, -4]} intensity={18} distance={14} decay={2} color="#ffe8c8" />
      <spotLight
        position={[0, height - 0.5, 3]}
        angle={0.55}
        penumbra={0.9}
        intensity={42}
        color="#fffaf4"
        distance={22}
        decay={2}
        castShadow={false}
      />
    </group>
  );
}

/** Evenly spaced station X positions along the desk */
function stationPositions(count: number, span: number): number[] {
  if (count <= 1) return [0];
  const step = span / (count - 1);
  const start = -span / 2;
  return Array.from({ length: count }, (_, i) => start + i * step);
}

const REG_WALL_DISPLAY_FALLBACK = PROJECT_VIDEOS[2] || PROJECT_VIDEOS[0];

function useRegistrationLobbyVideoUrl() {
  const boothOverrides = useStore((s) => s.boothOverrides);
  return useMemo(() => {
    const vertex = applyBoothOverrides(buildDefaultBoothLayoutList(), boothOverrides).find(
      (b) => b.id === 'vertex-elite',
    );
    return vertex?.videoUrl?.trim() || REG_WALL_DISPLAY_FALLBACK;
  }, [boothOverrides]);
}

/** 16:9 LED panel mounted flush on a lobby wall (faces visitors at +Z). */
function WallVideoPanel({
  position,
  args,
  url,
}: {
  position: [number, number, number];
  args: [number, number];
  url: string;
}) {
  const [w, h] = args;
  return (
    <group position={position} name="wall-video-panel">
      <mesh position={[0, 0, -0.05]} castShadow>
        <boxGeometry args={[w + 0.18, h + 0.18, 0.1]} />
        <meshStandardMaterial color="#0e1218" metalness={0.9} roughness={0.16} />
      </mesh>
      <mesh position={[0, 0, -0.028]}>
        <boxGeometry args={[w + 0.08, h + 0.08, 0.04]} />
        <meshStandardMaterial
          color="#1a2030"
          emissive={GOLD}
          emissiveIntensity={0.55}
          metalness={0.85}
          roughness={0.1}
        />
      </mesh>
      <Suspense
        fallback={
          <mesh position={[0, 0, 0.02]}>
            <planeGeometry args={args} />
            <meshBasicMaterial color="#0a0a10" />
          </mesh>
        }
      >
        <LedScreenSurface args={args} url={url} position={[0, 0, 0.045]} />
      </Suspense>
    </group>
  );
}

/**
 * Twin video walls on the north lobby surface — the large cream wall visitors face
 * when walking in (between the horizontal LED strips).
 */
function NorthWallVideoDisplays() {
  const videoUrl = useRegistrationLobbyVideoUrl();
  const wallFaceZ = cz - halfD + 0.48;
  const centerY = height * 0.46;
  const panelW = 5.2;
  const panelH = panelW * (9 / 16);
  /** Match LED strip span on north wall — panels sit at left/right ends. */
  const wallSpan = floorW - 4;
  const edgeInset = 1.15;
  const xLeft = -(wallSpan / 2) + panelW / 2 + edgeInset;
  const xRight = wallSpan / 2 - panelW / 2 - edgeInset;
  const panelArgs: [number, number] = [panelW, panelH];

  return (
    <group name="reg-north-wall-video-displays">
      <WallVideoPanel position={[xLeft, centerY, wallFaceZ]} args={panelArgs} url={videoUrl} />
      <WallVideoPanel position={[xRight, centerY, wallFaceZ]} args={panelArgs} url={videoUrl} />
    </group>
  );
}

/** Large LED + banner backdrop behind staff */
function ExpoBackdropWall() {
  const wallZ = -7.2;
  const wallH = 5.2;
  const wallCenterY = wallH / 2 + 0.6;
  const faceZ = 0.21;

  return (
    <group position={[0, 0, wallZ]}>
      <mesh position={[0, wallCenterY, 0]} castShadow receiveShadow>
        <boxGeometry args={[BACKDROP_W, wallH, 0.38]} />
        <meshStandardMaterial
          color="#08080c"
          emissive="#1a2030"
          emissiveIntensity={0.55}
          roughness={0.25}
          metalness={0.75}
        />
      </mesh>

      <Text
        position={[0, wallH + 0.35, faceZ + 0.02]}
        fontSize={0.82}
        color={LED_WHITE}
        maxWidth={BACKDROP_W * 0.72}
        textAlign="center"
        anchorX="center"
        anchorY="middle"
        font={FONT}
      >
        WELCOME TO THE EXPO
      </Text>
      <Text
        position={[0, wallCenterY - 1.2, faceZ + 0.02]}
        fontSize={0.36}
        color={GOLD}
        anchorX="center"
        anchorY="middle"
        font={FONT}
      >
        LAUNCH REAL ESTATE · GLOBAL PROPERTY SHOWCASE
      </Text>

      {/* Vertical branding banners */}
      {[-0.42, 0.42].map((frac, i) => (
        <group key={`banner-${i}`} position={[frac * BACKDROP_W, wallH * 0.55, 0.15]}>
          <mesh castShadow>
            <boxGeometry args={[1.05, wallH + 0.6, 0.12]} />
            <meshStandardMaterial
              color="#0c0c10"
              emissive={GOLD}
              emissiveIntensity={0.35}
              roughness={0.4}
              metalness={0.5}
            />
          </mesh>
          <Text
            position={[0, 0, 0.08]}
            fontSize={0.22}
            color={GOLD}
            rotation={[0, 0, Math.PI / 2]}
            anchorX="center"
            anchorY="middle"
            font={FONT}
          >
            VERTEX ELITE
          </Text>
        </group>
      ))}
    </group>
  );
}

const STATION_COUNT = 4;

/** Match product render: dark wood frame, cream insets, chrome company name. */
function applyReceptionDeskMaterials(root: THREE.Object3D) {
  const cream = new THREE.Color('#f8f5ef');
  const woodDark = new THREE.Color('#382215');
  const chrome = new THREE.Color('#e0e4e8');

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;

    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      if (!(mat instanceof THREE.MeshStandardMaterial)) continue;
      
      const matName = (mat.name || '').toLowerCase();

      if (matName.includes('metal')) {
        mat.color.copy(chrome);
        mat.emissive.set('#b0b8c0');
        mat.emissiveIntensity = 0.4;
        mat.metalness = 1.0;
        mat.roughness = 0.15;
        mat.envMapIntensity = 1.0;
      } else if (matName.includes('wood')) {
        mat.color.copy(woodDark);
        mat.emissive.set('#000000');
        mat.emissiveIntensity = 0;
        mat.metalness = 0.05;
        mat.roughness = 0.8;
        mat.envMapIntensity = 0.3;
      } else if (matName.includes('plane')) {
        mat.color.copy(cream);
        mat.emissive.set('#000000');
        mat.emissiveIntensity = 0;
        mat.metalness = 0.0;
        mat.roughness = 0.95;
        mat.envMapIntensity = 0.1;
      } else if (matName.includes('light')) {
        mat.color.set('#ffffff');
        mat.emissive.set('#ffeaaf'); // warm glow
        mat.emissiveIntensity = 3.5;
        mat.metalness = 0.0;
        mat.roughness = 0.5;
      } else if (matName.includes('glass')) {
        mat.color.set('#111111');
        mat.metalness = 0.8;
        mat.roughness = 0.2;
      }
    }
  });
}

function prepareReceptionDeskModel(source: THREE.Object3D) {
  const root = source.clone(true) as THREE.Object3D;
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
  root.scale.setScalar(RECEPTION_DESK_TARGET_WIDTH / horiz);
  root.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(root);
  const c = new THREE.Vector3();
  box2.getCenter(c);
  root.position.sub(c);
  root.updateMatrixWorld(true);
  const box3 = new THREE.Box3().setFromObject(root);
  root.position.y -= box3.min.y;
  root.updateMatrixWorld(true);

  /** Hide white floor mat / base plate baked into the GLB (thin mesh at feet). */
  const floorCutoff = 0.14;
  root.traverse((obj) => {
    const m = obj as THREE.Mesh;
    if (!m.isMesh) return;
    const b = new THREE.Box3().setFromObject(m);
    const s = new THREE.Vector3();
    b.getSize(s);
    const name = (m.name || '').toLowerCase();
    const namedFloor = /floor|ground|mat|plane|base|platform|carpet|rug/i.test(name);
    const thinAtFeet =
      s.y < 0.1 && b.max.y < floorCutoff && Math.max(s.x, s.z) > 0.4;
    if (namedFloor || thinAtFeet) {
      m.visible = false;
    }
  });

  applyReceptionDeskMaterials(root);

  return root;
}

/** GLB reception desk — visitor-facing +Z; click counter to check in. */
function ReceptionDeskGlbModel({
  onRegister,
}: {
  onRegister: () => void;
}) {
  const { scene } = useGLTF(RECEPTION_DESK_GLB_URL) as { scene: THREE.Object3D };
  const model = useMemo(() => prepareReceptionDeskModel(scene), [scene]);
  const deskSize = useMemo(() => {
    const b = new THREE.Box3().setFromObject(model);
    const s = new THREE.Vector3();
    b.getSize(s);
    return s;
  }, [model]);
  const deskDepth = deskSize.z;
  const deskHeight = deskSize.y;

  const pointerProps = {
    onClick: (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      onRegister();
    },
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      document.body.style.cursor = 'pointer';
    },
    onPointerOut: () => {
      document.body.style.cursor = 'auto';
    },
  };

  return (
    <group position={[0, 0, 1.15]} rotation={[0, -Math.PI / 2, 0]}>
      <primitive object={model} />
      {/* Warm wash under canopy — matches reference under-light */}
      <rectAreaLight
        position={[0, deskHeight * 0.92, deskDepth * 0.38]}
        width={RECEPTION_DESK_TARGET_WIDTH * 0.82}
        height={1.4}
        intensity={2.2}
        color="#fff8ee"
      />
      <pointLight
        position={[0, deskHeight * 0.88, deskDepth * 0.42]}
        intensity={6}
        color="#fff6e8"
        distance={8}
        decay={2}
      />
      {/* Invisible hit volume — click counter to check in */}
      <mesh position={[0, 0.85, deskDepth * 0.35]} visible={false} {...pointerProps}>
        <boxGeometry args={[RECEPTION_DESK_TARGET_WIDTH, 1.75, Math.max(deskDepth, 1.4)]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </group>
  );
}

/** Wide premium registration counter — visitor-facing south (+Z) */
function RegistrationCounterDesk() {
  const openRegistrationPopup = useStore((s) => s.openRegistrationPopup);

  return (
    <Suspense fallback={null}>
      <ReceptionDeskGlbModel onRegister={openRegistrationPopup} />
    </Suspense>
  );
}

/** Staff workstations behind counter — 8 check-in stations */
function StaffWorkstations() {
  const stationXs = stationPositions(STATION_COUNT, DESK_W - 2);
  return (
    <group name="staff-area">
      {/* Back credenza */}
      <mesh position={[0, 0.95, -0.35]} castShadow receiveShadow>
        <boxGeometry args={[DESK_W, 1.95, 0.65]} />
        <meshStandardMaterial color="#141418" roughness={0.28} metalness={0.7} />
      </mesh>

      {stationXs.map((x, i) => (
        <group key={`staff-${i}`} position={[x, 0, 0]}>
          <StaffChair position={[0, 0, -0.9]} rotation={Math.PI} />
          <mesh position={[0, 1.42, -0.55]} castShadow>
            <boxGeometry args={[0.72, 0.48, 0.04]} />
            <meshStandardMaterial
              color="#050508"
              emissive="#1a1a22"
              emissiveIntensity={0.4}
              roughness={0.08}
              metalness={0.9}
            />
          </mesh>
          <mesh position={[0, 1.42, -0.52]} castShadow>
            <boxGeometry args={[0.68, 0.42, 0.01]} />
            <meshStandardMaterial
              color="#0a1020"
              emissive="#4080e8"
              emissiveIntensity={0.85}
              roughness={0.12}
              metalness={0.85}
            />
          </mesh>
          <mesh position={[0.42, 1.28, -0.68]} castShadow>
            <boxGeometry args={[0.28, 0.02, 0.22]} />
            <meshStandardMaterial color="#2a2a30" roughness={0.5} metalness={0.4} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function StaffChair({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.42, 0]} castShadow>
        <boxGeometry args={[0.55, 0.85, 0.55]} />
        <meshStandardMaterial color="#1e1e24" roughness={0.75} metalness={0.2} />
      </mesh>
      <mesh position={[0, 0.9, -0.22]} castShadow>
        <boxGeometry args={[0.55, 0.75, 0.1]} />
        <meshStandardMaterial color="#1e1e24" roughness={0.75} metalness={0.2} />
      </mesh>
    </group>
  );
}

/** Queue lanes — black stanchions + ropes (reference style) */
function ReceptionQueueLanes() {
  const laneZ = [3.4, 2.5, 1.6, 0.65];
  const laneW = Math.min(4.8, DESK_W * 0.52);
  return (
    <group name="queue-lanes">
      {laneZ.map((z, row) => (
        <group key={`row-${row}`}>
          <Stanchion position={[-laneW, 0, z]} />
          <Stanchion position={[laneW, 0, z]} />
          {row < laneZ.length - 1 && (
            <>
              <QueueRope from={[-laneW, 1.05, z]} to={[-laneW, 1.05, laneZ[row + 1]!]} />
              <QueueRope from={[laneW, 1.05, z]} to={[laneW, 1.05, laneZ[row + 1]!]} />
            </>
          )}
        </group>
      ))}
      <QueueRope from={[-laneW, 1.05, laneZ[0]!]} to={[laneW, 1.05, laneZ[0]!]} />
    </group>
  );
}

function Stanchion({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.05, 0]} receiveShadow>
        <cylinderGeometry args={[0.2, 0.26, 0.1, 16]} />
        <meshStandardMaterial color="#0a0a0e" roughness={0.3} metalness={0.75} />
      </mesh>
      <mesh position={[0, 0.62, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.03, 1.12, 12]} />
        <meshStandardMaterial color="#1a1a20" roughness={0.25} metalness={0.85} />
      </mesh>
      <mesh position={[0, 1.2, 0]}>
        <sphereGeometry args={[0.06, 12, 12]} />
        <meshStandardMaterial color="#2a2a30" roughness={0.2} metalness={0.9} />
      </mesh>
    </group>
  );
}

function QueueRope({
  from,
  to,
}: {
  from: [number, number, number];
  to: [number, number, number];
}) {
  const start = new THREE.Vector3(...from);
  const end = new THREE.Vector3(...to);
  const dir = end.clone().sub(start);
  const len = dir.length();
  if (len < 0.02) return null;
  const mid = start.clone().add(end).multiplyScalar(0.5);
  const quat = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    dir.normalize(),
  );
  return (
    <mesh position={mid.toArray()} quaternion={quat} castShadow>
      <cylinderGeometry args={[0.035, 0.035, len, 8]} />
      <meshStandardMaterial color="#141418" roughness={0.75} metalness={0.15} />
    </mesh>
  );
}

/** Large vertical digital banners flanking the desk */
function DigitalVerticalBanners() {
  const x = BACKDROP_W * 0.48;
  return (
    <group name="digital-banners">
      <VerticalBanner position={[-x, 0, -6.5]} flip />
      <VerticalBanner position={[x, 0, -6.5]} />
    </group>
  );
}

function VerticalBanner({ position, flip = false }: { position: [number, number, number]; flip?: boolean }) {
  const rotY = flip ? Math.PI / 2 : -Math.PI / 2;
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <mesh position={[0, 2.8, 0]} castShadow>
        <boxGeometry args={[0.12, 4.8, 2.4]} />
        <meshStandardMaterial
          color="#06060a"
          emissive="#1a2848"
          emissiveIntensity={0.7}
          roughness={0.2}
          metalness={0.8}
        />
      </mesh>
      <mesh position={[0.08, 2.8, 0]}>
        <boxGeometry args={[0.02, 4.7, 2.35]} />
        <meshStandardMaterial {...MAT_GOLD} emissiveIntensity={0.5} />
      </mesh>
      <Text
        position={[0.12, 3.4, 0]}
        fontSize={0.11}
        color={LED_WHITE}
        maxWidth={2}
        textAlign="center"
        anchorX="center"
        anchorY="middle"
        rotation={[0, Math.PI / 2, 0]}
        font={FONT}
      >
        DISCOVER. CONNECT. INVEST.
      </Text>
      <Text
        position={[0.12, 2.2, 0]}
        fontSize={0.08}
        color={GOLD}
        maxWidth={2}
        textAlign="center"
        anchorX="center"
        anchorY="middle"
        rotation={[0, Math.PI / 2, 0]}
        font={FONT}
      >
        Your Future Starts Here
      </Text>
    </group>
  );
}

function lobbyRotation(
  layout: RegistrationLayoutConfig,
  name: string,
): [number, number, number] {
  return layout.loungeRotations[name] ?? [0, 0, 0];
}

function RegistrationGlbMesh({ url }: { url: string }) {
  const { scene } = useGLTF(url) as { scene: THREE.Object3D };
  const clone = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    return c;
  }, [scene]);
  return <primitive object={clone} />;
}

function RegistrationImportedModels({ models }: { models: RegistrationImportedModel[] }) {
  return (
    <>
      {models.map((m) => (
        <LayoutEditableGroup
          key={m.id}
          name={`reg-imported-${m.id}`}
          position={m.offset}
          rotation={m.rotation}
          scale={m.scale}
        >
          <Suspense fallback={null}>
            <RegistrationGlbMesh url={m.url} />
          </Suspense>
        </LayoutEditableGroup>
      ))}
    </>
  );
}

/** Gold floor lines guiding queue toward desk */
function FloorQueueGuides() {
  const lines: Array<{ pos: [number, number, number]; rot: number; len: number }> = [
    { pos: [0, 0.02, 5.2], rot: 0, len: DESK_W * 0.55 },
    { pos: [-halfW + 4, 0.02, 3.2], rot: Math.PI / 2, len: 4.5 },
    { pos: [halfW - 4, 0.02, 3.2], rot: Math.PI / 2, len: 4.5 },
  ];
  return (
    <group name="floor-queue-guides">
      {lines.map((l, i) => (
        <mesh
          key={`guide-${i}`}
          position={l.pos}
          rotation={[-Math.PI / 2, l.rot, 0]}
        >
          <planeGeometry args={[l.len, 0.08]} />
          <meshStandardMaterial
            color={GOLD}
            emissive={GOLD}
            emissiveIntensity={1.6}
            roughness={0.2}
            metalness={0.9}
          />
        </mesh>
      ))}
    </group>
  );
}

/** Side QR / digital signage totems */
function EventInfoTotems() {
  const x = DESK_W * 0.55 + 1.2;
  return (
    <group name="event-totems">
      <InfoTotem position={[-x, 0, 4.5]} label="SCAN QR" />
      <InfoTotem position={[x, 0, 4.5]} label="EVENT INFO" />
    </group>
  );
}

function InfoTotem({ position, label }: { position: [number, number, number]; label: string }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.75, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.18, 1.5, 12]} />
        <meshStandardMaterial color="#101014" roughness={0.3} metalness={0.7} />
      </mesh>
      <mesh position={[0, 1.65, 0]} castShadow>
        <boxGeometry args={[0.85, 1.35, 0.1]} />
        <meshStandardMaterial
          color="#08080c"
          emissive="#2040a0"
          emissiveIntensity={0.9}
          roughness={0.15}
          metalness={0.8}
        />
      </mesh>
      <mesh position={[0, 1.65, 0.06]}>
        <boxGeometry args={[0.9, 1.4, 0.02]} />
        <meshStandardMaterial {...MAT_GOLD} emissiveIntensity={0.7} />
      </mesh>
      <Text position={[0, 2.45, 0.08]} fontSize={0.12} color={GOLD} anchorX="center" font={FONT}>
        {label}
      </Text>
    </group>
  );
}

function WelcomeSign({ position, flip = false }: { position: [number, number, number]; flip?: boolean }) {
  return (
    <group position={position} rotation={[0, flip ? -Math.PI / 2 : Math.PI / 2, 0]}>
      <mesh position={[0, 1.4, 0]} castShadow>
        <boxGeometry args={[0.08, 2.6, 1.4]} />
        <meshStandardMaterial color="#121218" roughness={0.4} metalness={0.55} />
      </mesh>
      <Text position={[0.06, 1.7, 0]} fontSize={0.14} color={LED_WHITE} rotation={[0, Math.PI / 2, 0]} font={FONT}>
        WELCOME
      </Text>
    </group>
  );
}

/** Flanking plants + desk glow pad */
function ReceptionDecor() {
  const plantX = halfW - 1.8;
  return (
    <group name="reception-decor">
      <PlantPot position={[-plantX, 0, 5.5]} />
      <PlantPot position={[plantX, 0, 5.5]} />
    </group>
  );
}

function PlantPot({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.45, 0.38, 0.85, 16]} />
        <meshStandardMaterial color="#101014" roughness={0.35} metalness={0.55} />
      </mesh>
      <mesh position={[0, 0.88, 0]}>
        <torusGeometry args={[0.47, 0.025, 12, 24]} />
        <meshStandardMaterial {...MAT_GOLD} emissiveIntensity={0.9} />
      </mesh>
      <mesh position={[0, 1.55, 0]} castShadow>
        <coneGeometry args={[0.55, 1.6, 10]} />
        <meshStandardMaterial color="#1a4a28" roughness={0.85} />
      </mesh>
    </group>
  );
}

/** LED floor strips for dramatic edge lighting */
function LEDFloorStrips() {
  return (
    <group name="led-floor-strips">
      {/* Perimeter glow strips */}
      {/* North edge */}
      <mesh position={[0, 0.03, cz - halfD + 2]} castShadow>
        <boxGeometry args={[floorW - 3, 0.04, 0.15]} />
        <meshStandardMaterial
          color={GOLD}
          emissive={GOLD}
          emissiveIntensity={2.8}
          roughness={0.15}
          metalness={0.9}
        />
      </mesh>
      
      {/* South edge */}
      <mesh position={[0, 0.03, cz + halfD - 2]} castShadow>
        <boxGeometry args={[floorW - 3, 0.04, 0.15]} />
        <meshStandardMaterial
          color={GOLD}
          emissive={GOLD}
          emissiveIntensity={2.8}
          roughness={0.15}
          metalness={0.9}
        />
      </mesh>
      
      {/* West edge */}
      <mesh position={[-halfW + 2, 0.03, cz]} castShadow>
        <boxGeometry args={[0.15, 0.04, floorD - 3]} />
        <meshStandardMaterial
          color={GOLD}
          emissive={GOLD}
          emissiveIntensity={2.8}
          roughness={0.15}
          metalness={0.9}
        />
      </mesh>
      
      {/* East edge */}
      <mesh position={[halfW - 2, 0.03, cz]} castShadow>
        <boxGeometry args={[0.15, 0.04, floorD - 3]} />
        <meshStandardMaterial
          color={GOLD}
          emissive={GOLD}
          emissiveIntensity={2.8}
          roughness={0.15}
          metalness={0.9}
        />
      </mesh>
    </group>
  );
}

/** Gold pillars only behind reception (north) — not blocking south entry */
function GoldAccents() {
  return (
    <group name="gold-accents">
      {[
        [-halfW + 2.5, height / 2, cz - halfD + 2.5],
        [halfW - 2.5, height / 2, cz - halfD + 2.5],
      ].map((pos, i) => (
        <mesh key={`pillar-${i}`} position={pos as [number, number, number]} castShadow>
          <cylinderGeometry args={[0.25, 0.3, height - 1, 16]} />
          <meshStandardMaterial
            color={GOLD}
            roughness={0.25}
            metalness={0.85}
            envMapIntensity={1.2}
          />
        </mesh>
      ))}
    </group>
  );
}

useGLTF.preload(RECEPTION_DESK_GLB_URL);
