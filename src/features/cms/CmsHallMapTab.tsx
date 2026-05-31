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
  type BoothLayoutConfig,
  type BoothLayoutPatch,
} from '@/features/shared/data/boothLayouts';

export type CmsHallMapTabProps = {
  booths: BoothLayoutConfig[];
  selectedId: string;
  onSelectBooth: (id: string) => void;
  onPatchBooth: (id: string, patch: BoothLayoutPatch) => Promise<boolean>;
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

function radToDeg(r: number): number {
  return (r * 180) / Math.PI;
}

function degToRad(d: number): number {
  return (d * Math.PI) / 180;
}

const ROTATION_SNAP_DEG = 15;

function snapAngle(deg: number): number {
  return Math.round(deg / ROTATION_SNAP_DEG) * ROTATION_SNAP_DEG;
}

type DragState = {
  boothId: string;
  offsetX: number;
  offsetY: number;
  startWorldX: number;
  startWorldZ: number;
};

type RotateState = {
  boothId: string;
  startAngleDeg: number;
  startPointerAngle: number;
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

const HANDLE_R = 0.55;

function BoothRect({
  booth,
  isSelected,
  isDragging,
  isRotating,
  dragPos,
  rotatingDeg,
  onPointerDown,
  onRotateHandleDown,
}: {
  booth: BoothLayoutConfig;
  isSelected: boolean;
  isDragging: boolean;
  isRotating: boolean;
  dragPos: { x: number; y: number } | null;
  rotatingDeg: number | null;
  onPointerDown: (e: RPointerEvent<SVGGElement>, id: string) => void;
  onRotateHandleDown: (e: RPointerEvent<SVGCircleElement>, id: string) => void;
}) {
  const pos = isDragging && dragPos
    ? dragPos
    : worldToSvg(booth.position[0], booth.position[2]);
  const yawDeg = isRotating && rotatingDeg !== null
    ? rotatingDeg
    : radToDeg(booth.rotation[1]);

  const bw = BASE_BOOTH_W * booth.scale[0];
  const bd = BASE_BOOTH_D * booth.scale[2];
  const handleArm = bd / 2 + 1.2;

  const fill = booth.color || '#1a1a2e';
  const stroke = isSelected ? '#d4af37' : (booth.accent || '#555');
  const strokeW = isSelected ? 0.25 : 0.12;
  const opacity = isDragging ? 0.85 : 1;

  const shortName = booth.name.length > 14 ? booth.name.slice(0, 13) + '…' : booth.name;

  return (
    <g
      transform={`translate(${pos.x}, ${pos.y})`}
      style={{ opacity }}
    >
      <g transform={`rotate(${yawDeg})`}>
        <rect
          x={-bw / 2} y={-bd / 2}
          width={bw} height={bd}
          rx={0.3}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeW}
          style={{ cursor: 'grab' }}
          onPointerDown={(e) => onPointerDown(e as unknown as RPointerEvent<SVGGElement>, booth.id)}
        />
        {/* Front-face indicator */}
        <polygon
          points={`${-0.5},${-bd / 2 + 0.1} ${0.5},${-bd / 2 + 0.1} ${0},${-bd / 2 - 0.35}`}
          fill={isSelected ? '#d4af37' : 'rgba(255,255,255,0.3)'}
          style={{ pointerEvents: 'none' }}
        />
        {isSelected && (
          <rect
            x={-bw / 2 - 0.15} y={-bd / 2 - 0.15}
            width={bw + 0.3} height={bd + 0.3}
            rx={0.4}
            fill="none"
            stroke="#d4af37"
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
          {booth.scale[0].toFixed(2)} × {booth.scale[2].toFixed(2)}
        </text>

        {/* Rotation handle */}
        {isSelected && (
          <>
            <line
              x1={0} y1={-bd / 2}
              x2={0} y2={-handleArm}
              stroke="#d4af37" strokeWidth={0.08} opacity={0.5}
              style={{ pointerEvents: 'none' }}
            />
            <circle
              cx={0} cy={-handleArm}
              r={HANDLE_R}
              fill="#d4af37"
              stroke="#fff"
              strokeWidth={0.08}
              style={{ cursor: 'crosshair' }}
              onPointerDown={(e) => onRotateHandleDown(e, booth.id)}
            />
            <text
              x={0} y={-handleArm + 0.05}
              textAnchor="middle"
              dominantBaseline="central"
              fill="#000"
              fontSize={0.55}
              fontWeight="800"
              fontFamily="system-ui"
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              ↻
            </text>
          </>
        )}
      </g>
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

export function CmsHallMapTab({ booths, selectedId, onSelectBooth, onPatchBooth }: CmsHallMapTabProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [snapSize, setSnapSize] = useState<SnapSize>(1);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [dragSvgPos, setDragSvgPos] = useState<{ x: number; y: number } | null>(null);
  const [rotate, setRotate] = useState<RotateState | null>(null);
  const [rotateDeg, setRotateDeg] = useState<number | null>(null);

  const gridStep = useMemo(() => (snapEnabled ? snapSize : 5), [snapEnabled, snapSize]);

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
    if (rotate) return;
    e.stopPropagation();
    e.preventDefault();
    (e.target as SVGElement).setPointerCapture?.(e.pointerId);
    onSelectBooth(boothId);

    const booth = booths.find((b) => b.id === boothId);
    if (!booth) return;

    const { x: sx, y: sy } = svgPoint(e.clientX, e.clientY);
    const bpos = worldToSvg(booth.position[0], booth.position[2]);

    setDrag({
      boothId,
      offsetX: sx - bpos.x,
      offsetY: sy - bpos.y,
      startWorldX: booth.position[0],
      startWorldZ: booth.position[2],
    });
    setDragSvgPos(bpos);
  }, [booths, onSelectBooth, svgPoint, rotate]);

  const handleRotateDown = useCallback((e: RPointerEvent<SVGCircleElement>, boothId: string) => {
    e.stopPropagation();
    e.preventDefault();
    (e.target as SVGElement).setPointerCapture?.(e.pointerId);

    const booth = booths.find((b) => b.id === boothId);
    if (!booth) return;

    const bpos = worldToSvg(booth.position[0], booth.position[2]);
    const { x: mx, y: my } = svgPoint(e.clientX, e.clientY);
    const pointerAngle = Math.atan2(my - bpos.y, mx - bpos.x) * 180 / Math.PI;

    setRotate({
      boothId,
      startAngleDeg: radToDeg(booth.rotation[1]),
      startPointerAngle: pointerAngle,
    });
    setRotateDeg(radToDeg(booth.rotation[1]));
  }, [booths, svgPoint]);

  const handlePointerMove = useCallback((e: RPointerEvent<SVGSVGElement>) => {
    if (rotate) {
      const booth = booths.find((b) => b.id === rotate.boothId);
      if (!booth) return;
      const bpos = worldToSvg(booth.position[0], booth.position[2]);
      const { x: mx, y: my } = svgPoint(e.clientX, e.clientY);
      const currentAngle = Math.atan2(my - bpos.y, mx - bpos.x) * 180 / Math.PI;
      const delta = currentAngle - rotate.startPointerAngle;
      let newDeg = rotate.startAngleDeg + delta;
      if (snapEnabled) newDeg = snapAngle(newDeg);
      setRotateDeg(newDeg);
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
  }, [drag, rotate, snapEnabled, snapSize, svgPoint, booths]);

  const handlePointerUp = useCallback(() => {
    if (rotate && rotateDeg !== null) {
      const booth = booths.find((b) => b.id === rotate.boothId);
      if (booth) {
        const newYawRad = degToRad(rotateDeg);
        if (Math.abs(newYawRad - booth.rotation[1]) > 0.001) {
          void onPatchBooth(rotate.boothId, {
            rotation: [booth.rotation[0], newYawRad, booth.rotation[2]],
          });
        }
      }
      setRotate(null);
      setRotateDeg(null);
      return;
    }

    if (!drag || !dragSvgPos) { setDrag(null); setDragSvgPos(null); return; }
    const world = svgToWorld(dragSvgPos.x, dragSvgPos.y);
    const booth = booths.find((b) => b.id === drag.boothId);
    if (!booth) { setDrag(null); setDragSvgPos(null); return; }

    if (Math.abs(world.x - drag.startWorldX) > 0.01 || Math.abs(world.z - drag.startWorldZ) > 0.01) {
      void onPatchBooth(drag.boothId, {
        position: [world.x, booth.position[1], world.z],
      });
    }
    setDrag(null);
    setDragSvgPos(null);
  }, [drag, dragSvgPos, rotate, rotateDeg, booths, onPatchBooth]);

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

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b border-white/10 bg-[#0d0d14] px-4 py-2">
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

        {/* Status */}
        <div className="ml-auto text-[10px] text-white/30">
          {rotate
            ? `Rotating ${rotate.boothId} → ${rotateDeg?.toFixed(0) ?? '—'}°`
            : drag
            ? `Moving ${drag.boothId}${dragSvgPos ? ` → (${svgToWorld(dragSvgPos.x, dragSvgPos.y).x.toFixed(1)}, ${svgToWorld(dragSvgPos.x, dragSvgPos.y).z.toFixed(1)})` : ''}`
            : `${booths.length} booths · ${HALL_WIDTH}×${HALL_DEPTH}m hall`}
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="flex-1 relative bg-[#08080e] overflow-hidden">
        <svg
          ref={svgRef}
          viewBox={`${VB_X} ${VB_Y} ${VB_W} ${VB_H}`}
          className="absolute inset-0 w-full h-full"
          style={{ touchAction: 'none' }}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
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

          {/* ── Ballroom stage (east wall) ── */}
          {(() => {
            const stageW = 14;
            const stageD = 2.6;
            const ballroomX = HALL_HALF_WIDTH - 1.5;
            const stagePos = worldToSvg(ballroomX, 0);
            const screenW = 13;
            const screenH = 0.6;
            return (
              <g style={{ pointerEvents: 'none' }}>
                {/* Stage platform */}
                <rect
                  x={stagePos.x - stageD / 2} y={stagePos.y - stageW / 2}
                  width={stageD} height={stageW}
                  rx={0.2}
                  fill="rgba(107,68,35,0.25)"
                  stroke="rgba(107,68,35,0.4)"
                  strokeWidth={0.1}
                />
                {/* LED screen on stage */}
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

          {/* ── Entrance lobby ── */}
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

          {/* ── Aisle center lines ── */}
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

          {/* Entrance arrow */}
          <text x={0} y={hd - 0.6} textAnchor="middle" fill="rgba(255,255,255,0.15)" fontSize={0.8} fontFamily="system-ui" style={{ pointerEvents: 'none', userSelect: 'none' }}>
            ↓ ENTRANCE
          </text>

          {/* Snap crosshair while dragging */}
          {drag && dragSvgPos && <SnapCrosshair pos={dragSvgPos} />}

          {/* Booth rectangles */}
          {booths.map((b) => (
            <BoothRect
              key={b.id}
              booth={b}
              isSelected={b.id === selectedId}
              isDragging={drag?.boothId === b.id}
              isRotating={rotate?.boothId === b.id}
              dragPos={drag?.boothId === b.id ? dragSvgPos : null}
              rotatingDeg={rotate?.boothId === b.id ? rotateDeg : null}
              onPointerDown={handlePointerDown}
              onRotateHandleDown={handleRotateDown}
            />
          ))}
        </svg>

        {/* Legend overlay */}
        <div className="absolute bottom-3 left-3 rounded-lg bg-black/60 px-3 py-2 text-[10px] text-white/40 backdrop-blur-sm border border-white/5">
          <div className="font-semibold text-white/50 mb-1">2D Hall Map</div>
          <div>Drag booths to reposition</div>
          <div>Drag gold handle to rotate</div>
          <div>Click to select &middot; Snap: {snapEnabled ? `${snapSize}m / ${ROTATION_SNAP_DEG}°` : 'free'}</div>
        </div>
      </div>
    </div>
  );
}
