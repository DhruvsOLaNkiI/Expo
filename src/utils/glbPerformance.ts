import * as THREE from 'three';
import type { SceneOverridesInput } from '../data/boothLayouts';
import { DEFAULT_SCENE_CONFIG } from '../data/boothLayouts';

/** Runtime GLB compression level — reduces mesh/material cost for smoother expo FPS. */
export type ModelCompressionLevel = 'off' | '30fps';

export const PERFORMANCE_30FPS_SCENE_PATCH: SceneOverridesInput = {
  modelCompression: '30fps',
  postProcessing: false,
  showVideos: false,
  showBallroom: false,
  showRoamingExecutive: false,
  showHallCanopy: false,
  fogEnabled: true,
  fogNear: 16,
  fogFar: 58,
  fogColor: '#f5f0e8',
};

const TRIANGLE_KEEP_RATIO: Record<ModelCompressionLevel, number> = {
  off: 1,
  '30fps': 0.35,
};

function decimateIndexedGeometry(geometry: THREE.BufferGeometry, keepRatio: number) {
  if (keepRatio >= 0.98) return;
  const index = geometry.index;
  if (!index) return;
  const src = index.array;
  const triCount = Math.floor(src.length / 3);
  if (triCount < 8) return;
  const newTriCount = Math.max(2, Math.floor(triCount * keepRatio));
  const TypedIndex = src.constructor as Uint16ArrayConstructor | Uint32ArrayConstructor;
  const dst = new TypedIndex(newTriCount * 3);
  const step = triCount / newTriCount;
  for (let i = 0; i < newTriCount; i++) {
    const srcTri = Math.min(Math.floor(i * step) * 3, src.length - 3);
    dst[i * 3] = src[srcTri];
    dst[i * 3 + 1] = src[srcTri + 1];
    dst[i * 3 + 2] = src[srcTri + 2];
  }
  geometry.setIndex(new THREE.BufferAttribute(dst, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
}

function downgradeMaterial(material: THREE.Material): THREE.Material {
  if (!(material instanceof THREE.MeshStandardMaterial)) return material;
  if (material.normalMap || material.emissiveMap || material.roughnessMap || material.metalnessMap) {
    material.metalness = 0;
    material.roughness = 1;
    material.envMapIntensity = 0;
    return material;
  }
  const lambert = new THREE.MeshLambertMaterial({
    color: material.color,
    map: material.map,
    transparent: material.transparent,
    opacity: material.opacity,
    side: material.side,
    alphaTest: material.alphaTest,
    depthWrite: material.depthWrite,
  });
  material.dispose();
  return lambert;
}

function tuneTexture(map: THREE.Texture | null | undefined) {
  if (!map) return;
  map.anisotropy = 1;
  map.generateMipmaps = true;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  map.needsUpdate = true;
}

/**
 * Applies runtime compression to a cloned GLB root (meshes, materials, triangle count).
 * Skinned meshes keep topology but lose shadows and heavy PBR.
 */
export function optimizeGlbRoot(root: THREE.Object3D, level: ModelCompressionLevel) {
  if (level === 'off') return root;
  const keepRatio = TRIANGLE_KEEP_RATIO[level];

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;

    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = true;

    if (!(mesh instanceof THREE.SkinnedMesh) && mesh.geometry) {
      decimateIndexedGeometry(mesh.geometry, keepRatio);
    }

    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const next = mats.map((mat) => {
      if (!mat) return mat;
      tuneTexture((mat as THREE.MeshStandardMaterial).map);
      return downgradeMaterial(mat);
    });
    mesh.material = Array.isArray(mesh.material) ? next : next[0]!;
  });

  return root;
}

export function isModelCompressionActive(level: ModelCompressionLevel | undefined): boolean {
  return (level ?? DEFAULT_SCENE_CONFIG.modelCompression) === '30fps';
}

export function shouldHideDecorativeGlbInstances(level: ModelCompressionLevel | undefined): boolean {
  return isModelCompressionActive(level);
}
