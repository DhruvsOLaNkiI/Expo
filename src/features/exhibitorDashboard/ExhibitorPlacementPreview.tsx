import { useCallback, useRef } from 'react';
import { CmsPreview3D } from '@/features/cms/CmsPreview3D';
import { boothStageScreenUrl } from '@/features/shared/data/boothLayouts';
import type {
  BoothPlacementSlot,
  BoothWallPlacementAdjustments,
} from '@/features/booths/components/boothWallMetrics';
import { sanitizeBoothLogoUrlForWebGL } from './exhibitorLogo';
import { useExhibitorBooth } from './useExhibitorBooth';

const noop = () => {};

type Props = {
  sideWallLeftImageUrl: string;
  sideWallRightImageUrl: string;
  exteriorWallLeftImageUrl: string;
  exteriorWallRightImageUrl: string;
  counterFrontImageUrl: string;
  wallPlacementAdjustments: BoothWallPlacementAdjustments;
  onUploadSlot: (slot: BoothPlacementSlot, file: File) => Promise<void>;
};

export function ExhibitorPlacementPreview({
  sideWallLeftImageUrl,
  sideWallRightImageUrl,
  exteriorWallLeftImageUrl,
  exteriorWallRightImageUrl,
  counterFrontImageUrl,
  wallPlacementAdjustments,
  onUploadSlot,
}: Props) {
  const { booth, loading } = useExhibitorBooth();
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingSlot = useRef<BoothPlacementSlot | null>(null);

  const onSurfaceClick = useCallback(noop, []);
  const onSelectImage = useCallback((_id: string | null) => {}, []);
  const onDragImage = useCallback((_id: string, _pos: [number, number, number]) => {}, []);

  const onPlacementSlotClick = useCallback((slot: BoothPlacementSlot) => {
    pendingSlot.current = slot;
    inputRef.current?.click();
  }, []);

  if (loading) {
    return (
      <div className="exb-placement-3d exb-placement-3d-loading">Loading 3D preview…</div>
    );
  }

  if (!booth) {
    return (
      <div className="exb-placement-3d exb-placement-3d-loading">Booth not found.</div>
    );
  }

  const siteMapGallery = booth.siteMapGallery ?? [];

  return (
    <div className="exb-placement-3d">
      <p className="exb-muted exb-placement-3d-hint">
        Click a wall to upload. Use the shift &amp; size sliders below to fine-tune each poster — updates live here.
      </p>
      <input
        ref={inputRef}
        type="file"
        className="exb-hidden-input"
        accept="image/*"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          const slot = pendingSlot.current;
          pendingSlot.current = null;
          if (!f || !slot) return;
          void onUploadSlot(slot, f);
        }}
      />
      <CmsPreview3D
        boothId={booth.id}
        name={booth.name}
        color={booth.color}
        accent={booth.accent}
        counterColor={booth.counterColor}
        videoUrl={booth.videoUrl}
        stageScreenUrl={boothStageScreenUrl(booth)}
        headerLogoUrl={sanitizeBoothLogoUrlForWebGL(booth.headerLogoUrl) ?? ''}
        wallLogoLeftUrl={sanitizeBoothLogoUrlForWebGL(booth.wallLogoLeftUrl) ?? ''}
        wallLogoRightUrl={sanitizeBoothLogoUrlForWebGL(booth.wallLogoRightUrl) ?? ''}
        sideWallLeftImageUrl={sanitizeBoothLogoUrlForWebGL(sideWallLeftImageUrl) ?? ''}
        sideWallRightImageUrl={sanitizeBoothLogoUrlForWebGL(sideWallRightImageUrl) ?? ''}
        exteriorWallLeftImageUrl={sanitizeBoothLogoUrlForWebGL(exteriorWallLeftImageUrl) ?? ''}
        exteriorWallRightImageUrl={sanitizeBoothLogoUrlForWebGL(exteriorWallRightImageUrl) ?? ''}
        counterFrontImageUrl={sanitizeBoothLogoUrlForWebGL(counterFrontImageUrl) ?? ''}
        wallPlacementAdjustments={wallPlacementAdjustments}
        lighting={booth.lighting}
        placedImages={booth.placedImages ?? []}
        placingImageUrl={null}
        onSurfaceClick={onSurfaceClick}
        selectedImageId={null}
        onSelectImage={onSelectImage}
        onDragImage={onDragImage}
        onPlacementSlotClick={onPlacementSlotClick}
        brochureUrl={booth.brochureUrl}
        priceListUrl={booth.priceListUrl}
        siteMapUrl={booth.siteMapUrl ?? ''}
        siteMapGallery={siteMapGallery}
        hostessQuickReplies={booth.hostessQuickReplies}
      />
    </div>
  );
}
