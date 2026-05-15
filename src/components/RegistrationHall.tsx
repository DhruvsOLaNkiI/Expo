import { REG_HALL, REG_RECEPTION_Z } from '../data/registrationHall';
import {
  mergeRegistrationLayout,
  type RegistrationImportedModel,
  type RegistrationLayoutConfig,
} from '../data/boothLayouts';
import { LayoutEditableGroup } from './LayoutEditableGroup';
import { Text, useGLTF } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import { Suspense, useMemo } from 'react';
import { useStore } from '../store';
import * as THREE from 'three';

const { halfW, halfD, height, centerZ } = REG_HALL;
const cz = centerZ;
const floorW = halfW * 2;
const floorD = halfD * 2;

// Color palette
const FLOOR_DARK = '#1a1a1a';
const WALL_PANEL = '#2a2a2a';
const BLACK_GRID = '#0a0a0a';
const GOLD = '#d4af37';
const LED_WHITE = '#f0f8ff';
const RECEPTION_Z = REG_RECEPTION_Z;
const FONT =
  'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfMZhrib2Bg-4.ttf';

const MAT_DESK = { color: '#101014', roughness: 0.18, metalness: 0.78 } as const;
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
      <HexagonLEDCeiling />
      <LEDFloorStrips />
      <GoldAccents />
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
          roughness={0.08}
          metalness={0.65}
          envMapIntensity={1.2}
        />
      </mesh>
      
      {/* Reception zone reflective pad */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, RECEPTION_Z]}>
        <planeGeometry args={[32, 16]} />
        <meshStandardMaterial
          color="#222228"
          roughness={0.05}
          metalness={0.78}
          envMapIntensity={1.4}
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
        <meshStandardMaterial color={WALL_PANEL} roughness={0.85} metalness={0.12} />
      </mesh>
      <WallLEDStrips position={[0, 2, cz - halfD + 0.45]} width={floorW - 4} />
      <WallLEDStrips position={[0, height - 2, cz - halfD + 0.45]} width={floorW - 4} />
      
      {/* South wall (back) */}
      <mesh position={[0, height / 2, cz + halfD - 0.2]} receiveShadow castShadow>
        <boxGeometry args={[floorW, height, 0.4]} />
        <meshStandardMaterial color={WALL_PANEL} roughness={0.85} metalness={0.12} />
      </mesh>
      <WallLEDStrips position={[0, 2, cz + halfD - 0.45]} width={floorW - 4} />
      
      {/* West wall (left) */}
      <mesh position={[-halfW + 0.2, height / 2, cz]} receiveShadow castShadow>
        <boxGeometry args={[0.4, height, floorD]} />
        <meshStandardMaterial color={WALL_PANEL} roughness={0.85} metalness={0.12} />
      </mesh>
      
      {/* East wall (right) */}
      <mesh position={[halfW - 0.2, height / 2, cz]} receiveShadow castShadow>
        <boxGeometry args={[0.4, height, floorD]} />
        <meshStandardMaterial color={WALL_PANEL} roughness={0.85} metalness={0.12} />
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
        emissiveIntensity={2.2}
        roughness={0.3}
        metalness={0.8}
      />
    </mesh>
  );
}

/** BLACK HEXAGON LED CEILING - Primary design element */
function HexagonLEDCeiling() {
  const hexRadius = 2.2;
  const gridSpacing = 4.6;
  const numX = 11;
  const numZ = 13;
  
  return (
    <group name="hexagon-ceiling" position={[0, height - 0.25, cz]}>
      {/* Black ceiling base */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.25, 0]} receiveShadow>
        <planeGeometry args={[floorW, floorD]} />
        <meshStandardMaterial color={BLACK_GRID} roughness={0.75} metalness={0.25} />
      </mesh>
      
      {/* Hexagon LED panels grid */}
      {Array.from({ length: numX }).map((_, i) =>
        Array.from({ length: numZ }).map((_, j) => {
          const offsetX = (j % 2) * (gridSpacing / 2);
          const x = -22 + i * gridSpacing + offsetX;
          const z = -26 + j * (gridSpacing * 0.87);
          
          if (Math.abs(x) > halfW - 3 || Math.abs(z) > halfD - 3) return null;
          
          return (
            <HexagonPanel
              key={`hex-${i}-${j}`}
              position={[x, 0, z]}
              radius={hexRadius}
              glowIntensity={1.8 + ((i * 7 + j) % 5) * 0.25}
            />
          );
        })
      )}
      
      {/* Angular LED strip lines connecting hexagons */}
      <AngularLEDStrips />
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
          roughness={0.2}
          metalness={0.7}
        />
      </mesh>
    </group>
  );
}

/** Angular LED strip lines for futuristic grid pattern */
function AngularLEDStrips() {
  return (
    <group name="angular-strips">
      {/* Horizontal strips */}
      {[-20, -10, 0, 10, 20].map((z, i) => (
        <mesh key={`h-strip-${i}`} position={[0, -0.05, z]}>
          <boxGeometry args={[floorW - 4, 0.06, 0.12]} />
          <meshStandardMaterial
            color={LED_WHITE}
            emissive={LED_WHITE}
            emissiveIntensity={1.8}
            roughness={0.25}
            metalness={0.75}
          />
        </mesh>
      ))}
      
      {/* Vertical strips */}
      {[-18, -9, 0, 9, 18].map((x, i) => (
        <mesh key={`v-strip-${i}`} position={[x, -0.05, 0]}>
          <boxGeometry args={[0.12, 0.06, floorD - 4]} />
          <meshStandardMaterial
            color={LED_WHITE}
            emissive={LED_WHITE}
            emissiveIntensity={1.8}
            roughness={0.25}
            metalness={0.75}
          />
        </mesh>
      ))}
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
        <StaffWorkstations />
      </LayoutEditableGroup>
      <LayoutEditableGroup
        name="reg-event-totems"
        position={layout.totemsOffset}
        rotation={lobbyRotation(layout, 'reg-event-totems')}
      >
        <EventInfoTotems />
      </LayoutEditableGroup>
      <LayoutEditableGroup
        name="reg-queue-lanes"
        position={layout.queueOffset}
        rotation={lobbyRotation(layout, 'reg-queue-lanes')}
      >
        <ReceptionQueueLanes />
      </LayoutEditableGroup>
      <DigitalVerticalBanners />
      <MainExpoHallEntrance />
      <FloorQueueGuides />
      <ReceptionDecor />
      <LobbyLoungeArea />
    </LayoutEditableGroup>
  );
}

/** Evenly spaced station X positions along the desk */
function stationPositions(count: number, span: number): number[] {
  if (count <= 1) return [0];
  const step = span / (count - 1);
  const start = -span / 2;
  return Array.from({ length: count }, (_, i) => start + i * step);
}

/** Large LED + banner backdrop behind staff */
function ExpoBackdropWall() {
  const wallZ = -8.5;
  return (
    <group position={[0, 0, wallZ]}>
      <mesh position={[0, 4.2, 0]} castShadow receiveShadow>
        <boxGeometry args={[28, 5.2, 0.35]} />
        <meshStandardMaterial
          color="#08080c"
          emissive="#1a2030"
          emissiveIntensity={0.55}
          roughness={0.25}
          metalness={0.75}
        />
      </mesh>

      <Text
        position={[0, 5.1, 0.22]}
        fontSize={0.72}
        color={LED_WHITE}
        maxWidth={18}
        textAlign="center"
        anchorX="center"
        anchorY="middle"
        font={FONT}
      >
        WELCOME TO THE EXPO
      </Text>
      <Text
        position={[0, 4.0, 0.22]}
        fontSize={0.32}
        color={GOLD}
        anchorX="center"
        anchorY="middle"
        font={FONT}
      >
        LAUNCH REAL ESTATE · GLOBAL PROPERTY SHOWCASE
      </Text>

      {/* Sponsor / project logo panels */}
      {[-7.5, -2.5, 2.5, 7.5].map((x, i) => (
        <mesh key={`logo-${i}`} position={[x, 2.4, 0.2]} castShadow>
          <boxGeometry args={[3.2, 1.4, 0.08]} />
          <meshStandardMaterial color="#141418" roughness={0.35} metalness={0.65} />
        </mesh>
      ))}

      {/* Vertical branding banners */}
      {[-9.8, 9.8].map((x, i) => (
        <group key={`banner-${i}`} position={[x, 3.8, 0.15]}>
          <mesh castShadow>
            <boxGeometry args={[1.1, 6.5, 0.12]} />
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

const STATION_COUNT = 8;

/** Wide premium registration counter — visitor-facing south (+Z) */
function RegistrationCounterDesk() {
  const openRegistrationPopup = useStore((s) => s.openRegistrationPopup);
  const deskW = 30;
  const deskH = 1.18;
  const deskD = 2.05;
  const stationXs = stationPositions(STATION_COUNT, deskW - 4);

  const pointerProps = {
    onClick: (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      openRegistrationPopup();
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
    <group>
      {/* Main counter body */}
      <mesh position={[0, deskH / 2, 1.2]} castShadow receiveShadow {...pointerProps}>
        <boxGeometry args={[deskW, deskH, deskD]} />
        <meshStandardMaterial {...MAT_DESK} envMapIntensity={1.1} />
      </mesh>

      {/* Glossy top slab */}
      <mesh position={[0, deskH + 0.04, 1.2]} receiveShadow {...pointerProps}>
        <boxGeometry args={[deskW + 0.1, 0.07, deskD + 0.08]} />
        <meshStandardMaterial color="#1a1a22" roughness={0.08} metalness={0.88} />
      </mesh>

      {/* Gold LED edge — top */}
      <mesh position={[0, deskH + 0.1, 1.2]}>
        <boxGeometry args={[deskW + 0.15, 0.05, deskD + 0.12]} />
        <meshStandardMaterial {...MAT_GOLD} emissiveIntensity={2.2} />
      </mesh>

      {/* Gold LED edge — front kick */}
      <mesh position={[0, 0.12, 1.2 + deskD / 2 + 0.04]}>
        <boxGeometry args={[deskW + 0.1, 0.06, 0.08]} />
        <meshStandardMaterial {...MAT_GOLD} emissiveIntensity={2.5} />
      </mesh>

      <mesh position={[0, 0.06, 1.2 + deskD / 2 + 0.12]}>
        <boxGeometry args={[deskW + 0.2, 0.04, 0.14]} />
        <meshStandardMaterial {...MAT_GOLD} emissiveIntensity={3.2} />
      </mesh>
      <mesh position={[0, 0.02, 1.2 + deskD / 2 + 0.2]}>
        <boxGeometry args={[deskW + 0.35, 0.02, 0.22]} />
        <meshStandardMaterial color={GOLD} emissive={GOLD} emissiveIntensity={1.8} transparent opacity={0.55} />
      </mesh>

      <Text
        position={[-deskW / 2 + 2.2, 0.62, 1.2 + deskD / 2 + 0.08]}
        fontSize={0.2}
        color={LED_WHITE}
        anchorX="left"
        anchorY="middle"
        font={FONT}
      >
        REGISTRATION
      </Text>

      {stationXs.map((x, i) => (
        <group key={`station-glass-${i}`} position={[x, deskH + 0.12, 1.2 + deskD / 2 - 0.15]}>
          <mesh>
            <boxGeometry args={[0.05, 0.95, 0.7]} />
            <meshStandardMaterial color="#e8eef8" transparent opacity={0.28} roughness={0.1} metalness={0.2} />
          </mesh>
          <Text position={[0, 0.1, 0.38]} fontSize={0.14} color={LED_WHITE} anchorX="center" anchorY="middle" font={FONT}>
            {String(i + 1).padStart(2, '0')}
          </Text>
          <DeskTopPlant />
        </group>
      ))}

      {/* Visitor side low panel */}
      <mesh position={[0, 0.55, 2.35]} castShadow>
        <boxGeometry args={[deskW - 2, 0.08, 0.5]} />
        <meshStandardMaterial color="#0e0e12" roughness={0.3} metalness={0.6} />
      </mesh>
    </group>
  );
}

/** Small plant on desk between stations */
function DeskTopPlant() {
  return (
    <group position={[0.35, 0.55, 0]}>
      <mesh position={[0, 0.12, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.1, 0.24, 8]} />
        <meshStandardMaterial color="#101014" roughness={0.4} metalness={0.5} />
      </mesh>
      <mesh position={[0, 0.38, 0]} castShadow>
        <coneGeometry args={[0.14, 0.32, 8]} />
        <meshStandardMaterial color="#1a4a28" roughness={0.85} />
      </mesh>
    </group>
  );
}

/** Staff workstations behind counter — 8 check-in stations */
function StaffWorkstations() {
  const stationXs = stationPositions(STATION_COUNT, 26);
  return (
    <group name="staff-area">
      {/* Back credenza */}
      <mesh position={[0, 0.95, -0.35]} castShadow receiveShadow>
        <boxGeometry args={[28, 1.9, 0.65]} />
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
  const laneZ = [6.5, 4.8, 3.1, 1.4];
  const laneW = 11;
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
      <QueueRope from={[-laneW, 1.05, 6.5]} to={[laneW, 1.05, 6.5]} />
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
  return (
    <group name="digital-banners">
      <VerticalBanner position={[-16, 0, -2]} flip />
      <VerticalBanner position={[16, 0, 2]} />
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

/** Main expo hall doorway + directional sign (south wall area) */
function MainExpoHallEntrance() {
  return (
    <group name="main-expo-entrance" position={[14, 0, 10]}>
      <mesh position={[0, 2.4, 0]} castShadow>
        <boxGeometry args={[3.2, 4.2, 0.25]} />
        <meshStandardMaterial color="#0e0e12" roughness={0.4} metalness={0.5} />
      </mesh>
      <mesh position={[0, 2.4, 0.14]}>
        <boxGeometry args={[2.6, 3.6, 0.04]} />
        <meshStandardMaterial
          color="#08080c"
          emissive={GOLD}
          emissiveIntensity={0.35}
          roughness={0.3}
          metalness={0.6}
        />
      </mesh>
      <Text position={[0, 3.5, 0.18]} fontSize={0.14} color={GOLD} anchorX="center" font={FONT}>
        MAIN EXPO HALL
      </Text>
      <group position={[1.8, 2.2, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.08, 2.2, 1.1]} />
          <meshStandardMaterial color="#121218" roughness={0.45} />
        </mesh>
        {['EXHIBITION HALL', 'CONFERENCE ROOM', 'NETWORKING LOUNGE'].map((line, i) => (
          <Text
            key={line}
            position={[0.06, 1.6 - i * 0.55, 0]}
            fontSize={0.07}
            color={LED_WHITE}
            rotation={[0, Math.PI / 2, 0]}
            anchorX="left"
            font={FONT}
          >
            {line}
          </Text>
        ))}
      </group>
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

/** ──────────────────────────────────────────────────
 *  PREMIUM LOBBY LOUNGE — lights + couches + plants
 * ────────────────────────────────────────────────── */
function LobbyLoungeArea() {
  const regLayout = useStore((s) => s.sceneOverrides.registrationLayout);
  const layout = useMemo(() => mergeRegistrationLayout(regLayout), [regLayout]);

  return (
    <LayoutEditableGroup
      name="reg-lobby-lounge"
      position={layout.loungeOffset}
      rotation={lobbyRotation(layout, 'reg-lobby-lounge')}
    >
      {/* ── Ceiling downlights over the carpet ── */}
      <pointLight position={[-5, height - 1, 0]} intensity={55} distance={12} decay={2} color="#fff5e0" />
      <pointLight position={[5, height - 1, 0]} intensity={55} distance={12} decay={2} color="#fff5e0" />
      <pointLight position={[0, height - 1, 3]} intensity={40} distance={10} decay={2} color="#ffecc8" />

      {/* Emissive downlight rings on ceiling */}
      {[-5, 5].map((x, i) => (
        <mesh key={`dl-ring-${i}`} position={[x, height - 0.12, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.28, 0.04, 12, 32]} />
          <meshStandardMaterial color="#fffbe8" emissive="#fffbe8" emissiveIntensity={3.5} />
        </mesh>
      ))}

      {/* ── Carpet ── */}
      <mesh position={[0, 0.015, 1]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[13, 8]} />
        <meshStandardMaterial color="#2a2830" roughness={0.95} metalness={0.02} />
      </mesh>
      {/* Thin gold border around rug */}
      {[
        [0, -3.5, 13, 0.06] as const,
        [0, 3.5, 13, 0.06] as const,
        [-6.5, 0, 0.06, 8] as const,
        [6.5, 0, 0.06, 8] as const,
      ].map(([x, z, w, d], i) => (
        <mesh key={`rug-edge-${i}`} position={[x, 0.02, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[w, d]} />
          <meshStandardMaterial color={GOLD} emissive={GOLD} emissiveIntensity={1.2} />
        </mesh>
      ))}

      {/* ── L-shaped sectional sofa (centre, faces registration desk) ── */}
      <LayoutEditableGroup
        name="reg-lobby-sectional"
        position={layout.sectionalOffset}
        rotation={lobbyRotation(layout, 'reg-lobby-sectional')}
      >
        <PremiumSectional />
      </LayoutEditableGroup>

      {/* ── Two accent chairs flanking the table ── */}
      <LayoutEditableGroup
        name="reg-lobby-chair-left"
        position={layout.chairLeftOffset}
        rotation={lobbyRotation(layout, 'reg-lobby-chair-left')}
      >
        <PremiumChair />
      </LayoutEditableGroup>
      <LayoutEditableGroup
        name="reg-lobby-chair-right"
        position={layout.chairRightOffset}
        rotation={lobbyRotation(layout, 'reg-lobby-chair-right')}
      >
        <PremiumChair />
      </LayoutEditableGroup>

      {/* ── Oval coffee table ── */}
      <LayoutEditableGroup
        name="reg-lobby-coffee-table"
        position={layout.coffeeTableOffset}
        rotation={lobbyRotation(layout, 'reg-lobby-coffee-table')}
      >
        <CoffeeTable />
      </LayoutEditableGroup>

      {/* ── Floor lamps ── */}
      <LayoutEditableGroup
        name="reg-lobby-lamp-left"
        position={layout.lampLeftOffset}
        rotation={lobbyRotation(layout, 'reg-lobby-lamp-left')}
      >
        <FloorLamp />
      </LayoutEditableGroup>
      <LayoutEditableGroup
        name="reg-lobby-lamp-right"
        position={layout.lampRightOffset}
        rotation={lobbyRotation(layout, 'reg-lobby-lamp-right')}
      >
        <FloorLamp />
      </LayoutEditableGroup>

      {/* ── Plants ── */}
      {layout.loungePlantOffsets.map((pos, i) => {
        const plantName = `reg-lobby-plant-${i}`;
        return (
          <LayoutEditableGroup
            key={plantName}
            name={plantName}
            position={pos}
            rotation={lobbyRotation(layout, plantName)}
          >
            <TallPlant />
          </LayoutEditableGroup>
        );
      })}

      <RegistrationImportedModels models={layout.importedModels} />
    </LayoutEditableGroup>
  );
}

/** 3-seat sofa with layered cushions + arms */
function PremiumSectional() {
  const fabric = { color: '#b8b2a8', roughness: 0.82, metalness: 0.04 } as const;
  const dark = { color: '#1a1a20', roughness: 0.28, metalness: 0.68 } as const;
  return (
    <group>
      {/* Legs */}
      {[-4.2, -1.4, 1.4, 4.2].map((x, i) =>
        [-0.38, 0.38].map((z, j) => (
          <mesh key={`leg-${i}-${j}`} position={[x, 0.1, z]} castShadow>
            <cylinderGeometry args={[0.05, 0.05, 0.2, 8]} />
            <meshStandardMaterial {...dark} />
          </mesh>
        ))
      )}
      {/* Base */}
      <mesh position={[0, 0.28, 0]} castShadow receiveShadow>
        <boxGeometry args={[9.8, 0.36, 1.1]} />
        <meshStandardMaterial {...fabric} />
      </mesh>
      {/* Seat cushions */}
      {[-3, -1, 1, 3].map((x, i) => (
        <mesh key={`cush-${i}`} position={[x, 0.55, 0.08]} castShadow>
          <boxGeometry args={[2.15, 0.22, 0.92]} />
          <meshStandardMaterial color="#c4beb4" roughness={0.8} metalness={0.03} />
        </mesh>
      ))}
      {/* Back rest */}
      <mesh position={[0, 0.9, -0.42]} castShadow>
        <boxGeometry args={[9.8, 0.8, 0.28]} />
        <meshStandardMaterial {...fabric} />
      </mesh>
      {/* Back cushions */}
      {[-3, -1, 1, 3].map((x, i) => (
        <mesh key={`back-cush-${i}`} position={[x, 0.88, -0.28]} castShadow>
          <boxGeometry args={[2.1, 0.72, 0.22]} />
          <meshStandardMaterial color="#c0bab0" roughness={0.82} />
        </mesh>
      ))}
      {/* Arm rests */}
      <mesh position={[-4.75, 0.65, 0]} castShadow>
        <boxGeometry args={[0.42, 0.52, 1.1]} />
        <meshStandardMaterial {...fabric} />
      </mesh>
      <mesh position={[4.75, 0.65, 0]} castShadow>
        <boxGeometry args={[0.42, 0.52, 1.1]} />
        <meshStandardMaterial {...fabric} />
      </mesh>
      {/* Dark gold arm caps */}
      <mesh position={[-4.75, 0.92, 0]}>
        <boxGeometry args={[0.44, 0.06, 1.12]} />
        <meshStandardMaterial {...dark} envMapIntensity={1.2} />
      </mesh>
      <mesh position={[4.75, 0.92, 0]}>
        <boxGeometry args={[0.44, 0.06, 1.12]} />
        <meshStandardMaterial {...dark} envMapIntensity={1.2} />
      </mesh>
      {/* Accent pillows */}
      {[-1.5, 1.5].map((x, i) => (
        <mesh key={`pillow-${i}`} position={[x, 0.88, -0.1]} castShadow>
          <boxGeometry args={[0.42, 0.42, 0.14]} />
          <meshStandardMaterial color={GOLD} roughness={0.7} metalness={0.15} />
        </mesh>
      ))}
    </group>
  );
}

/** Barrel accent chair */
function PremiumChair() {
  const fabric = { color: '#b0aaa0', roughness: 0.82, metalness: 0.04 } as const;
  const dark = { color: '#181820', roughness: 0.3, metalness: 0.65 } as const;
  return (
    <group>
      {/* Legs */}
      {[-0.36, 0.36].map((x, i) =>
        [-0.28, 0.28].map((z, j) => (
          <mesh key={`cl-${i}-${j}`} position={[x, 0.12, z]} castShadow>
            <cylinderGeometry args={[0.04, 0.04, 0.24, 8]} />
            <meshStandardMaterial {...dark} />
          </mesh>
        ))
      )}
      {/* Seat */}
      <mesh position={[0, 0.32, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.88, 0.22, 0.82]} />
        <meshStandardMaterial {...fabric} />
      </mesh>
      {/* Seat cushion */}
      <mesh position={[0, 0.48, 0.04]} castShadow>
        <boxGeometry args={[0.82, 0.18, 0.72]} />
        <meshStandardMaterial color="#bcb6ac" roughness={0.8} />
      </mesh>
      {/* Back */}
      <mesh position={[0, 0.82, -0.3]} castShadow>
        <boxGeometry args={[0.9, 0.7, 0.22]} />
        <meshStandardMaterial {...fabric} />
      </mesh>
      {/* Arms */}
      <mesh position={[-0.46, 0.6, -0.05]} castShadow>
        <boxGeometry args={[0.1, 0.32, 0.78]} />
        <meshStandardMaterial {...fabric} />
      </mesh>
      <mesh position={[0.46, 0.6, -0.05]} castShadow>
        <boxGeometry args={[0.1, 0.32, 0.78]} />
        <meshStandardMaterial {...fabric} />
      </mesh>
      {/* Gold leg caps */}
      {[-0.36, 0.36].map((x, i) =>
        [-0.28, 0.28].map((z, j) => (
          <mesh key={`cap-${i}-${j}`} position={[x, 0.02, z]}>
            <cylinderGeometry args={[0.045, 0.045, 0.04, 8]} />
            <meshStandardMaterial color={GOLD} roughness={0.2} metalness={0.92} />
          </mesh>
        ))
      )}
    </group>
  );
}

/** Oval marble-top coffee table with gold base */
function CoffeeTable() {
  return (
    <group>
      {/* Oval top */}
      <mesh position={[0, 0.52, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.25, 1.1, 0.08, 32]} />
        <meshStandardMaterial color="#2a2428" roughness={0.18} metalness={0.55} />
      </mesh>
      {/* Gold rim */}
      <mesh position={[0, 0.56, 0]}>
        <torusGeometry args={[1.18, 0.03, 12, 40]} />
        <meshStandardMaterial color={GOLD} emissive={GOLD} emissiveIntensity={1.4} roughness={0.18} metalness={0.92} />
      </mesh>
      {/* Pedestal */}
      <mesh position={[0, 0.26, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.28, 0.52, 16]} />
        <meshStandardMaterial color={GOLD} roughness={0.22} metalness={0.88} />
      </mesh>
      {/* Disc base */}
      <mesh position={[0, 0.04, 0]} receiveShadow>
        <cylinderGeometry args={[0.55, 0.55, 0.08, 24]} />
        <meshStandardMaterial color="#1a1820" roughness={0.3} metalness={0.7} />
      </mesh>
      {/* Decorative flower vase */}
      <mesh position={[0, 0.72, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.12, 0.32, 16]} />
        <meshStandardMaterial color="#d4c8b8" roughness={0.5} metalness={0.25} />
      </mesh>
      <mesh position={[0, 0.94, 0]} castShadow>
        <sphereGeometry args={[0.14, 10, 10]} />
        <meshStandardMaterial color="#f5e8d0" roughness={0.9} metalness={0.0} />
      </mesh>
    </group>
  );
}

/** Tall arc floor lamp with gold stand */
function FloorLamp() {
  return (
    <group>
      <mesh position={[0, 0.06, 0]} receiveShadow>
        <cylinderGeometry args={[0.22, 0.22, 0.12, 16]} />
        <meshStandardMaterial color="#111116" roughness={0.3} metalness={0.75} />
      </mesh>
      <mesh position={[0, 1.55, 0]} castShadow>
        <cylinderGeometry args={[0.025, 0.025, 3.0, 10]} />
        <meshStandardMaterial color={GOLD} roughness={0.2} metalness={0.9} />
      </mesh>
      {/* Shade */}
      <mesh position={[0, 3.1, 0]} castShadow>
        <cylinderGeometry args={[0.28, 0.18, 0.42, 16, 1, true]} />
        <meshStandardMaterial color="#f5ead8" roughness={0.85} side={2} />
      </mesh>
      {/* Emissive glow inside shade */}
      <mesh position={[0, 3.05, 0]}>
        <cylinderGeometry args={[0.16, 0.12, 0.06, 16]} />
        <meshStandardMaterial color="#fffbe8" emissive="#fffbe8" emissiveIntensity={4.5} />
      </mesh>
    </group>
  );
}

/** Tall decorative plant in black pot with gold ring */
function TallPlant() {
  return (
    <group>
      {/* Pot */}
      <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.38, 0.3, 0.9, 14]} />
        <meshStandardMaterial color="#0e0e12" roughness={0.35} metalness={0.55} />
      </mesh>
      {/* Gold rim */}
      <mesh position={[0, 0.92, 0]}>
        <torusGeometry args={[0.4, 0.025, 12, 24]} />
        <meshStandardMaterial color={GOLD} emissive={GOLD} emissiveIntensity={1.1} roughness={0.2} metalness={0.9} />
      </mesh>
      {/* Soil disc */}
      <mesh position={[0, 0.9, 0]}>
        <cylinderGeometry args={[0.36, 0.36, 0.04, 14]} />
        <meshStandardMaterial color="#2a2018" roughness={0.95} />
      </mesh>
      {/* Main stem */}
      <mesh position={[0, 1.8, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.06, 1.8, 8]} />
        <meshStandardMaterial color="#2d4a20" roughness={0.85} />
      </mesh>
      {/* Large leaf fans at different heights */}
      {[
        [0, 1.5, 0, 0] as const,
        [0, 2.0, 0, Math.PI / 3] as const,
        [0, 2.5, 0, -Math.PI / 4] as const,
        [0, 3.0, 0, Math.PI / 5] as const,
      ].map(([x, y, z, rotY], i) => (
        <mesh key={`leaf-${i}`} position={[x, y, z]} rotation={[Math.PI / 5 - i * 0.08, rotY, 0]} castShadow>
          <planeGeometry args={[0.6 + i * 0.1, 1.0 + i * 0.12]} />
          <meshStandardMaterial color="#1a4a22" roughness={0.85} side={2} />
        </mesh>
      ))}
    </group>
  );
}

/** Gold floor lines guiding queue toward desk */
function FloorQueueGuides() {
  const lines: Array<{ pos: [number, number, number]; rot: number; len: number }> = [
    { pos: [0, 0.02, 8], rot: 0, len: 14 },
    { pos: [-8, 0.02, 5], rot: Math.PI / 2, len: 6 },
    { pos: [8, 0.02, 5], rot: Math.PI / 2, len: 6 },
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
  return (
    <group name="event-totems">
      <InfoTotem position={[-11, 0, 4]} label="SCAN QR" />
      <InfoTotem position={[11, 0, 4]} label="EVENT INFO" />
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
  return (
    <group name="reception-decor">
      <PlantPot position={[-10.5, 0, 2.5]} />
      <PlantPot position={[10.5, 0, 2.5]} />
      <mesh position={[0, 0.02, 1.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[32, 5]} />
        <meshStandardMaterial
          color={GOLD}
          emissive={GOLD}
          emissiveIntensity={0.25}
          transparent
          opacity={0.35}
          roughness={0.2}
          metalness={0.9}
        />
      </mesh>
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
        <boxGeometry args={[floorW - 8, 0.04, 0.15]} />
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
        <boxGeometry args={[floorW - 8, 0.04, 0.15]} />
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
        <boxGeometry args={[0.15, 0.04, floorD - 8]} />
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
        <boxGeometry args={[0.15, 0.04, floorD - 8]} />
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

/** Gold metallic trim accents throughout */
function GoldAccents() {
  return (
    <group name="gold-accents">
      {/* Vertical gold pillars at key locations */}
      {[
        [-halfW + 4, height / 2, cz - halfD + 4],
        [halfW - 4, height / 2, cz - halfD + 4],
        [-halfW + 4, height / 2, cz + halfD - 4],
        [halfW - 4, height / 2, cz + halfD - 4],
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
