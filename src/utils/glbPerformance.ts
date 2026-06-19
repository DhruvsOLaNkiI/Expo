import * as THREE from 'three';
import type { SceneOverridesInput } from '@/features/shared/data/boothLayouts';
import { DEFAULT_SCENE_CONFIG } from '@/features/shared/data/boothLayouts';

/** Runtime GLB compression level — reduces mesh/material cost for smoother expo FPS. */
export type ModelCompressionLevel = 'off' | '30fps';

export const PERFORMANCE_30FPS_SCENE_PATCH: SceneOverridesInput = {
  modelCompression: '30fps',
  postProcessing: false,
  showVideos: false,
  showBallroom: true,
  showRoamingExecutive: false,
  showHallCanopy: false,
  fogEnabled: false,
  fogNear: 30,
  fogFar: 88,
  fogColor: '#f0ebe4',
};

const TRIANGLE_KEEP_RATIO: Record<ModelCompressionLevel, number> = {
  off: 1,
  '30fps': 0.35,
};

/** Boost keeps far more detail (0.7 vs 0.35) so meshes don't shatter — "non-destructive" decimation. */
const BOOST_TRIANGLE_KEEP_RATIO = 0.7;
/** Only decimate genuinely heavy meshes; small props lose their shape if decimated. */
const BOOST_DECIMATE_MIN_TRIANGLES = 24_000;
/** Cap GLB texture edge on phones — oversized maps cause memory spikes and stutter. */
const MAX_TEXTURE_EDGE = 1024;

function decimateIndexedGeometry(
  geometry: THREE.BufferGeometry,
  keepRatio: number,
  minTriangles: number,
) {
  if (keepRatio >= 0.98) return;
  const index = geometry.index;
  if (!index) return;
  const src = index.array;
  const triCount = Math.floor(src.length / 3);
  if (triCount < Math.max(8, minTriangles)) return;
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

function tuneTexture(map: THREE.Texture | null | undefined, capEdge: boolean) {
  if (!map) return;
  map.anisotropy = 1;
  map.generateMipmaps = true;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  if (capEdge) capTextureResolution(map);
  map.needsUpdate = true;
}

/** Downscale an oversized texture's source bitmap to MAX_TEXTURE_EDGE using a 2D canvas. */
function capTextureResolution(map: THREE.Texture | null | undefined) {
  if (!map) return;
  const img = map.image as
    | HTMLImageElement
    | HTMLCanvasElement
    | ImageBitmap
    | { width?: number; height?: number }
    | undefined;
  if (!img) return;
  const w = (img as { width?: number }).width ?? 0;
  const h = (img as { height?: number }).height ?? 0;
  if (!w || !h) return;
  const longest = Math.max(w, h);
  if (longest <= MAX_TEXTURE_EDGE) return;
  if (typeof document === 'undefined') return;
  const scale = MAX_TEXTURE_EDGE / longest;
  const nw = Math.max(1, Math.round(w * scale));
  const nh = Math.max(1, Math.round(h * scale));
  try {
    const canvas = document.createElement('canvas');
    canvas.width = nw;
    canvas.height = nh;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(img as CanvasImageSource, 0, 0, nw, nh);
    map.image = canvas;
  } catch {
    /* tainted / unsupported source — keep original */
  }
}

type OptimizeOptions = {
  /** When true (default): non-destructive decimation + 1024px texture cap. */
  boost?: boolean;
};

/**
 * Applies runtime compression to a cloned GLB root (meshes, materials, triangle count).
 * Skinned meshes keep topology but lose shadows and heavy PBR.
 */
export function optimizeGlbRoot(
  root: THREE.Object3D,
  level: ModelCompressionLevel,
  options: OptimizeOptions = {},
) {
  if (level === 'off') return root;
  const boost = options.boost ?? true;
  const keepRatio = boost ? BOOST_TRIANGLE_KEEP_RATIO : TRIANGLE_KEEP_RATIO[level];
  const minTriangles = boost ? BOOST_DECIMATE_MIN_TRIANGLES : 8;

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;

    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = true;

    if (!(mesh instanceof THREE.SkinnedMesh) && mesh.geometry) {
      decimateIndexedGeometry(mesh.geometry, keepRatio, minTriangles);
    }

    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const next = mats.map((mat) => {
      if (!mat) return mat;
      const std = mat as THREE.MeshStandardMaterial;
      tuneTexture(std.map, boost);
      if (boost) {
        capTextureResolution(std.normalMap as THREE.Texture);
        capTextureResolution(std.roughnessMap as THREE.Texture);
        capTextureResolution(std.metalnessMap as THREE.Texture);
        capTextureResolution(std.emissiveMap as THREE.Texture);
      }
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
