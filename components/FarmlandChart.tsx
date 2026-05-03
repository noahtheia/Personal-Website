"use client";

import { useMemo, useRef, useState } from "react";
import type { FarmlandSeries } from "@/lib/farmland";

type Mode = "level" | "indexed";

const W = 720;
const H = 320;
const PAD = { top: 24, right: 24, bottom: 36, left: 56 };

export function FarmlandChart({ series }: { series: FarmlandSeries[] }) {
  const [activeId, setActiveId] = useState(series[0]?.id ?? "");
  const [mode, setMode] = useState<Mode>("level");
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const active = series.find((s) => s.id === activeId) ?? series[0];

  const view = useMemo(() => buildView(active, mode), [active, mode]);

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const idx = nearestIndex(x, view.points);
    setHoverIdx(idx);
  }

  function onLeave() {
    setHoverIdx(null);
  }

  const hovered = hoverIdx !== null ? view.points[hoverIdx] : null;
  const last = view.points[view.points.length - 1];
  const first = view.points[0];
  const totalChange =
    mode === "indexed"
      ? last.value - 100
      : ((last.raw - first.raw) / first.raw) * 100;

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-2 border-b border-rule pb-3">
        <div
          role="tablist"
          aria-label="Series"
          className="flex flex-wrap gap-1"
        >
          {series.map((s) => {
            const on = s.id === active.id;
            return (
              <button
                key={s.id}
                role="tab"
                aria-selected={on}
                onClick={() => setActiveId(s.id)}
                className={`rounded-sm border px-2.5 py-1 text-xs transition-colors ${
                  on
                    ? "border-accent bg-accent !text-bg"
                    : "border-rule !text-fg hover:border-accent hover:!text-accent"
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
        <div className="ml-auto flex items-center gap-1 text-xs">
          <ModeBtn on={mode === "level"} onClick={() => setMode("level")}>
            Level
          </ModeBtn>
          <ModeBtn on={mode === "indexed"} onClick={() => setMode("indexed")}>
            Indexed = 100
          </ModeBtn>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <div className="font-display text-2xl font-semibold text-fg tabular-nums">
            {hovered
              ? formatY(hovered.value, mode, active.unit)
              : formatY(last.value, mode, active.unit)}
          </div>
          <div className="text-xs text-muted">
            {hovered ? hovered.year : `${first.year}–${last.year}`} ·{" "}
            {active.description}
          </div>
        </div>
        <div className="text-right text-xs">
          <div className="text-muted">
            {first.year} → {last.year}
          </div>
          <div
            className={`text-sm font-medium tabular-nums ${
              totalChange >= 0
                ? "text-[var(--positive)]"
                : "text-[var(--negative)]"
            }`}
          >
            {totalChange >= 0 ? "▲" : "▼"} {Math.abs(totalChange).toFixed(1)}%
          </div>
        </div>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${active.label} from ${first.year} to ${last.year}`}
        className="mt-3 w-full touch-none select-none"
        onPointerMove={onMove}
        onPointerLeave={onLeave}
      >
        {/* Y gridlines + labels */}
        {view.yTicks.map((t) => (
          <g key={t.value}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={t.y}
              y2={t.y}
              stroke="var(--border)"
              strokeDasharray="2 3"
            />
            <text
              x={PAD.left - 8}
              y={t.y}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize="10"
              fill="var(--muted)"
            >
              {formatTick(t.value, mode, active.unit)}
            </text>
          </g>
        ))}

        {/* X labels */}
        {view.xTicks.map((t) => (
          <text
            key={t.year}
            x={t.x}
            y={H - PAD.bottom + 16}
            textAnchor="middle"
            fontSize="10"
            fill="var(--muted)"
          >
            {t.year}
          </text>
        ))}

        {/* Area fill */}
        <path d={view.area} fill="var(--accent)" fillOpacity="0.08" />
        {/* Line */}
        <path
          d={view.path}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Points */}
        {view.points.map((p, i) => (
          <circle
            key={p.year}
            cx={p.x}
            cy={p.y}
            r={hoverIdx === i ? 4 : 2.5}
            fill={hoverIdx === i ? "var(--accent)" : "var(--bg)"}
            stroke="var(--accent)"
            strokeWidth="1.5"
          />
        ))}

        {/* Hover crosshair */}
        {hovered && (
          <g>
            <line
              x1={hovered.x}
              x2={hovered.x}
              y1={PAD.top}
              y2={H - PAD.bottom}
              stroke="var(--accent)"
              strokeOpacity="0.35"
              strokeDasharray="3 3"
            />
            <g
              transform={`translate(${clampTooltipX(hovered.x)}, ${PAD.top + 8})`}
            >
              <rect
                x={-58}
                y={0}
                width={116}
                height={36}
                rx={2}
                fill="var(--bg-elevated)"
                stroke="var(--border-strong)"
              />
              <text
                x={0}
                y={14}
                textAnchor="middle"
                fontSize="10"
                fill="var(--muted)"
              >
                {hovered.year}
              </text>
              <text
                x={0}
                y={28}
                textAnchor="middle"
                fontSize="12"
                fontWeight="600"
                fill="var(--fg)"
              >
                {formatY(hovered.value, mode, active.unit)}
              </text>
            </g>
          </g>
        )}
      </svg>

      <p className="mt-2 text-xs text-muted">
        Hover or tap to inspect a year. Toggle between absolute level and an
        index rebased to 100 at {first.year}.
      </p>
    </div>
  );
}

function ModeBtn({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-sm border px-2 py-1 transition-colors ${
        on
          ? "border-accent !text-accent"
          : "border-rule !text-muted hover:border-accent hover:!text-accent"
      }`}
    >
      {children}
    </button>
  );
}

type Point = { year: number; value: number; raw: number; x: number; y: number };

function buildView(s: FarmlandSeries, mode: Mode) {
  const base = s.data[0].value;
  const values = s.data.map((d) =>
    mode === "indexed" ? (d.value / base) * 100 : d.value,
  );
  const minRaw = Math.min(...values);
  const maxRaw = Math.max(...values);
  const pad = (maxRaw - minRaw) * 0.1 || maxRaw * 0.05 || 1;
  const yMin = niceFloor(minRaw - pad);
  const yMax = niceCeil(maxRaw + pad);

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const stepX = innerW / (s.data.length - 1);

  const points: Point[] = s.data.map((d, i) => {
    const v = values[i];
    return {
      year: d.year,
      value: v,
      raw: d.value,
      x: PAD.left + i * stepX,
      y: PAD.top + (1 - (v - yMin) / (yMax - yMin)) * innerH,
    };
  });

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
  const area =
    `M${points[0].x.toFixed(1)},${(H - PAD.bottom).toFixed(1)} ` +
    points
      .map((p) => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(" ") +
    ` L${points[points.length - 1].x.toFixed(1)},${(H - PAD.bottom).toFixed(1)} Z`;

  const yTicks = buildYTicks(yMin, yMax, innerH);
  const xTicks = buildXTicks(points);

  return { points, path, area, yTicks, xTicks, yMin, yMax };
}

function buildYTicks(min: number, max: number, innerH: number) {
  const count = 4;
  const step = (max - min) / count;
  const ticks: { value: number; y: number }[] = [];
  for (let i = 0; i <= count; i++) {
    const v = min + step * i;
    const y = PAD.top + (1 - (v - min) / (max - min)) * innerH;
    ticks.push({ value: v, y });
  }
  return ticks;
}

function buildXTicks(points: Point[]) {
  if (points.length <= 6) return points.map((p) => ({ year: p.year, x: p.x }));
  const stride = Math.ceil(points.length / 6);
  const out: { year: number; x: number }[] = [];
  for (let i = 0; i < points.length; i += stride) {
    out.push({ year: points[i].year, x: points[i].x });
  }
  const last = points[points.length - 1];
  if (out[out.length - 1].year !== last.year) {
    out.push({ year: last.year, x: last.x });
  }
  return out;
}

function nearestIndex(x: number, points: Point[]) {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < points.length; i++) {
    const d = Math.abs(points[i].x - x);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

function clampTooltipX(x: number) {
  return Math.max(PAD.left + 60, Math.min(W - PAD.right - 60, x));
}

function niceFloor(v: number) {
  if (v <= 0) return 0;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  return Math.floor(v / mag) * mag;
}

function niceCeil(v: number) {
  if (v <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  return Math.ceil(v / mag) * mag;
}

function formatY(v: number, mode: Mode, unit: string) {
  if (mode === "indexed") return v.toFixed(1);
  if (unit.startsWith("$")) {
    return `$${Math.round(v).toLocaleString("en-US")}`;
  }
  return v.toFixed(0);
}

function formatTick(v: number, mode: Mode, unit: string) {
  if (mode === "indexed") return v.toFixed(0);
  if (unit.startsWith("$")) {
    if (v >= 1000) return `$${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`;
    return `$${Math.round(v)}`;
  }
  return v.toFixed(0);
}
