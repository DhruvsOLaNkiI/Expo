import type { SceneOverridesInput } from './boothLayouts';

/** Expo render quality tier — controls canvas resolution (DPR) only. */
export type RenderQuality = 'fullhd' | 'hd' | '480p';

export type RenderQualityPreset = {
  id: RenderQuality;
  label: string;
  hint: string;
  /** Canvas `dpr` min/max — lower = fewer pixels (480p feel on any monitor). */
  dpr: [number, number];
  /** Only updates `renderQuality` — does not change fog, compression, or videos. */
  patch: SceneOverridesInput;
};

export const RENDER_QUALITY_PRESETS: RenderQualityPreset[] = [
  {
    id: 'fullhd',
    label: 'Full HD',
    hint: 'Sharpest picture — highest pixel density',
    dpr: [1, 2],
    patch: { renderQuality: 'fullhd' },
  },
  {
    id: 'hd',
    label: 'HD',
    hint: 'Balanced resolution for most devices',
    dpr: [1, 1.25],
    patch: { renderQuality: 'hd' },
  },
  {
    id: '480p',
    label: '480p',
    hint: 'Lower canvas + softer LED video — all booths, canopy & screens stay on',
    dpr: [0.55, 0.75],
    patch: { renderQuality: '480p' },
  },
];

/** How LED video textures are decoded/uploaded per quality tier (never hides screens). */
export type VideoPlaybackTier = {
  decodeWidth: number;
  decodeHeight: number;
  /** Ms between GPU texture uploads (0 = every frame). */
  textureUpdateMs: number;
  maxAnisotropy: number;
};

export function getVideoPlaybackTier(quality: RenderQuality | undefined): VideoPlaybackTier {
  switch (quality) {
    case '480p':
      return { decodeWidth: 854, decodeHeight: 480, textureUpdateMs: 50, maxAnisotropy: 1 };
    case 'hd':
      return { decodeWidth: 1280, decodeHeight: 720, textureUpdateMs: 33, maxAnisotropy: 2 };
    default:
      return { decodeWidth: 0, decodeHeight: 0, textureUpdateMs: 0, maxAnisotropy: 4 };
  }
}

const PRESET_BY_ID = Object.fromEntries(
  RENDER_QUALITY_PRESETS.map((p) => [p.id, p]),
) as Record<RenderQuality, RenderQualityPreset>;

export function getRenderQualityPreset(id: RenderQuality | undefined): RenderQualityPreset {
  return PRESET_BY_ID[id ?? 'hd'] ?? PRESET_BY_ID.hd;
}

export function isRenderQuality(value: unknown): value is RenderQuality {
  return value === 'fullhd' || value === 'hd' || value === '480p';
}
