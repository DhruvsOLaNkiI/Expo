import { useThree, type ThreeEvent } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import { useLayoutEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import type { PlacedImage } from '../data/boothLayouts';

/** CMS-style placed image with selection outline and drag-to-reposition. */
export function BoothPlacedImageInteractive({
  item,
  selected,
  onSelect,
  onDrag,
}: {
  item: PlacedImage;
  selected: boolean;
  onSelect: () => void;
  onDrag: (pos: [number, number, number]) => void;
}) {
  const tex = useTexture(item.url);
  const meshRef = useRef<THREE.Mesh>(null);
  const dragging = useRef(false);
  const { camera, raycaster, gl } = useThree();
  const plane = useRef(new THREE.Plane());
  const intersection = useRef(new THREE.Vector3());

  useLayoutEffect(() => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
  }, [tex]);

  const handlePointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onSelect();
    if (!meshRef.current) return;
    dragging.current = true;
    const normal = new THREE.Vector3(0, 0, 1).applyEuler(
      new THREE.Euler(item.rotation[0], item.rotation[1], item.rotation[2])
    );
    plane.current.setFromNormalAndCoplanarPoint(normal, meshRef.current.position);
    (e.nativeEvent.target as HTMLElement)?.setPointerCapture?.(e.nativeEvent.pointerId);
  }, [onSelect, item.rotation]);

  const handlePointerMove = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (!dragging.current) return;
    e.stopPropagation();
    const pointer = new THREE.Vector2(
      (e.nativeEvent.offsetX / gl.domElement.clientWidth) * 2 - 1,
      -(e.nativeEvent.offsetY / gl.domElement.clientHeight) * 2 + 1
    );
    raycaster.setFromCamera(pointer, camera);
    if (raycaster.ray.intersectPlane(plane.current, intersection.current)) {
      onDrag([
        parseFloat(intersection.current.x.toFixed(3)),
        parseFloat(intersection.current.y.toFixed(3)),
        parseFloat(intersection.current.z.toFixed(3)),
      ]);
    }
  }, [camera, raycaster, gl, onDrag]);

  const handlePointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  return (
    <mesh
      ref={meshRef}
      position={item.position}
      rotation={item.rotation}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <planeGeometry args={item.size} />
      <meshStandardMaterial
        map={tex}
        transparent
        alphaTest={0.05}
        toneMapped={false}
        roughness={0.5}
        depthWrite
        polygonOffset
        polygonOffsetFactor={-2}
        polygonOffsetUnits={-2}
      />
      {selected && (
        <lineSegments>
          <edgesGeometry args={[new THREE.PlaneGeometry(item.size[0], item.size[1])]} />
          <lineBasicMaterial color="#d4af37" linewidth={2} />
        </lineSegments>
      )}
    </mesh>
  );
}
