import { useGLTF } from '@react-three/drei';
import { Suspense, useMemo } from 'react';
import * as THREE from 'three';
import type { BoothLayoutConfig } from '@/features/shared/data/boothLayouts';

const STANDEE_GLB_URL = '/digital_display_standee_sketchfab_export.glb';
const STANDEE_TARGET_HEIGHT = 2.45;
/** Meters from booth anchor toward hall center (lower = closer to booth / back toward wall). */
const AISLE_INSET = 3;

export type StandeePlacement = {
  id: string;
  position: [number, number, number];
  rotation: [number, number, number];
};

/**
 * One Sketchfab standee between each adjacent booth pair on west & east rows.
 * Y rotation faces the aisle (opposite the hall wall behind the booths).
 */
export function standeePlacementsFromBooths(layouts: BoothLayoutConfig[]): StandeePlacement[] {
  const west = layouts.filter((b) => b.position[0] < -2).sort((a, b) => a.position[2] - b.position[2]);
  const east = layouts.filter((b) => b.position[0] > 2).sort((a, b) => a.position[2] - b.position[2]);
  const out: StandeePlacement[] = [];

  for (let i = 0; i < west.length - 1; i++) {
    const z = (west[i].position[2] + west[i + 1].position[2]) / 2;
    const x = west[i].position[0] + AISLE_INSET;
    out.push({
      id: `standee-west-${west[i].id}-${west[i + 1].id}`,
      position: [x, 0, z],
      rotation: [0, -Math.PI / 2, 0],
    });
  }

  for (let i = 0; i < east.length - 1; i++) {
    const z = (east[i].position[2] + east[i + 1].position[2]) / 2;
    const x = east[i].position[0] - AISLE_INSET;
    out.push({
      id: `standee-east-${east[i].id}-${east[i + 1].id}`,
      position: [x, 0, z],
      rotation: [0, Math.PI / 2, 0],
    });
  }

  return out;
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
  name,
  position,
  rotation,
}: {
  name: string;
  position: [number, number, number];
  rotation: [number, number, number];
}) {
  const { scene } = useGLTF(STANDEE_GLB_URL) as { scene: THREE.Object3D };
  const model = useMemo(() => prepareStandeeModel(scene), [scene]);

  return (
    <group name={name} position={position} rotation={rotation}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <circleGeometry args={[0.55, 32]} />
        <meshStandardMaterial color="#1a1210" roughness={0.2} metalness={0.45} transparent opacity={0.35} />
      </mesh>
      <primitive object={model} />
    </group>
  );
}

/** `digital_display_standee_sketchfab_export.glb` between every booth gap, facing the aisle. */
export function HallAisleStandees({ layouts }: { layouts: BoothLayoutConfig[] }) {
  const placements = useMemo(() => standeePlacementsFromBooths(layouts), [layouts]);

  return (
    <group name="hall-aisle-standees">
      <Suspense fallback={null}>
        {placements.map((p) => (
          <SketchfabStandee key={p.id} name={p.id} position={p.position} rotation={p.rotation} />
        ))}
      </Suspense>
    </group>
  );
}

useGLTF.preload(STANDEE_GLB_URL);
