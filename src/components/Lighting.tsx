import { Environment } from '@react-three/drei';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';

/** Required once for WebGL — enables physically based wall wash from RectAreaLights */
let rectAreaLightUniformsReady = false;
function ensureRectAreaLightUniforms() {
  if (rectAreaLightUniformsReady) return;
  RectAreaLightUniformsLib.init();
  rectAreaLightUniformsReady = true;
}

export function Lighting({ compressedMode = false }: { compressedMode?: boolean }) {
  ensureRectAreaLightUniforms();
  return (
    <>
      {/* Soft sky/ground fill — lifts crushed blacks, reduces shadow noise */}
      <hemisphereLight color="#fffaf4" groundColor="#c8d0e0" intensity={0.42} />

      <ambientLight intensity={compressedMode ? 0.68 : 0.48} color="#fff8ef" />

      {/* Single primary shadow caster — avoids overlapping shadow maps & blocky artifacts */}
      {!compressedMode && (
        <directionalLight
          position={[32, 52, 28]}
          intensity={1.35}
          color="#fffaf0"
          castShadow
          shadow-mapSize={[512, 512]}
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

      {/* Fill — no shadows (prevents noisy multi-shadow overlap) */}
      <directionalLight position={[-28, 34, -22]} intensity={compressedMode ? 0.95 : 0.72} color="#e8f0ff" />
      <directionalLight position={[0, 22, -42]} intensity={compressedMode ? 0.68 : 0.45} color="#ffeedd" />

      {/* Environment map disabled in compressed mode for better performance */}
      {!compressedMode && <Environment preset="city" environmentIntensity={0.22} />}
    </>
  );
}
