import { useGLTF } from '@react-three/drei';
import { Suspense, useMemo } from 'react';
import * as THREE from 'three';
import type { BoothLayoutConfig } from '@/features/shared/data/boothLayouts';
import type { BoothDisplayTransform } from '@/features/shared/data/boothDisplayLayout';
import { LayoutEditableGroup } from '@/features/shared/LayoutEditableGroup';

const STANDEE_GLB_URL = '/digital_display_standee_sketchfab_export.glb';
const STANDEE_TARGET_HEIGHT = 3.15;
/** Booths on the same wall row share X or Z within this tolerance (m). */
const ROW_TOLERANCE = 5;
/** Minimum center-to-center spacing before placing a standee in the gap. */
const MIN_STANDEE_GAP = 4;
/** Nudge standee toward hall center so it sits in the aisle-facing gap. */
const AISLE_INSET = 1.2;

export type StandeePlacement = {
  id: string;
  position: [number, number, number];
  rotation: [number, number, number];
};

export function hallAisleStandeeObjectName(id: string): string {
  return `hall-standee-${id}`;
}

function canonicalPairId(aId: string, bId: string): string {
  return aId < bId ? `${aId}--${bId}` : `${bId}--${aId}`;
}

function standeeGapId(aId: string, bId: string): string {
  return `standee-gap-${canonicalPairId(aId, bId)}`;
}

/** Parse `standee-gap-builder-6--builder-8` into booth ids. */
export function parseStandeeGapBoothIds(id: string): [string, string] | null {
  if (!id.startsWith('standee-gap-')) return null;
  const body = id.slice('standee-gap-'.length);
  const idx = body.indexOf('--');
  if (idx <= 0) return null;
  return [body.slice(0, idx), body.slice(idx + 2)];
}

export function standeeGapLabel(id: string, nameById: Map<string, string>): string {
  const pair = parseStandeeGapBoothIds(id);
  if (pair) {
    const [a, b] = pair;
    const na = nameById.get(a) ?? a;
    const nb = nameById.get(b) ?? b;
    return `Aisle standee · ${na} ↔ ${nb}`;
  }
  // Legacy standee-east-builder-4-builder-5
  const legacy = id.replace(/^standee-(west|east)-/, '');
  const boothIds = [...nameById.keys()].sort((x, y) => y.length - x.length);
  for (const a of boothIds) {
    if (!legacy.startsWith(`${a}-`)) continue;
    const b = legacy.slice(a.length + 1);
    if (nameById.has(b)) {
      return `Aisle standee · ${nameById.get(a)} ↔ ${nameById.get(b)}`;
    }
  }
  return `Aisle standee · ${legacy}`;
}

function faceAisleRotation(x: number, z: number): [number, number, number] {
  if (Math.abs(x) >= Math.abs(z)) {
    return [0, x >= 0 ? Math.PI / 2 : -Math.PI / 2, 0];
  }
  return [0, z >= 0 ? Math.PI : 0, 0];
}

function towardCenterAxis(value: number, inset: number): number {
  if (Math.abs(value) < 0.5) return value;
  return value > 0 ? value - inset : value + inset;
}

/**
 * One Sketchfab standee in every gap between adjacent booths on the same row.
 * Handles both default rows (fixed X, varying Z) and CMS rows (fixed Z, varying X).
 */
export function standeePlacementsFromBooths(layouts: BoothLayoutConfig[]): StandeePlacement[] {
  if (layouts.length < 2) return [];

  const out: StandeePlacement[] = [];
  const seen = new Set<string>();

  const addPair = (
    a: BoothLayoutConfig,
    b: BoothLayoutConfig,
    position: [number, number, number],
    rotation: [number, number, number],
  ) => {
    const id = standeeGapId(a.id, b.id);
    if (seen.has(id)) return;
    seen.add(id);
    out.push({ id, position, rotation });
  };

  // Rows aligned on Z (booths share similar Z → gap is along X)
  const zRows = new Map<number, BoothLayoutConfig[]>();
  for (const b of layouts) {
    const key = Math.round(b.position[2] / ROW_TOLERANCE);
    if (!zRows.has(key)) zRows.set(key, []);
    zRows.get(key)!.push(b);
  }
  for (const row of zRows.values()) {
    if (row.length < 2) continue;
    const sorted = [...row].sort((a, c) => a.position[0] - c.position[0]);
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i];
      const b = sorted[i + 1];
      const dx = b.position[0] - a.position[0];
      if (dx < MIN_STANDEE_GAP) continue;
      const midX = (a.position[0] + b.position[0]) / 2;
      const rowZ = (a.position[2] + b.position[2]) / 2;
      addPair(a, b, [midX, 0, towardCenterAxis(rowZ, AISLE_INSET)], faceAisleRotation(midX, rowZ));
    }
  }

  // Rows aligned on X (booths share similar X → gap is along Z)
  const xRows = new Map<number, BoothLayoutConfig[]>();
  for (const b of layouts) {
    const key = Math.round(b.position[0] / ROW_TOLERANCE);
    if (!xRows.has(key)) xRows.set(key, []);
    xRows.get(key)!.push(b);
  }
  for (const row of xRows.values()) {
    if (row.length < 2) continue;
    const sorted = [...row].sort((a, c) => a.position[2] - c.position[2]);
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i];
      const b = sorted[i + 1];
      const dz = b.position[2] - a.position[2];
      if (dz < MIN_STANDEE_GAP) continue;
      const midZ = (a.position[2] + b.position[2]) / 2;
      const rowX = (a.position[0] + b.position[0]) / 2;
      addPair(a, b, [towardCenterAxis(rowX, AISLE_INSET), 0, midZ], faceAisleRotation(rowX, midZ));
    }
  }

  return out;
}

function mergeStandeeTransform(
  defaults: BoothDisplayTransform,
  saved?: BoothDisplayTransform,
): BoothDisplayTransform {
  if (!saved) return defaults;
  return {
    position: saved.position ?? defaults.position,
    rotation: saved.rotation ?? defaults.rotation,
    scale: saved.scale ?? defaults.scale,
  };
}

function prepareStandeeModel(source: THREE.Object3D) {
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
  const h = Math.max(size.y, 1e-6);
  root.scale.setScalar(STANDEE_TARGET_HEIGHT / h);
  root.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(root);
  const c = new THREE.Vector3();
  box2.getCenter(c);
  root.position.sub(c);
  root.updateMatrixWorld(true);
  const box3 = new THREE.Box3().setFromObject(root);
  root.position.y -= box3.min.y;
  root.updateMatrixWorld(true);
  return root;
}

function SketchfabStandee({
  id,
  defaults,
  saved,
}: {
  id: string;
  defaults: BoothDisplayTransform;
  saved?: BoothDisplayTransform;
}) {
  const { scene } = useGLTF(STANDEE_GLB_URL) as { scene: THREE.Object3D };
  const model = useMemo(() => prepareStandeeModel(scene), [scene]);
  const t = mergeStandeeTransform(defaults, saved);

  return (
    <LayoutEditableGroup
      name={hallAisleStandeeObjectName(id)}
      position={t.position}
      rotation={t.rotation}
      scale={t.scale}
    >
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <circleGeometry args={[0.55, 32]} />
        <meshStandardMaterial color="#1a1210" roughness={0.2} metalness={0.45} transparent opacity={0.35} />
      </mesh>
      <primitive object={model} />
    </LayoutEditableGroup>
  );
}

/** `digital_display_standee_sketchfab_export.glb` in every gap between adjacent booths. */
export function HallAisleStandees({
  layouts,
  aisleStandeeTransforms = {},
}: {
  layouts: BoothLayoutConfig[];
  aisleStandeeTransforms?: Record<string, BoothDisplayTransform>;
}) {
  const placements = useMemo(() => standeePlacementsFromBooths(layouts), [layouts]);

  return (
    <group name="hall-aisle-standees">
      <Suspense fallback={null}>
        {placements.map((p) => (
          <SketchfabStandee
            key={p.id}
            id={p.id}
            defaults={{ position: p.position, rotation: p.rotation }}
            saved={aisleStandeeTransforms[p.id]}
          />
        ))}
      </Suspense>
    </group>
  );
}

useGLTF.preload(STANDEE_GLB_URL);
