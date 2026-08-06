import { useEffect, useLayoutEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import * as THREE from 'three';
import { useStore } from '@/store';
import { registerLayoutObject, unregisterLayoutObject } from '@/features/shared/layoutRegistry';

type Props = {
  name: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  children: ReactNode;
};

/**
 * Wraps any editable layout object.
 * - Registers the group in the global layout registry for instant lookup.
 * - Applies saved transforms from props when the gizmo is not mid-drag.
 *   Selecting an object in Edit Layout must NOT block CMS Hall Map updates.
 */
export function LayoutEditableGroup({
  name,
  position,
  rotation = [0, 0, 0],
  scale,
  children,
}: Props) {
  const ref = useRef<THREE.Group>(null);
  const sel = useStore((s) => s.hallLayoutSelection);
  const dragging = useStore((s) => s.hallLayoutDragging);
  const isDraggingThis = sel === name && dragging;

  // Register immediately in the layout phase (fires before useEffect)
  useLayoutEffect(() => {
    const g = ref.current;
    if (!g) return;
    g.name = name;
    registerLayoutObject(name, g);
  }, [name]);

  // Also register in the regular effect phase as a safety net,
  // and handle cleanup on unmount.
  useEffect(() => {
    const g = ref.current;
    if (g) {
      g.name = name;
      registerLayoutObject(name, g);
    }
    return () => {
      unregisterLayoutObject(name);
    };
  }, [name]);

  // Apply saved transforms when not actively being dragged by the gizmo.
  useLayoutEffect(() => {
    const g = ref.current;
    if (!g || isDraggingThis) return;

    g.position.set(position[0], position[1], position[2]);
    g.rotation.set(rotation[0], rotation[1], rotation[2]);
    if (scale) g.scale.set(scale[0], scale[1], scale[2]);
  }, [isDraggingThis, position, rotation, scale]);

  return (
    <group ref={ref}>
      {children}
    </group>
  );
}
