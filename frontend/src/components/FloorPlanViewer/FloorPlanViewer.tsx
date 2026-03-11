import React, { useRef, useState, useMemo } from "react";
import { useLayoutStore } from "../../store/layoutStore";
import type { Point, SpaceAllocation, FurnitureItem, WallSegment } from "../../types";
import clsx from "clsx";

const PADDING = 40; // SVG viewport padding in pixels
const VIEWBOX_SIZE = 800;

function toViewport(
  p: Point,
  bbox: { min_x: number; min_y: number; max_x: number; max_y: number },
): [number, number] {
  const w = bbox.max_x - bbox.min_x || 1;
  const h = bbox.max_y - bbox.min_y || 1;
  const scale = Math.min(
    (VIEWBOX_SIZE - 2 * PADDING) / w,
    (VIEWBOX_SIZE - 2 * PADDING) / h,
  );
  const offsetX = PADDING + ((VIEWBOX_SIZE - 2 * PADDING) - w * scale) / 2;
  const offsetY = PADDING + ((VIEWBOX_SIZE - 2 * PADDING) - h * scale) / 2;
  return [
    offsetX + (p.x - bbox.min_x) * scale,
    VIEWBOX_SIZE - (offsetY + (p.y - bbox.min_y) * scale), // flip Y axis
  ];
}

function pointsToPath(
  points: Point[],
  bbox: { min_x: number; min_y: number; max_x: number; max_y: number },
  closed = true,
): string {
  if (points.length < 2) return "";
  const vpts = points.map((p) => toViewport(p, bbox));
  const d = vpts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return closed ? d + " Z" : d;
}

export function FloorPlanViewer() {
  const {
    floorPlan, layout, showWalls, showFurniture, showZones,
    selectedSpaceId, selectSpace, toggleLayer,
  } = useLayoutStore();

  const svgRef = useRef<SVGSVGElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);

  const bbox = floorPlan?.bounding_box ?? { min_x: 0, min_y: 0, max_x: 1000, max_y: 1000 };

  const selectedSpace = useMemo(
    () => layout?.spaces.find((s) => s.id === selectedSpaceId) ?? null,
    [layout, selectedSpaceId]
  );

  if (!floorPlan) return null;

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.max(0.3, Math.min(5, z * (e.deltaY < 0 ? 1.15 : 0.87))));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || e.altKey) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    }
  };

  const handleMouseUp = () => setIsPanning(false);

  return (
    <div className="relative flex flex-col h-full bg-slate-100">
      {/* Toolbar */}
      <div className="absolute top-3 left-3 z-20 flex flex-col gap-1.5">
        <ToolbarGroup>
          <ToolbarBtn
            active={showWalls}
            onClick={() => toggleLayer("walls")}
            title="Toggle walls"
            label="Walls"
          />
          <ToolbarBtn
            active={showZones}
            onClick={() => toggleLayer("zones")}
            title="Toggle space zones"
            label="Spaces"
          />
          <ToolbarBtn
            active={showFurniture}
            onClick={() => toggleLayer("furniture")}
            title="Toggle furniture"
            label="Furniture"
          />
        </ToolbarGroup>
        <ToolbarGroup>
          <button onClick={() => setZoom((z) => Math.min(z * 1.3, 5))} className="toolbar-btn text-xl leading-none">+</button>
          <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="toolbar-btn text-xs">Reset</button>
          <button onClick={() => setZoom((z) => Math.max(z * 0.77, 0.3))} className="toolbar-btn text-xl leading-none">−</button>
        </ToolbarGroup>
      </div>

      {/* Legend */}
      {layout && (
        <div className="absolute bottom-3 left-3 z-20 bg-white/90 rounded-xl border border-slate-200 p-3 shadow-sm max-w-xs">
          <p className="text-xs font-semibold text-slate-600 mb-2">Space Legend</p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            {Array.from(new Set(layout.spaces.map((s) => s.space_type))).slice(0, 10).map((st) => {
              const space = layout.spaces.find((s) => s.space_type === st)!;
              return (
                <div key={st} className="flex items-center gap-1.5 text-xs text-slate-600">
                  <div
                    className="w-3 h-3 rounded-sm border border-slate-300 shrink-0"
                    style={{ backgroundColor: space.color }}
                  />
                  <span className="truncate">{st.replace(/_/g, " ")}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SVG Canvas */}
      <div
        className="flex-1 overflow-hidden fp-viewer"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: isPanning ? "grabbing" : "default" }}
      >
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
          preserveAspectRatio="xMidYMid meet"
          style={{
            transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
            transformOrigin: "center",
            transition: isPanning ? "none" : "transform 0.1s ease",
          }}
        >
          {/* Grid */}
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e2e8f0" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width={VIEWBOX_SIZE} height={VIEWBOX_SIZE} fill="url(#grid)" />

          {/* Floor outline */}
          {floorPlan.floor_outline.length > 2 && (
            <path
              d={pointsToPath(floorPlan.floor_outline, bbox)}
              fill="#f8fafc"
              stroke="#94a3b8"
              strokeWidth="2"
              strokeDasharray="none"
            />
          )}

          {/* Spaces / zones layer */}
          {showZones && layout?.spaces.map((space) => (
            <g key={space.id}>
              <path
                d={pointsToPath(space.vertices, bbox)}
                fill={space.color}
                stroke={selectedSpaceId === space.id ? "#2563EB" : "#94a3b8"}
                strokeWidth={selectedSpaceId === space.id ? 2 : 0.5}
                className="fp-space"
                onClick={() => selectSpace(selectedSpaceId === space.id ? null : space.id)}
                onMouseEnter={(e) => {
                  const rect = svgRef.current?.getBoundingClientRect();
                  if (rect) {
                    setTooltip({
                      text: `${space.label} · ${space.area > 0 ? space.area.toFixed(0) + " m²" : ""} · Cap: ${space.capacity}`,
                      x: e.clientX - rect.left,
                      y: e.clientY - rect.top - 30,
                    });
                  }
                }}
                onMouseLeave={() => setTooltip(null)}
              />
              {/* Space label */}
              {space.vertices.length > 0 && (() => {
                const cx = space.vertices.reduce((s, p) => s + p.x, 0) / space.vertices.length;
                const cy = space.vertices.reduce((s, p) => s + p.y, 0) / space.vertices.length;
                const [vx, vy] = toViewport({ x: cx, y: cy }, bbox);
                return (
                  <text
                    x={vx} y={vy}
                    className="fp-label"
                    fontSize={Math.max(8, Math.min(11, 10 / zoom))}
                    dominantBaseline="middle"
                  >
                    {space.label.length > 16 ? space.label.slice(0, 14) + "…" : space.label}
                  </text>
                );
              })()}
            </g>
          ))}

          {/* Core elements */}
          {floorPlan.core_elements.map((c) => (
            <path
              key={c.id}
              d={pointsToPath(c.vertices, bbox)}
              className="fp-core"
            />
          ))}

          {/* Walls */}
          {showWalls && floorPlan.walls.map((w, i) => {
            const [sx, sy] = toViewport(w.start, bbox);
            const [ex, ey] = toViewport(w.end, bbox);
            return (
              <line
                key={i}
                x1={sx} y1={sy} x2={ex} y2={ey}
                className="fp-wall"
                strokeWidth="1.5"
              />
            );
          })}

          {/* Columns */}
          {floorPlan.columns.map((c, i) => {
            const [vx, vy] = toViewport(c, bbox);
            return <rect key={i} x={vx - 3} y={vy - 3} width={6} height={6} fill="#475569" />;
          })}

          {/* Furniture */}
          {showFurniture && layout?.furniture.map((f) => {
            const [vx, vy] = toViewport({ x: f.x, y: f.y }, bbox);
            const scale2 = Math.min(VIEWBOX_SIZE / ((bbox.max_x - bbox.min_x) || 1), VIEWBOX_SIZE / ((bbox.max_y - bbox.min_y) || 1));
            const fw = f.width * scale2;
            const fh = f.height * scale2;
            return (
              <rect
                key={f.id}
                x={vx - fw / 2} y={vy - fh / 2}
                width={fw} height={fh}
                fill="#94a3b8"
                fillOpacity={0.6}
                stroke="#64748b"
                strokeWidth="0.5"
                rx={1}
                transform={f.rotation ? `rotate(${f.rotation}, ${vx}, ${vy})` : undefined}
              />
            );
          })}
        </svg>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute z-30 bg-slate-900 text-white text-xs px-2 py-1 rounded-lg pointer-events-none shadow-lg"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.text}
        </div>
      )}

      {/* Selected space panel */}
      {selectedSpace && (
        <div className="absolute bottom-3 right-3 z-20 bg-white rounded-xl border border-blue-200 p-4 shadow-lg w-64">
          <div className="flex items-center gap-2 mb-2">
            <div
              className="w-4 h-4 rounded-sm border border-slate-300"
              style={{ backgroundColor: selectedSpace.color }}
            />
            <h4 className="font-semibold text-slate-800 text-sm">{selectedSpace.label}</h4>
          </div>
          <div className="space-y-1 text-xs text-slate-600">
            <div className="flex justify-between">
              <span>Type</span>
              <span className="font-medium capitalize">{selectedSpace.space_type.replace(/_/g, " ")}</span>
            </div>
            {selectedSpace.area > 0 && (
              <div className="flex justify-between">
                <span>Area</span>
                <span className="font-medium">{selectedSpace.area.toFixed(1)} m²</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Capacity</span>
              <span className="font-medium">{selectedSpace.capacity} people</span>
            </div>
            {selectedSpace.zone && (
              <div className="flex justify-between">
                <span>Zone</span>
                <span className="font-medium">{selectedSpace.zone}</span>
              </div>
            )}
          </div>
          <button
            onClick={() => selectSpace(null)}
            className="mt-3 w-full text-xs text-slate-400 hover:text-slate-600"
          >
            Deselect
          </button>
        </div>
      )}
    </div>
  );
}

function ToolbarGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white/90 backdrop-blur rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      {children}
    </div>
  );
}

function ToolbarBtn({
  active, onClick, label, title
}: { active: boolean; onClick: () => void; label: string; title: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={clsx(
        "px-3 py-2 text-xs font-medium transition-colors",
        active ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:bg-slate-50",
      )}
    >
      {label}
    </button>
  );
}
