import { useTexture } from '@react-three/drei';
import { type ThreeElements, useFrame, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { mergeSceneConfig } from '@/features/shared/data/boothLayouts';
import { getVideoPlaybackTier, isRenderQuality } from '@/features/shared/data/renderQuality';
import { resolveMediaUrlForWebGL, resolveTextureUrlForWebGL } from '@/config/webglTextureUrl';
import { useStore } from '@/store';

type LedVideoPlaneProps = {
  args: [number, number];
  url: string;
  polygonOffset?: boolean;
} & Omit<ThreeElements['mesh'], 'args'>;

export function isScreenImageUrl(url: string): boolean {
  const u = url.trim().toLowerCase();
  if (!u) return false;
  if (u.startsWith('data:image/')) return true;
  if (isScreenVideoUrl(url)) return false;
  const path = u.split('?')[0].toLowerCase();
  if (/\.(png|jpe?g|webp|gif|svg|bmp|avif)(\?|#|$)/i.test(path)) return true;
  // R2 / CMS uploads often omit extensions — folder names distinguish image vs video
  if (/(^|[/-])(stage-image|signage|ballroom-stage-image|hall-canopy-image|logo|brochure|price-list|unit-layout|floor-plan|screen-image)([/-]|$)/i.test(path)) {
    return true;
  }
  return false;
}

export function isScreenVideoUrl(url: string): boolean {
  const u = url.trim().toLowerCase();
  if (u.startsWith('data:video/')) return true;
  const path = u.split('?')[0].toLowerCase();
  if (/\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i.test(path)) return true;
  if (/(^|[/-])(stage-video|walkthrough|ballroom-stage-video|hall-canopy-video)([/-]|$)/i.test(path)) return true;
  return false;
}

/** Large back-wall LED — prefers {@link stageScreenUrl}; falls back to Walk Through only if LED is empty. */
export function resolveBoothLedScreenUrl(
  stageScreenUrl: string | undefined,
  videoUrl: string,
  showVideos: boolean,
): string {
  const stage = (stageScreenUrl ?? '').trim();
  const walk = (videoUrl ?? '').trim();
  const raw = stage || walk;
  if (!raw) return '';
  if (isScreenImageUrl(raw)) return raw;
  return showVideos ? raw : '';
}

export function LedScreenSuspenseFallback({
  args,
  polygonOffset = true,
}: {
  args: [number, number];
  polygonOffset?: boolean;
}) {
  return (
    <mesh position={[0, 0, 0.1]}>
      <planeGeometry args={args} />
      <meshBasicMaterial color="#050508" toneMapped polygonOffset={polygonOffset} />
    </mesh>
  );
}

function FallbackBlackPlane({
  args,
  polygonOffset = true,
  ...meshProps
}: Omit<LedVideoPlaneProps, 'url'>) {
  return (
    <mesh position={[0, 0, 0.1]} {...meshProps}>
      <planeGeometry args={args} />
      <meshBasicMaterial
        color="#030303"
        toneMapped
        depthWrite
        polygonOffset={polygonOffset}
        polygonOffsetFactor={polygonOffset ? -0.5 : 0}
        polygonOffsetUnits={polygonOffset ? -0.5 : 0}
      />
    </mesh>
  );
}

function LedImagePlane({ args, url, polygonOffset = true, ...meshProps }: LedVideoPlaneProps) {
  const gl = useThree((s) => s.gl);
  const sceneOverrides = useStore((s) => s.sceneOverrides);
  const cfg = useMemo(() => mergeSceneConfig(sceneOverrides), [sceneOverrides]);
  const tier = getVideoPlaybackTier(isRenderQuality(cfg.renderQuality) ? cfg.renderQuality : 'hd');
  const resolvedUrl = useMemo(() => resolveTextureUrlForWebGL(url) || url, [url]);
  const tex = useTexture(resolvedUrl, undefined, (loader) => {
    if (/^https?:\/\//i.test(resolvedUrl.trim())) loader.setCrossOrigin('anonymous');
  });

  useLayoutEffect(() => {
    tex.colorSpace = gl.outputColorSpace;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    const cap = gl.capabilities.getMaxAnisotropy?.() ?? 1;
    tex.anisotropy = Math.min(tier.maxAnisotropy, cap);
    tex.needsUpdate = true;
  }, [tex, gl, tier.maxAnisotropy]);

  return (
    <mesh position={[0, 0, 0.1]} {...meshProps}>
      <planeGeometry args={args} />
      <meshStandardMaterial
        map={tex}
        emissiveMap={tex}
        emissive="#ffffff"
        emissiveIntensity={0.85}
        toneMapped={false}
        depthWrite
        polygonOffset={polygonOffset}
        polygonOffsetFactor={polygonOffset ? -0.5 : 0}
        polygonOffsetUnits={polygonOffset ? -0.5 : 0}
      />
    </mesh>
  );
}

type SharedVideoEntry = {
  video: HTMLVideoElement;
  texture: THREE.Texture;
  refs: number;
  canvas?: HTMLCanvasElement;
  ctx?: CanvasRenderingContext2D;
  lastTexUpdate: number;
  tierKey: string;
  /** Set once a frame upload fails (CORS-tainted / decode error) so we stop retrying every frame. */
  uploadFailed?: boolean;
  /** Kept so a source detached to free a decoder can be re-attached on approach. */
  src: string;
  attached: boolean;
  /** Every plane drawing this video — nearest one decides the entry's priority. */
  meshes: Set<THREE.Object3D>;
};

const sharedVideos = new Map<string, SharedVideoEntry>();

/**
 * Phones expose only a handful of hardware video decoders. Past that limit a
 * `<video>` silently never reaches readyState 2, so the LED stays black forever.
 * Only the nearest few screens are allowed to decode; the rest freeze on their
 * last frame until the visitor walks closer.
 */
const CONCURRENT_VIDEO_BUDGET = (() => {
  if (typeof navigator === 'undefined') return 8;
  const ua = navigator.userAgent;
  if (/Android|iPhone|iPod/i.test(ua)) return 2;
  if (/iPad/i.test(ua)) return 3;
  return 8;
})();

/** Pausing alone does not always hand the decoder back — phones need the source dropped. */
const RELEASE_DECODERS = CONCURRENT_VIDEO_BUDGET <= 3;

/** How often the nearest-screen ranking is recomputed. Per-frame would be wasteful. */
const RANK_INTERVAL_MS = 400;

function attachSource(entry: SharedVideoEntry) {
  if (entry.attached) return;
  entry.video.src = entry.src;
  entry.video.load();
  entry.attached = true;
}

function detachSource(entry: SharedVideoEntry) {
  entry.video.pause();
  // Without a canvas the texture samples the element directly, so dropping the
  // source would blank the screen instead of freezing it.
  if (!RELEASE_DECODERS || !entry.ctx || !entry.attached) return;
  entry.video.removeAttribute('src');
  entry.video.load();
  entry.attached = false;
}

function nearestDistanceSq(entry: SharedVideoEntry, camera: THREE.Vector3, scratch: THREE.Vector3): number {
  let best = Infinity;
  for (const mesh of entry.meshes) {
    const d = mesh.getWorldPosition(scratch).distanceToSquared(camera);
    if (d < best) best = d;
  }
  return best;
}

function tierCacheKey(tier: ReturnType<typeof getVideoPlaybackTier>): string {
  return `${tier.decodeWidth}x${tier.decodeHeight}@${tier.textureUpdateMs}`;
}

function paintCanvasBlack(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
  ctx.fillStyle = '#050508';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function bindTextureToTier(entry: SharedVideoEntry, tier: ReturnType<typeof getVideoPlaybackTier>) {
  const key = tierCacheKey(tier);
  if (entry.tierKey === key) return;

  entry.texture.dispose();
  entry.tierKey = key;
  entry.lastTexUpdate = 0;

  if (tier.decodeWidth > 0 && tier.decodeHeight > 0) {
    const canvas = entry.canvas ?? document.createElement('canvas');
    canvas.width = tier.decodeWidth;
    canvas.height = tier.decodeHeight;
    const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    if (!ctx) return;
    paintCanvasBlack(ctx, canvas);
    entry.canvas = canvas;
    entry.ctx = ctx;
    entry.texture = new THREE.CanvasTexture(canvas);
    entry.texture.colorSpace = THREE.SRGBColorSpace;
    entry.texture.generateMipmaps = false;
    entry.texture.minFilter = THREE.LinearFilter;
    entry.texture.magFilter = THREE.LinearFilter;
  } else {
    entry.canvas = undefined;
    entry.ctx = undefined;
    const vt = new THREE.VideoTexture(entry.video);
    vt.colorSpace = THREE.SRGBColorSpace;
    entry.texture = vt;
  }
}

function acquireSharedVideo(url: string, tier: ReturnType<typeof getVideoPlaybackTier>): SharedVideoEntry {
  let entry = sharedVideos.get(url);
  if (!entry) {
    const video = document.createElement('video');
    // Same-origin proxy URLs do not need CORS; keep anonymous for any leftover remote URLs.
    const isSameOrigin =
      url.startsWith('/') ||
      (typeof window !== 'undefined' && url.startsWith(`${window.location.origin}/`));
    if (!isSameOrigin) {
      video.crossOrigin = 'anonymous';
    }
    video.src = url;
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.preload = 'auto';
    entry = {
      video,
      texture: new THREE.VideoTexture(video),
      refs: 0,
      lastTexUpdate: 0,
      tierKey: '',
      src: url,
      attached: true,
      meshes: new Set(),
    };
    sharedVideos.set(url, entry);
  }
  bindTextureToTier(entry, tier);
  entry.refs += 1;
  return entry;
}

function releaseSharedVideo(url: string) {
  const entry = sharedVideos.get(url);
  if (!entry) return;
  entry.refs -= 1;
  if (entry.refs <= 0) {
    entry.video.pause();
    entry.video.removeAttribute('src');
    entry.video.load();
    entry.texture.dispose();
    sharedVideos.delete(url);
  }
}

/** Keeps the shared expo video playing and uploads frames (480p uses a downscaled canvas). */
export function SharedVideoTextureUpdater() {
  const sceneOverrides = useStore((s) => s.sceneOverrides);
  const cfg = useMemo(() => mergeSceneConfig(sceneOverrides), [sceneOverrides]);
  const tier = getVideoPlaybackTier(isRenderQuality(cfg.renderQuality) ? cfg.renderQuality : 'hd');

  const camPos = useRef(new THREE.Vector3()).current;
  const scratch = useRef(new THREE.Vector3()).current;
  const allowed = useRef(new Set<SharedVideoEntry>()).current;
  const lastRank = useRef(-Infinity);

  useFrame((state) => {
    const now = state.clock.elapsedTime * 1000;

    if (now - lastRank.current >= RANK_INTERVAL_MS) {
      lastRank.current = now;
      state.camera.getWorldPosition(camPos);
      const live = [...sharedVideos.values()].filter((e) => e.refs > 0 && !e.uploadFailed);
      live.sort((a, b) => nearestDistanceSq(a, camPos, scratch) - nearestDistanceSq(b, camPos, scratch));
      allowed.clear();
      for (const entry of live.slice(0, CONCURRENT_VIDEO_BUDGET)) allowed.add(entry);
      for (const entry of live) {
        if (allowed.has(entry)) attachSource(entry);
        else detachSource(entry);
      }
    }

    for (const entry of sharedVideos.values()) {
      if (entry.refs <= 0) continue;
      // A tainted/undecodable source throws on every upload — freeze on the last frame instead.
      if (entry.uploadFailed) continue;
      if (!allowed.has(entry)) continue;
      bindTextureToTier(entry, tier);
      const { video } = entry;

      if (video.paused && video.readyState >= 2) {
        void video.play().catch(() => {});
      }

      if (video.readyState < 2) continue;

      if (entry.ctx && entry.canvas) {
        if (tier.textureUpdateMs > 0 && now - entry.lastTexUpdate < tier.textureUpdateMs) continue;
        try {
          entry.ctx.drawImage(video, 0, 0, entry.canvas.width, entry.canvas.height);
        } catch (e) {
          entry.uploadFailed = true;
          console.warn(
            `[led-video] Frame upload disabled for ${video.currentSrc || video.src} — cross-origin video without CORS headers.`,
            e,
          );
          continue;
        }
        entry.texture.needsUpdate = true;
        entry.lastTexUpdate = now;
      } else if (entry.texture instanceof THREE.VideoTexture) {
        entry.texture.needsUpdate = true;
      }
    }
  });

  return null;
}

export function LedVideoPlane({
  args,
  url,
  polygonOffset = true,
  ...meshProps
}: LedVideoPlaneProps) {
  const gl = useThree((s) => s.gl);
  const sceneOverrides = useStore((s) => s.sceneOverrides);
  const cfg = useMemo(() => mergeSceneConfig(sceneOverrides), [sceneOverrides]);
  const tier = getVideoPlaybackTier(isRenderQuality(cfg.renderQuality) ? cfg.renderQuality : 'hd');
  const tierKey = tierCacheKey(tier);
  const playUrl = useMemo(() => resolveMediaUrlForWebGL(url) || url, [url]);
  const [entry, setEntry] = useState<SharedVideoEntry | null>(null);
  const meshRef = useRef<THREE.Mesh>(null);

  useEffect(() => {
    const acquired = acquireSharedVideo(playUrl, tier);
    setEntry(acquired);
    const { video } = acquired;
    const onReady = () => {
      void video.play().catch(() => {});
    };
    if (video.readyState >= 2) onReady();
    else video.addEventListener('canplay', onReady);
    return () => {
      video.removeEventListener('canplay', onReady);
      releaseSharedVideo(playUrl);
      setEntry(null);
    };
  }, [playUrl, tierKey]);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!entry || !mesh) return;
    entry.meshes.add(mesh);
    return () => {
      entry.meshes.delete(mesh);
    };
  }, [entry]);

  useLayoutEffect(() => {
    if (!entry) return;
    bindTextureToTier(entry, tier);
    const cap = gl.capabilities.getMaxAnisotropy?.() ?? 1;
    entry.texture.anisotropy = Math.min(tier.maxAnisotropy, cap);
    entry.texture.colorSpace = gl.outputColorSpace;
    entry.texture.needsUpdate = true;
  }, [entry, tierKey, gl, tier.maxAnisotropy]);

  if (!entry?.texture) {
    return <FallbackBlackPlane args={args} polygonOffset={polygonOffset} {...meshProps} />;
  }

  return (
    <mesh ref={meshRef} position={[0, 0, 0.1]} {...meshProps}>
      <planeGeometry args={args} />
      <meshBasicMaterial
        map={entry.texture}
        toneMapped
        depthWrite
        polygonOffset={polygonOffset}
        polygonOffsetFactor={polygonOffset ? -0.5 : 0}
        polygonOffsetUnits={polygonOffset ? -0.5 : 0}
      />
    </mesh>
  );
}

export function LedScreenSurface({ args, url, polygonOffset = true, ...meshProps }: LedVideoPlaneProps) {
  const trimmed = url?.trim() ?? '';
  if (!trimmed) {
    return <FallbackBlackPlane args={args} polygonOffset={polygonOffset} {...meshProps} />;
  }
  if (isScreenVideoUrl(trimmed)) {
    return (
      <Suspense fallback={<LedScreenSuspenseFallback args={args} polygonOffset={polygonOffset} />}>
        <LedVideoPlane url={trimmed} args={args} polygonOffset={polygonOffset} {...meshProps} />
      </Suspense>
    );
  }
  return (
    <Suspense
      fallback={<LedScreenSuspenseFallback args={args} polygonOffset={polygonOffset} />}
    >
      <LedImagePlane key={trimmed} url={trimmed} args={args} polygonOffset={polygonOffset} {...meshProps} />
    </Suspense>
  );
}
