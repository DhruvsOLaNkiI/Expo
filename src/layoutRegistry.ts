import * as THREE from 'three';

/** Registry of editable layout objects by name. */
const objectRegistry = new Map<string, THREE.Object3D>();

export function registerLayoutObject(name: string, obj: THREE.Object3D) {
  objectRegistry.set(name, obj);
  console.log(`[Registry] Registered: ${name}, total: ${objectRegistry.size}`);
}

export function unregisterLayoutObject(name: string) {
  objectRegistry.delete(name);
  console.log(`[Registry] Unregistered: ${name}, total: ${objectRegistry.size}`);
}

export function getLayoutObject(name: string): THREE.Object3D | null {
  const obj = objectRegistry.get(name) ?? null;
  if (!obj) {
    console.log(`[Registry] Not found: ${name}. Available:`, Array.from(objectRegistry.keys()));
  }
  return obj;
}

export function clearLayoutRegistry() {
  objectRegistry.clear();
}

