import { useCallback, useMemo } from 'react';
import { CmsPreview3D } from '@/features/cms/CmsPreview3D';
import { boothStageScreenUrl } from '@/features/shared/data/boothLayouts';
import { useExhibitorBooth } from './useExhibitorBooth';

const noop = () => {};

export function ExhibitorBoothPreview() {
  const { booth, loading } = useExhibitorBooth();

  const onSurfaceClick = useCallback(noop, []);
  const onSelectImage = useCallback((_id: string | null) => {}, []);
  const onDragImage = useCallback((_id: string, _pos: [number, number, number]) => {}, []);

  const siteMapFields = useMemo(() => {
    if (!booth) return { siteMapUrl: '', siteMapGallery: [] as string[] };
    const gallery = booth.siteMapGallery ?? [];
    return { siteMapUrl: booth.siteMapUrl ?? '', siteMapGallery: gallery };
  }, [booth]);

  if (loading) {
    return (
      <div className="exb-booth-preview-view exb-booth-preview-loading">
        Loading booth model…
      </div>
    );
  }

  if (!booth) {
    return (
      <div className="exb-booth-preview-view exb-booth-preview-loading">
        Booth not found. Use <code>?booth=vertex-elite</code> in the URL.
      </div>
    );
  }

  return (
    <div className="exb-booth-preview-view">
      <CmsPreview3D
        boothId={booth.id}
        name={booth.name}
        color={booth.color}
        accent={booth.accent}
        counterColor={booth.counterColor}
        videoUrl={booth.videoUrl}
        stageScreenUrl={boothStageScreenUrl(booth)}
        headerLogoUrl={booth.headerLogoUrl ?? ''}
        lighting={booth.lighting}
        placedImages={booth.placedImages ?? []}
        placingImageUrl={null}
        onSurfaceClick={onSurfaceClick}
        selectedImageId={null}
        onSelectImage={onSelectImage}
        onDragImage={onDragImage}
        brochureUrl={booth.brochureUrl}
        priceListUrl={booth.priceListUrl}
        siteMapUrl={siteMapFields.siteMapUrl}
        siteMapGallery={siteMapFields.siteMapGallery}
        hostessQuickReplies={booth.hostessQuickReplies}
      />
    </div>
  );
}
