/** Flat lobby lighting — no HDR environment map (avoids dark / blown-out walls). */
export function RegistrationLobbyLighting({ compressedMode = false }: { compressedMode?: boolean }) {
  return (
    <>
      <hemisphereLight color="#fffaf4" groundColor="#8a9098" intensity={compressedMode ? 0.68 : 0.55} />
      <ambientLight intensity={compressedMode ? 0.78 : 0.62} color="#fff8ef" />
      <directionalLight position={[0, 12, -6]} intensity={compressedMode ? 1.25 : 1.1} color="#ffffff" />
      {!compressedMode && (
        <>
          <directionalLight position={[-8, 8, 4]} intensity={0.45} color="#e8f0ff" />
          <directionalLight position={[8, 6, 2]} intensity={0.35} color="#fff4e8" />
        </>
      )}
    </>
  );
}
