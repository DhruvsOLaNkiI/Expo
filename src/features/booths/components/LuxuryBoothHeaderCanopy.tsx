import { Text } from '@react-three/drei';

const FONT =
  'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfMZhrib2Bg-4.ttf';

/** Grey satin fascia + gold trim — matches LUXE / standard luxury booth headers. */
export function LuxuryBoothHeaderCanopy({
  title,
  subtitle,
  accent = '#d4af37',
  width = 12.5,
  height = 1.45,
  depth = 0.72,
  position = [0, 0, 0] as [number, number, number],
}: {
  title: string;
  subtitle?: string;
  accent?: string;
  width?: number;
  height?: number;
  depth?: number;
  position?: [number, number, number];
}) {
  const zFace = depth / 2 + 0.04;
  const titleSize = Math.min(0.92, width * 0.052);
  const subSize = titleSize * 0.38;

  return (
    <group position={position}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshPhysicalMaterial
          color="#e6e4de"
          roughness={0.22}
          metalness={0}
          clearcoat={0.45}
          clearcoatRoughness={0.24}
          envMapIntensity={0.14}
          reflectivity={0.32}
        />
      </mesh>
      <mesh position={[0, height / 2 - 0.04, zFace - 0.02]}>
        <boxGeometry args={[width + 0.06, 0.07, 0.05]} />
        <meshStandardMaterial color={accent} metalness={0.88} roughness={0.22} emissive={accent} emissiveIntensity={0.2} />
      </mesh>
      <mesh position={[0, -height / 2 + 0.04, zFace - 0.02]}>
        <boxGeometry args={[width + 0.06, 0.07, 0.05]} />
        <meshStandardMaterial color={accent} metalness={0.88} roughness={0.22} emissive={accent} emissiveIntensity={0.35} />
      </mesh>
      {[-width / 2 + 0.04, width / 2 - 0.04].map((x, i) => (
        <mesh key={`cap-${i}`} position={[x, 0, zFace - 0.02]}>
          <boxGeometry args={[0.07, height - 0.12, 0.05]} />
          <meshStandardMaterial color={accent} metalness={0.85} roughness={0.25} />
        </mesh>
      ))}

      <Text
        position={[0, subtitle ? 0.14 : 0, zFace]}
        fontSize={titleSize}
        color={accent}
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.05}
        maxWidth={width - 0.8}
        textAlign="center"
        font={FONT}
      >
        {title}
        <meshStandardMaterial attach="material" color={accent} emissive={accent} emissiveIntensity={0.35} metalness={0.5} roughness={0.35} />
      </Text>
      {subtitle ? (
        <Text
          position={[0, -0.22, zFace]}
          fontSize={subSize}
          color="#4a4844"
          anchorX="center"
          anchorY="middle"
          letterSpacing={0.14}
          font={FONT}
        >
          {subtitle}
        </Text>
      ) : null}
    </group>
  );
}
