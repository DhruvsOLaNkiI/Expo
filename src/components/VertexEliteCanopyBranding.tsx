import { Text } from '@react-three/drei';

const FONT =
  'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfMZhrib2Bg-4.ttf';

export function VertexEliteCanopyBranding({
  glow,
  position = [0, 6.12, 2.09] as [number, number, number],
}: {
  glow: string;
  position?: [number, number, number];
}) {
  const aw    = 13.0;
  const ah    = 1.02;
  const depth = 0.18;
  const rail  = 0.052;
  const zF    = depth / 2;
  const zR    = zF + 0.003;

  return (
    <group position={position}>
      {/* Single cheap point light — no rectAreaLight */}
      <pointLight position={[0, 0.1, 0.8]} intensity={3.5} color="#fff4e0" distance={6} decay={2} />

      {/* Fascia slab */}
      <mesh castShadow>
        <boxGeometry args={[aw, ah, depth]} />
        <meshStandardMaterial color="#010108" metalness={0.95} roughness={0.08} />
      </mesh>

      {/* Gold rails — top, bottom, left, right */}
      <mesh position={[0,  ah / 2 + rail / 2, zR]}>
        <boxGeometry args={[aw + rail * 2.8, rail, 0.034]} />
        <meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={1.0} metalness={0.97} roughness={0.04} toneMapped={false} />
      </mesh>
      <mesh position={[0, -ah / 2 - rail / 2, zR]}>
        <boxGeometry args={[aw + rail * 2.8, rail, 0.034]} />
        <meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={1.0} metalness={0.97} roughness={0.04} toneMapped={false} />
      </mesh>
      <mesh position={[-aw / 2 - rail / 2, 0, zR]}>
        <boxGeometry args={[rail, ah + rail * 2.8, 0.034]} />
        <meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={0.88} metalness={0.97} roughness={0.04} toneMapped={false} />
      </mesh>
      <mesh position={[ aw / 2 + rail / 2, 0, zR]}>
        <boxGeometry args={[rail, ah + rail * 2.8, 0.034]} />
        <meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={0.88} metalness={0.97} roughness={0.04} toneMapped={false} />
      </mesh>

      {/* Face panel */}
      <mesh position={[0, 0, zF + 0.005]}>
        <planeGeometry args={[aw * 0.984, ah * 0.984]} />
        <meshStandardMaterial color="#04041c" metalness={0.92} roughness={0.1} />
      </mesh>

      {/* Inner warm LED lines */}
      <mesh position={[0,  ah * 0.37, zF + 0.01]}>
        <planeGeometry args={[aw * 0.935, 0.024]} />
        <meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={3.2} toneMapped={false} />
      </mesh>
      <mesh position={[0, -ah * 0.37, zF + 0.01]}>
        <planeGeometry args={[aw * 0.935, 0.024]} />
        <meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={3.2} toneMapped={false} />
      </mesh>

      {/* VERTEX ELITE */}
      <Text
        position={[0, 0.1, zF + 0.022]}
        fontSize={1.08}
        letterSpacing={0.11}
        color="#fffdf8"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.09}
        outlineColor={glow}
        font={FONT}
      >
        VERTEX ELITE
        <meshStandardMaterial
          attach="material"
          color="#fffdf8"
          emissive="#fff5dc"
          emissiveIntensity={1.3}
          toneMapped={false}
        />
      </Text>

      {/* Tagline */}
      <Text
        position={[0, -0.38, zF + 0.016]}
        fontSize={0.19}
        letterSpacing={0.34}
        color={glow}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.026}
        outlineColor="#0e0a02"
        font={FONT}
      >
        SOVEREIGN RESIDENCES
        <meshStandardMaterial
          attach="material"
          color={glow}
          emissive={glow}
          emissiveIntensity={0.62}
          toneMapped={false}
        />
      </Text>
    </group>
  );
}
