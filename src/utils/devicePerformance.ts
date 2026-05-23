import type { SceneOverridesInput } from '@/features/shared/data/boothLayouts';

/** Mac / lag fix — lowers resolution & meshes; keeps all LEDs, canopy & booths visible. */
export const SMOOTH_MODE_SCENE_PATCH: SceneOverridesInput = {
  renderQuality: '480p',
  modelCompression: '30fps',
  fogEnabled: false,
};

export function isLowPowerDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return true;
  if (/Macintosh|Mac OS X/i.test(ua)) return true;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (mem !== undefined && mem <= 4) return true;
  const cores = navigator.hardwareConcurrency;
  if (cores !== undefined && cores <= 4) return true;
  return false;
}

/** Applied when the visitor has no saved scene config in this browser. */
export function getBootstrapSceneForDevice(): SceneOverridesInput {
  if (isLowPowerDevice()) {
    return {
      ...SMOOTH_MODE_SCENE_PATCH,
      showVideos: true,
      showHallCanopy: true,
    };
  }
  return {
    modelCompression: '30fps',
    showVideos: true,
    showHallCanopy: true,
    fogEnabled: false,
    renderQuality: 'hd',
  };
}

/** Cap pixel ratio on Mac / mobile so HD does not mean 2× native resolution. */
export function getEffectiveCanvasDpr(
  preset: [number, number],
  options?: { compressModels?: boolean },
): [number, number] {
  if (!isLowPowerDevice()) return preset;
  const tight = options?.compressModels === true;
  const max = tight ? 0.9 : 1.15;
  const min = tight ? 0.5 : 0.65;
  return [Math.min(preset[0], min), Math.min(preset[1], max)];
}
