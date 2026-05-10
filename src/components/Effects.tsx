import { Bloom, EffectComposer, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing';
import { HalfFloatType } from 'three';

/**
 * Stable cinematic post stack: multisampled buffer, adaptive tone map,
 * conservative bloom (no mipmap blur on video), SMAA for edge AA, light vignette.
 */
export function Effects() {
  return (
    <EffectComposer multisampling={8} frameBufferType={HalfFloatType}>
      <Bloom
        luminanceThreshold={2.05}
        luminanceSmoothing={0.12}
        mipmapBlur={false}
        intensity={0.2}
        radius={0.22}
      />
      <ToneMapping adaptive />
      <Vignette eskil={false} offset={0.22} darkness={0.42} />
      <SMAA />
    </EffectComposer>
  );
}
