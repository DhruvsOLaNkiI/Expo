import { useStore } from '@/store';
import { DEFAULT_SCENE_CONFIG } from '@/features/shared/data/boothLayouts';

/**
 * Master performance-boost switch. When on (default), the scene distance-gates the
 * hostess animation, drops two global fill lights, shrinks the shadow map, caps GLB
 * textures to 1024px, and decimates only heavy meshes. Toggle off to compare raw FPS.
 */
export function usePerformanceBoost(): boolean {
  return useStore(
    (s) => s.sceneOverrides.performanceBoost ?? DEFAULT_SCENE_CONFIG.performanceBoost,
  );
}
