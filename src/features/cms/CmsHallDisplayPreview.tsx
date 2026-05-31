import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Suspense } from 'react';
import { Ballroom } from '@/features/booths/components/Ballroom';

export function CmsHallDisplayPreview({ stageScreenUrl }: { stageScreenUrl: string }) {
  return (
    <div className="absolute inset-0">
      <Canvas shadows camera={{ position: [0, 3.5, 10], fov: 48, near: 0.1, far: 100 }}>
        <color attach="background" args={['#111118']} />
        <OrbitControls makeDefault target={[0, 3, 0]} />
        <ambientLight intensity={0.2} />
        <directionalLight position={[6, 12, 8]} intensity={0.7} />
        <Suspense fallback={null}>
          <Ballroom showVideos stageScreenUrl={stageScreenUrl.trim() || undefined} />
        </Suspense>
      </Canvas>
    </div>
  );
}
