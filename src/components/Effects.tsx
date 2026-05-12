import { Bloom, EffectComposer, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { HalfFloatType } from 'three';

/**
 * Lightweight post stack (fewer passes + no mipmap Bloom = smoother on low-end GPUs).
 * Tune Bloom `intensity` / `luminanceThreshold` if LEDs look too flat or too hot.
 */
export function Effects() {
  return (
    <EffectComposer multisampling={0} frameBufferType={HalfFloatType}>
      <Bloom
        luminanceThreshold={1.85}
        luminanceSmoothing={0.22}
        mipmapBlur={false}
        intensity={0.15}
        radius={0.3}
      />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} whitePoint={3.6} middleGrey={0.6} />
      <Vignette eskil={false} offset={0.22} darkness={0.32} />
    </EffectComposer>
  );
}
