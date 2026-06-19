import { Environment } from '@react-three/drei';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';

/** Required once for WebGL — enables physically based wall wash from RectAreaLights */
let rectAreaLightUniformsReady = false;
function ensureRectAreaLightUniforms() {
  if (rectAreaLightUniformsReady) return;
  RectAreaLightUniformsLib.init();
  rectAreaLightUniformsReady = true;
}

export function Lighting({
  compressedMode = false,
  boost = false,
}: {
  compressedMode?: boolean;
  boost?: boolean;
}) {
  ensureRectAreaLightUniforms();
  return (
    <>
      {/* Bright cream fill — matches whitish convention hall walls */}
      <hemisphereLight color="#faf8f4" groundColor="#e8e4dc" intensity={compressedMode ? 0.62 : 0.58} />

      <ambientLight intensity={(compressedMode ? 0.72 : 0.62) + (boost ? 0.08 : 0)} color="#f8f6f0" />

      {/* Single primary shadow caster — #3 smaller shadow map under boost */}
      {!compressedMode && (
        <directionalLight
          position={[32, 52, 28]}
          intensity={1.35}
          color="#fffaf0"
          castShadow
          shadow-mapSize={boost ? [256, 256] : [512, 512]}
          shadow-camera-near={0.5}
          shadow-camera-far={140}
          shadow-camera-left={-58}
          shadow-camera-right={58}
          shadow-camera-top={58}
          shadow-camera-bottom={-58}
          shadow-bias={-0.00008}
          shadow-normalBias={0.028}
        />
      )}

      {/*
        #2 Forward rendering evaluates EVERY light per pixel, so the global fill count is a
        direct FPS lever. Boost keeps just 2 directionals (key + front) and folds the rest
        into slightly stronger key/front + ambient. Off = full 5-light beauty rig.
      */}
      <directionalLight
        position={[-28, 34, -22]}
        intensity={(compressedMode ? 0.95 : 0.78) + (boost ? 0.2 : 0)}
        color="#fffaf4"
      />
      <directionalLight
        position={[0, 18, 42]}
        intensity={(compressedMode ? 0.65 : 0.52) + (boost ? 0.14 : 0)}
        color="#f8f6f0"
      />
      {!boost && (
        <>
          <directionalLight position={[0, 22, -42]} intensity={compressedMode ? 0.8 : 0.65} color="#f8f6f0" />
          <directionalLight position={[38, 18,   0]}  intensity={0.38} color="#fffaf4" />
          <directionalLight position={[-38, 18,  0]}  intensity={0.38} color="#fffaf4" />
        </>
      )}

      {!compressedMode && <Environment preset="apartment" environmentIntensity={0.18} />}
    </>
  );
}
