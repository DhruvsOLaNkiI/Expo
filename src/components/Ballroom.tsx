import { Box, useGLTF } from '@react-three/drei';
import { Suspense, useMemo, useRef, useLayoutEffect, useEffect, useState } from 'react';
import * as THREE from 'three';
import schoolChairUrl from '../../school-chair/school_chair.glb?url';
import { LedVideoPlane } from './LedVideoPlane';

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
  position: [0, 6, -8.32] as [number, number, number],
  width: 29.5,
  height: 9.5,
};

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
    return cloned;
  }, [scene]);

  return (
    <group position={position} scale={[0.18, 0.18, 0.18]} rotation={[0, 0, 0]}>
      <primitive object={chairScene} />
    </group>
  );
}

export function Ballroom({ showVideos = true }: { showVideos?: boolean }) {
  return (
    <group position={[0, 0, -30]}>
      {/* Stage */}
      <mesh position={[0, 0.5, -4]} receiveShadow castShadow>
        <boxGeometry args={[40, 1, 10]} />
        <meshStandardMaterial color="#fdfaf5" roughness={0.3} metalness={0.05} />
      </mesh>

      {/* Giant LED Wall */}
      <mesh position={[0, 6, -8.5]}>
        <planeGeometry args={[30, 10]} />
        <meshStandardMaterial color="#fdfaf5" roughness={0.3} metalness={0.05} />
      </mesh>
      {/* Main stage backdrop — solid panel only; video plays on side LEDs */}
      <mesh position={[0, 6, -8.4]}>
        <planeGeometry args={[29.5, 9.5]} />
        <meshStandardMaterial color="#080808" roughness={0.4} metalness={0.2} />
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
        <group key={`massive-side-led-${side}`} position={[side * 25, 6.1, -8.18]}>
          {/* Recessed architectural niche (near floor-to-ceiling proportion) */}
          <mesh position={[0, 0, -0.22]} receiveShadow>
            <boxGeometry args={[10.9, 7.8, 0.5]} />
            <meshStandardMaterial color="#e8e2d7" roughness={0.75} metalness={0.06} />
          </mesh>

          {/* Soft warm ambient backlight */}
          <mesh position={[0, 0, -0.06]}>
            <planeGeometry args={[10.4, 7.3]} />
            <meshStandardMaterial
              color="#fff0cf"
              emissive="#fff0cf"
              emissiveIntensity={0.26}
              transparent
              opacity={0.22}
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

      {/* Podium */}
      <group position={[0, 1, -1]}>
        <Box args={[1, 1.5, 0.8]} position={[0, 0.75, 0]} castShadow>
          <meshStandardMaterial color="#ffffff" roughness={0.1} />
        </Box>
        <Box args={[1.2, 0.1, 1]} position={[0, 1.55, 0]} castShadow>
          <meshStandardMaterial color="#d4af37" />
        </Box>
      </group>

      {/* Premium conference seating with central aisle */}
      {Array.from({ length: 5 }).map((_, row) => {
        const z = 4.8 + row * 2.25;
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
      <pointLight position={[0, 6.2, -6]} intensity={14} distance={22} decay={2} color="#f5f0e8" />

      {/* Stage Lighting — aimed at screen (invalid target-position was ignored before) */}
      <BallroomSpot
        position={[-15, 12, 5]}
        target={[0, 6, -8.2]}
        intensity={38}
      />
      <BallroomSpot
        position={[15, 12, 5]}
        target={[0, 6, -8.2]}
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
