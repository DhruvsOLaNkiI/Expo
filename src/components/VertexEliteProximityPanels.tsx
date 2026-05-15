import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useStore } from '../store';
import type { CompanyProfile, MediaItem, PlacedImage } from '../data/boothLayouts';

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
 */
export function VertexEliteProximityPanels({
  glow = '#d4af37',
  brochureUrl = '',
  priceListUrl = '',
  siteMapUrls = [],
  videoUrl = '',
  media = [],
  placedImages = [],
  company,
  cmsPreview = false,
}: {
  glow?: string;
  brochureUrl?: string;
  priceListUrl?: string;
  siteMapUrls?: string[];
  videoUrl?: string;
  media?: MediaItem[];
  placedImages?: PlacedImage[];
  company?: CompanyProfile;
  cmsPreview?: boolean;
}) {
  const { camera } = useThree();
  const anchorRef = useRef<THREE.Group>(null);
  const smoothed = useRef(0);
  const setVertexEliteHudAlpha = useStore((s) => s.setVertexEliteHudAlpha);
  const setVertexEliteHudContext = useStore((s) => s.setVertexEliteHudContext);

  useEffect(() => {
    if (cmsPreview) {
      setVertexEliteHudContext(null);
      return;
    }
    setVertexEliteHudContext({
      glow,
      brochureUrl: brochureUrl ?? '',
      priceListUrl: priceListUrl ?? '',
      siteMapUrls: siteMapUrls ?? [],
      videoUrl: videoUrl ?? '',
      media: media ?? [],
      placedImages: placedImages ?? [],
      company: company ?? EMPTY_COMPANY,
    });
    return () => {
      setVertexEliteHudContext(null);
      setVertexEliteHudAlpha(0);
    };
  }, [
    cmsPreview,
    glow,
    brochureUrl,
    priceListUrl,
    siteMapUrls,
    videoUrl,
    media,
    placedImages,
    company,
    setVertexEliteHudContext,
    setVertexEliteHudAlpha,
  ]);

  useFrame((_, delta) => {
    if (cmsPreview) return;
    if (!anchorRef.current) return;
    const wp = new THREE.Vector3(0, 0, 0);
    anchorRef.current.getWorldPosition(wp);
    const dist = wp.distanceTo(camera.position);
    const FULL = 4.2;
    const FAR = 9.5;
    const target = THREE.MathUtils.clamp((FAR - dist) / (FAR - FULL), 0, 1);
    smoothed.current = THREE.MathUtils.lerp(smoothed.current, target, 1 - Math.pow(0.0015, delta * 60));
    setVertexEliteHudAlpha(smoothed.current);
  });

  if (cmsPreview) return null;

  return <group ref={anchorRef} position={[0, 0, 0]} />;
}
