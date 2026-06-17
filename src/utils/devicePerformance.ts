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
    // Phones start at HD (not 480p) so booths look crisp out of the box; compression +
    // the per-quality DPR ceiling keep the framerate playable. Visitors can drop to
    // 480p / Smooth from the Quality bar if their device struggles.
    return {
      modelCompression: '30fps',
      showVideos: true,
      showHallCanopy: true,
      fogEnabled: false,
      renderQuality: 'hd',
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

/**
 * Pixel-ratio range for the canvas on Mac / mobile.
 *
 * Phones report devicePixelRatio 2–3; rendering at native is far too heavy, but the old
 * flat cap (~0.9–1.15) clamped EVERY tier to roughly the same low resolution, so tapping
 * "Full HD" on a phone changed nothing and booths looked blurry/jagged. We now keep the
 * tier's intent: the ceiling scales with the chosen quality preset so Full HD genuinely
 * renders sharper than 480p. r3f varies the DPR within [min, max] based on live perf, so a
 * high ceiling only kicks in when the phone can sustain it.
 */
export function getEffectiveCanvasDpr(
  preset: [number, number],
  options?: { compressModels?: boolean },
): [number, number] {
  if (!isLowPowerDevice()) return preset;
  const tight = options?.compressModels === true;
  // Sharper than before: Full HD reaches ~1.8 (or 1.5 when compressing), 480p stays low.
  const ceiling = tight ? 1.5 : 1.8;
  const [min, max] = preset;
  return [Math.min(min, ceiling), Math.min(max, ceiling)];
}
