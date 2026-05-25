import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, GizmoHelper, GizmoViewport } from '@react-three/drei';
import { Suspense } from 'react';
import { HALL_HEIGHT } from '@/features/shared/data/boothLayouts';
import { Ballroom, BALLROOM_WALL_X } from '@/features/booths/components/Ballroom';

/** World position of the ballroom east-wall LED (for CMS preview camera). */
const PREVIEW_LED_TARGET: [number, number, number] = [
  BALLROOM_WALL_X - 0.6,
  HALL_HEIGHT * 0.46,
  0,
];

export function CmsHallDisplayPreview({
  stageScreenUrl,
}: {
  stageScreenUrl: string;
}) {
  return (
    <div className="absolute inset-0">
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: false }}
        camera={{
          position: [BALLROOM_WALL_X - 11, HALL_HEIGHT * 0.46, 0],
          fov: 42,
          near: 0.1,
          far: 100,
        }}
      >
        <color attach="background" args={['#111118']} />
        <OrbitControls
          makeDefault
          target={PREVIEW_LED_TARGET}
          enablePan
          minDistance={4}
          maxDistance={24}
          minPolarAngle={0.15}
          maxPolarAngle={Math.PI / 2 + 0.05}
        />
        <ambientLight intensity={0.35} />
        <directionalLight position={[6, 12, 8]} intensity={0.85} castShadow />
        <Grid
          position={[0, -0.01, 0]}
          args={[30, 30]}
          cellSize={1}
          cellThickness={0.5}
          cellColor="#ffffff"
          sectionSize={5}
          sectionThickness={1}
          sectionColor="#d4af37"
          fadeDistance={25}
          fadeStrength={1.5}
          followCamera={false}
          infiniteGrid
        />
        <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
          <GizmoViewport axisColors={['#ff4444', '#44ff44', '#4444ff']} labelColor="white" />
        </GizmoHelper>
        <Suspense fallback={null}>
          <Ballroom showVideos stageScreenUrl={stageScreenUrl.trim() || undefined} />
        </Suspense>
      </Canvas>

      <div className="absolute bottom-4 left-4 rounded-xl border border-white/[0.08] bg-black/60 px-4 py-2 backdrop-blur-lg">
        <span className="text-[10px] text-[#d4af37] font-semibold">Hall Big Display</span>
        <span className="mx-2 text-[10px] text-white/20">|</span>
        <span className="text-[10px] text-white/30">Ballroom east-wall LED · Fast Travel → Ballroom stage</span>
      </div>
    </div>
  );
}
