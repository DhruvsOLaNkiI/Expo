import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { clone as cloneSkinnedHierarchy } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { CAMERA_MODES } from '@/features/expo/camera/cameraModes';
import { useStore } from '@/store';
import type { VisitorAvatar } from '@/features/visitor/visitorProfile';

/** Mixamo walking character (FBX with skin + walk clip). */
const WALKING_MODEL_URL = '/assets/3d%20model/Walking%20(1).fbx';
const TARGET_HEIGHT = 1.72;
const WALK_SPEED_REF = 4.2;

type Props = {
  feetRef: RefObject<THREE.Vector3>;
};

function pickWalkClip(animations: THREE.AnimationClip[]): THREE.AnimationClip | null {
  if (!animations.length) return null;
  const walk =
    animations.find((a) => /walk|stride|locomotion/i.test(a.name)) ?? animations[0];
  return walk;
}

/** Remove root/hips translation so WASD controls position (non–in-place Mixamo export). */
function stripRootMotion(clip: THREE.AnimationClip): THREE.AnimationClip {
  const tracks = clip.tracks.filter((track) => {
    if (!track.name.endsWith('.position')) return true;
    const bone = track.name.split('.')[0].toLowerCase();
    return !(
      bone.includes('hips') ||
      bone.includes('root') ||
      bone === 'mixamorighips' ||
      bone.endsWith('hips')
    );
  });
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}

function applyClothing(obj: THREE.Object3D, avatar: VisitorAvatar) {
  const outfitC = new THREE.Color(avatar.outfitColor);
  const skinC = new THREE.Color(avatar.skinTone);
  const pantsC = new THREE.Color('#1a1a2e');
  const hairC = new THREE.Color(avatar.hairColor);

  obj.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;

    mesh.castShadow = true;
    mesh.receiveShadow = true;

    mesh.geometry.computeBoundingBox();
    const bb = mesh.geometry.boundingBox;
    if (!bb) return;

    const totalH = bb.max.y - bb.min.y;
    if (totalH < 0.01) return;

    const posAttr = mesh.geometry.getAttribute('position');
    if (!posAttr) return;

    const vertCount = posAttr.count;
    const colors = new Float32Array(vertCount * 3);

    for (let i = 0; i < vertCount; i++) {
      const y = posAttr.getY(i);
      const normalizedY = (y - bb.min.y) / totalH;
      let c: THREE.Color;
      if (normalizedY > 0.92) c = hairC;
      else if (normalizedY > 0.82) c = skinC;
      else if (normalizedY > 0.4) c = outfitC;
      else c = pantsC;
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    mesh.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    mesh.material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.6,
      metalness: 0,
    });
  });
}

function prepareWalkingModel(source: THREE.Group, avatar: VisitorAvatar) {
  const root = cloneSkinnedHierarchy(source) as THREE.Group;
  root.rotation.set(0, Math.PI, 0);
  root.scale.set(1, 1, 1);
  root.updateMatrixWorld(true);

  applyClothing(root, avatar);

  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  const sy = Math.max(size.y, 1e-6);
  const s = TARGET_HEIGHT / sy;
  root.scale.setScalar(s);
  root.updateMatrixWorld(true);

  const box2 = new THREE.Box3().setFromObject(root);
  root.position.y -= box2.min.y;
  root.updateMatrixWorld(true);

  return root;
}

function CharacterModel({ avatar }: { avatar: VisitorAvatar }) {
  const fbx = useLoader(FBXLoader, WALKING_MODEL_URL) as THREE.Group;
  const model = useMemo(() => prepareWalkingModel(fbx, avatar), [fbx, avatar]);

  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const walkActionRef = useRef<THREE.AnimationAction | null>(null);
  const animBlendRef = useRef(0);

  useEffect(() => {
    const clips = fbx.animations ?? [];
    const rawWalk = pickWalkClip(clips);
    if (!rawWalk) return;

    const walkClip = stripRootMotion(rawWalk);
    const mixer = new THREE.AnimationMixer(model);
    mixerRef.current = mixer;

    const walk = mixer.clipAction(walkClip);
    walk.setLoop(THREE.LoopRepeat, Infinity);
    walk.enabled = true;
    walk.setEffectiveWeight(0);
    walk.play();
    walkActionRef.current = walk;

    return () => {
      mixer.stopAllAction();
      mixerRef.current = null;
      walkActionRef.current = null;
    };
  }, [fbx, model]);

  useFrame((_, delta) => {
    const mixer = mixerRef.current;
    const walk = walkActionRef.current;
    if (!mixer || !walk) return;

    const speed = useStore.getState().playerSpeed;
    const moving = speed > 0.15;
    const targetBlend = moving ? 1 : 0;
    animBlendRef.current = THREE.MathUtils.lerp(animBlendRef.current, targetBlend, 1 - Math.pow(0.001, delta * 60));

    walk.setEffectiveWeight(animBlendRef.current);
    if (animBlendRef.current > 0.02) {
      walk.paused = false;
      const speedScale = THREE.MathUtils.clamp(speed / WALK_SPEED_REF, 0.35, 1.4);
      walk.timeScale = speedScale;
    } else {
      walk.paused = true;
    }

    mixer.update(delta);
  });

  return <primitive object={model} />;
}

function PlayerGroundMarker() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
      <ringGeometry args={[0.28, 0.42, 32]} />
      <meshBasicMaterial color="#d4af37" transparent opacity={0.45} depthWrite={false} />
    </mesh>
  );
}

export function LocalVisitorAvatar({ feetRef }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const visitorProfile = useStore((s) => s.visitorProfile);
  const cameraMode = useStore((s) => s.cameraMode);
  const showAvatar = CAMERA_MODES[cameraMode].showAvatar;

  useFrame(() => {
    const g = groupRef.current;
    const feet = feetRef.current;
    if (!g || !feet) return;
    g.position.set(feet.x, feet.y, feet.z);
    g.rotation.y = useStore.getState().playerFacingYaw;
  });

  if (!visitorProfile) return null;

  return (
    <group ref={groupRef}>
      <PlayerGroundMarker />
      {showAvatar && <CharacterModel avatar={visitorProfile.avatar} />}
    </group>
  );
}

useLoader.preload(FBXLoader, WALKING_MODEL_URL);
