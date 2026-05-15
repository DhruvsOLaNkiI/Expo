import * as THREE from 'three';
import { useStore } from './store';
import {
  defaultEntranceLobbyZ,
  mergeHallLayout,
  mergeRegistrationLayout,
  type HallLayoutConfig,
  type RegistrationLayoutConfig,
} from './data/boothLayouts';
import { REG_RECEPTION_Z } from './data/registrationHall';
import { getLayoutObject } from './layoutRegistry';

const BANNER_LOCAL_BASE: [number, number, number] = [0, 6, -4.5];

let sceneRef: THREE.Scene | null = null;
let activeTarget: THREE.Object3D | null = null;
let activeSelection: string | null = null;

export function registerHallLayoutScene(scene: THREE.Scene | null) {
  sceneRef = scene;
}

export function setHallLayoutActiveTarget(selection: string | null, obj: THREE.Object3D | null) {
  activeSelection = selection;
  activeTarget = obj;
}

/** Find editable group by checking registry first, then scene search. */
export function findLayoutObject(name: string): THREE.Object3D | null {
  if (activeTarget?.name === name) {
    console.log(`[FindObj] Found via activeTarget: ${name}`);
    return activeTarget;
  }
  
  // Check registry first (fastest)
  const registered = getLayoutObject(name);
  if (registered) {
    console.log(`[FindObj] Found via registry: ${name}`);
    return registered;
  }

  // Fallback: full scene search
  if (!sceneRef) {
    console.log(`[FindObj] No scene ref for: ${name}`);
    return null;
  }
  let found: THREE.Object3D | null = null;
  sceneRef.traverse((obj) => {
    if (!found && obj.name === name) found = obj;
  });
  if (found) {
    console.log(`[FindObj] Found via scene traverse: ${name}`);
  } else {
    console.log(`[FindObj] NOT FOUND anywhere: ${name}`);
  }
  return found;
}

function saveLoungeRotation(
  reg: RegistrationLayoutConfig,
  selection: string,
  obj: THREE.Object3D,
): RegistrationLayoutConfig['loungeRotations'] {
  return {
    ...reg.loungeRotations,
    [selection]: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
  };
}

/**
 * Saves the current transform of an object to the store and localStorage.
 */
export function persistHallLayoutTransform(selection: string, obj: THREE.Object3D): boolean {
  if (!selection || !obj) return false;
  const storeState = useStore.getState();
  const { patchSceneOverride, patchBoothOverride } = storeState;
  const get = () => storeState;

  obj.updateMatrixWorld(true);

  if (selection === 'hall-entrance-lobby') {
    const ez = defaultEntranceLobbyZ();
    patchSceneOverride({
      hallLayout: {
        entranceLobbyOffset: [obj.position.x, obj.position.y, obj.position.z - ez],
      },
    });
    return true;
  }

  if (selection === 'hall-reception-banner') {
    patchSceneOverride({
      hallLayout: {
        receptionBannerOffset: [
          obj.position.x - BANNER_LOCAL_BASE[0],
          obj.position.y - BANNER_LOCAL_BASE[1],
          obj.position.z - BANNER_LOCAL_BASE[2],
        ],
      },
    });
    return true;
  }

  if (selection.startsWith('hall-plant-')) {
    const idx = parseInt(selection.slice('hall-plant-'.length), 10);
    if (!isNaN(idx) && idx >= 0 && idx <= 3) {
      const hall = mergeHallLayout(get().sceneOverrides.hallLayout);
      const next = [...hall.plantPositions] as HallLayoutConfig['plantPositions'];
      next[idx] = [obj.position.x, obj.position.y, obj.position.z];
      patchSceneOverride({ hallLayout: { plantPositions: next } });
      return true;
    }
    return false;
  }

  if (selection.startsWith('booth-root-')) {
    const id = selection.slice('booth-root-'.length);
    void patchBoothOverride(id, {
      position: [obj.position.x, obj.position.y, obj.position.z],
      rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
      scale: [obj.scale.x, obj.scale.y, obj.scale.z],
    });
    return true;
  }

  const reg = mergeRegistrationLayout(get().sceneOverrides.registrationLayout);

  if (selection === 'reg-reception-root') {
    patchSceneOverride({
      registrationLayout: {
        receptionOffset: [obj.position.x, obj.position.y, obj.position.z - REG_RECEPTION_Z],
        loungeRotations: saveLoungeRotation(reg, selection, obj),
      },
    });
    return true;
  }

  if (selection.startsWith('reg-imported-')) {
    const id = selection.slice('reg-imported-'.length);
    const next = reg.importedModels.map((m) =>
      m.id === id
        ? {
            ...m,
            offset: [obj.position.x, obj.position.y, obj.position.z] as [number, number, number],
            rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z] as [number, number, number],
            scale: [obj.scale.x, obj.scale.y, obj.scale.z] as [number, number, number],
          }
        : m,
    );
    patchSceneOverride({ registrationLayout: { importedModels: next } });
    return true;
  }

  const regLocal: Record<string, keyof RegistrationLayoutConfig> = {
    'reg-registration-desk': 'deskOffset',
    'reg-expo-backdrop': 'backdropOffset',
    'reg-queue-lanes': 'queueOffset',
    'reg-event-totems': 'totemsOffset',
    'reg-lobby-lounge': 'loungeOffset',
    'reg-lobby-sectional': 'sectionalOffset',
    'reg-lobby-chair-left': 'chairLeftOffset',
    'reg-lobby-chair-right': 'chairRightOffset',
    'reg-lobby-coffee-table': 'coffeeTableOffset',
    'reg-lobby-lamp-left': 'lampLeftOffset',
    'reg-lobby-lamp-right': 'lampRightOffset',
  };

  const field = regLocal[selection];
  if (field) {
    patchSceneOverride({
      registrationLayout: {
        [field]: [obj.position.x, obj.position.y, obj.position.z],
        loungeRotations: saveLoungeRotation(reg, selection, obj),
      },
    });
    return true;
  }

  if (selection.startsWith('reg-lobby-plant-')) {
    const idx = parseInt(selection.slice('reg-lobby-plant-'.length), 10);
    if (!isNaN(idx) && idx >= 0 && idx <= 3) {
      const next = [...reg.loungePlantOffsets] as RegistrationLayoutConfig['loungePlantOffsets'];
      next[idx] = [obj.position.x, obj.position.y, obj.position.z];
      patchSceneOverride({
        registrationLayout: {
          loungePlantOffsets: next,
          loungeRotations: saveLoungeRotation(reg, selection, obj),
        },
      });
      return true;
    }
  }

  return false;
}

/**
 * Finds the object in the scene and saves its transform.
 * Returns true if successful.
 */
export function commitHallLayoutTransform(): boolean {
  const sel = useStore.getState().hallLayoutSelection ?? activeSelection;
  if (!sel) return false;

  const obj = findLayoutObject(sel);
  if (!obj) return false;

  return persistHallLayoutTransform(sel, obj);
}
