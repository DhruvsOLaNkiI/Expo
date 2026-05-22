import { useMemo, type ComponentType } from 'react';
import {
  BOOTH_ROW_X_EAST,
  BOOTH_ROW_X_WEST,
  siteMapUrlsFromConfig,
  type BoothLayoutConfig,
  type HostessQuickReply,
} from '../data/boothLayouts';

const EMPTY_REPLIES: HostessQuickReply[] = [];

/** Props for the full luxury booth shell (same as AURUM RESIDENCES). */
export type LuxuryBoothProps = {
  position: [number, number, number];
  rotation: [number, number, number];
  boothScale: [number, number, number];
  id: string;
  name: string;
  color: string;
  accent: string;
  counterColor: string;
  videoUrl: string;
  headerLogoUrl?: string;
  lighting: import('../data/boothLayouts').BoothLighting;
  placedImages: import('../data/boothLayouts').PlacedImage[];
  brochureUrl?: string;
  priceListUrl?: string;
  unitLayoutUrl?: string;
  siteMapUrls?: string[];
  media?: import('../data/boothLayouts').MediaItem[];
  company?: import('../data/boothLayouts').CompanyProfile;
  hostessQuickReplies: HostessQuickReply[];
  showVideos?: boolean;
};

/** 3 per side — full AURUM-style booths facing the center aisle. */
export const SIDE_SPECS: {
  templateId: string;
  sideId: string;
  position: [number, number, number];
  rotation: [number, number, number];
}[] = [
  { templateId: 'builder-1', sideId: 'side-west-luxe', position: [BOOTH_ROW_X_WEST, 0, -28], rotation: [0, Math.PI / 2, 0] },
  { templateId: 'builder-2', sideId: 'side-west-aurum', position: [BOOTH_ROW_X_WEST, 0, -8], rotation: [0, Math.PI / 2, 0] },
  { templateId: 'builder-4', sideId: 'side-west-crown', position: [BOOTH_ROW_X_WEST, 0, 12], rotation: [0, Math.PI / 2, 0] },
  { templateId: 'builder-5', sideId: 'side-east-monarch', position: [BOOTH_ROW_X_EAST, 0, -28], rotation: [0, -Math.PI / 2, 0] },
  { templateId: 'builder-6', sideId: 'side-east-horizon', position: [BOOTH_ROW_X_EAST, 0, -8], rotation: [0, -Math.PI / 2, 0] },
  { templateId: 'builder-2', sideId: 'side-east-aurum', position: [BOOTH_ROW_X_EAST, 0, 12], rotation: [0, -Math.PI / 2, 0] },
];

export function isBoothHidden(hidden: Set<string>, boothId: string): boolean {
  return hidden.has(boothId);
}

export function SideExpoBooths({
  layouts,
  showVideos = true,
  BoothComponent,
  hiddenBooths = new Set(),
}: {
  layouts: BoothLayoutConfig[];
  showVideos?: boolean;
  BoothComponent: ComponentType<LuxuryBoothProps>;
  hiddenBooths?: Set<string>;
}) {
  const sideBooths = useMemo(
    () =>
      SIDE_SPECS.flatMap((spec) => {
        if (isBoothHidden(hiddenBooths, spec.sideId)) return [];
        const template = layouts.find((l) => l.id === spec.templateId);
        if (!template) return [];
        return [
          {
            ...template,
            id: spec.sideId,
            position: spec.position,
            rotation: spec.rotation,
          },
        ];
      }),
    [layouts, hiddenBooths],
  );

  return (
    <>
      {sideBooths.map((b) => (
        <BoothComponent
          key={b.id}
          position={b.position}
          rotation={b.rotation}
          boothScale={b.scale}
          id={b.id}
          name={b.name}
          color={b.color}
          accent={b.accent}
          counterColor={b.counterColor}
          videoUrl={b.videoUrl}
          headerLogoUrl={b.headerLogoUrl}
          lighting={b.lighting}
          placedImages={b.placedImages}
          brochureUrl={b.brochureUrl}
          priceListUrl={b.priceListUrl}
          unitLayoutUrl={b.unitLayoutUrl}
          siteMapUrls={siteMapUrlsFromConfig({ siteMapUrl: b.siteMapUrl, siteMapGallery: b.siteMapGallery })}
          media={b.media}
          company={b.company}
          hostessQuickReplies={b.hostessQuickReplies ?? EMPTY_REPLIES}
          showVideos={showVideos}
        />
      ))}
    </>
  );
}
