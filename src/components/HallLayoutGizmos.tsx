import { TransformControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useStore } from '../store';
import {
  findLayoutObject,
  persistHallLayoutTransform,
  registerHallLayoutScene,
  setHallLayoutActiveTarget,
} from '../hallLayoutPersist';

function isRegLobbySelection(selection: string): boolean {
  return selection.startsWith('reg-lobby-') || selection.startsWith('reg-imported-');
}

const EDITABLE_PREFIXES = ['reg-', 'hall-', 'booth-root-'] as const;

function isEditableName(name: string): boolean {
  return EDITABLE_PREFIXES.some((p) => name.startsWith(p));
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

  // Store target in state so a delayed registry hit triggers a re-render
  const [target, setTarget] = useState<THREE.Object3D | null>(null);

  useEffect(() => {
    registerHallLayoutScene(scene);
    return () => registerHallLayoutScene(null);
  }, [scene]);

  // Resolve the selected object, with a rAF retry in case the registry
  // hasn't been populated yet on the first render after a selection change.
  useEffect(() => {
    if (!edit || !sel) {
      setTarget(null);
      setHallLayoutActiveTarget(null, null);
      return;
    }

    const obj = findLayoutObject(sel);
    if (obj) {
      console.log(`[Gizmo] Found target immediately: ${sel}`);
      setTarget(obj);
      setHallLayoutActiveTarget(sel, obj);
      return;
    }

    // Not found yet — retry on the next animation frame (after all useLayoutEffects run)
    console.log(`[Gizmo] Target not found immediately for: ${sel}, retrying…`);
    let cancelled = false;
    const id = requestAnimationFrame(() => {
      if (cancelled) return;
      // Also do a direct scene search as fallback
      let found = findLayoutObject(sel);
      if (!found) {
        scene.traverse((o) => {
          if (!found && o.name === sel) found = o;
        });
      }
      if (found) {
        console.log(`[Gizmo] Found target after retry: ${sel}`);
      } else {
        console.warn(`[Gizmo] Could NOT find target: ${sel}`);
      }
      setTarget(found);
      setHallLayoutActiveTarget(sel, found);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, [edit, sel, scene]);

  // Click-to-select in the 3D view
  useEffect(() => {
    if (!edit) return;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 || draggingRef.current) return;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(scene.children, true);

      for (const hit of intersects) {
        let curr: THREE.Object3D | null = hit.object;
        while (curr) {
          // Skip the gizmo itself and its children
          if (curr.name === '__hall-layout-gizmo__') break;
          if (curr.name && isEditableName(curr.name)) {
            console.log(`[Click-Select] ${curr.name}`);
            setSel(curr.name);
            return;
          }
          curr = curr.parent;
        }
      }
    };

    gl.domElement.addEventListener('pointerdown', onPointerDown);
    return () => gl.domElement.removeEventListener('pointerdown', onPointerDown);
  }, [edit, scene, raycaster, camera, mouse, gl.domElement, setSel]);

  useEffect(() => {
    const tc = controlsRef.current as { addEventListener?: Function } | null;
    if (!tc?.addEventListener) return;
    const onDrag = (e: { value: boolean }) => {
      draggingRef.current = e.value;
      gl.domElement.style.cursor = e.value ? 'grabbing' : '';
    };
    tc.addEventListener('dragging-changed', onDrag);
    return () => (tc as any).removeEventListener?.('dragging-changed', onDrag);
  }, [gl.domElement, target]); // re-bind when target (and thus controlsRef) changes

  if (!edit || !target || !sel) return null;

  const lockedAxis = mode === 'rotate' ? rotationAxis : null;
  const space = isRegLobbySelection(sel) ? 'local' : 'world';

  return (
    <TransformControls
      ref={controlsRef as never}
      key={`${sel}-${mode}-${lockedAxis ?? 'pick'}`}
      object={target}
      mode={mode}
      axis={lockedAxis}
      space={space}
      size={0.85}
      onMouseUp={() => {
        persistHallLayoutTransform(sel, target);
      }}
    />
  );
}
