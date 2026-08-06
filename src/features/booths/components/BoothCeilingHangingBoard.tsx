import { Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import {
  resolveHangingBoardName,
  HALL_HEIGHT,
  type BoothHeaderBranding,
} from '@/features/shared/data/boothLayouts';

const FONT =
  'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfMZhrib2Bg-4.ttf';

const _worldPos = new THREE.Vector3();
const _worldScale = new THREE.Vector3();

/**
 * Ceiling-hung project name board — white face, thick gold frame, two suspension rods
 * that always stretch up to the hall ceiling (even after Edit Layout moves the board).
 * Text only — logos stay on the attached booth top fascia bar.
 */
export function BoothCeilingHangingBoard({
  boothName,
  headerBranding,
  accent = '#d4af37',
  /** Title + underline color — defaults to accent; set separately for multi-color branding. */
  textColor,
  boardColor = '#ffffff',
  width = 9.2,
  height = 1.55,
  depth = 0.18,
}: {
  boothName: string;
  headerBranding?: BoothHeaderBranding;
  /** Kept for call-site compatibility; hanging board no longer uses tagline. */
  companyTagline?: string;
  accent?: string;
  textColor?: string;
  boardColor?: string;
  width?: number;
  height?: number;
  depth?: number;
}) {
  const rootRef = useRef<THREE.Group>(null);
  const rodMeshRefs = useRef<(THREE.Mesh | null)[]>([null, null]);
  const mountRefs = useRef<(THREE.Mesh | null)[]>([null, null]);

  const title = resolveHangingBoardName({
    name: boothName,
    headerBranding,
  })
    .trim()
    .toUpperCase();
  const titleColor = (textColor ?? accent).trim() || accent;
  const zFace = depth / 2 + 0.02;
  const frameT = 0.1;
  const rawScale = headerBranding?.hangingTitleScale;
  const fontScale =
    typeof rawScale === 'number' && Number.isFinite(rawScale)
      ? Math.min(1.8, Math.max(0.7, rawScale))
      : 1.25;
  const titleSize = Math.min(0.72 * fontScale, width * 0.078 * fontScale);
  const rodXs = useMemo(() => [-width * 0.32, width * 0.32] as const, [width]);
  const underlineW = Math.min(width * 0.55, Math.max(1.2, title.length * titleSize * 0.38));

  // Stretch rods so their tops sit flush under the hall ceiling in world space.
  useFrame(() => {
    const root = rootRef.current;
    if (!root) return;
    root.getWorldPosition(_worldPos);
    root.getWorldScale(_worldScale);
    const sy = Math.max(_worldScale.y, 0.001);
    const boardTopWorldY = _worldPos.y + (height / 2) * sy;
    // Slightly into the ceiling slab so the mount plate reads as attached.
    const targetWorldY = HALL_HEIGHT - 0.02;
    const localRodLen = Math.max(0.4, (targetWorldY - boardTopWorldY) / sy);

    for (let i = 0; i < 2; i++) {
      const rod = rodMeshRefs.current[i];
      const mount = mountRefs.current[i];
      if (rod) {
        rod.position.y = height / 2 + localRodLen * 0.5;
        rod.scale.set(1, localRodLen, 1);
      }
      if (mount) {
        mount.position.y = height / 2 + localRodLen;
      }
    }
  });

  return (
    <group ref={rootRef}>
      {/* Suspension rods + ceiling mounts (length updated each frame to meet ceiling) */}
      {rodXs.map((x, i) => (
        <group key={`rod-${x}`}>
          <mesh
            ref={(el) => {
              rodMeshRefs.current[i] = el;
            }}
            position={[x, height / 2 + 1.2, 0]}
            castShadow
          >
            {/* Unit height — scaled in Y by useFrame to reach the ceiling */}
            <cylinderGeometry args={[0.028, 0.028, 1, 8]} />
            <meshStandardMaterial color="#1a1a1a" metalness={0.7} roughness={0.35} />
          </mesh>
          <mesh position={[x, height / 2 + 0.04, 0]}>
            <sphereGeometry args={[0.055, 10, 10]} />
            <meshStandardMaterial color="#2a2a2a" metalness={0.8} roughness={0.3} />
          </mesh>
          <mesh
            ref={(el) => {
              mountRefs.current[i] = el;
            }}
            position={[x, height / 2 + 2.4, 0]}
          >
            <boxGeometry args={[0.28, 0.1, 0.28]} />
            <meshStandardMaterial color="#2a2a2a" metalness={0.75} roughness={0.3} />
          </mesh>
        </group>
      ))}

      {/* Board body */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshPhysicalMaterial
          color={boardColor}
          roughness={0.28}
          metalness={0}
          clearcoat={0.55}
          clearcoatRoughness={0.2}
          envMapIntensity={0.12}
        />
      </mesh>

      {/* Thick gold frame */}
      <mesh position={[0, height / 2 - frameT / 2, zFace - 0.01]}>
        <boxGeometry args={[width + 0.04, frameT, 0.06]} />
        <meshStandardMaterial
          color={accent}
          metalness={0.88}
          roughness={0.2}
          emissive={accent}
          emissiveIntensity={0.22}
        />
      </mesh>
      <mesh position={[0, -(height / 2 - frameT / 2), zFace - 0.01]}>
        <boxGeometry args={[width + 0.04, frameT, 0.06]} />
        <meshStandardMaterial
          color={accent}
          metalness={0.88}
          roughness={0.2}
          emissive={accent}
          emissiveIntensity={0.28}
        />
      </mesh>
      {[-width / 2 + frameT / 2, width / 2 - frameT / 2].map((x, i) => (
        <mesh key={`side-${i}`} position={[x, 0, zFace - 0.01]}>
          <boxGeometry args={[frameT, height - frameT * 2 + 0.02, 0.06]} />
          <meshStandardMaterial color={accent} metalness={0.85} roughness={0.22} />
        </mesh>
      ))}

      <Text
        position={[0, 0.08, zFace]}
        fontSize={titleSize}
        color={titleColor}
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.08}
        maxWidth={width - 0.6}
        textAlign="center"
        font={FONT}
      >
        {title}
        <meshStandardMaterial
          attach="material"
          color={titleColor}
          emissive={titleColor}
          emissiveIntensity={0.35}
          metalness={0.45}
          roughness={0.35}
        />
      </Text>

      <mesh position={[0, -titleSize * 0.55, zFace]}>
        <boxGeometry args={[underlineW, 0.028, 0.02]} />
        <meshStandardMaterial
          color={titleColor}
          metalness={0.9}
          roughness={0.2}
          emissive={titleColor}
          emissiveIntensity={0.3}
        />
      </mesh>
    </group>
  );
}
