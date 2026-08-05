import { BoothFixedImageSlot, BoothFixedImageSlotFront } from './BoothFixedImageSlot';
import { BOOTH_WALL, resolveBoothWallPlacementUrls, type BoothWallPlacementInput } from './boothWallMetrics';

/** Booths whose side walls differ from the shared metrics (e.g. Horizon has no entrance wing). */
type WallMetricsOverride = Partial<
  Record<'innerFaceX' | 'innerPosterZ' | 'outerFaceX' | 'exteriorPosterZ', number>
>;

export function BoothPlacementImages(
  props: BoothWallPlacementInput & { wallMetrics?: WallMetricsOverride },
) {
  const w = { ...BOOTH_WALL, ...props.wallMetrics };
  const adj = props.wallPlacementAdjustments ?? {};
  const {
    interiorLeft: sideWallLeftImageUrl,
    interiorRight: sideWallRightImageUrl,
    exteriorLeft: exteriorWallLeftImageUrl,
    exteriorRight: exteriorWallRightImageUrl,
    counterFront: counterFrontImageUrl,
  } = resolveBoothWallPlacementUrls(props);

  return (
    <>
      <BoothFixedImageSlot
        url={sideWallLeftImageUrl}
        position={[-w.innerFaceX, w.innerPosterY, w.innerPosterZ]}
        rotation={[0, Math.PI / 2, 0]}
        maxW={w.innerPosterMaxW}
        maxH={w.innerPosterMaxH}
        adjust={adj.interiorLeft}
      />
      <BoothFixedImageSlot
        url={sideWallRightImageUrl}
        position={[w.innerFaceX, w.innerPosterY, w.innerPosterZ]}
        rotation={[0, -Math.PI / 2, 0]}
        maxW={w.innerPosterMaxW}
        maxH={w.innerPosterMaxH}
        adjust={adj.interiorRight}
      />

      <BoothFixedImageSlot
        url={exteriorWallLeftImageUrl}
        position={[-w.outerFaceX, w.exteriorPosterY, w.exteriorPosterZ]}
        rotation={[0, -Math.PI / 2, 0]}
        maxW={w.exteriorPosterMaxW}
        maxH={w.exteriorPosterMaxH}
        adjust={adj.exteriorLeft}
      />
      <BoothFixedImageSlot
        url={exteriorWallRightImageUrl}
        position={[w.outerFaceX, w.exteriorPosterY, w.exteriorPosterZ]}
        rotation={[0, Math.PI / 2, 0]}
        maxW={w.exteriorPosterMaxW}
        maxH={w.exteriorPosterMaxH}
        adjust={adj.exteriorRight}
      />

      <BoothFixedImageSlotFront
        url={counterFrontImageUrl}
        position={[0, 0.52, 0.52]}
        maxW={3.4}
        maxH={0.78}
        adjust={adj.counterFront}
      />
    </>
  );
}
