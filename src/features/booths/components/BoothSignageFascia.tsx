import { Component, type ReactNode, Suspense, useLayoutEffect, useMemo } from 'react';
import { Text, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import {
  resolveBoothHeaderBranding,
  resolveFasciaLayout,
  resolveHeaderLogoScale,
  type BoothHeaderBranding,
} from '@/features/shared/data/boothLayouts';
import { sanitizeBoothLogoUrlForWebGL } from '@/features/exhibitorDashboard/exhibitorLogo';
import { boothDisplayCode } from '@/features/exhibitorDashboard/exhibitorConfig';

const FONT =
  'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfMZhrib2Bg-4.ttf';

/**
 * Gold number plate showing only the booth number, e.g. 08 or 09.
 */
export function BoothNumberBadge({
  boothId,
  accent = '#d4af37',
  position = [0, 0, 0] as [number, number, number],
  rotation = [0, 0, 0] as [number, number, number],
  scale = 1,
}: {
  boothId: string;
  accent?: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
}) {
  const code = boothDisplayCode(boothId).match(/\d+/)?.[0] ?? boothDisplayCode(boothId);
  const plateW = 0.62 * scale;
  const plateH = 0.52 * scale;
  const fontSize = 0.28 * scale;

  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[plateW + 0.06, plateH + 0.06]} />
        <meshStandardMaterial
          color={accent}
          metalness={0.85}
          roughness={0.22}
          emissive={accent}
          emissiveIntensity={0.25}
        />
      </mesh>
      <mesh position={[0, 0, 0.01]}>
        <planeGeometry args={[plateW, plateH]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.45} metalness={0.15} />
      </mesh>
      <Text
        position={[0, 0, 0.03]}
        fontSize={fontSize}
        color={accent}
        anchorX="center"
        anchorY="middle"
        font={FONT}
        letterSpacing={0.06}
      >
        {code}
        <meshStandardMaterial
          attach="material"
          color={accent}
          emissive={accent}
          emissiveIntensity={0.4}
          metalness={0.4}
          roughness={0.35}
        />
      </Text>
    </group>
  );
}

function FasciaLogoPlaceholder() {
  return (
    <Text fontSize={0.14} color="#9ca3af" anchorX="center" anchorY="middle" font={FONT}>
      LOGO
    </Text>
  );
}

class FasciaLogoErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) return <FasciaLogoPlaceholder />;
    return this.props.children;
  }
}

function FasciaLogoPlane({
  url,
  scale,
  variant = 'side',
}: {
  url: string;
  scale: number;
  variant?: 'side' | 'center';
}) {
  const tex = useTexture(url);
  useLayoutEffect(() => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    tex.needsUpdate = true;
  }, [tex]);

  const { logoW, logoH } = useMemo(() => {
    const img = tex.image as { width?: number; height?: number } | undefined;
    const aspect =
      img?.width && img?.height && img.height > 0 ? img.width / img.height : 2.2;
    const isCenter = variant === 'center';
    const baseMaxH = isCenter ? 0.78 : 0.88;
    const baseMaxW = isCenter ? 3.2 : 1.55;
    const maxH = baseMaxH * scale;
    const maxW = baseMaxW * scale;
    let logoH = maxH;
    let logoW = logoH * aspect;
    if (logoW > maxW) {
      logoW = maxW;
      logoH = logoW / aspect;
    }
    return { logoW, logoH };
  }, [tex, scale, variant]);

  return (
    <mesh position={[0, 0, 0.04]}>
      <planeGeometry args={[logoW, logoH]} />
      <meshStandardMaterial
        map={tex}
        emissiveMap={tex}
        emissive="#fff8f0"
        emissiveIntensity={1.4}
        color="#ffffff"
        transparent
        alphaTest={0.06}
        toneMapped={false}
      />
    </mesh>
  );
}

function FasciaLogoSlot({
  url,
  scale,
  variant = 'side',
}: {
  url: string;
  scale: number;
  variant?: 'side' | 'center';
}) {
  return (
    <FasciaLogoErrorBoundary key={url}>
      <Suspense fallback={<FasciaLogoPlaceholder />}>
        <FasciaLogoPlane url={url} scale={scale} variant={variant} />
      </Suspense>
    </FasciaLogoErrorBoundary>
  );
}

/** Reusable fascia logo plane (e.g. Vertex Elite header). */
export function BoothFasciaLogo({
  url,
  scale = 1,
  variant = 'side',
}: {
  url: string;
  scale?: number;
  variant?: 'side' | 'center';
}) {
  return <FasciaLogoSlot url={url} scale={scale} variant={variant} />;
}

export function BoothSignageFascia({
  boothId,
  boothName,
  accent = '#d4af37',
  headerLogoUrl,
  projectLogoUrl,
  headerBranding,
  companyTagline,
  fasciaColor = '#e6e4de',
  subtitleColor = '#4a4844',
  width = 12.5,
  height = 1.45,
  depth = 0.72,
  position = [0, 6.5, -3.64] as [number, number, number],
}: {
  boothId?: string;
  boothName: string;
  accent?: string;
  headerLogoUrl?: string;
  /** Right fascia logo (project logo). */
  projectLogoUrl?: string;
  headerBranding?: BoothHeaderBranding;
  companyTagline?: string;
  fasciaColor?: string;
  subtitleColor?: string;
  width?: number;
  height?: number;
  depth?: number;
  position?: [number, number, number];
}) {
  const branding = resolveBoothHeaderBranding({
    name: boothName,
    headerBranding,
    companyTagline,
  });
  const zFace = depth / 2 + 0.04;
  const titleSize = Math.min(0.62, width * 0.038);
  const subSize = titleSize * 0.42;
  const logoUrl = sanitizeBoothLogoUrlForWebGL(headerLogoUrl);
  const rightLogoUrl = sanitizeBoothLogoUrlForWebGL(projectLogoUrl);
  const logoScale = resolveHeaderLogoScale(headerBranding);
  const { centerLogo, hideCenterText, showRera } = resolveFasciaLayout(
    headerBranding,
    Boolean(rightLogoUrl),
  );
  const showRightLogo = Boolean(rightLogoUrl) && !centerLogo;
  const showRightRera = showRera && !showRightLogo;

  return (
    <group position={position}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshPhysicalMaterial
          color={fasciaColor}
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
        <meshStandardMaterial
          color={accent}
          metalness={0.88}
          roughness={0.22}
          emissive={accent}
          emissiveIntensity={0.2}
        />
      </mesh>
      <mesh position={[0, -height / 2 + 0.04, zFace - 0.02]}>
        <boxGeometry args={[width + 0.06, 0.07, 0.05]} />
        <meshStandardMaterial
          color={accent}
          metalness={0.88}
          roughness={0.22}
          emissive={accent}
          emissiveIntensity={0.35}
        />
      </mesh>
      {[-width / 2 + 0.04, width / 2 - 0.04].map((x, i) => (
        <mesh key={`cap-${i}`} position={[x, 0, zFace - 0.02]}>
          <boxGeometry args={[0.07, height - 0.12, 0.05]} />
          <meshStandardMaterial color={accent} metalness={0.85} roughness={0.25} />
        </mesh>
      ))}

      {!centerLogo ? (
        <group position={[-width * 0.34, 0.02, zFace]}>
          {logoUrl ? <FasciaLogoSlot url={logoUrl} scale={logoScale} /> : <FasciaLogoPlaceholder />}
        </group>
      ) : null}

      {centerLogo ? (
        <group position={[0, 0.02, zFace]}>
          {logoUrl ? (
            <FasciaLogoSlot url={logoUrl} scale={logoScale} variant="center" />
          ) : (
            <FasciaLogoPlaceholder />
          )}
        </group>
      ) : null}

      {!hideCenterText ? (
        <>
          <Text
            position={[0, branding.projectSubtitle ? 0.12 : 0.02, zFace]}
            fontSize={titleSize}
            color={accent}
            anchorX="center"
            anchorY="middle"
            letterSpacing={0.05}
            maxWidth={width * 0.38}
            textAlign="center"
            font={FONT}
          >
            {branding.projectName}
            <meshStandardMaterial
              attach="material"
              color={accent}
              emissive={accent}
              emissiveIntensity={0.35}
              metalness={0.5}
              roughness={0.35}
            />
          </Text>
          {branding.projectSubtitle ? (
            <Text
              position={[0, -0.18, zFace]}
              fontSize={subSize}
              color={subtitleColor}
              anchorX="center"
              anchorY="middle"
              letterSpacing={0.12}
              maxWidth={width * 0.38}
              textAlign="center"
              font={FONT}
            >
              {branding.projectSubtitle}
            </Text>
          ) : null}
        </>
      ) : null}

      {showRightLogo ? (
        <group position={[width * 0.34, 0.02, zFace]}>
          <FasciaLogoSlot url={rightLogoUrl!} scale={logoScale} />
        </group>
      ) : null}

      {showRightRera ? (
        <group position={[width * 0.34, 0, zFace]}>
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
          {branding.reraNumber ? (
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
              {branding.reraNumber}
            </Text>
          ) : null}
        </group>
      ) : null}

      {boothId ? (
        <BoothNumberBadge
          boothId={boothId}
          accent={accent}
          position={[0, -6.05, 3.11]}
          rotation={[0, Math.PI, 0]}
          scale={1.15}
        />
      ) : null}
    </group>
  );
}
