import { Text, Box, Cylinder, Torus, useGLTF, useTexture } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useStore } from '../store';
import { Suspense, useRef, useMemo, useLayoutEffect, useEffect } from 'react';
import * as THREE from 'three';
import { clone as cloneSkinnedHierarchy } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { LedScreenSurface } from './LedVideoPlane';
import { VertexEliteCanopyBranding } from './VertexEliteCanopyBranding';
import { VertexEliteCtaKiosk } from './VertexEliteCtaKiosk';
import { BoothPlacedImageInteractive } from './BoothPlacedImageInteractive';
import { applyBoothOverrides, buildDefaultBoothLayoutList, type PlacedImage } from '../data/boothLayouts';

/**
 * Vertex Elite uses the same procedural `Booth` shell as other luxury stalls; defaults live in `src/data/boothLayouts.ts` (overridable via Booth CMS + `public/booth-cms.json`).
 * Hostess: `public/assets/indian_office_woman.glb` (Mixamo rig + idle clip).
 */
const HOSTESS_MODEL_URL = '/assets/indian_office_woman.glb';
const HOSTESS_MAX_WIDTH = 2.25;
const HOSTESS_MAX_HEIGHT = 1.58;

/** Hallway decorative trees — Maple (`public/assets/maple1_MZRT.glb`) */
const HALL_TREE_MODEL_URL = '/assets/maple1_MZRT.glb';
/** World-space height after uniform scale (meters); multiplied by each `<Plant scale={…} />` */
const HALL_TREE_TARGET_HEIGHT = 5.15;

/**
 * Procedural `Booth` local space: +Y up, +Z toward main aisle / visitors, −Z back wall.
 * Reception desk lives in `<group position={[0, 0.5, 0]}>`; body is box 4×1×1 centered → back face at z = −0.5 in that group.
 */
const BOOTH_DESK_GROUP_Y = 0.5;
const BOOTH_COUNTER_HALF_DEPTH_Z = 0.5;
/** Space between counter back plane and avatar anchor (collision-safe). */
const BOOTH_HOSTESS_BACK_CLEARANCE = 0.42;
/** Slight −X shifts hostess away from the small counter TV (+X side of desk). */
const BOOTH_HOSTESS_DESK_LOCAL_X = -0.36;
/**
 * Extra **up** (meters) so shoes sit on the floor — animated GLBs often need a small nudge vs `prepareHostessModel`’s bind pose.
 * Increase if feet clip **into** the floor; decrease if she floats.
 */
const BOOTH_HOSTESS_FLOOR_LIFT = 0.075;
/**
 * Yaw (radians) around Y: turn the hostess so she faces visitors on the aisle.
 * - `0` and `Math.PI` differ by 180° — use whichever matches your GLB’s forward axis.
 * - Add small values (e.g. `±0.15`) for a slight angle toward the hall center.
 */
const BOOTH_HOSTESS_YAW = 0;
/**
 * Position inside desk group: feet near hall floor (booth y≈0 → desk-local y ≈ −BOOTH_DESK_GROUP_Y + lift).
 * z = behind counter back edge.
 */
const BOOTH_HOSTESS_DESK_LOCAL: [number, number, number] = [
  BOOTH_HOSTESS_DESK_LOCAL_X,
  -BOOTH_DESK_GROUP_Y + BOOTH_HOSTESS_FLOOR_LIFT,
  -(BOOTH_COUNTER_HALF_DEPTH_Z + BOOTH_HOSTESS_BACK_CLEARANCE),
];

/** Stable idle phase per booth / desk (desync motion). */
function stringToPhase(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 10000;
  return h * 0.001 * Math.PI;
}

export function Booths() {
  const boothOverrides = useStore((s) => s.boothOverrides);
  const initBoothCms = useStore((s) => s.initBoothCms);

  useEffect(() => {
    void initBoothCms();
  }, [initBoothCms]);

  const layouts = useMemo(
    () => applyBoothOverrides(buildDefaultBoothLayoutList(), boothOverrides),
    [boothOverrides]
  );

  return (
    <group position={[0, 0, 0]}>
      {/* Central Featured Help Desk Zone */}
      <FeaturedProperty position={[0, 0, 0]} />

      {/* Main Path Decorative Plants (`tree.glb`) */}
      <Suspense fallback={null}>
        <Plant position={[-5, 0, 15]} scale={1.08} />
        <Plant position={[5, 0, 15]} scale={1.08} />
        <Plant position={[-5, 0, 30]} scale={0.92} />
        <Plant position={[5, 0, 30]} scale={0.92} />
      </Suspense>

      {layouts.map((b) =>
        b.id === 'vertex-elite' ? (
          <VertexEliteBooth
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
            lighting={b.lighting}
            placedImages={b.placedImages}
            brochureUrl={b.brochureUrl}
            priceListUrl={b.priceListUrl}
            siteMapUrl={b.siteMapUrl}
          />
        ) : (
          <Booth
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
          />
        )
      )}
    </group>
  );
}

function BoothHeaderLogo({
  url,
  tagline,
  accent,
}: {
  url: string;
  tagline: string;
  accent: string;
}) {
  const tex = useTexture(url);
  useLayoutEffect(() => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    tex.needsUpdate = true;
  }, [tex]);

  const { logoW, logoH } = useMemo(() => {
    const img = tex.image as { width?: number; height?: number } | undefined;
    const aspect =
      img?.width && img?.height && img.height > 0 ? img.width / img.height : 3.4;
    const logoH = 0.7;
    return { logoW: logoH * aspect, logoH };
  }, [tex]);

  const padX = 0.52;
  const padY = 0.26;
  const boardW = logoW + padX;
  const boardH = logoH + padY;
  const trim = 0.038;
  const gold = '#d4af37';
  const warmWhite = '#fffaf4';
  const haloEmissive = '#fff8f0';

  return (
    <group position={[0, 6.5, -3.58]}>
      {/* Soft wash toward wall — mall-style backlit halo */}
      <pointLight position={[0, 0, -0.28]} intensity={2.2} distance={5.5} decay={2} color={haloEmissive} />
      <pointLight position={[0, 0.15, -0.22]} intensity={0.85} distance={4} decay={2} color="#fff5e6" />

      {/* Deep lightbox — warm emissive “LED wash” behind graphic */}
      <mesh position={[0, 0, -0.14]}>
        <planeGeometry args={[boardW * 0.98, boardH * 0.98]} />
        <meshStandardMaterial
          color={warmWhite}
          emissive={haloEmissive}
          emissiveIntensity={2.4}
          roughness={1}
          metalness={0}
          toneMapped={false}
        />
      </mesh>

      {/* Satin acrylic face — PBR white, very soft env read */}
      <mesh position={[0, 0, -0.055]}>
        <planeGeometry args={[boardW, boardH]} />
        <meshPhysicalMaterial
          color="#fdfdfd"
          roughness={0.22}
          metalness={0}
          clearcoat={0.42}
          clearcoatRoughness={0.2}
          envMapIntensity={0.14}
          reflectivity={0.12}
        />
      </mesh>

      {/* Perimeter “LED” strips — soft gold + white */}
      <mesh position={[0, boardH / 2 + trim / 2, 0.012]}>
        <boxGeometry args={[boardW + trim * 2.2, trim, 0.028]} />
        <meshStandardMaterial
          color={gold}
          emissive="#fff4dc"
          emissiveIntensity={0.55}
          metalness={0.35}
          roughness={0.38}
        />
      </mesh>
      <mesh position={[0, -boardH / 2 - trim / 2, 0.012]}>
        <boxGeometry args={[boardW + trim * 2.2, trim, 0.028]} />
        <meshStandardMaterial
          color={gold}
          emissive="#fff4dc"
          emissiveIntensity={0.55}
          metalness={0.35}
          roughness={0.38}
        />
      </mesh>
      <mesh position={[-boardW / 2 - trim / 2, 0, 0.012]}>
        <boxGeometry args={[trim, boardH + trim * 2, 0.028]} />
        <meshStandardMaterial
          color={gold}
          emissive="#fff4dc"
          emissiveIntensity={0.5}
          metalness={0.35}
          roughness={0.38}
        />
      </mesh>
      <mesh position={[boardW / 2 + trim / 2, 0, 0.012]}>
        <boxGeometry args={[trim, boardH + trim * 2, 0.028]} />
        <meshStandardMaterial
          color={gold}
          emissive="#fff4dc"
          emissiveIntensity={0.5}
          metalness={0.35}
          roughness={0.38}
        />
      </mesh>

      {/* Inner rim glow — subtle white/gold edge wash on acrylic */}
      <mesh position={[0, 0, 0.018]}>
        <planeGeometry args={[boardW * 0.94, boardH * 0.94]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#fffdf8"
          emissiveIntensity={0.35}
          transparent
          opacity={0.45}
          depthWrite={false}
          roughness={1}
          metalness={0}
          toneMapped={false}
        />
      </mesh>

      {/* Logo — strong emissive for backlit + bloom; sits proud of face */}
      <mesh castShadow position={[0, 0, 0.078]}>
        <planeGeometry args={[logoW, logoH]} />
        <meshStandardMaterial
          map={tex}
          emissiveMap={tex}
          emissive="#f4fff8"
          emissiveIntensity={2.15}
          color="#ffffff"
          transparent
          alphaTest={0.06}
          roughness={0.55}
          metalness={0}
          envMapIntensity={0.08}
          toneMapped={false}
          polygonOffset
          polygonOffsetFactor={-1}
        />
      </mesh>

      <Text
        position={[0, -0.52, 0.095]}
        fontSize={0.26}
        color={accent}
        anchorX="center"
        anchorY="middle"
        font="https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfMZhrib2Bg-4.ttf"
      >
        {tagline}
        <meshStandardMaterial
          attach="material"
          color={accent}
          emissive={accent}
          emissiveIntensity={0.75}
          toneMapped={false}
        />
      </Text>
    </group>
  );
}

function Booth({
  position,
  rotation,
  boothScale,
  id,
  name,
  color,
  accent,
  counterColor,
  videoUrl,
  headerLogoUrl,
  lighting,
  placedImages,
}: {
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
  placedImages: PlacedImage[];
}) {
  const setActiveBooth = useStore((state) => state.setActiveBooth);

  return (
    <group position={position} rotation={rotation} scale={boothScale}>
      {/* Back Wall with Luxury Trim */}
      <mesh position={[0, 3, -4]} receiveShadow castShadow>
        <boxGeometry args={[12, 6, 0.5]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.6} />
      </mesh>
      
      {/* Accent Wall Pillars */}
      <mesh position={[-5.8, 3, -3.9]}>
        <boxGeometry args={[0.2, 6.2, 0.6]} />
        <meshStandardMaterial color={accent} metalness={1} roughness={0.1} />
      </mesh>
      <mesh position={[5.8, 3, -3.9]}>
        <boxGeometry args={[0.2, 6.2, 0.6]} />
        <meshStandardMaterial color={accent} metalness={1} roughness={0.1} />
      </mesh>

      {/* Side Walls */}
      <mesh position={[-5.75, 3, -2]} receiveShadow castShadow>
        <boxGeometry args={[0.5, 6, 4]} />
        <meshStandardMaterial color={color} roughness={0.4} />
      </mesh>
      <mesh position={[5.75, 3, -2]} receiveShadow castShadow>
        <boxGeometry args={[0.5, 6, 4]} />
        <meshStandardMaterial color={color} roughness={0.4} />
      </mesh>

      {/* Floor Pad with Recessed LED Strip */}
      <mesh position={[0, 0.05, -1.5]} receiveShadow>
        <boxGeometry args={[12, 0.1, 5.5]} />
        <meshStandardMaterial color="#f0ede4" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.06, 1.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[12, 0.05]} />
        <meshStandardMaterial color={lighting.ledStripColor} emissive={lighting.ledStripColor} emissiveIntensity={lighting.ledStripIntensity} />
      </mesh>

      {/* Header fascia — Vertex: physical satin acrylic slab; others: metallic canopy */}
      <mesh position={[0, 6.5, -4]} castShadow>
        <boxGeometry args={[12.5, 1.5, 0.6]} />
        {headerLogoUrl ? (
          <meshPhysicalMaterial
            color="#fcfcfc"
            roughness={0.2}
            metalness={0}
            clearcoat={0.48}
            clearcoatRoughness={0.22}
            envMapIntensity={0.15}
            reflectivity={0.35}
          />
        ) : (
          <meshStandardMaterial color={color} metalness={0.8} roughness={0.2} />
        )}
      </mesh>

      {/* Branding: optional PNG on canopy, else gold title only */}
      {headerLogoUrl ? (
        <Suspense fallback={null}>
          <BoothHeaderLogo url={headerLogoUrl} tagline={name} accent={accent} />
        </Suspense>
      ) : (
        <Text
          position={[0, 6.5, -3.6]}
          fontSize={0.8}
          color={accent}
          anchorX="center"
          anchorY="middle"
          font="https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfMZhrib2Bg-4.ttf"
        >
          {name}
          <meshStandardMaterial attach="material" color={accent} emissive={accent} emissiveIntensity={0.15} />
        </Text>
      )}

      {/* Interactive Concierge Desk */}
      <group position={[0, 0.5, 0]}>
        <mesh position={[0, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[4, 1, 1]} />
          <meshStandardMaterial color={counterColor} metalness={0.1} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
          <boxGeometry args={[4.2, 0.1, 1.2]} />
          <meshStandardMaterial color={accent} metalness={0.4} roughness={0.2} />
        </mesh>

        {/* Counter LED TV */}
        <group position={[1.2, 0.8, -0.2]} rotation={[-0.2, -0.3, 0]}>
          <mesh castShadow>
            <boxGeometry args={[1.6, 1.0, 0.1]} />
            <meshStandardMaterial color="#111" metalness={0.8} roughness={0.2} />
          </mesh>
          <Suspense fallback={<meshBasicMaterial color="#000" />}>
            <LedScreenSurface args={[1.5, 0.9]} url={videoUrl} position={[0, 0, 0.01]} />
          </Suspense>
          <mesh position={[0, -0.6, 0]}>
            <boxGeometry args={[0.4, 0.2, 0.2]} />
            <meshStandardMaterial color="#111" />
          </mesh>
        </group>

        {/* Invisible Click Target for UI Overlay */}
        <mesh
          position={[0, 1, 0]}
          visible={false}
          onClick={(e) => {
            e.stopPropagation();
            const offset = rotation[1] > 0 ? 6 : -6;
            const teleportPos: [number, number, number] = [position[0] + offset, 1.7, position[2]];
            setActiveBooth(name, teleportPos);
            document.exitPointerLock();
          }}
          onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
          onPointerOut={() => { document.body.style.cursor = 'auto'; }}
        >
          <boxGeometry args={[5, 3, 3]} />
        </mesh>

        {/* Hostess: behind reception counter, facing aisle (+Z booth local); anchored to desk group */}
        <Suspense fallback={null}>
          <BoothHostessGreeter boothId={id} />
        </Suspense>
      </group>

      {/* Main Display Screen (Large TV) */}
      <group position={[0, 3, -3.8]}>
        <mesh castShadow>
          <boxGeometry args={[6.4, 3.6, 0.2]} />
          <meshStandardMaterial color="#111" metalness={0.9} roughness={0.1} />
        </mesh>
        <group position={[0, 0, 0.11]}>
          <Suspense fallback={<meshBasicMaterial color="#000" />}>
            <LedScreenSurface args={[6.2, 3.4]} url={videoUrl} />
          </Suspense>
        </group>
      </group>


      <spotLight
        position={[0, 7.5, -1.2]}
        angle={0.45}
        penumbra={0.7}
        intensity={lighting.spotlightIntensity}
        color={lighting.spotlightColor}
        distance={18}
        decay={2}
        target-position={[0, 3, -3.8]}
      />

      {/* Scale Model Pedestal */}
      <group position={[-3, 0.5, -1.5]}>
        <Cylinder args={[0.8, 0.8, 1, 32]} position={[0, 0, 0]} castShadow receiveShadow>
          <meshStandardMaterial color="#ffffff" roughness={0.1} metalness={0.1} />
        </Cylinder>
        <Box args={[0.5, 1.5, 0.5]} position={[0, 1.25, 0]} castShadow>
          <meshStandardMaterial color="#fff" roughness={0.1} metalness={0.1} />
        </Box>
      </group>

      <BoothStandee name={name} accent={accent} />

      {/* CMS-placed custom images */}
      {placedImages.map((img) => (
        <Suspense key={img.id} fallback={null}>
          <BoothPlacedImage item={img} />
        </Suspense>
      ))}
    </group>
  );
}

function BoothPlacedImage({ item }: { item: PlacedImage }) {
  const tex = useTexture(item.url);
  useLayoutEffect(() => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
  }, [tex]);
  return (
    <mesh position={item.position} rotation={item.rotation}>
      <planeGeometry args={item.size} />
      <meshStandardMaterial
        map={tex}
        transparent
        alphaTest={0.05}
        toneMapped={false}
        roughness={0.5}
        depthWrite
        polygonOffset
        polygonOffsetFactor={-2}
        polygonOffsetUnits={-2}
      />
    </mesh>
  );
}

/* ─── Futuristic Vertex Elite Studio Booth ─── */
export function VertexEliteBooth({
  position, rotation, boothScale, id, name, color, accent, counterColor,
  videoUrl, lighting, placedImages, brochureUrl, priceListUrl, siteMapUrl,
  cmsPreview,
  cmsPlacedImageEdit,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  boothScale: [number, number, number];
  id: string;
  name: string;
  color: string;
  accent: string;
  counterColor: string;
  videoUrl: string;
  lighting: import('../data/boothLayouts').BoothLighting;
  placedImages: PlacedImage[];
  brochureUrl?: string;
  priceListUrl?: string;
  siteMapUrl?: string;
  /** When true, skip the invisible “enter booth” hitbox (expo hall only). */
  cmsPreview?: boolean;
  cmsPlacedImageEdit?: {
    selectedImageId: string | null;
    onSelectImage: (id: string | null) => void;
    onDragImage: (id: string, pos: [number, number, number]) => void;
  };
}) {
  const setActiveBooth = useStore((s) => s.setActiveBooth);
  const glow = accent;
  const dark = '#0c0c12';
  const glass = '#1a1a28';

  return (
    <group position={position} rotation={rotation} scale={boothScale}>
      {/* ── Dark reflective floor ── */}
      <mesh position={[0, 0.02, -1.5]} receiveShadow>
        <boxGeometry args={[13, 0.04, 7]} />
        <meshStandardMaterial color="#0a0a10" roughness={0.07} metalness={0.94} />
      </mesh>
      {/* Floor LED edge strips */}
      {[[-6.3, 0.04, -1.5], [6.3, 0.04, -1.5]].map(([x, y, z], i) => (
        <mesh key={`fstrip-${i}`} position={[x, y, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.06, 7]} />
          <meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={3.5} toneMapped={false} />
        </mesh>
      ))}
      {/* Front threshold LED strip */}
      <mesh position={[0, 0.04, 2.05]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[13, 0.08]} />
        <meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={4} toneMapped={false} />
      </mesh>

      {/* ── Back wall ── */}
      <mesh position={[0, 3.2, -4.5]} receiveShadow>
        <boxGeometry args={[13, 6.4, 0.35]} />
        <meshStandardMaterial color={dark} roughness={0.2} metalness={0.9} />
      </mesh>
      {/* Vertical accent LED strips on back wall */}
      {[-6.2, 6.2].map((x, i) => (
        <mesh key={`vled-${i}`} position={[x, 3.2, -4.28]}>
          <boxGeometry args={[0.06, 6.4, 0.02]} />
          <meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={4.5} toneMapped={false} />
        </mesh>
      ))}
      {/* Horizontal LED strip top of back wall */}
      <mesh position={[0, 6.42, -4.28]}>
        <boxGeometry args={[12.5, 0.06, 0.02]} />
        <meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={4} toneMapped={false} />
      </mesh>
      {/* Horizontal LED strip bottom */}
      <mesh position={[0, 0.08, -4.28]}>
        <boxGeometry args={[12.5, 0.06, 0.02]} />
        <meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={3} toneMapped={false} />
      </mesh>

      {/* ── Side walls — glass-dark panels ── */}
      {[[-6.2, 1], [6.2, 1]].map(([x], i) => (
        <mesh key={`side-${i}`} position={[x, 3.2, -1.5]} receiveShadow>
          <boxGeometry args={[0.25, 6.4, 6]} />
          <meshStandardMaterial color={glass} roughness={0.12} metalness={0.78} transparent opacity={0.93} />
        </mesh>
      ))}
      {/* Side wall inner LED strips */}
      {[-6.05, 6.05].map((x, i) => (
        <mesh key={`sided-${i}`} position={[x, 0.08, -1.5]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.04, 6]} />
          <meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={2.5} toneMapped={false} />
        </mesh>
      ))}

      {/* ── Ceiling slab ── */}
      <mesh position={[0, 6.55, -1.5]}>
        <boxGeometry args={[13, 0.2, 7]} />
        <meshStandardMaterial color="#0a0a10" roughness={0.22} metalness={0.92} />
      </mesh>

      {/* Ceiling oval LED halo — smaller torus so it stays inside the booth shell (no wall clip) */}
      <mesh position={[0, 6.32, -1.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.75, 0.11, 32, 160]} />
        <meshStandardMaterial
          color={glow}
          emissive={glow}
          emissiveIntensity={3.5}
          toneMapped={false}
          polygonOffset
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
        />
      </mesh>
      <pointLight position={[0, 6.22, -1.8]} intensity={16} color={glow} distance={11} decay={2} />

      {/* ── Back canopy slab ── */}
      <mesh position={[0, 6.84, -4.38]}>
        <boxGeometry args={[13.2, 1.1, 0.74]} />
        <meshStandardMaterial color="#08080f" roughness={0.08} metalness={0.92} />
      </mesh>
      <mesh position={[0, 7.395, -4.38]}>
        <boxGeometry args={[13.18, 0.05, 0.76]} />
        <meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={0.9} metalness={0.95} roughness={0.06} toneMapped={false} />
      </mesh>

      {/* ── FRONT ENTRANCE FASCIA — header at z≈+1.84, fully visible from the aisle ──
           Ceiling front edge is at z = −1.5 + 3.5 = +2.0.
           Fascia slab: center z=1.84, depth=0.32 → front face z=2.0.
           Sign center z=2.09, depth=0.18 → back=2.0 (flush), front=2.18 (protrudes). ── */}

      {/* Main fascia structural slab */}
      <mesh position={[0, 6.12, 1.84]}>
        <boxGeometry args={[13.2, 1.22, 0.32]} />
        <meshStandardMaterial color="#08080f" roughness={0.07} metalness={0.93} />
      </mesh>

      {/* Gold top rail */}
      <mesh position={[0, 6.74, 1.84]}>
        <boxGeometry args={[13.18, 0.055, 0.34]} />
        <meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={1.0} metalness={0.96} roughness={0.05} toneMapped={false} />
      </mesh>
      {/* Gold bottom rail */}
      <mesh position={[0, 5.50, 1.84]}>
        <boxGeometry args={[13.18, 0.055, 0.34]} />
        <meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={1.0} metalness={0.96} roughness={0.05} toneMapped={false} />
      </mesh>
      {/* Gold left/right end caps */}
      {[-6.56, 6.56].map((x, i) => (
        <mesh key={`ffront-${i}`} position={[x, 6.12, 1.84]}>
          <boxGeometry args={[0.055, 1.18, 0.34]} />
          <meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={0.88} metalness={0.96} roughness={0.05} toneMapped={false} />
        </mesh>
      ))}

      {/* Ceiling-to-fascia join cap */}
      <mesh position={[0, 6.545, 1.84]}>
        <boxGeometry args={[13.2, 0.12, 0.34]} />
        <meshStandardMaterial color="#07070e" metalness={0.95} roughness={0.08} />
      </mesh>

      {/* Underside LED strip */}
      <mesh position={[0, 5.49, 1.9]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[12.8, 0.06]} />
        <meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={4.5} toneMapped={false} />
      </mesh>

      {/* ── VERTEX ELITE sign on front face of fascia, protrudes toward aisle ── */}
      <Suspense fallback={null}>
        <VertexEliteCanopyBranding glow={glow} />
      </Suspense>

      {/* ── Main LED wall display (large) ── */}
      <group position={[0, 3.2, -4.25]}>
        <mesh>
          <boxGeometry args={[8.5, 4.5, 0.12]} />
          <meshStandardMaterial color="#030308" metalness={0.96} roughness={0.05} />
        </mesh>
        <mesh position={[0, 0, 0.02]}>
          <boxGeometry args={[8.7, 4.7, 0.01]} />
          <meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={0.85} transparent opacity={0.38} toneMapped={false} />
        </mesh>
        <group position={[0, 0, 0.07]}>
          <Suspense fallback={<meshBasicMaterial color="#000" />}>
            <LedScreenSurface args={[8.3, 4.3]} url={videoUrl} />
          </Suspense>
        </group>
      </group>

      {/* ── Floating reception desk ── */}
      <group position={[0, 0.55, 0.8]}>
        <mesh>
          <boxGeometry args={[5, 1.1, 0.9]} />
          <meshStandardMaterial color="#111118" roughness={0.1} metalness={0.85} />
        </mesh>
        <mesh position={[0, 0.56, 0]}>
          <boxGeometry args={[5.2, 0.06, 1.0]} />
          <meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={0.8} metalness={0.6} roughness={0.2} />
        </mesh>
        {/* Desk front LED strip */}
        <mesh position={[0, 0, 0.46]}>
          <boxGeometry args={[5, 0.04, 0.01]} />
          <meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={3.5} toneMapped={false} />
        </mesh>
        {/* Counter tablet display */}
        <group position={[1.5, 0.9, -0.1]} rotation={[-0.25, -0.2, 0]}>
          <mesh>
            <boxGeometry args={[1.4, 0.9, 0.06]} />
            <meshStandardMaterial color="#05050a" metalness={0.92} roughness={0.06} />
          </mesh>
        </group>
        {/* Hostess */}
        <Suspense fallback={null}>
          <BoothHostessGreeter boothId={id} />
        </Suspense>
      </group>

      {/* ── CTA kiosk — front-right by reception: path stays open (center x clear), screen + branding visible ── */}
      <VertexEliteCtaKiosk
        glow={glow}
        brochureUrl={brochureUrl}
        priceListUrl={priceListUrl}
        siteMapUrl={siteMapUrl}
        position={[4.48, 0.03, 2.02]}
        rotation={[0, 0.13, 0]}
      />

      {/* Click target — hall only (CMS reuses this mesh but must not open the expo booth UI). */}
      {!cmsPreview && (
        <mesh
          position={[0, 1.5, 0.8]}
          visible={false}
          onClick={(e) => {
            e.stopPropagation();
            const offset = rotation[1] > 0 ? 7 : -7;
            const tp: [number, number, number] = [position[0] + offset, 1.7, position[2]];
            setActiveBooth(name, tp);
            document.exitPointerLock();
          }}
          onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
          onPointerOut={() => { document.body.style.cursor = 'auto'; }}
        >
          <boxGeometry args={[6, 3, 4]} />
        </mesh>
      )}

      {/* ── Lounge chairs — no castShadow on small pieces ── */}
      {[[-3.5, 0, 1.8], [3.5, 0, 1.8]].map(([cx, cy, cz], ci) => (
        <group key={`chair-${ci}`} position={[cx, cy, cz]} rotation={[0, ci === 0 ? 0.3 : -0.3, 0]}>
          <mesh position={[0, 0.22, 0]}>
            <boxGeometry args={[0.9, 0.18, 0.9]} />
            <meshStandardMaterial color="#1a1a22" roughness={0.35} metalness={0.6} />
          </mesh>
          <mesh position={[0, 0.36, 0]}>
            <boxGeometry args={[0.82, 0.1, 0.82]} />
            <meshStandardMaterial color="#222230" roughness={0.7} metalness={0.15} />
          </mesh>
          <mesh position={[0, 0.52, -0.38]}>
            <boxGeometry args={[0.82, 0.35, 0.1]} />
            <meshStandardMaterial color="#222230" roughness={0.65} metalness={0.15} />
          </mesh>
          {[[-0.35, 0, -0.35], [0.35, 0, -0.35], [-0.35, 0, 0.35], [0.35, 0, 0.35]].map(([lx, , lz], li) => (
            <mesh key={`leg-${li}`} position={[lx, 0.07, lz]}>
              <cylinderGeometry args={[0.025, 0.025, 0.14, 6]} />
              <meshStandardMaterial color="#888" metalness={0.95} roughness={0.1} />
            </mesh>
          ))}
        </group>
      ))}

      {/* ── Side tables ── */}
      {[[-2.4, 0, 2.0], [2.4, 0, 2.0]].map(([tx, ty, tz], ti) => (
        <group key={`table-${ti}`} position={[tx, ty, tz]}>
          <mesh position={[0, 0.32, 0]}>
            <cylinderGeometry args={[0.3, 0.3, 0.04, 16]} />
            <meshStandardMaterial color="#ccc" roughness={0.12} metalness={0.2} transparent opacity={0.65} />
          </mesh>
          <mesh position={[0, 0.16, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 0.32, 6]} />
            <meshStandardMaterial color="#333" metalness={0.9} roughness={0.15} />
          </mesh>
        </group>
      ))}

      {/* ── Indoor plants ── */}
      {[[-5.2, 0, -3.8], [5.2, 0, -3.8], [-5.2, 0, 1.0], [5.2, 0, 1.0]].map(([px, py, pz], pi) => (
        <group key={`plant-${pi}`} position={[px, py, pz]}>
          <mesh position={[0, 0.35, 0]}>
            <cylinderGeometry args={[0.28, 0.22, 0.7, 10]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.5} metalness={0.6} />
          </mesh>
          <mesh position={[0, 1.1, 0]}>
            <cylinderGeometry args={[0.035, 0.045, 0.8, 5]} />
            <meshStandardMaterial color="#3d2b15" roughness={0.85} />
          </mesh>
          {/* 2 spheres instead of 4 for foliage */}
          {[[0, 1.68, 0, 0.38], [0, 1.9, 0, 0.24]].map(([fx, fy, fz, r], fi) => (
            <mesh key={`leaf-${fi}`} position={[fx, fy, fz]}>
              <sphereGeometry args={[r, 8, 7]} />
              <meshStandardMaterial color="#1a5c2a" roughness={0.75} />
            </mesh>
          ))}
        </group>
      ))}

      {/* ── Pedestal ── */}
      <group position={[-3.5, 0, -2.5]}>
        <Cylinder args={[0.7, 0.7, 0.9, 20]} position={[0, 0.45, 0]}>
          <meshStandardMaterial color="#111116" roughness={0.1} metalness={0.9} />
        </Cylinder>
        <mesh position={[0, 0.91, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.55, 0.68, 32]} />
          <meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={3} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
        <Box args={[0.45, 1.4, 0.45]} position={[0, 1.6, 0]}>
          <meshStandardMaterial color="#fff" roughness={0.1} metalness={0.1} />
        </Box>
      </group>

      {/* ── Lighting — 2 lights only (no castShadow here, global light casts shadow) ── */}
      <pointLight position={[0, 5.5, -1.5]} intensity={lighting.spotlightIntensity * 0.55} color={lighting.spotlightColor} distance={18} decay={2} />
      <pointLight position={[0, 5.0, -4.0]} intensity={8} color={glow} distance={12} decay={2} />

      {placedImages.map((img) => (
        <Suspense key={img.id} fallback={null}>
          {cmsPlacedImageEdit ? (
            <BoothPlacedImageInteractive
              item={img}
              selected={img.id === cmsPlacedImageEdit.selectedImageId}
              onSelect={() => cmsPlacedImageEdit.onSelectImage(img.id)}
              onDrag={(pos) => cmsPlacedImageEdit.onDragImage(img.id, pos)}
            />
          ) : (
            <BoothPlacedImage item={img} />
          )}
        </Suspense>
      ))}
    </group>
  );
}

/** Roll-up style stand facing visitors approaching from the hall center */
function BoothStandee({ name, accent }: { name: string; accent: string }) {
  const w = 0.95;
  const h = 1.55;
  const frameT = 0.04;
  // Local +X = toward TV side of counter; +Z = aisle — matches standee beside desk edge
  const standeePosition: [number, number, number] = [2.76, 0, 3.4];
  return (
    <group position={standeePosition}>
      {/* Weighted base plate */}
      <mesh position={[0, 0.0, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.55, 0.08, 0.35]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.75} roughness={0.25} />
      </mesh>
      {/* Centre pole */}
      <mesh position={[0, 0.005, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.04, 1.55, 12]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.85} roughness={0.2} />
      </mesh>
      {/* Poster panel + gold frame */}
      <group position={[0, 1.02, 0]}>
        <mesh rotation={[0, 0, 0]}>
          <planeGeometry args={[w, h]} />
          <meshStandardMaterial color="#faf8f4" roughness={0.55} metalness={0.05} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, h / 2 + frameT / 2, 0.01]}>
          <boxGeometry args={[w + frameT * 2, frameT, 0.02]} />
          <meshStandardMaterial color={accent} metalness={0.9} roughness={0.2} />
        </mesh>
        <mesh position={[0, -h / 2 - frameT / 2, 0.01]}>
          <boxGeometry args={[w + frameT * 2, frameT, 0.02]} />
          <meshStandardMaterial color={accent} metalness={0.9} roughness={0.2} />
        </mesh>
        <mesh position={[-w / 2 - frameT / 2, 0, 0.01]}>
          <boxGeometry args={[frameT, h, 0.02]} />
          <meshStandardMaterial color={accent} metalness={0.9} roughness={0.2} />
        </mesh>
        <mesh position={[w / 2 + frameT / 2, 0, 0.01]}>
          <boxGeometry args={[frameT, h, 0.02]} />
          <meshStandardMaterial color={accent} metalness={0.9} roughness={0.2} />
        </mesh>
        <Text
          position={[0, 0.15, 0.02]}
          fontSize={0.11}
          color="#1a1a1a"
          anchorX="center"
          anchorY="middle"
          maxWidth={w - 0.12}
          textAlign="center"
          font="https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfMZhrib2Bg-4.ttf"
        >
          {name}
        </Text>
        <Text
          position={[0, -0.35, 0.02]}
          fontSize={0.055}
          color={accent}
          anchorX="center"
          anchorY="middle"
          maxWidth={w - 0.12}
          textAlign="center"
          font="https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfMZhrib2Bg-4.ttf"
        >
          LUXURY RESIDENCES
        </Text>
      </group>
    </group>
  );
}

function prepareHallTreeModel(source: THREE.Object3D, heightScale: number) {
  const root = source.clone(true) as THREE.Object3D;
  root.rotation.set(0, 0, 0);
  root.scale.set(1, 1, 1);
  root.updateMatrixWorld(true);
  root.traverse((obj) => {
    const m = obj as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = true;
    }
  });
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  const h = Math.max(size.y, 1e-6);
  root.scale.setScalar((HALL_TREE_TARGET_HEIGHT / h) * heightScale);
  root.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(root);
  const c = new THREE.Vector3();
  box2.getCenter(c);
  root.position.sub(c);
  root.updateMatrixWorld(true);
  const box3 = new THREE.Box3().setFromObject(root);
  root.position.y -= box3.min.y;
  root.updateMatrixWorld(true);
  return root;
}

function Plant({
  position,
  scale = 1,
}: {
  position: [number, number, number];
  scale?: number;
}) {
  const { scene } = useGLTF(HALL_TREE_MODEL_URL) as { scene: THREE.Object3D };
  const model = useMemo(() => prepareHallTreeModel(scene, scale), [scene, scale]);
  return (
    <group position={position}>
      <primitive object={model} />
    </group>
  );
}

function TickerRing({ radius, height, yPos, text, speed, reverse, color, bgColor }: any) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.Texture();

    const fullText = `${text} • ${text} • ${text} • ${text} • `;
    canvas.width = 8192;
    canvas.height = 200;

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#d4af37';
    ctx.fillRect(0, 0, canvas.width, 10);
    ctx.fillRect(0, canvas.height - 10, canvas.width, 10);

    ctx.font = 'bold 118px "Inter", sans-serif';
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = color;
    ctx.shadowBlur = 28;

    ctx.fillText(fullText, canvas.width / 2, canvas.height / 2 + 2);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 1);
    tex.anisotropy = 16;
    return tex;
  }, [text, color, bgColor]);

  useFrame((state, delta) => {
    texture.offset.x += delta * speed * (reverse ? -1 : 1);
  });

  return (
    <mesh position={[0, yPos, 0]}>
      <cylinderGeometry args={[radius, radius, height, 64]} />
      <meshStandardMaterial
        map={texture}
        emissiveMap={texture}
        emissive="#ffffff"
        emissiveIntensity={0.8}
        roughness={0.2}
        metalness={0.8}
      />
    </mesh>
  );
}

function FeaturedProperty({ position }: { position: [number, number, number] }) {
  const textGroupRef = useRef<any>(null);
  const graphicRingRef = useRef<any>(null);

  useFrame((state, delta) => {
    const time = state.clock.getElapsedTime();
    if (textGroupRef.current) {
      textGroupRef.current.rotation.y += delta * 0.15;
    }
    if (graphicRingRef.current) {
      graphicRingRef.current.rotation.y += delta * 0.5;
    }
  });

  return (
    <group position={position}>
      {/* --- CIRCULAR HELP DESK (on main hall floor — recessed stage disc removed) --- */}
      <group position={[0, 0, 0]}>
        {/* Main Circular Counter Structure */}
        <group rotation={[0, -Math.PI / 6, 0]}>
          {/* Desk Body (Polished White Marble) */}
          <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[5.8, 5.8, 1.1, 128, 1, true, 0, Math.PI * 2]} />
            <meshStandardMaterial color="#ffffff" roughness={0.1} metalness={0.1} side={THREE.DoubleSide} />
          </mesh>

          {/* Champagne Gold Mid-Belt Detail */}
          <mesh position={[0, 0.55, 0]}>
            <cylinderGeometry args={[5.82, 5.82, 0.3, 128, 1, true, 0, Math.PI * 2]} />
            <meshStandardMaterial color="#d4af37" metalness={1} roughness={0.1} side={THREE.DoubleSide} />
          </mesh>

          {/* Desk Top Surface (Premium Marble) */}
          <mesh position={[0, 1.1, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <ringGeometry args={[5, 5.85, 128, 1, 0, Math.PI * 2]} />
            <meshStandardMaterial color="#ffffff" roughness={0.05} metalness={0.2} side={THREE.DoubleSide} />
          </mesh>

          {/* Under-counter LED Glow */}
          <mesh position={[0, 1.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[5.7, 5.8, 128, 1, 0, Math.PI * 2]} />
            <meshStandardMaterial color="#fff5e6" emissive="#fff5e6" emissiveIntensity={1.5} side={THREE.DoubleSide} />
          </mesh>

          {/* Front Branding & Concierge Panel */}
          <group position={[0, 0, 0]} rotation={[0, Math.PI * 0.8, 0]}>
            <mesh position={[0, 0.55, 5.85]} castShadow>
              <boxGeometry args={[3, 1.1, 0.1]} />
              <meshStandardMaterial color="#ffffff" roughness={0.1} />
            </mesh>
            <Text
              position={[0, 0.65, 5.96]}
              fontSize={0.28}
              color="#d4af37"
              font="https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfMZhrib2Bg-4.ttf"
              anchorX="center"
              anchorY="middle"
            >
              CONCIERGE
              <meshStandardMaterial attach="material" color="#d4af37" emissive="#d4af37" emissiveIntensity={0.5} />
            </Text>
            <Text
              position={[0, 0.4, 5.96]}
              fontSize={0.1}
              color="#333"
              font="https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfMZhrib2Bg-4.ttf"
              anchorX="center"
              anchorY="middle"
              letterSpacing={0.1}
            >
              PREMIUM REAL ESTATE SUMMIT
            </Text>
          </group>

          {/* Integrated iMac-style stations — evenly spaced on full ring */}
          {Array.from({ length: 5 }).map((_, i) => {
            const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
            const x = 5.3 * Math.cos(angle);
            const z = 5.3 * Math.sin(angle);
            return (
              <group key={i} position={[x, 0.85, z]} rotation={[0, -angle - Math.PI / 2, 0]}>
                <mesh position={[0, 0, 0]}>
                  <boxGeometry args={[0.6, 0.4, 0.02]} />
                  <meshStandardMaterial color="#111" metalness={0.9} roughness={0.1} />
                </mesh>
                <mesh position={[0, -0.25, -0.05]}>
                  <boxGeometry args={[0.1, 0.3, 0.05]} />
                  <meshStandardMaterial color="#d4af37" metalness={1} />
                </mesh>
              </group>
            );
          })}
          <Suspense fallback={null}>
            <HelpDeskCustomGirl />
          </Suspense>
        </group>
      </group>

      {/* --- GIANT SUSPENDED JUMBOTRON --- */}
      <group position={[0, 14, 0]}>
        {/* Support Cables */}
        <mesh position={[-5, 3, -5]}>
          <cylinderGeometry args={[0.03, 0.03, 15, 8]} />
          <meshStandardMaterial color="#d4af37" metalness={1} />
        </mesh>
        <mesh position={[5, 3, -5]}>
          <cylinderGeometry args={[0.03, 0.03, 15, 8]} />
          <meshStandardMaterial color="#d4af37" metalness={1} />
        </mesh>
        <mesh position={[-5, 3, 5]}>
          <cylinderGeometry args={[0.03, 0.03, 15, 8]} />
          <meshStandardMaterial color="#d4af37" metalness={1} />
        </mesh>
        <mesh position={[5, 3, 5]}>
          <cylinderGeometry args={[0.03, 0.03, 15, 8]} />
          <meshStandardMaterial color="#d4af37" metalness={1} />
        </mesh>

        <group>
          {/* Clean upper crown ring (text removed) */}
          <mesh position={[0, 3.5, 0]}>
            <cylinderGeometry args={[9.5, 9.5, 1.0, 96]} />
            <meshStandardMaterial color="#d4af37" metalness={0.95} roughness={0.2} />
          </mesh>

          {/* Main Displays (8-Sided) */}
          <group>
            {Array.from({ length: 8 }).map((_, i) => (
              <group key={i} rotation={[0, (i * Math.PI) / 4, 0]}>
                <group rotation={[0, Math.PI, 0]}>
                  <mesh position={[0, 0, 8.2]}>
                    <boxGeometry args={[6.27, 4.8, 0.2]} />
                    <meshStandardMaterial color="#111" metalness={0.5} roughness={0.2} />
                  </mesh>
                  <Suspense fallback={<meshBasicMaterial color="#000" />}>
                    <LedScreenSurface
                      args={[6.1, 4.5]}
                      url="/13391496_3840_2160_60fps.mp4"
                      position={[0, 0, 8.31]}
                    />
                  </Suspense>
                  <mesh position={[3.5, 0, 8.1]}>
                    <boxGeometry args={[0.2, 4.8, 0.3]} />
                    <meshStandardMaterial color="#d4af37" />
                  </mesh>
                </group>
              </group>
            ))}
          </group>

          {/* DIGITAL GRAPHIC RING - Re-aligned & Centered */}
          <group position={[0, -2.6, 0]}>
            <group ref={graphicRingRef}>
              <Torus args={[8.5, 0.03, 16, 128]} rotation={[Math.PI / 2, 0, 0]}>
                <meshStandardMaterial 
                  color="#d4af37" 
                  emissive="#d4af37" 
                  emissiveIntensity={1.5} 
                  transparent 
                  opacity={0.3} 
                  wireframe 
                />
              </Torus>
            </group>
          </group>

          <TickerRing
            radius={8.5}
            height={1.55}
            yPos={-3.8}
            text="FUTURE OF SMART LIVING • DIGITAL PROPERTY SHOWCASE • INVEST IN PREMIUM LIVING • FUTURISTIC REAL ESTATE EXPERIENCE"
            speed={0.06}
            reverse={false}
            color="#d4af37"
            bgColor="#111111"
          />

          <pointLight position={[0, -5, 0]} intensity={150} color="#d4af37" distance={40} decay={2} />
        </group>
      </group>

      {/* Main Center Area Spotlight */}
      <spotLight
        position={[0, 17, 0]}
        angle={0.9}
        penumbra={0.6}
        intensity={250}
        color="#ffffff"
        castShadow
      />
    </group>
  );
}

/** Sketchfab / numbered bones like `LeftArm_013`, `Hips_01` (see `scene (3).glb`). */
function hasScene3HostRig(root: THREE.Object3D) {
  let found = false;
  root.traverse((o) => {
    const b = o as THREE.Bone;
    if (b.isBone && (b.name === 'Hips_01' || /^LeftForeArm1_/.test(b.name))) found = true;
  });
  return found;
}

function hasFoldableArmRig(root: THREE.Object3D) {
  let found = false;
  root.traverse((o) => {
    const b = o as THREE.Bone;
    if (b.isBone && /^LeftArm_/.test(b.name)) found = true;
  });
  return found;
}

/**
 * Reception pose for `scene (3).glb`: small **additive** Euler deltas on the main arm chain only.
 * Do not touch forearm *twist* bones (`LeftForeArm1_` …) — they are chest-weighted and cause tearing.
 * Do not use broad regexes (they can hit unintended nodes on dense rigs).
 */
function applyScene3ReceptionPose(root: THREE.Object3D) {
  const addAllNamed = (name: string, dx: number, dy: number, dz: number) => {
    root.traverse((o) => {
      const b = o as THREE.Bone;
      if (b.isBone && b.name === name) {
        b.rotation.x += dx;
        b.rotation.y += dy;
        b.rotation.z += dz;
      }
    });
  };

  // “Hands low, modest clasp” — symmetric; keeps wrists below chest to avoid stop-gesture / behind-back look
  addAllNamed('LeftShoulder_012', 0.025, 0.07, -0.035);
  addAllNamed('RightShoulder_038', 0.025, -0.07, 0.035);
  addAllNamed('LeftArm_013', 0.42, 0.04, -0.14);
  addAllNamed('RightArm_039', 0.42, -0.04, 0.14);
  addAllNamed('LeftForeArm_014', 0.4, 0, 0.02);
  addAllNamed('RightForeArm_040', 0.4, 0, -0.02);
  addAllNamed('LeftHand_017', 0.06, -0.12, 0.04);
  addAllNamed('RightHand_043', 0.06, 0.12, -0.04);
}

/** Optional reception pose for rigs that match older office-girl bone names (absolute rotations). */
function applyFoldedHandsPose(root: THREE.Object3D) {
  const apply = (re: RegExp, rx: number, ry: number, rz: number) => {
    root.traverse((o) => {
      const b = o as THREE.Bone;
      if (b.isBone && re.test(b.name)) {
        b.rotation.set(rx, ry, rz, 'XYZ');
      }
    });
  };
  apply(/^LeftShoulder_/, 0.07, 0.14, -0.14);
  apply(/^RightShoulder_/, 0.07, -0.14, 0.14);
  apply(/^LeftArm_/, 1.22, -0.22, -0.58);
  apply(/^LeftForeArm_/, 0.55, 0.1, 0.08);
  apply(/^RightArm_/, 1.22, 0.22, 0.58);
  apply(/^RightForeArm_/, 0.55, -0.1, -0.08);
  apply(/^LeftHand_[0-9]/, 0.22, -0.38, 0.12);
  apply(/^RightHand_[0-9]/, 0.22, 0.38, -0.12);
}

function prepareHostessModel(
  sourceScene: THREE.Object3D,
  opts?: { skipManualArmPose?: boolean }
) {
  const root = cloneSkinnedHierarchy(sourceScene) as THREE.Object3D;
  root.rotation.set(0, 0, 0);
  root.scale.set(1, 1, 1);
  root.updateMatrixWorld(true);
  root.traverse((obj) => {
    const m = obj as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = true;
    }
  });
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  const horiz = Math.max(size.x, size.z, 1e-6);
  const sy = Math.max(size.y, 1e-6);
  const s = Math.min(HOSTESS_MAX_WIDTH / horiz, HOSTESS_MAX_HEIGHT / sy);
  root.scale.setScalar(s);
  root.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(root);
  const c = new THREE.Vector3();
  box2.getCenter(c);
  root.position.sub(c);
  root.updateMatrixWorld(true);
  if (!opts?.skipManualArmPose) {
    if (hasScene3HostRig(root)) {
      applyScene3ReceptionPose(root);
      root.updateMatrixWorld(true);
    } else if (hasFoldableArmRig(root)) {
      applyFoldedHandsPose(root);
      root.updateMatrixWorld(true);
    }
  }
  const box3 = new THREE.Box3().setFromObject(root);
  root.position.y -= box3.min.y;
  root.updateMatrixWorld(true);
  return root;
}

function ExpoHostessAvatar({
  position,
  rotation,
  idlePhase = 0,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  idlePhase?: number;
}) {
  const breathingRef = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(HOSTESS_MODEL_URL) as {
    scene: THREE.Object3D;
    animations: THREE.AnimationClip[];
  };

  const animCount = animations?.length ?? 0;
  const model = useMemo(
    () => prepareHostessModel(scene, { skipManualArmPose: animCount > 0 }),
    [scene, animCount]
  );

  /** Hips_01 / Mixamo-style rig: without a baked clip, skip spine/forearm procedural idle. */
  const isScene3Hostess = useMemo(() => {
    let ok = false;
    model.traverse((o) => {
      if (o.name === 'Hips_01') ok = true;
    });
    return ok;
  }, [model]);

  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  /** Paused clip holds a natural pose; stopping the action resets the rig to bind pose (T-pose). */
  const freezePoseActiveRef = useRef(false);
  const idleBonesRef = useRef<{
    head?: THREE.Bone;
    spine?: THREE.Bone;
    lFore?: THREE.Bone;
    rFore?: THREE.Bone;
    baseHead?: THREE.Euler;
    baseSpine?: THREE.Euler;
    baseLFore?: THREE.Euler;
    baseRFore?: THREE.Euler;
  }>({});

  useLayoutEffect(() => {
    const rec = idleBonesRef.current;
    rec.head = undefined;
    rec.spine = undefined;
    rec.lFore = undefined;
    rec.rFore = undefined;
    model.traverse((o) => {
      const b = o as THREE.Bone;
      if (!b.isBone) return;
      if (/^Head_[0-9]/.test(b.name)) rec.head = b;
      if (/^Spine2_/.test(b.name)) rec.spine = b;
      if (/^LeftForeArm_[0-9]/.test(b.name)) rec.lFore = b;
      if (/^RightForeArm_[0-9]/.test(b.name)) rec.rFore = b;
    });
    if (rec.head) rec.baseHead = rec.head.rotation.clone();
    if (rec.spine) rec.baseSpine = rec.spine.rotation.clone();
    if (rec.lFore) rec.baseLFore = rec.lFore.rotation.clone();
    if (rec.rFore) rec.baseRFore = rec.rFore.rotation.clone();
  }, [model]);

  useLayoutEffect(() => {
    freezePoseActiveRef.current = false;
    if (!animations?.length) {
      mixerRef.current = null;
      return;
    }
    const mixer = new THREE.AnimationMixer(model);
    mixerRef.current = mixer;
    const clip = animations[0];
    const action = mixer.clipAction(clip);
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.clampWhenFinished = false;
    action.setEffectiveWeight(1);
    action.play();
    const dur = clip.duration > 1e-6 ? clip.duration : 1;
    const seekT = Math.min(Math.max(dur * 0.18, 0.12), dur * 0.95);
    mixer.update(seekT);
    action.paused = true;
    freezePoseActiveRef.current = true;
    return () => {
      freezePoseActiveRef.current = false;
      action.stop();
      mixer.stopAllAction();
      mixerRef.current = null;
    };
  }, [model, animations]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const ph = idlePhase;

    if (breathingRef.current) {
      const br = Math.sin(t * 2.12 + ph) * 0.007;
      breathingRef.current.scale.set(1 + br * 0.35, 1 + br, 1 + br * 0.35);
    }

    if (freezePoseActiveRef.current) return;

    const rec = idleBonesRef.current;
    const procedural = !animations?.length;
    if (procedural) {
      const headAmp = isScene3Hostess ? 0.35 : 1;
      if (rec.head && rec.baseHead) {
        rec.head.rotation.x = rec.baseHead.x + Math.sin(t * 0.92 + ph) * 0.028 * headAmp;
        rec.head.rotation.y = rec.baseHead.y + Math.sin(t * 0.71 + ph * 1.7) * 0.048 * headAmp;
      }
      if (!isScene3Hostess && rec.spine && rec.baseSpine) {
        rec.spine.rotation.x = rec.baseSpine.x + Math.sin(t * 2.05 + ph) * 0.017;
      }
      if (!isScene3Hostess && rec.lFore && rec.baseLFore) {
        rec.lFore.rotation.x = rec.baseLFore.x + Math.sin(t * 1.22 + ph) * 0.032;
        rec.lFore.rotation.z = rec.baseLFore.z + Math.sin(t * 1.04 + ph * 0.5) * 0.036;
      }
      if (!isScene3Hostess && rec.rFore && rec.baseRFore) {
        rec.rFore.rotation.x = rec.baseRFore.x + Math.sin(t * 1.19 + ph * 1.08) * 0.032;
        rec.rFore.rotation.z = rec.baseRFore.z + Math.sin(t * 1.06 + ph * 0.55) * 0.036;
      }
    }
  });

  return (
    <group position={position} rotation={rotation}>
      <group ref={breathingRef}>
        <primitive object={model} />
      </group>
    </group>
  );
}

/**
 * Behind the procedural reception counter (parent = desk group). Faces +Z booth local (aisle).
 */
function BoothHostessGreeter({ boothId }: { boothId: string }) {
  return (
    <ExpoHostessAvatar
      position={BOOTH_HOSTESS_DESK_LOCAL}
      rotation={[0, BOOTH_HOSTESS_YAW, 0]}
      idlePhase={stringToPhase(boothId)}
    />
  );
}

function HelpDeskCustomGirl() {
  return (
    <ExpoHostessAvatar
      position={[1.72, 0, 3.28]}
      rotation={[0, -0.8, 0]}
      idlePhase={stringToPhase('concierge-desk')}
    />
  );
}

useGLTF.preload(HOSTESS_MODEL_URL);
useGLTF.preload(HALL_TREE_MODEL_URL);
