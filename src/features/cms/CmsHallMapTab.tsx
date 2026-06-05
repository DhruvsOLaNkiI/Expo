import React, { useState, useCallback, useRef, useMemo, type PointerEvent as RPointerEvent } from 'react';
import {
  HALL_WIDTH,
  HALL_DEPTH,
  HALL_HALF_WIDTH,
  HALL_HALF_DEPTH,
  HELP_DESK_RADIUS,
  BOOTH_ROW_X_WEST,
  BOOTH_ROW_X_EAST,
  EXPO_AISLE_WEST_X,
  EXPO_AISLE_EAST_X,
  defaultEntranceLobbyZ,
  type HallLayoutConfig,
  type BoothLayoutConfig,
  type BoothLayoutPatch,
} from '@/features/shared/data/boothLayouts';
import { DEFAULT_MAIN_EXPO_SPAWN } from '@/features/shared/data/registrationHall';
import { DEFAULT_EXPO_HALL_ID, type ExpoHallMeta } from '@/features/shared/data/expoHalls';
import { CmsApplyHallLayoutControls } from './CmsApplyHallLayoutControls';
import { CmsApplySelectedBoothLayout } from './CmsApplySelectedBoothLayout';
import { CmsApplyMultiBoothLayout } from './CmsApplyMultiBoothLayout';

export type CmsHallMapTabProps = {
  booths: BoothLayoutConfig[];
  /** All selected booth ids (multi-select). */
  selectedIds: string[];
  /** Last clicked booth — drives single-booth sidebar when one selected. */
  primarySelectedId: string;
  onSelectBooth: (id: string, opts?: { additive?: boolean }) => void;
  onClearSelection?: () => void;
  onPatchBooth: (id: string, patch: BoothLayoutPatch) => Promise<boolean>;
  hallLayout?: Partial<Pick<HallLayoutConfig, 'mainExpoSpawn' | 'mainExpoSpawnYaw'>>;
  onPatchHallLayout: (patch: Partial<Pick<HallLayoutConfig, 'mainExpoSpawn' | 'mainExpoSpawnYaw'>>) => void;
  /** Mini map in All Halls grid — hides toolbar and drag. */
  compact?: boolean;
  interactive?: boolean;
  /** When set, shows “Apply layout to other halls” in the map toolbar. */
  layoutCopy?: {
    halls: ExpoHallMeta[];
    activeHallId: string;
    onApplyLayoutFrom: (sourceHallId: string) => Promise<{ ok: boolean; applied: string[] }>;
  };
  /** Selected booth — apply this booth's placement to other halls. */
  selectedBoothLayout?: {
    slotIds: string[];
    boothNames: string[];
    halls: ExpoHallMeta[];
    activeHallId: string;
    onApplyFromHall: (
      slotIds: string[],
      sourceHallId: string,
      targetHallIds: string[],
    ) => Promise<{ ok: boolean; applied: string[] }>;
  };
};

const PAD = 4;
const VB_X = -(HALL_WIDTH / 2 + PAD);
const VB_Y = -(HALL_DEPTH / 2 + PAD);
const VB_W = HALL_WIDTH + PAD * 2;
const VB_H = HALL_DEPTH + PAD * 2;

const BASE_BOOTH_W = 12;
const BASE_BOOTH_D = 5.5;

const SNAP_OPTIONS = [0.5, 1, 2, 5] as const;
type SnapSize = (typeof SNAP_OPTIONS)[number];

function snap(v: number, size: number): number {
  return Math.round(v / size) * size;
}

function worldToSvg(wx: number, wz: number): { x: number; y: number } {
  return { x: wx, y: -wz };
}

function svgToWorld(sx: number, sy: number): { x: number; z: number } {
  return { x: sx, z: -sy };
}

type DragState = {
  boothId: string;
  offsetX: number;
  offsetY: number;
  startWorldX: number;
  startWorldZ: number;
  /** Multi-select drag: start X/Z per booth id. */
  groupStarts?: Record<string, { x: number; z: number }>;
};

type EntryDragState = {
  offsetX: number;
  offsetY: number;
  startWorldX: number;
  startWorldZ: number;
};

function GridLines({ step }: { step: number }) {
  const hw = HALL_WIDTH / 2;
  const hd = HALL_DEPTH / 2;
  const lines: React.ReactElement[] = [];
  for (let x = -hw; x <= hw; x += step) {
    const isAxis = x === 0;
    lines.push(
      <line
        key={`gv-${x}`}
        x1={x} y1={-hd} x2={x} y2={hd}
        stroke={isAxis ? 'rgba(212,175,55,0.18)' : 'rgba(212,175,55,0.06)'}
        strokeWidth={isAxis ? 0.12 : 0.05}
      />,
    );
  }
  for (let z = -hd; z <= hd; z += step) {
    const isAxis = z === 0;
    lines.push(
      <line
        key={`gh-${z}`}
        x1={-hw} y1={z} x2={hw} y2={z}
        stroke={isAxis ? 'rgba(212,175,55,0.18)' : 'rgba(212,175,55,0.06)'}
        strokeWidth={isAxis ? 0.12 : 0.05}
      />,
    );
  }
  return <>{lines}</>;
}

/**
 * Booths always render as wide horizontal blocks (no SVG rotation).
 * A small arrow on the aisle-facing side indicates direction.
 * Rotation editing is handled in the Layout tab sidebar.
 */
function BoothRect({
  booth,
  isSelected,
  isPrimary,
  isDragging,
  dragPos,
  onPointerDown,
  interactive = true,
}: {
  booth: BoothLayoutConfig;
  isSelected: boolean;
  isPrimary: boolean;
  isDragging: boolean;
  dragPos: { x: number; y: number } | null;
  onPointerDown: (e: RPointerEvent<SVGGElement>, id: string) => void;
  interactive?: boolean;
}) {
  const pos = isDragging && dragPos
    ? dragPos
    : worldToSvg(booth.position[0], booth.position[2]);

  const bw = BASE_BOOTH_W * booth.scale[0];
  const bd = BASE_BOOTH_D * booth.scale[2];

  const fill = booth.color || '#1a1a2e';
  const stroke = isPrimary ? '#d4af37' : isSelected ? '#a78bfa' : (booth.accent || '#555');
  const strokeW = isSelected ? 0.25 : 0.12;
  const opacity = isDragging ? 0.85 : 1;

  const shortName = booth.name.length > 14 ? booth.name.slice(0, 13) + '\u2026' : booth.name;

  // True booth-facing indicator from world yaw -> map vector.
  // Booth local +Z is "front". In map space, (x, z) projects to (x, -z).
  // So forward map vector is: [sin(yaw), -cos(yaw)].
  const yaw = booth.rotation[1];
  const fx = Math.sin(yaw);
  const fy = -Math.cos(yaw);
  const absFx = Math.abs(fx);
  const absFy = Math.abs(fy);
  let arrowPts = '';
  if (absFx >= absFy) {
    const arrowX = fx >= 0 ? bw / 2 + 0.42 : -bw / 2 - 0.42;
    arrowPts = fx >= 0
      ? `${arrowX - 0.25},-0.5 ${arrowX + 0.3},0 ${arrowX - 0.25},0.5`
      : `${arrowX + 0.25},-0.5 ${arrowX - 0.3},0 ${arrowX + 0.25},0.5`;
  } else {
    const arrowY = fy >= 0 ? bd / 2 + 0.42 : -bd / 2 - 0.42;
    arrowPts = fy >= 0
      ? `-0.5,${arrowY - 0.25} 0.5,${arrowY - 0.25} 0,${arrowY + 0.3}`
      : `-0.5,${arrowY + 0.25} 0.5,${arrowY + 0.25} 0,${arrowY - 0.3}`;
  }

  return (
    <g
      transform={`translate(${pos.x}, ${pos.y})`}
      style={{ opacity }}
    >
      <rect
        x={-bw / 2} y={-bd / 2}
        width={bw} height={bd}
        rx={0.3}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeW}
        style={{ cursor: interactive ? 'grab' : 'pointer' }}
        onPointerDown={(e) => onPointerDown(e as unknown as RPointerEvent<SVGGElement>, booth.id)}
      />
      <polygon
        points={arrowPts}
        fill={isPrimary ? '#d4af37' : isSelected ? '#a78bfa' : 'rgba(255,255,255,0.25)'}
        style={{ pointerEvents: 'none' }}
      />
      {isSelected && (
        <rect
          x={-bw / 2 - 0.15} y={-bd / 2 - 0.15}
          width={bw + 0.3} height={bd + 0.3}
          rx={0.4}
          fill="none"
          stroke={isPrimary ? '#d4af37' : '#a78bfa'}
          strokeWidth={0.08}
          strokeDasharray="0.4 0.3"
          opacity={0.5}
        />
      )}
      <text
        x={0} y={-0.2}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#fff"
        fontSize={Math.min(1.1, bw * 0.17)}
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {shortName}
      </text>
      <text
        x={0} y={0.85}
        textAnchor="middle"
        dominantBaseline="central"
        fill="rgba(255,255,255,0.35)"
        fontSize={Math.min(0.65, bw * 0.1)}
        fontFamily="monospace"
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {booth.scale[0].toFixed(2)} &times; {booth.scale[2].toFixed(2)}
      </text>
    </g>
  );
}

function SnapCrosshair({ pos }: { pos: { x: number; y: number } }) {
  const hw = HALL_WIDTH / 2;
  const hd = HALL_DEPTH / 2;
  return (
    <>
      <line x1={pos.x} y1={-hd} x2={pos.x} y2={hd} stroke="#d4af37" strokeWidth={0.06} opacity={0.3} strokeDasharray="0.5 0.4" />
      <line x1={-hw} y1={pos.y} x2={hw} y2={pos.y} stroke="#d4af37" strokeWidth={0.06} opacity={0.3} strokeDasharray="0.5 0.4" />
    </>
  );
}

export function CmsHallMapTab({
  booths,
  selectedIds,
  primarySelectedId,
  onSelectBooth,
  onClearSelection,
  onPatchBooth,
  hallLayout,
  onPatchHallLayout,
  compact = false,
  interactive = true,
  layoutCopy,
  selectedBoothLayout,
}: CmsHallMapTabProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [snapSize, setSnapSize] = useState<SnapSize>(1);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [dragSvgPos, setDragSvgPos] = useState<{ x: number; y: number } | null>(null);
  const [entryDrag, setEntryDrag] = useState<EntryDragState | null>(null);
  const [entrySvgPos, setEntrySvgPos] = useState<{ x: number; y: number } | null>(null);

  const gridStep = useMemo(() => (snapEnabled ? snapSize : 5), [snapEnabled, snapSize]);
  const currentEntry = useMemo<[number, number, number]>(() => {
    const s = hallLayout?.mainExpoSpawn;
    if (s && s.length === 3 && s.every((n) => Number.isFinite(n))) return s;
    return DEFAULT_MAIN_EXPO_SPAWN;
  }, [hallLayout?.mainExpoSpawn]);

  const svgPoint = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const svgP = pt.matrixTransform(ctm.inverse());
    return { x: svgP.x, y: svgP.y };
  }, []);

  const handlePointerDown = useCallback((e: RPointerEvent<SVGGElement>, boothId: string) => {
    e.stopPropagation();
    e.preventDefault();
    (e.target as SVGElement).setPointerCapture?.(e.pointerId);
    const additive = e.shiftKey || e.metaKey || e.ctrlKey;
    const booth = booths.find((b) => b.id === boothId);
    if (!booth) return;

    let dragGroup: string[];
    if (additive) {
      onSelectBooth(boothId, { additive: true });
      const toggled = selectedIds.includes(boothId)
        ? selectedIds.filter((x) => x !== boothId)
        : [...selectedIds, boothId];
      dragGroup = toggled.length > 0 ? toggled : [boothId];
    } else if (selectedIds.includes(boothId) && selectedIds.length > 1) {
      dragGroup = selectedIds;
    } else {
      onSelectBooth(boothId);
      dragGroup = [boothId];
    }
    if (!(dragGroup.length > 1 && dragGroup.includes(boothId))) {
      dragGroup = [boothId];
    }

    const groupStarts: Record<string, { x: number; z: number }> = {};
    for (const id of dragGroup) {
      const b = booths.find((x) => x.id === id);
      if (b) groupStarts[id] = { x: b.position[0], z: b.position[2] };
    }

    const { x: sx, y: sy } = svgPoint(e.clientX, e.clientY);
    const bpos = worldToSvg(booth.position[0], booth.position[2]);

    setDrag({
      boothId,
      offsetX: sx - bpos.x,
      offsetY: sy - bpos.y,
      startWorldX: booth.position[0],
      startWorldZ: booth.position[2],
      groupStarts: dragGroup.length > 1 ? groupStarts : undefined,
    });
    setDragSvgPos(bpos);
  }, [booths, onSelectBooth, selectedIds, svgPoint]);

  const handleEntryDown = useCallback((e: RPointerEvent<SVGGElement>) => {
    if (drag) return;
    e.stopPropagation();
    e.preventDefault();
    (e.target as SVGElement).setPointerCapture?.(e.pointerId);

    const [ex, , ez] = currentEntry;
    const entry = worldToSvg(ex, ez);
    const { x: sx, y: sy } = svgPoint(e.clientX, e.clientY);
    setEntryDrag({
      offsetX: sx - entry.x,
      offsetY: sy - entry.y,
      startWorldX: ex,
      startWorldZ: ez,
    });
    setEntrySvgPos(entry);
  }, [currentEntry, drag, svgPoint]);

  const handlePointerMove = useCallback((e: RPointerEvent<SVGSVGElement>) => {
    if (entryDrag) {
      const { x: sx, y: sy } = svgPoint(e.clientX, e.clientY);
      let rawX = sx - entryDrag.offsetX;
      let rawY = sy - entryDrag.offsetY;
      if (snapEnabled) {
        const w = svgToWorld(rawX, rawY);
        w.x = snap(w.x, snapSize);
        w.z = snap(w.z, snapSize);
        const snapped = worldToSvg(w.x, w.z);
        rawX = snapped.x;
        rawY = snapped.y;
      }
      setEntrySvgPos({ x: rawX, y: rawY });
      return;
    }
    if (!drag) return;
    const { x: sx, y: sy } = svgPoint(e.clientX, e.clientY);
    let rawX = sx - drag.offsetX;
    let rawY = sy - drag.offsetY;
    if (snapEnabled) {
      const w = svgToWorld(rawX, rawY);
      w.x = snap(w.x, snapSize);
      w.z = snap(w.z, snapSize);
      const snapped = worldToSvg(w.x, w.z);
      rawX = snapped.x;
      rawY = snapped.y;
    }
    setDragSvgPos({ x: rawX, y: rawY });
  }, [drag, entryDrag, snapEnabled, snapSize, svgPoint]);

  const handlePointerUp = useCallback(() => {
    if (entryDrag && entrySvgPos) {
      const world = svgToWorld(entrySvgPos.x, entrySvgPos.y);
      const hw = HALL_WIDTH / 2;
      const hd = HALL_DEPTH / 2;
      const x = Math.max(-hw + 1, Math.min(hw - 1, world.x));
      const z = Math.max(-hd + 1, Math.min(hd - 1, world.z));
      if (Math.abs(x - entryDrag.startWorldX) > 0.01 || Math.abs(z - entryDrag.startWorldZ) > 0.01) {
        const prevYaw = hallLayout?.mainExpoSpawnYaw;
        const yaw = Number.isFinite(prevYaw) ? (prevYaw as number) : Math.atan2(-x, z);
        onPatchHallLayout({
          mainExpoSpawn: [x, 1.7, z],
          mainExpoSpawnYaw: yaw,
        });
      }
      setEntryDrag(null);
      setEntrySvgPos(null);
      return;
    }

    if (!drag || !dragSvgPos) { setDrag(null); setDragSvgPos(null); return; }
    const world = svgToWorld(dragSvgPos.x, dragSvgPos.y);
    const dx = world.x - drag.startWorldX;
    const dz = world.z - drag.startWorldZ;

    if (drag.groupStarts && (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01)) {
      for (const [id, start] of Object.entries(drag.groupStarts)) {
        const b = booths.find((x) => x.id === id);
        if (!b) continue;
        void onPatchBooth(id, {
          position: [start.x + dx, b.position[1], start.z + dz],
        });
      }
    } else {
      const booth = booths.find((b) => b.id === drag.boothId);
      if (booth && (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01)) {
        void onPatchBooth(drag.boothId, {
          position: [world.x, booth.position[1], world.z],
        });
      }
    }
    setDrag(null);
    setDragSvgPos(null);
  }, [drag, dragSvgPos, entryDrag, entrySvgPos, booths, hallLayout?.mainExpoSpawnYaw, onPatchBooth, onPatchHallLayout]);

  const alignRow = useCallback((side: 'west' | 'east') => {
    const targetX = side === 'west' ? BOOTH_ROW_X_WEST : BOOTH_ROW_X_EAST;
    const rowBooths = booths.filter((b) =>
      side === 'west' ? b.position[0] < 0 : b.position[0] > 0,
    );
    for (const b of rowBooths) {
      if (Math.abs(b.position[0] - targetX) > 0.01) {
        void onPatchBooth(b.id, { position: [targetX, b.position[1], b.position[2]] });
      }
    }
  }, [booths, onPatchBooth]);

  const distributeRow = useCallback((side: 'west' | 'east') => {
    const targetX = side === 'west' ? BOOTH_ROW_X_WEST : BOOTH_ROW_X_EAST;
    const rowBooths = booths
      .filter((b) => (side === 'west' ? b.position[0] < 0 : b.position[0] > 0))
      .sort((a, b) => a.position[2] - b.position[2]);
    if (rowBooths.length < 2) return;
    const minZ = rowBooths[0].position[2];
    const maxZ = rowBooths[rowBooths.length - 1].position[2];
    const spacing = (maxZ - minZ) / (rowBooths.length - 1);
    for (let i = 0; i < rowBooths.length; i++) {
      const newZ = snapEnabled ? snap(minZ + spacing * i, snapSize) : minZ + spacing * i;
      void onPatchBooth(rowBooths[i].id, {
        position: [targetX, rowBooths[i].position[1], newZ],
      });
    }
  }, [booths, onPatchBooth, snapEnabled, snapSize]);

  const hw = HALL_WIDTH / 2;
  const hd = HALL_DEPTH / 2;

  const canEdit = interactive && !compact;

  return (
    <div className={`flex flex-col ${compact ? 'h-full min-h-0' : 'h-full'}`}>
      {/* Toolbar */}
      {canEdit && (
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 bg-[#0d0d14] px-4 py-2">
        {/* Snap controls */}
        <label className="flex items-center gap-1.5 text-[11px] text-white/60">
          <input
            type="checkbox"
            checked={snapEnabled}
            onChange={(e) => setSnapEnabled(e.target.checked)}
            className="accent-[#d4af37]"
          />
          Snap
        </label>
        {snapEnabled && (
          <select
            value={snapSize}
            onChange={(e) => setSnapSize(Number(e.target.value) as SnapSize)}
            className="rounded bg-white/[0.06] px-2 py-0.5 text-[11px] text-white/70 outline-none border border-white/10"
          >
            {SNAP_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}m</option>
            ))}
          </select>
        )}

        <div className="mx-2 h-4 w-px bg-white/10" />

        {/* Align buttons */}
        <span className="text-[10px] text-white/40 uppercase tracking-wider">Align</span>
        <button
          type="button"
          onClick={() => alignRow('west')}
          className="rounded bg-white/[0.06] px-2.5 py-1 text-[11px] text-white/70 hover:bg-white/[0.1] hover:text-white transition-colors border border-white/10"
          title={`Align all west-row booths to X=${BOOTH_ROW_X_WEST}`}
        >
          West Row X
        </button>
        <button
          type="button"
          onClick={() => alignRow('east')}
          className="rounded bg-white/[0.06] px-2.5 py-1 text-[11px] text-white/70 hover:bg-white/[0.1] hover:text-white transition-colors border border-white/10"
          title={`Align all east-row booths to X=${BOOTH_ROW_X_EAST}`}
        >
          East Row X
        </button>

        <div className="mx-2 h-4 w-px bg-white/10" />

        <span className="text-[10px] text-white/40 uppercase tracking-wider">Distribute</span>
        <button
          type="button"
          onClick={() => distributeRow('west')}
          className="rounded bg-white/[0.06] px-2.5 py-1 text-[11px] text-white/70 hover:bg-white/[0.1] hover:text-white transition-colors border border-white/10"
          title="Evenly space west-row booths along Z"
        >
          West Z
        </button>
        <button
          type="button"
          onClick={() => distributeRow('east')}
          className="rounded bg-white/[0.06] px-2.5 py-1 text-[11px] text-white/70 hover:bg-white/[0.1] hover:text-white transition-colors border border-white/10"
          title="Evenly space east-row booths along Z"
        >
          East Z
        </button>

        {selectedBoothLayout && selectedBoothLayout.halls.length > 1 ? (
          selectedBoothLayout.slotIds.length > 1 ? (
            <CmsApplyMultiBoothLayout
              slotIds={selectedBoothLayout.slotIds}
              boothLabels={selectedBoothLayout.boothNames}
              activeHallId={selectedBoothLayout.activeHallId}
              halls={selectedBoothLayout.halls}
              onApplyFromHall={selectedBoothLayout.onApplyFromHall}
              variant="toolbar"
            />
          ) : (
            <CmsApplySelectedBoothLayout
              slotId={selectedBoothLayout.slotIds[0] ?? ''}
              boothName={selectedBoothLayout.boothNames[0] ?? ''}
              activeHallId={selectedBoothLayout.activeHallId}
              halls={selectedBoothLayout.halls}
              onApplyFromHall={(slotId, source, targets) =>
                selectedBoothLayout.onApplyFromHall([slotId], source, targets)
              }
              variant="toolbar"
            />
          )
        ) : layoutCopy && layoutCopy.halls.length > 1 ? (
          <CmsApplyHallLayoutControls
            halls={layoutCopy.halls}
            defaultSourceHallId={DEFAULT_EXPO_HALL_ID}
            onApplyLayoutFrom={layoutCopy.onApplyLayoutFrom}
            variant="toolbar"
          />
        ) : null}

        {/* Status */}
        <div className="ml-auto text-[10px] text-white/30 shrink-0">
          {drag
            ? `Moving ${drag.groupStarts ? `${Object.keys(drag.groupStarts).length} booths` : drag.boothId}${dragSvgPos ? ` \u2192 (${svgToWorld(dragSvgPos.x, dragSvgPos.y).x.toFixed(1)}, ${svgToWorld(dragSvgPos.x, dragSvgPos.y).z.toFixed(1)})` : ''}`
            : `${booths.length} booths \u00b7 ${selectedIds.length} selected \u00b7 ${HALL_WIDTH}\u00d7${HALL_DEPTH}m hall`}
        </div>
      </div>
      )}

      {/* SVG Canvas */}
      <div className={`relative bg-[#08080e] overflow-hidden ${compact ? 'flex-1 min-h-0' : 'flex-1'}`}>
        <svg
          ref={svgRef}
          viewBox={`${VB_X} ${VB_Y} ${VB_W} ${VB_H}`}
          className="absolute inset-0 w-full h-full"
          style={{ touchAction: canEdit ? 'none' : 'auto' }}
          onPointerMove={canEdit ? handlePointerMove : undefined}
          onPointerUp={canEdit ? handlePointerUp : undefined}
          onPointerLeave={canEdit ? handlePointerUp : undefined}
        >
          {/* Grid */}
          <GridLines step={gridStep} />

          {/* Hall boundary */}
          <rect
            x={-hw} y={-hd}
            width={HALL_WIDTH} height={HALL_DEPTH}
            fill="none"
            stroke="rgba(212,175,55,0.2)"
            strokeWidth={0.15}
            rx={0.5}
          />

          {/* Ballroom stage (east wall) */}
          {(() => {
            const stageW = 14;
            const stageD = 2.6;
            const ballroomX = HALL_HALF_WIDTH - 1.5;
            const stagePos = worldToSvg(ballroomX, 0);
            const screenW = 13;
            const screenH = 0.6;
            return (
              <g style={{ pointerEvents: 'none' }}>
                <rect
                  x={stagePos.x - stageD / 2} y={stagePos.y - stageW / 2}
                  width={stageD} height={stageW}
                  rx={0.2}
                  fill="rgba(107,68,35,0.25)"
                  stroke="rgba(107,68,35,0.4)"
                  strokeWidth={0.1}
                />
                <rect
                  x={stagePos.x - 0.15} y={stagePos.y - screenW / 2}
                  width={screenH} height={screenW}
                  rx={0.1}
                  fill="rgba(0,180,255,0.15)"
                  stroke="rgba(0,180,255,0.35)"
                  strokeWidth={0.08}
                />
                <text
                  x={stagePos.x - stageD / 2 + 0.5} y={stagePos.y}
                  textAnchor="middle" dominantBaseline="central"
                  fill="rgba(0,180,255,0.4)"
                  fontSize={0.7}
                  fontFamily="system-ui"
                  transform={`rotate(-90, ${stagePos.x - stageD / 2 + 0.5}, ${stagePos.y})`}
                  style={{ userSelect: 'none' }}
                >
                  BALLROOM STAGE
                </text>
                <text
                  x={stagePos.x + 0.3} y={stagePos.y}
                  textAnchor="middle" dominantBaseline="central"
                  fill="rgba(0,180,255,0.3)"
                  fontSize={0.5}
                  fontFamily="system-ui"
                  transform={`rotate(-90, ${stagePos.x + 0.3}, ${stagePos.y})`}
                  style={{ userSelect: 'none' }}
                >
                  LED SCREEN
                </text>
              </g>
            );
          })()}

          {/* Visitor entry spawn (drag to reposition) */}
          {(() => {
            const [ex, , ez] = currentEntry;
            const entryPos = entrySvgPos ?? worldToSvg(ex, ez);
            const entryW = 2.8;
            const entryD = 3.2;
            return (
              <g
                onPointerDown={canEdit ? handleEntryDown : undefined}
                style={{ cursor: canEdit ? 'grab' : 'default' }}
              >
                <rect
                  x={entryPos.x - entryW / 2}
                  y={entryPos.y - entryD / 2}
                  width={entryW}
                  height={entryD}
                  rx={0.25}
                  fill="rgba(34,197,94,0.12)"
                  stroke="#22c55e"
                  strokeWidth={0.14}
                />
                <text
                  x={entryPos.x}
                  y={entryPos.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#4ade80"
                  fontSize={0.75}
                  fontWeight="700"
                  fontFamily="system-ui"
                  style={{ userSelect: 'none', pointerEvents: 'none' }}
                >
                  ENTRY
                </text>
              </g>
            );
          })()}

          {/* Entrance lobby */}
          {(() => {
            const lobbyZ = defaultEntranceLobbyZ();
            const lobbyPos = worldToSvg(0, lobbyZ);
            const lobbyW = 10;
            const lobbyD = 3;
            return (
              <g style={{ pointerEvents: 'none' }}>
                <rect
                  x={lobbyPos.x - lobbyW / 2} y={lobbyPos.y - lobbyD / 2}
                  width={lobbyW} height={lobbyD}
                  rx={0.3}
                  fill="rgba(100,200,100,0.08)"
                  stroke="rgba(100,200,100,0.2)"
                  strokeWidth={0.08}
                  strokeDasharray="0.5 0.3"
                />
                <text
                  x={lobbyPos.x} y={lobbyPos.y}
                  textAnchor="middle" dominantBaseline="central"
                  fill="rgba(100,200,100,0.35)"
                  fontSize={0.75}
                  fontFamily="system-ui"
                  style={{ userSelect: 'none' }}
                >
                  ENTRANCE LOBBY
                </text>
              </g>
            );
          })()}

          {/* Aisle center lines */}
          <line
            x1={EXPO_AISLE_WEST_X} y1={-hd} x2={EXPO_AISLE_WEST_X} y2={hd}
            stroke="rgba(255,255,255,0.06)" strokeWidth={0.08} strokeDasharray="0.8 0.6"
          />
          <line
            x1={EXPO_AISLE_EAST_X} y1={-hd} x2={EXPO_AISLE_EAST_X} y2={hd}
            stroke="rgba(255,255,255,0.06)" strokeWidth={0.08} strokeDasharray="0.8 0.6"
          />

          {/* Help desk circle at center */}
          <circle
            cx={0} cy={0}
            r={HELP_DESK_RADIUS}
            fill="rgba(212,175,55,0.05)"
            stroke="rgba(212,175,55,0.15)"
            strokeWidth={0.08}
          />
          <text
            x={0} y={0}
            textAnchor="middle" dominantBaseline="central"
            fill="rgba(212,175,55,0.3)"
            fontSize={0.9}
            fontFamily="system-ui, sans-serif"
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            Help Desk
          </text>

          {/* Row labels */}
          <text x={BOOTH_ROW_X_WEST} y={-hd + 1.2} textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize={1} fontWeight="600" fontFamily="system-ui" style={{ pointerEvents: 'none', userSelect: 'none' }}>
            WEST ROW
          </text>
          <text x={BOOTH_ROW_X_EAST} y={-hd + 1.2} textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize={1} fontWeight="600" fontFamily="system-ui" style={{ pointerEvents: 'none', userSelect: 'none' }}>
            EAST ROW
          </text>

          {/* South reception anchor */}
          <text x={0} y={hd - 0.6} textAnchor="middle" fill="rgba(255,255,255,0.12)" fontSize={0.7} fontFamily="system-ui" style={{ pointerEvents: 'none', userSelect: 'none' }}>
            RECEPTION
          </text>

          {/* Snap crosshair while dragging */}
          {drag && dragSvgPos && <SnapCrosshair pos={dragSvgPos} />}

          {/* Booth rectangles */}
          {booths.map((b) => (
            <BoothRect
              key={b.id}
              booth={b}
              isSelected={selectedIds.includes(b.id)}
              isPrimary={b.id === primarySelectedId}
              isDragging={drag?.boothId === b.id || (drag?.groupStarts != null && b.id in drag.groupStarts && drag.boothId !== b.id && dragSvgPos != null)}
              dragPos={drag?.boothId === b.id ? dragSvgPos : null}
              interactive={canEdit}
              onPointerDown={canEdit ? handlePointerDown : (e) => {
                e.stopPropagation();
                onSelectBooth(b.id, { additive: e.shiftKey || e.metaKey || e.ctrlKey });
              }}
            />
          ))}
        </svg>

        {/* Legend overlay */}
        {canEdit && (
        <div className="absolute bottom-3 left-3 rounded-lg bg-black/60 px-3 py-2 text-[10px] text-white/40 backdrop-blur-sm border border-white/5">
          <div className="font-semibold text-white/50 mb-1">2D Hall Map</div>
          <div>Drag booths to reposition (multi-select: drag moves all)</div>
          <div>Click to select · Shift+click to add/remove · Snap: {snapEnabled ? `${snapSize}m` : 'free'}</div>
          {selectedIds.length > 1 && onClearSelection ? (
            <button
              type="button"
              className="mt-1 text-violet-300/80 hover:text-violet-200 underline"
              onClick={onClearSelection}
            >
              Clear selection ({selectedIds.length})
            </button>
          ) : null}
        </div>
        )}
      </div>
    </div>
  );
}
