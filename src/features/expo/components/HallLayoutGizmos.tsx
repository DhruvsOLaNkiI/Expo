import { TransformControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useStore } from '@/store';
import {
  findLayoutObject,
  persistHallLayoutTransform,
  registerHallLayoutScene,
  setHallLayoutActiveTarget,
  setLayoutTransformDragging,
} from '@/store/persist/hallLayout';

/** Registration props (desk, backdrop, lounge) rotate/move in parent-local space. */
function isRegistrationSelection(selection: string): boolean {
  return selection.startsWith('reg-');
}

const EDITABLE_PREFIXES = ['reg-', 'hall-', 'booth-root-', 'booth-display-'] as const;

function isEditableName(name: string): boolean {
  return EDITABLE_PREFIXES.some((p) => name.startsWith(p));
}

function isTransformControlsObject(obj: THREE.Object3D | null): boolean {
  let curr: THREE.Object3D | null = obj;
  while (curr) {
    const type = curr.type;
    if (
      type === 'TransformControls' ||
      type === 'TransformControlsGizmo' ||
      type === 'TransformControlsPlane'
    ) {
      return true;
    }
    curr = curr.parent;
  }
  return false;
}

/**
 * In-canvas gizmo for HallLayoutEditHud.
 * Click objects to select; drag gizmo to move/rotate; releases save automatically.
 */
export function HallLayoutGizmos() {
  const edit = useStore((s) => s.hallLayoutEditMode);
  const sel = useStore((s) => s.hallLayoutSelection);
  const setSel = useStore((s) => s.setHallLayoutSelection);
  const mode = useStore((s) => s.hallLayoutGizmoMode);
  const rotationAxis = useStore((s) => s.hallLayoutRotationAxis);

  const scene = useThree((s) => s.scene);
  const gl = useThree((s) => s.gl);
  const raycaster = useThree((s) => s.raycaster);
  const camera = useThree((s) => s.camera);
  const mouse = useThree((s) => s.mouse);

  const controlsRef = useRef<THREE.EventDispatcher | null>(null);
  const draggingRef = useRef(false);
  const pointerDownRef = useRef<{ x: number; y: number } | null>(null);

  const [target, setTarget] = useState<THREE.Object3D | null>(null);

  useEffect(() => {
    registerHallLayoutScene(scene);
    return () => registerHallLayoutScene(null);
  }, [scene]);

  useEffect(() => {
    if (!edit || !sel) {
      setTarget(null);
      setHallLayoutActiveTarget(null, null);
      return;
    }

    const obj = findLayoutObject(sel);
    if (obj) {
      setTarget(obj);
      setHallLayoutActiveTarget(sel, obj);
      return;
    }

    let cancelled = false;
    const id = requestAnimationFrame(() => {
      if (cancelled) return;
      let found = findLayoutObject(sel);
      if (!found) {
        scene.traverse((o) => {
          if (!found && o.name === sel) found = o;
        });
      }
      setTarget(found);
      setHallLayoutActiveTarget(sel, found);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, [edit, sel, scene]);

  // Click-to-select on pointerup only (pointerdown races TransformControls rotate drags).
  useEffect(() => {
    if (!edit) return;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 || draggingRef.current) return;
      pointerDownRef.current = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e: PointerEvent) => {
      if (e.button !== 0 || draggingRef.current) return;
      const start = pointerDownRef.current;
      pointerDownRef.current = null;
      if (!start) return;
      const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y);
      if (moved > 6) return;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(scene.children, true);

      for (const hit of intersects) {
        if (isTransformControlsObject(hit.object)) return;
        let curr: THREE.Object3D | null = hit.object;
        while (curr) {
          if (curr.name && isEditableName(curr.name)) {
            setSel(curr.name);
            return;
          }
          curr = curr.parent;
        }
      }
    };

    gl.domElement.addEventListener('pointerdown', onPointerDown);
    gl.domElement.addEventListener('pointerup', onPointerUp);
    return () => {
      gl.domElement.removeEventListener('pointerdown', onPointerDown);
      gl.domElement.removeEventListener('pointerup', onPointerUp);
    };
  }, [edit, scene, raycaster, camera, mouse, gl.domElement, setSel]);

  useEffect(() => {
    const tc = controlsRef.current as { addEventListener?: Function } | null;
    if (!tc?.addEventListener) return;
    const onDrag = (e: { value: boolean }) => {
      draggingRef.current = e.value;
      setLayoutTransformDragging(e.value);
      gl.domElement.style.cursor = e.value ? 'grabbing' : '';
      if (e.value) {
        document.exitPointerLock();
      }
    };
    tc.addEventListener('dragging-changed', onDrag);
    return () => {
      setLayoutTransformDragging(false);
      (tc as any).removeEventListener?.('dragging-changed', onDrag);
    };
  }, [gl.domElement, target]);

  useEffect(() => {
    if (!edit) setLayoutTransformDragging(false);
  }, [edit]);

  if (!edit || !target || !sel) return null;

  const lockedAxis =
    mode === 'rotate' && rotationAxis && rotationAxis !== 'E' ? rotationAxis : null;
  const rotateAxis = mode === 'rotate' ? (rotationAxis === 'E' ? 'E' : lockedAxis) : lockedAxis;
  const space =
    mode === 'rotate' ||
      sel.startsWith('reg-corner-') ||
      sel.startsWith('reg-north-screen-') ||
      !isRegistrationSelection(sel)
      ? 'world'
      : 'local';

  return (
    <TransformControls
      ref={controlsRef as never}
      key={`${sel}-${mode}-${rotateAxis ?? 'pick'}-${space}`}
      object={target}
      mode={mode}
      axis={rotateAxis}
      space={space}
      size={0.85}
      onMouseDown={() => {
        draggingRef.current = true;
        setLayoutTransformDragging(true);
        document.exitPointerLock();
      }}
      onMouseUp={() => {
        draggingRef.current = false;
        setLayoutTransformDragging(false);
        persistHallLayoutTransform(sel, target);
      }}
      onObjectChange={() => {
        target.updateMatrixWorld(true);
      }}
    />
  );
}
