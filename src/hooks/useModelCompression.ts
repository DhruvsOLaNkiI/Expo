import { useStore } from '../store';
import { DEFAULT_SCENE_CONFIG } from '../data/boothLayouts';
import type { ModelCompressionLevel } from '../utils/glbPerformance';

export function useModelCompression(): ModelCompressionLevel {
  return useStore(
    (s) => s.sceneOverrides.modelCompression ?? DEFAULT_SCENE_CONFIG.modelCompression,
  );
}
