import type { ReactNode } from 'react';
import { BOOTH_WALL, boothSideWallMainArgs, boothSideWallWingArgs } from './boothWallMetrics';

type WallMat = ReactNode;

/** Main side walls + forward entrance wings (large white panels at booth entry). */
export function BoothSideWallAssembly({
  color,
  material,
}: {
  color: string;
  material?: WallMat;
}) {
  const mat =
    material ??
    (
      <meshStandardMaterial color={color} roughness={0.4} metalness={0.05} />
    );
  const { sideCenterX, mainCenterZ, wingCenterZ } = BOOTH_WALL;
  const mainArgs = boothSideWallMainArgs();
  const wingArgs = boothSideWallWingArgs();

  return (
    <>
      <mesh position={[-sideCenterX, BOOTH_WALL.wallCenterY, mainCenterZ]} receiveShadow castShadow>
        <boxGeometry args={mainArgs} />
        {mat}
      </mesh>
      <mesh position={[sideCenterX, BOOTH_WALL.wallCenterY, mainCenterZ]} receiveShadow castShadow>
        <boxGeometry args={mainArgs} />
        {mat}
      </mesh>
      <mesh position={[-sideCenterX, BOOTH_WALL.wallCenterY, wingCenterZ]} receiveShadow castShadow>
        <boxGeometry args={wingArgs} />
        {mat}
      </mesh>
      <mesh position={[sideCenterX, BOOTH_WALL.wallCenterY, wingCenterZ]} receiveShadow castShadow>
        <boxGeometry args={wingArgs} />
        {mat}
      </mesh>
    </>
  );
}
