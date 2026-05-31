import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useStore, type VertexEliteHudContext } from '@/store';
import type { CompanyProfile, CustomFaqQuestion, MediaItem, PlacedImage, UnitLayoutItem } from '@/features/shared/data/boothLayouts';

const EMPTY_COMPANY: CompanyProfile = {
  companyName: '',
  tagline: '',
  website: '',
  phone: '',
  email: '',
  whatsapp: '',
  facebook: '',
  instagram: '',
  twitter: '',
  brandPrimary: '#d4af37',
  brandSecondary: '#1a1a1a',
};

/**
 * Measures distance to the booth entrance and drives `vertexEliteHudAlpha`.
 * Pushes CTA payload to `vertexEliteHudContext` for {@link VertexEliteScreenHud}.
 * Multiple booths report proximity; the strongest signal wins.
 */
export function VertexEliteProximityPanels({
  boothId,
  glow = '#d4af37',
  brochureUrl = '',
  priceListUrl = '',
  unitLayoutUrl = '',
  unitLayouts = [],
  floorPlanUrl = '',
  floorPlans = [],
  faqUrl = '',
  customFaqQuestions = [],
  siteMapUrls = [],
  videoUrl = '',
  media = [],
  placedImages = [],
  company,
  cmsPreview = false,
  entranceLocal = [0, 0, 0] as [number, number, number],
}: {
  boothId: string;
  glow?: string;
  brochureUrl?: string;
  priceListUrl?: string;
  unitLayoutUrl?: string;
  unitLayouts?: UnitLayoutItem[];
  floorPlanUrl?: string;
  floorPlans?: UnitLayoutItem[];
  faqUrl?: string;
  customFaqQuestions?: CustomFaqQuestion[];
  siteMapUrls?: string[];
  videoUrl?: string;
  media?: MediaItem[];
  placedImages?: PlacedImage[];
  company?: CompanyProfile;
  cmsPreview?: boolean;
  /** Local-space anchor for distance check (aisle-facing point). */
  entranceLocal?: [number, number, number];
}) {
  const { camera } = useThree();
  const anchorRef = useRef<THREE.Group>(null);
  const smoothed = useRef(0);
  const reportBoothHudProximity = useStore((s) => s.reportBoothHudProximity);
  const ctxRef = useRef<VertexEliteHudContext | null>(null);

  useEffect(() => {
    if (cmsPreview) {
      ctxRef.current = null;
      return;
    }
    ctxRef.current = {
      boothId,
      glow,
      brochureUrl: brochureUrl ?? '',
      priceListUrl: priceListUrl ?? '',
      unitLayoutUrl: unitLayoutUrl ?? '',
      unitLayouts: unitLayouts ?? [],
      floorPlanUrl: floorPlanUrl ?? '',
      floorPlans: floorPlans ?? [],
      faqUrl: faqUrl ?? '',
      customFaqQuestions: customFaqQuestions ?? [],
      siteMapUrls: siteMapUrls ?? [],
      videoUrl: videoUrl ?? '',
      media: media ?? [],
      placedImages: placedImages ?? [],
      company: company ?? EMPTY_COMPANY,
    };
  }, [
    cmsPreview,
    boothId,
    glow,
    brochureUrl,
    priceListUrl,
    unitLayoutUrl,
    unitLayouts,
    floorPlanUrl,
    floorPlans,
    faqUrl,
    customFaqQuestions,
    siteMapUrls,
    videoUrl,
    media,
    placedImages,
    company,
  ]);

  useEffect(() => {
    return () => {
      reportBoothHudProximity(boothId, 0, null);
    };
  }, [boothId, reportBoothHudProximity]);

  const frameCount = useRef(0);
  const worldPos = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    if (cmsPreview || !ctxRef.current) return;
    if (!anchorRef.current) return;
    
    // Throttle proximity checks to every 3 frames for better performance
    frameCount.current++;
    if (frameCount.current % 3 !== 0) return;
    
    anchorRef.current.getWorldPosition(worldPos.current);
    const dist = worldPos.current.distanceTo(camera.position);
    const FULL = 4.2;
    const FAR = 9.5;
    const target = THREE.MathUtils.clamp((FAR - dist) / (FAR - FULL), 0, 1);
    smoothed.current = THREE.MathUtils.lerp(smoothed.current, target, 1 - Math.pow(0.0015, delta * 60));
    reportBoothHudProximity(boothId, smoothed.current, ctxRef.current);
  });

  if (cmsPreview) return null;

  return <group ref={anchorRef} position={entranceLocal} />;
}
