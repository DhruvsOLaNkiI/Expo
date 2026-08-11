import { useThree, useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';

/**
 * Live WebGL render stats, written each frame by {@link RenderStatsProbe} and read by the
 * DOM-side FPS meter. Mutable singleton so the overlay can poll it without React churn.
 */
export const renderStats = {
  calls: 0,
  triangles: 0,
  lights: 0,
  geometries: 0,
  textures: 0,
  programs: 0,
};

/**
 * Sits inside the Canvas and copies `renderer.info` into {@link renderStats} every frame.
 * Active-light count (the usual forward-rendering bottleneck) is recounted a few times a
 * second by walking the scene graph — cheap, and lights rarely change mid-frame.
 */
export function RenderStatsProbe() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const tick = useRef(0);

  /**
   * `renderer.info` auto-resets on every `render()` call, so a frame made of several passes
   * (shadow map, scene, then each post-processing pass) leaves only the last pass behind —
   * a fullscreen triangle, which is why the HUD read 1 call / 1 triangle whenever bloom was on.
   * Owning the reset lets the counters accumulate across every pass in the frame instead.
   */
  useEffect(() => {
    gl.info.autoReset = false;
    return () => {
      gl.info.autoReset = true;
    };
  }, [gl]);

  useFrame(() => {
    const info = gl.info;
    renderStats.calls = info.render.calls;
    renderStats.triangles = info.render.triangles;
    renderStats.geometries = info.memory.geometries;
    renderStats.textures = info.memory.textures;
    renderStats.programs = info.programs?.length ?? 0;
    info.reset();

    tick.current = (tick.current + 1) % 12;
    if (tick.current === 0) {
      let lights = 0;
      scene.traverse((o) => {
        if ((o as { isLight?: boolean }).isLight && o.visible) lights += 1;
      });
      renderStats.lights = lights;
    }
  });

  return null;
}
