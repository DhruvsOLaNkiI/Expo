import { Text } from '@react-three/drei';
import { useState } from 'react';
import * as THREE from 'three';
import { useStore } from '../store';

const FONT =
  'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfMZhrib2Bg-4.ttf';

const GOLD        = '#d4af37';
const GOLD_BRIGHT = '#f5d060';
const WHITE       = '#fffef8';
const DARK        = '#020209';
const GLASS       = '#07071a';

type CtaRow = { label: string; url: string; siteMapUrls?: string[] };

function BookIcon({ glow, z }: { glow: string; z: number }) {
  return (
    <group position={[0, 0, z]}>
      <mesh position={[-0.035, 0, 0]}><boxGeometry args={[0.055, 0.11, 0.006]} /><meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={0.9} toneMapped={false} /></mesh>
      <mesh position={[ 0.035, 0, 0]}><boxGeometry args={[0.055, 0.11, 0.006]} /><meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={0.9} toneMapped={false} /></mesh>
      <mesh><boxGeometry args={[0.008, 0.115, 0.008]} /><meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={1.2} toneMapped={false} /></mesh>
    </group>
  );
}

function DocIcon({ glow, z }: { glow: string; z: number }) {
  return (
    <group position={[0, 0, z]}>
      <mesh><boxGeometry args={[0.09, 0.115, 0.006]} /><meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={0.5} toneMapped={false} /></mesh>
      {[-0.03, 0, 0.03].map((ly, i) => (
        <mesh key={i} position={[0, ly, 0.007]}>
          <boxGeometry args={[0.065, 0.009, 0.004]} />
          <meshStandardMaterial color={DARK} />
        </mesh>
      ))}
    </group>
  );
}

function PinIcon({ glow, z }: { glow: string; z: number }) {
  return (
    <group position={[0, 0, z]}>
      <mesh position={[0, 0.025, 0]}><sphereGeometry args={[0.042, 10, 8]} /><meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={0.85} toneMapped={false} /></mesh>
      <mesh position={[0, 0.025, 0]}><sphereGeometry args={[0.022, 8, 6]} /><meshStandardMaterial color={DARK} /></mesh>
      <mesh position={[0, -0.04, 0]} rotation={[0, 0, Math.PI]}><coneGeometry args={[0.026, 0.07, 6]} /><meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={0.85} toneMapped={false} /></mesh>
    </group>
  );
}

function CtaButton({
  row, index, glow, btnW, btnH,
}: {
  row: CtaRow; index: number; glow: string; btnW: number; btnH: number;
}) {
  const [hovered, setHovered] = useState(false);
  const rowGap = 0.07;
  const y = -index * (btnH + rowGap);
  const enabled = row.siteMapUrls
    ? row.siteMapUrls.some((u) => u.trim())
    : Boolean(row.url?.trim());

  const handleClick = (e: THREE.Event) => {
    (e as unknown as { stopPropagation(): void }).stopPropagation();
    if (!enabled) return;
    if (typeof document !== 'undefined' && document.pointerLockElement) {
      document.exitPointerLock();
    }
    if (row.label === 'VIEW SITE MAP') {
      const slides = (row.siteMapUrls ?? []).map((u) => u.trim()).filter(Boolean);
      if (slides.length === 0) return;
      useStore.getState().setCtaResourcePopup({
        title: row.label,
        url: slides[0],
        variant: 'image',
        imageGallery: slides.length > 1 ? slides : undefined,
      });
      return;
    }
    useStore.getState().setCtaResourcePopup({
      title: row.label,
      url: row.url,
      variant: 'document',
    });
  };

  const bg     = !enabled ? '#0a0a14' : hovered ? '#16162e' : '#0b0b1e';
  const border = !enabled ? '#4a4030' : hovered ? GOLD_BRIGHT : glow;
  const bInt   = !enabled ? 0.25 : hovered ? 1.8 : 0.85;
  const rail   = 0.014;
  const zF     = 0.014;
  const hitD   = 0.045;

  return (
    <group position={[0, y, 0]}>
      <mesh position={[0, 0, zF]}
        onClick={handleClick}
        onPointerOver={(e) => {
          (e as unknown as { stopPropagation(): void }).stopPropagation();
          if (!enabled) {
            document.body.style.cursor = 'not-allowed';
            return;
          }
          setHovered(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto'; }}
      >
        <boxGeometry args={[btnW, btnH, hitD]} />
        <meshStandardMaterial color={bg} metalness={0.8} roughness={0.14} />
      </mesh>

      {/* Border rails */}
      {([
        { p: [0,  btnH/2+rail/2, zF + hitD * 0.5 + 0.003] as [number,number,number], s: [btnW+rail*2.2, rail, 0.018] as [number,number,number] },
        { p: [0, -btnH/2-rail/2, zF + hitD * 0.5 + 0.003] as [number,number,number], s: [btnW+rail*2.2, rail, 0.018] as [number,number,number] },
        { p: [-btnW/2-rail/2, 0, zF + hitD * 0.5 + 0.003] as [number,number,number], s: [rail, btnH+rail*2.2, 0.018] as [number,number,number] },
        { p: [ btnW/2+rail/2, 0, zF + hitD * 0.5 + 0.003] as [number,number,number], s: [rail, btnH+rail*2.2, 0.018] as [number,number,number] },
      ] as Array<{p:[number,number,number]; s:[number,number,number]}>).map(({ p, s }, i) => (
        <mesh key={i} position={p}>
          <boxGeometry args={s} />
          <meshStandardMaterial color={border} emissive={border} emissiveIntensity={bInt} metalness={0.97} roughness={0.04} toneMapped={false} />
        </mesh>
      ))}

      {/* Icon — left cluster; label starts to the right so nothing overlaps */}
      <group position={[-btnW * 0.4, 0, zF + hitD / 2 + 0.008]} scale={1.05}>
        {index === 0 && <BookIcon glow={border} z={0} />}
        {index === 1 && <DocIcon  glow={border} z={0} />}
        {index === 2 && <PinIcon  glow={border} z={0} />}
      </group>

      {/* Label */}
      <Text
        position={[-btnW * 0.19, 0.01, zF + hitD / 2 + 0.012]}
        fontSize={0.118}
        letterSpacing={0.022}
        color={!enabled ? '#666' : hovered ? '#ffffff' : WHITE}
        anchorX="left"
        anchorY="middle"
        font={FONT}
        maxWidth={btnW * 0.48}
      >
        {row.label}
        <meshStandardMaterial attach="material" color={!enabled ? '#666' : hovered ? '#fff' : WHITE} emissive={!enabled ? '#111' : hovered ? '#fff' : WHITE} emissiveIntensity={!enabled ? 0.15 : hovered ? 0.9 : 0.55} toneMapped={false} />
      </Text>

      {/* Chevron */}
      <Text
        position={[btnW * 0.37, 0, zF + hitD / 2 + 0.012]}
        fontSize={0.14}
        color={border}
        anchorX="center"
        anchorY="middle"
        font={FONT}
      >
        ›
        <meshStandardMaterial attach="material" color={border} emissive={border} emissiveIntensity={hovered ? 1.4 : 0.85} toneMapped={false} />
      </Text>
      {/* No hover point-lights — use emissive only */}
    </group>
  );
}

export function VertexEliteCtaKiosk({
  glow = GOLD,
  brochureUrl  = '',
  priceListUrl = '',
  siteMapUrls  = [],
  position = [4.48, 0.03, 2.02] as [number, number, number],
  rotation = [0, 0.13, 0] as [number, number, number],
}: {
  glow?: string;
  brochureUrl?:  string;
  priceListUrl?: string;
  siteMapUrls?:  string[];
  position?: [number, number, number];
  rotation?: [number, number, number];
}) {
  const rows: CtaRow[] = [
    { label: 'VIEW BROCHURE',   url: brochureUrl },
    { label: 'VIEW PRICE LIST', url: priceListUrl },
    { label: 'VIEW SITE MAP',   url: siteMapUrls[0] ?? '', siteMapUrls },
  ];

  const kW = 1.92;
  const kH = 3.55;
  const kD = 0.26;
  const rail = 0.018;

  const baseH = 0.1;
  const baseW = kW + 0.22;
  const baseD = kD + 0.26;
  const zF    = kD / 2;

  const btnW = kW * 0.885;
  const btnH = 0.54;
  const btnAreaTop = kH * 0.21;

  return (
    <group position={position} rotation={rotation}>

      {/* One shared point light — no spawning per-button */}
      <pointLight position={[0, kH * 0.88 + baseH, 0.85]} intensity={2.3} color={glow} distance={8} decay={2} />

      {/* Base */}
      <mesh position={[0, baseH * 0.3, 0]} receiveShadow>
        <boxGeometry args={[baseW + 0.08, baseH * 0.6, baseD + 0.08]} />
        <meshStandardMaterial color={DARK} metalness={0.94} roughness={0.08} />
      </mesh>
      <mesh position={[0, baseH * 0.85, 0]} receiveShadow>
        <boxGeometry args={[baseW, baseH * 0.7, baseD]} />
        <meshStandardMaterial color={DARK} metalness={0.94} roughness={0.08} />
      </mesh>
      <mesh position={[0, baseH + 0.006, 0]}>
        <boxGeometry args={[baseW + 0.012, 0.013, baseD + 0.012]} />
        <meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={1.1} metalness={0.97} roughness={0.04} toneMapped={false} />
      </mesh>
      {/* Floor LED strip */}
      <mesh position={[0, 0.003, baseD / 2 + 0.012]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[baseW, 0.04]} />
        <meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={4} toneMapped={false} />
      </mesh>

      {/* Kiosk body */}
      <group position={[0, baseH + kH / 2, 0]}>
        <mesh castShadow>
          <boxGeometry args={[kW, kH, kD]} />
          <meshStandardMaterial color={DARK} metalness={0.96} roughness={0.07} />
        </mesh>

        {/* Gold perimeter rails */}
        {([
          { p: [0,  kH/2+rail/2, zF+0.003] as [number,number,number], s: [kW+rail*3, rail, 0.026] as [number,number,number] },
          { p: [0, -kH/2-rail/2, zF+0.003] as [number,number,number], s: [kW+rail*3, rail, 0.026] as [number,number,number] },
          { p: [-kW/2-rail/2, 0, zF+0.003] as [number,number,number], s: [rail, kH+rail*3, 0.026] as [number,number,number] },
          { p: [ kW/2+rail/2, 0, zF+0.003] as [number,number,number], s: [rail, kH+rail*3, 0.026] as [number,number,number] },
        ] as Array<{p:[number,number,number]; s:[number,number,number]}>).map(({ p, s }, i) => (
          <mesh key={i} position={p}>
            <boxGeometry args={s} />
            <meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={0.95} metalness={0.97} roughness={0.04} toneMapped={false} />
          </mesh>
        ))}

        {/* Gloss face panel */}
        <mesh position={[0, 0, zF + 0.007]}>
          <planeGeometry args={[kW * 0.982, kH * 0.982]} />
          <meshStandardMaterial color={GLASS} metalness={0.9} roughness={0.1} />
        </mesh>

        {/* Top LED accent */}
        <mesh position={[0, kH * 0.462, zF + 0.012]}>
          <planeGeometry args={[kW * 0.9, 0.018]} />
          <meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={3.0} toneMapped={false} />
        </mesh>

        {/* EXPLORE MORE header */}
        <group position={[0, kH * 0.40, zF + 0.018]}>
          <mesh position={[-kW * 0.28, 0, 0]}><planeGeometry args={[kW * 0.22, 0.008]} /><meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={2.0} toneMapped={false} /></mesh>
          <mesh position={[ kW * 0.28, 0, 0]}><planeGeometry args={[kW * 0.22, 0.008]} /><meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={2.0} toneMapped={false} /></mesh>
          <Text position={[0, 0, 0]} fontSize={0.088} letterSpacing={0.26} color={glow} anchorX="center" anchorY="middle" font={FONT}>
            EXPLORE MORE
            <meshStandardMaterial attach="material" color={glow} emissive={glow} emissiveIntensity={0.88} toneMapped={false} />
          </Text>
        </group>

        {/* CTA buttons */}
        <group position={[0, btnAreaTop, zF + 0.016]}>
          {rows.map((row, i) => (
            <CtaButton key={row.label} row={row} index={i} glow={glow} btnW={btnW} btnH={btnH} />
          ))}
        </group>

        {/* Divider */}
        <mesh position={[0, -kH * 0.295, zF + 0.012]}>
          <planeGeometry args={[kW * 0.88, 0.008]} />
          <meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={1.4} transparent opacity={0.6} toneMapped={false} />
        </mesh>

        {/* QR footer */}
        <group position={[0, -kH * 0.39, zF + 0.016]}>
          <mesh position={[0, 0, -0.006]}>
            <planeGeometry args={[kW * 0.9, kH * 0.17]} />
            <meshStandardMaterial color="#0a0a1c" transparent opacity={0.7} toneMapped={false} />
          </mesh>
          <mesh position={[0.34, 0, 0]}>
            <boxGeometry args={[0.32, 0.32, 0.008]} />
            <meshStandardMaterial color="#ffffff" roughness={0.6} />
          </mesh>
          {[[-0.085, 0.085], [0.085, 0.085], [-0.085, -0.085], [0.085, -0.085], [0, 0]].map(([qx, qy], qi) => (
            <mesh key={qi} position={[0.34 + qx, qy, 0.008]}>
              <boxGeometry args={qi === 4 ? [0.075, 0.075, 0.005] : [0.088, 0.088, 0.005]} />
              <meshStandardMaterial color="#111" />
            </mesh>
          ))}
          <Text
            position={[-0.14, 0.058, 0]}
            fontSize={0.076}
            letterSpacing={0.04}
            lineHeight={1.15}
            color={WHITE}
            anchorX="center"
            anchorY="middle"
            font={FONT}
            maxWidth={0.52}
            textAlign="center"
          >
            SCAN QR CODE
            <meshStandardMaterial attach="material" color={WHITE} emissive={WHITE} emissiveIntensity={0.6} toneMapped={false} />
          </Text>
          <Text
            position={[-0.14, -0.082, 0]}
            fontSize={0.058}
            letterSpacing={0.032}
            lineHeight={1.2}
            color={glow}
            anchorX="center"
            anchorY="middle"
            font={FONT}
            maxWidth={0.52}
            textAlign="center"
          >
            {`TO DOWNLOAD\nPROJECT DETAILS`}
            <meshStandardMaterial attach="material" color={glow} emissive={glow} emissiveIntensity={0.62} toneMapped={false} />
          </Text>
        </group>

        {/* Bottom LED strip */}
        <mesh position={[0, -kH * 0.492, zF + 0.012]}>
          <planeGeometry args={[kW * 0.9, 0.014]} />
          <meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={2.8} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}
