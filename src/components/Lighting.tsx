import { Environment } from '@react-three/drei';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';

/** Required once for WebGL — enables physically based wall wash from RectAreaLights */
let rectAreaLightUniformsReady = false;
function ensureRectAreaLightUniforms() {
  if (rectAreaLightUniformsReady) return;
  RectAreaLightUniformsLib.init();
  rectAreaLightUniformsReady = true;
}

export function Lighting() {
  ensureRectAreaLightUniforms();
  return (
    <>
      {/* Soft sky/ground fill — lifts crushed blacks, reduces shadow noise */}
      <hemisphereLight color="#fffaf4" groundColor="#c8d0e0" intensity={0.42} />

      <ambientLight intensity={0.48} color="#fff8ef" />

      {/* Single primary shadow caster — avoids overlapping shadow maps & blocky artifacts */}
      <directionalLight
        position={[32, 52, 28]}
        intensity={1.35}
        color="#fffaf0"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={0.5}
        shadow-camera-far={140}
        shadow-camera-left={-58}
        shadow-camera-right={58}
        shadow-camera-top={58}
        shadow-camera-bottom={-58}
        shadow-bias={-0.00008}
        shadow-normalBias={0.028}
      />

      {/* Fill — no shadows (prevents noisy multi-shadow overlap) */}
      <directionalLight position={[-28, 34, -22]} intensity={0.72} color="#e8f0ff" />
      <directionalLight position={[0, 22, -42]} intensity={0.45} color="#ffeedd" />

      {/* Center hero wash — no cast shadow (was washing floor with 1024 map noise) */}
      <spotLight
        position={[0, 28, 0]}
        angle={0.9}
        penumbra={0.85}
        intensity={280}
        color="#ffffff"
        distance={90}
        decay={2}
      />

      <spotLight
        position={[0, 15, 0]}
        angle={1.15}
        penumbra={0.9}
        intensity={120}
        color="#ffd9a0"
        distance={70}
        decay={2}
      />

      <spotLight
        position={[0, 18, 45]}
        angle={0.52}
        penumbra={0.88}
        intensity={95}
        color="#ffd9a0"
        distance={85}
        decay={2}
      />

      <Environment preset="city" environmentIntensity={0.52} />
    </>
  );
}
