import { Text } from '@react-three/drei';
import type { Texture } from 'three';
import {
  resolveFasciaLayout,
  resolveHeaderLogoScale,
  resolveManagedHeaderCopy,
  type BoothHeaderBranding,
} from '@/features/shared/data/boothLayouts';
import { sanitizeBoothLogoUrlForWebGL } from '@/features/exhibitorDashboard/exhibitorLogo';
import { BoothFasciaLogo, BoothNumberBadge } from './BoothSignageFascia';

const FONT =
  'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfMZhrib2Bg-4.ttf';

/**
 * Exhibitor-controlled header beam. Reads only from `headerBranding` + `headerLogoUrl`
 * (no automatic booth-name title). Used for B-04 Crown Estates so CMS updates always apply.
 */
export function BoothManagedHeader({
  boothId,
  accent = '#d4af37',
  headerLogoUrl,
  projectLogoUrl,
  headerBranding,
  companyTagline,
  fasciaColor = '#1a1a1a',
  fasciaMap,
  subtitleColor = '#c8c4bc',
  width = 12.5,
  height = 1.45,
  depth = 0.72,
  position = [0, 6.5, -3.64] as [number, number, number],
}: {
  boothId: string;
  accent?: string;
  headerLogoUrl?: string;
  projectLogoUrl?: string;
  headerBranding?: BoothHeaderBranding;
  companyTagline?: string;
  fasciaColor?: string;
  /** When set, fascia uses the same gradient/map as booth walls (e.g. Crown Estates). */
  fasciaMap?: Texture;
  subtitleColor?: string;
  width?: number;
  height?: number;
  depth?: number;
  position?: [number, number, number];
}) {
  const zFace = depth / 2 + 0.04;
  const logoUrl = sanitizeBoothLogoUrlForWebGL(headerLogoUrl);
  const rightLogoUrl = sanitizeBoothLogoUrlForWebGL(projectLogoUrl);
  const logoScale = resolveHeaderLogoScale(headerBranding);
  const { centerLogo, showRera } = resolveFasciaLayout(
    headerBranding,
    Boolean(rightLogoUrl),
  );
  const copy = resolveManagedHeaderCopy({
    headerBranding,
    companyTagline,
    hasProjectLogo: Boolean(rightLogoUrl),
  });
  const titleSize = Math.min(0.58, width * 0.036);
  const subSize = titleSize * 0.42;
  const headerKey = [
    boothId,
    logoUrl ?? '',
    rightLogoUrl ?? '',
    centerLogo ? 'c' : 'l',
    copy.showTitle ? copy.title : '',
    copy.showSubtitle ? copy.subtitle : '',
    fasciaColor,
  ].join('|');

  return (
    <group position={position} key={headerKey}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        {fasciaMap ? (
          <meshPhysicalMaterial
            map={fasciaMap}
            color="#ffffff"
            roughness={0.15}
            metalness={0.08}
            clearcoat={0.4}
            clearcoatRoughness={0.22}
          />
        ) : (
          <meshPhysicalMaterial
            color={fasciaColor}
            roughness={0.28}
            metalness={0.05}
            clearcoat={0.35}
            clearcoatRoughness={0.3}
          />
        )}
      </mesh>
      <mesh position={[0, -height / 2 + 0.03, zFace - 0.02]}>
        <boxGeometry args={[width + 0.04, 0.06, 0.04]} />
        <meshStandardMaterial
          color={accent}
          metalness={0.85}
          roughness={0.25}
          emissive={accent}
          emissiveIntensity={0.35}
        />
      </mesh>

      {centerLogo ? (
        <group position={[0, 0.02, zFace]}>
          {logoUrl ? (
            <BoothFasciaLogo url={logoUrl} scale={logoScale} variant="center" />
          ) : (
            <Text fontSize={0.14} color="#9ca3af" anchorX="center" anchorY="middle" font={FONT}>
              LOGO
            </Text>
          )}
        </group>
      ) : logoUrl ? (
        <group position={[-width * 0.36, 0.02, zFace]}>
          <BoothFasciaLogo url={logoUrl} scale={logoScale} />
        </group>
      ) : null}

      {copy.showTitle ? (
        <Text
          position={[0, copy.showSubtitle ? 0.12 : 0, zFace]}
          fontSize={titleSize}
          color={accent}
          anchorX="center"
          anchorY="middle"
          letterSpacing={0.05}
          maxWidth={width * 0.42}
          textAlign="center"
          font={FONT}
        >
          {copy.title}
          <meshStandardMaterial
            attach="material"
            color={accent}
            emissive={accent}
            emissiveIntensity={0.35}
            metalness={0.5}
            roughness={0.35}
          />
        </Text>
      ) : null}

      {copy.showSubtitle ? (
        <Text
          position={[0, -0.18, zFace]}
          fontSize={subSize}
          color={subtitleColor}
          anchorX="center"
          anchorY="middle"
          letterSpacing={0.1}
          maxWidth={width * 0.42}
          textAlign="center"
          font={FONT}
        >
          {copy.subtitle}
          <meshStandardMaterial attach="material" color={subtitleColor} />
        </Text>
      ) : null}

      {rightLogoUrl ? (
        <group position={[width * 0.36, 0.02, zFace]}>
          <BoothFasciaLogo url={rightLogoUrl} scale={logoScale} />
        </group>
      ) : showRera ? (
        <group position={[width * 0.36, 0, zFace]}>
          <Text
            position={[0, 0.1, 0]}
            fontSize={0.16}
            color={accent}
            anchorX="center"
            anchorY="middle"
            font={FONT}
          >
            RERA
            <meshStandardMaterial attach="material" color={accent} emissive={accent} emissiveIntensity={0.25} />
          </Text>
          {copy.reraNumber ? (
            <Text
              position={[0, -0.12, 0]}
              fontSize={0.11}
              color={subtitleColor}
              anchorX="center"
              anchorY="middle"
              maxWidth={2.2}
              textAlign="center"
              font={FONT}
            >
              {copy.reraNumber}
            </Text>
          ) : null}
        </group>
      ) : null}

      <BoothNumberBadge
        boothId={boothId}
        accent={accent}
        position={[0, -6.05, 3.11]}
        rotation={[0, Math.PI, 0]}
        scale={1.15}
      />
    </group>
  );
}
