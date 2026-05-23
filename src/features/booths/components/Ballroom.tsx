import { useGLTF } from '@react-three/drei';
import { useModelCompression } from '@/hooks/useModelCompression';
import { optimizeGlbRoot } from '@/utils/glbPerformance';
import { Suspense, useMemo, useRef, useLayoutEffect, useEffect, useState } from 'react';
import * as THREE from 'three';
import schoolChairUrl from '../../../../school-chair/school_chair.glb?url';
import { LedVideoPlane } from '@/features/media/components/LedVideoPlane';

const FONT =
  'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfMZhrib2Bg-4.ttf';

/**
 * ─── BALLROOM MAIN STAGE SCREEN TEXT ───────────────────────────────────────
 * Set `enabled: true` and edit the strings below. Leave `enabled: false` for a
 * plain black screen (no text). Side screens use `/expo-led-video.mp4` in public/.
 */
export const BALLROOM_MAIN_SCREEN = {
  enabled: true,
  headline: 'Digital Property Expo (NOIDA)',
  poweredByLabel: 'Powered By',
  poweredByBrand: 'Digital Broker.in',
} as const;

/** Main center LED panel size (meters). */
const MAIN_SCREEN = {
  position: [0, 6, -14.32] as [number, number, number],
  width: 29.5,
  height: 9.5,
};

/** Stage + backdrop sit flush against north hall wall (hall edge z ≈ −45; ballroom group z = −30). */
const STAGE_Z = -10;
const BACKDROP_Z = -14.4;
const SIDE_LED_Z = -14.18;
const STAGE_TOP_Y = 1;
const PODIUM_Z = STAGE_Z + 3.2;
const CHAIR_FIRST_ROW_Z = -1.2;
const CHAIR_ROW_SPACING = 2.15;

function BallroomMainScreenSign({
  headline,
  poweredByLabel,
  poweredByBrand,
}: {
  headline: string;
  poweredByLabel: string;
  poweredByBrand?: string;
}) {
  const [fontReady, setFontReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const face = new FontFace('BallroomInter', `url(${FONT})`);
    void face
      .load()
      .then((loaded) => {
        if (cancelled) return;
        document.fonts.add(loaded);
        setFontReady(true);
      })
      .catch(() => {
        if (!cancelled) setFontReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const texture = useMemo(() => {
    const { width, height } = MAIN_SCREEN;
    const canvas = document.createElement('canvas');
    const w = 4096;
    const h = Math.round(w * (height / width));
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.Texture();

    ctx.fillStyle = '#080808';
    ctx.fillRect(0, 0, w, h);

    const family = fontReady ? 'BallroomInter, Inter, system-ui, sans-serif' : 'system-ui, sans-serif';
    const draw = (text: string, y: number, size: number, color: string, weight: number) => {
      ctx.font = `${weight} ${size}px ${family}`;
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowBlur = 0;
      ctx.fillText(text, w / 2, y);
    };

    draw(headline, h * 0.36, 108, '#e8c547', 700);
    draw(poweredByLabel, h * 0.54, 52, '#b8b4ac', 500);
    if (poweredByBrand?.trim()) {
      draw(poweredByBrand.trim(), h * 0.66, 132, '#f8f6f2', 800);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = 16;
    return tex;
  }, [headline, poweredByLabel, poweredByBrand, fontReady]);

  return (
    <mesh position={MAIN_SCREEN.position}>
      <planeGeometry args={[MAIN_SCREEN.width, MAIN_SCREEN.height]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}

function ConferenceChair({ position }: { position: [number, number, number] }) {
  const modelCompression = useModelCompression();
  const { scene } = useGLTF(schoolChairUrl);
  const chairScene = useMemo(() => {
    const cloned = scene.clone(true);
    cloned.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = false;
        mesh.receiveShadow = true;
      }
    });
    const box = new THREE.Box3().setFromObject(cloned);
    cloned.position.y -= box.min.y;
    return optimizeGlbRoot(cloned, modelCompression);
  }, [scene, modelCompression]);

  return (
    <group position={position} scale={[0.18, 0.18, 0.18]} rotation={[0, 0, 0]}>
      <primitive object={chairScene} />
    </group>
  );
}

function StagePodium() {
  const bodyH = 1.35;
  const topH = 0.08;
  const topY = bodyH + topH / 2;
  const micPoleH = 1.28;

  return (
    <group position={[0, STAGE_TOP_Y, PODIUM_Z]}>
      <mesh position={[0, bodyH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[1, bodyH, 0.75]} />
        <meshStandardMaterial color="#ffffff" roughness={0.12} metalness={0.05} />
      </mesh>
      <mesh position={[0, topY, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.15, topH, 0.9]} />
        <meshStandardMaterial color="#d4af37" roughness={0.55} metalness={0.35} envMapIntensity={0.1} />
      </mesh>
      {/* Mic stand — base flush on podium top, pole + head attached */}
      <group position={[0, bodyH + topH, 0]}>
        <mesh position={[0, 0.02, 0]} castShadow>
          <cylinderGeometry args={[0.13, 0.15, 0.04, 18]} />
          <meshStandardMaterial color="#1a1a1a" metalness={0.75} roughness={0.35} />
        </mesh>
        <mesh position={[0, micPoleH / 2 + 0.04, 0]} castShadow>
          <cylinderGeometry args={[0.012, 0.016, micPoleH, 10]} />
          <meshStandardMaterial color="#2a2a2a" metalness={0.88} roughness={0.22} />
        </mesh>
        <mesh position={[0, micPoleH + 0.08, 0.07]} castShadow>
          <sphereGeometry args={[0.055, 12, 12]} />
          <meshStandardMaterial color="#111111" metalness={0.9} roughness={0.18} />
        </mesh>
      </group>
    </group>
  );
}

export function Ballroom({ showVideos = true }: { showVideos?: boolean }) {
  return (
    <group position={[0, 0, -30]}>
      {/* Stage — back edge flush with north wall */}
      <mesh position={[0, 0.5, STAGE_Z]} receiveShadow castShadow>
        <boxGeometry args={[40, 1, 10]} />
        <meshStandardMaterial color="#fdfaf5" roughness={0.3} metalness={0.05} />
      </mesh>

      {/* Giant LED Wall Housing/Frame — changed to dark to avoid "white void" look */}
      <mesh position={[0, 6, BACKDROP_Z - 0.1]}>
        <planeGeometry args={[31, 11]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.2} metalness={0.8} />
      </mesh>
      {/* Main stage backdrop — solid panel only; video plays on side LEDs */}
      <mesh position={[0, 6, BACKDROP_Z]}>
        <planeGeometry args={[29.5, 9.5]} />
        <meshStandardMaterial color="#050505" roughness={0.4} metalness={0.2} />
      </mesh>

      {BALLROOM_MAIN_SCREEN.enabled && (
        <BallroomMainScreenSign
          headline={BALLROOM_MAIN_SCREEN.headline}
          poweredByLabel={BALLROOM_MAIN_SCREEN.poweredByLabel}
          poweredByBrand={BALLROOM_MAIN_SCREEN.poweredByBrand}
        />
      )}

      {/* Massive Side Wall LED Presentation Panels */}
      {[-1, 1].map((side) => (
        <group key={`massive-side-led-${side}`} position={[side * 25, 6.1, SIDE_LED_Z]}>
          {/* Recessed architectural niche (near floor-to-ceiling proportion) */}
          <mesh position={[0, 0, -0.22]} receiveShadow>
            <boxGeometry args={[10.9, 7.8, 0.5]} />
            <meshStandardMaterial color="#9c968c" roughness={0.82} metalness={0.04} />
          </mesh>

          {/* Soft warm ambient backlight */}
          <mesh position={[0, 0, -0.06]}>
            <planeGeometry args={[10.4, 7.3]} />
            <meshStandardMaterial
              color="#fff0cf"
              emissive="#fff0cf"
              emissiveIntensity={0.12}
              transparent
              opacity={0.14}
            />
          </mesh>

          {/* Champagne architectural frame (thin premium bezel) */}
          <mesh castShadow>
            <boxGeometry args={[10.1, 7, 0.2]} />
            <meshStandardMaterial color="#d4af37" metalness={0.95} roughness={0.18} />
          </mesh>

          {/* Glossy black built-in LED wall housing */}
          <mesh position={[0, 0, 0.045]} castShadow>
            <boxGeometry args={[9.84, 6.74, 0.15]} />
            <meshStandardMaterial color="#0b0b0b" metalness={0.88} roughness={0.14} />
          </mesh>

          {/* Cinematic giant side display content */}
          {showVideos ? (
            <Suspense fallback={<meshBasicMaterial color="#111" />}>
              <LedVideoPlane
                args={[9.62, 6.52]}
                url="/expo-led-video.mp4"
                position={[0, 0, 0.12]}
              />
            </Suspense>
          ) : (
            <meshBasicMaterial color="#111" />
          )}

          {/* Side LED glow for presentation mood */}
          <rectAreaLight
            position={[0, 0, 0.5]}
            width={8.8}
            height={5.8}
            intensity={3}
            color="#ffe8c2"
          />
        </group>
      ))}

      {/* Podium + mic — parented to stage top so nothing floats */}
      <StagePodium />

      {/* Premium conference seating with central aisle */}
      {Array.from({ length: 5 }).map((_, row) => {
        const z = CHAIR_FIRST_ROW_Z + row * CHAIR_ROW_SPACING;
        const leftCols = Array.from({ length: 5 }).map((__, col) => -9.5 + col * 1.55);
        const rightCols = Array.from({ length: 5 }).map((__, col) => 2.3 + col * 1.55);
        return (
          <group key={`chair-row-${row}`}>
            {leftCols.map((x) => (
              <ConferenceChair key={`chair-left-${row}-${x}`} position={[x, 0, z]} />
            ))}
            {rightCols.map((x) => (
              <ConferenceChair key={`chair-right-${row}-${x}`} position={[x, 0, z]} />
            ))}
          </group>
        );
      })}

      {/* Soft fill on backdrop — reduces harsh under-screen shadows */}
      <pointLight position={[0, 6.2, BACKDROP_Z + 8.4]} intensity={14} distance={22} decay={2} color="#f5f0e8" />

      {/* Stage Lighting — aimed at screen (invalid target-position was ignored before) */}
      <BallroomSpot
        position={[-15, 12, 5]}
        target={[0, 6, BACKDROP_Z + 0.2]}
        intensity={38}
      />
      <BallroomSpot
        position={[15, 12, 5]}
        target={[0, 6, BACKDROP_Z + 0.2]}
        intensity={38}
      />
    </group>
  );
}

function BallroomSpot({
  position,
  target,
  intensity,
}: {
  position: [number, number, number];
  target: [number, number, number];
  intensity: number;
}) {
  const lightRef = useRef<THREE.SpotLight>(null);
  const targetRef = useRef<THREE.Group>(null);
  useLayoutEffect(() => {
    const L = lightRef.current;
    const T = targetRef.current;
    if (!L || !T) return;
    L.target = T;
    L.target.updateMatrixWorld();
  }, []);
  return (
    <>
      <spotLight
        ref={lightRef}
        position={position}
        angle={Math.PI / 5.5}
        penumbra={0.78}
        intensity={intensity}
        color="#ffddaa"
        distance={55}
        decay={2}
        castShadow={false}
      />
      <group ref={targetRef} position={target} />
    </>
  );
}

useGLTF.preload(schoolChairUrl);
