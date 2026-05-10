"use client";

// Shared client-side primitives for the article charts: a framed container with
// title / subtitle / source footnote (with `not-prose` baked in so embedding
// inside an MDX `.prose` article doesn't corrupt the UI), a "data pending"
// placeholder, and a hover-enabled multi-line SVG chart. Built on lib/chart-helpers.

import { useId, useMemo, useRef, useState } from "react";
import {
  makeYTicks,
  makeXTicksByYear,
  niceBounds,
  pathFromPoints,
  scaleLinear,
  type Scale,
  type XY,
} from "@/lib/chart-helpers";

// --- framed container -----------------------------------------------------

export function ChartFrame({
  title,
  subtitle,
  source,
  retrievedAt,
  children,
}: {
  title: string;
  subtitle?: string;
  source?: string;
  retrievedAt?: string | null;
  children: React.ReactNode;
}) {
  return (
    <figure className="not-prose my-8 rounded-sm border border-rule bg-surface p-5 sm:p-6">
      <figcaption className="border-b border-rule pb-3">
        <div className="font-display text-base font-semibold text-fg">{title}</div>
        {subtitle ? (
          <div className="mt-1 text-xs uppercase tracking-wider text-muted">{subtitle}</div>
        ) : null}
      </figcaption>
      <div className="mt-4">{children}</div>
      {source ? (
        <div className="mt-4 border-t border-rule pt-2 text-[11px] leading-snug text-muted">
          Source: {source}
          {retrievedAt ? ` · retrieved ${retrievedAt}` : ""}
        </div>
      ) : null}
    </figure>
  );
}

export function DataPending({ note }: { note?: string }) {
  return (
    <div className="flex min-h-[180px] flex-col items-center justify-center rounded-sm border border-dashed border-rule-strong bg-[var(--bg)] px-6 py-10 text-center">
      <div className="font-display text-sm font-semibold text-fg-soft">Data pending</div>
      <p className="mt-1 max-w-sm text-xs text-muted">
        {note ?? "This visual is wired up; its dataset hasn't been sourced yet."}
      </p>
    </div>
  );
}

// --- multi-line chart -----------------------------------------------------

export type LineSeries = {
  key: string;
  color: string;
  points: { year: number; value: number }[];
};

const W = 760;
const H = 320;
const PAD = { top: 22, right: 26, bottom: 36, left: 58 };

export function LineChart({
  series,
  formatValue,
  formatTick,
  includeZero = false,
  markers = [],
  ariaLabel,
}: {
  series: LineSeries[];
  formatValue: (v: number) => string;
  formatTick: (v: number) => string;
  includeZero?: boolean;
  markers?: { value: number; label: string; color?: string }[];
  ariaLabel: string;
}) {
  const uid = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set());
  const [hoverYear, setHoverYear] = useState<number | null>(null);

  const visible = useMemo(
    () => series.filter((s) => !hiddenKeys.has(s.key) && s.points.length >= 1),
    [series, hiddenKeys],
  );

  const view = useMemo(() => {
    const pts = visible.flatMap((s) => s.points);
    if (pts.length === 0) return null;
    const years = Array.from(new Set(pts.map((p) => p.year))).sort((a, b) => a - b);
    const values = pts.map((p) => p.value).concat(markers.map((m) => m.value));
    const { lo, hi } = niceBounds(Math.min(...values), Math.max(...values), {
      padFrac: 0.05,
      includeZero,
    });
    const xScale: Scale = scaleLinear({
      domain: [years[0], years[years.length - 1]],
      range: [PAD.left, W - PAD.right],
    });
    const yScale: Scale = scaleLinear({
      domain: [lo, hi],
      range: [H - PAD.bottom, PAD.top],
    });
    const yTicks = makeYTicks(lo, hi, 4, yScale);
    const yearSpan = years[years.length - 1] - years[0];
    const nX = yearSpan > 120 ? 7 : yearSpan > 30 ? 6 : 4;
    const xTicks = makeXTicksByYear(years, nX, xScale);
    const lines = visible.map((s) => {
      const sorted = [...s.points].sort((a, b) => a.year - b.year);
      const xy: XY[] = sorted.map((p) => ({ x: xScale(p.year), y: yScale(p.value) }));
      return { key: s.key, color: s.color, xy, sorted };
    });
    return { years, xScale, yScale, yTicks, xTicks, lines, lo, hi };
  }, [visible, markers, includeZero]);

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!view) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const xPx = ((e.clientX - rect.left) / rect.width) * W;
    let best = view.years[0];
    let bestD = Infinity;
    for (const y of view.years) {
      const d = Math.abs(view.xScale(y) - xPx);
      if (d < bestD) {
        bestD = d;
        best = y;
      }
    }
    setHoverYear(best);
  }

  function toggle(key: string) {
    setHiddenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const multi = series.length > 1;

  return (
    <div>
      {multi ? (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {series.map((s) => {
            const off = hiddenKeys.has(s.key);
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => toggle(s.key)}
                aria-pressed={!off}
                className={`flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-xs transition-colors ${
                  off
                    ? "border-rule text-muted"
                    : "border-rule-strong text-fg-soft hover:border-[var(--accent-warm)]"
                }`}
              >
                <span
                  aria-hidden
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: off ? "var(--border-strong)" : s.color }}
                />
                {s.key}
              </button>
            );
          })}
        </div>
      ) : null}

      {view ? (
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={ariaLabel}
          className="w-full touch-none select-none"
          onPointerMove={onMove}
          onPointerLeave={() => setHoverYear(null)}
        >
          {view.yTicks.map((t, i) => (
            <g key={`y-${uid}-${i}`}>
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
                {formatTick(t.value)}
              </text>
            </g>
          ))}

          {view.xTicks.map((t, i) => (
            <text
              key={`x-${uid}-${i}`}
              x={t.x}
              y={H - PAD.bottom + 16}
              textAnchor={t.anchor}
              fontSize="10"
              fill="var(--muted)"
            >
              {t.label}
            </text>
          ))}

          {markers.map((m, i) => {
            const y = view.yScale(m.value);
            return (
              <g key={`m-${uid}-${i}`}>
                <line
                  x1={PAD.left}
                  x2={W - PAD.right}
                  y1={y}
                  y2={y}
                  stroke={m.color ?? "var(--accent-warm)"}
                  strokeDasharray="5 4"
                  strokeWidth="1.5"
                />
                <text
                  x={W - PAD.right}
                  y={y - 4}
                  textAnchor="end"
                  fontSize="10"
                  fill={m.color ?? "var(--accent-warm-hover)"}
                >
                  {m.label}
                </text>
              </g>
            );
          })}

          {view.lines.map((ln) => (
            <path
              key={`ln-${uid}-${ln.key}`}
              d={pathFromPoints(ln.xy)}
              fill="none"
              stroke={ln.color}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}

          {hoverYear !== null ? (
            <g>
              <line
                x1={view.xScale(hoverYear)}
                x2={view.xScale(hoverYear)}
                y1={PAD.top}
                y2={H - PAD.bottom}
                stroke="var(--muted)"
                strokeDasharray="2 3"
              />
              <text
                x={view.xScale(hoverYear)}
                y={PAD.top - 6}
                textAnchor="middle"
                fontSize="10"
                fontWeight="600"
                fill="var(--fg-soft)"
              >
                {hoverYear}
              </text>
              {view.lines.map((ln) => {
                const pt = ln.sorted.find((p) => p.year === hoverYear);
                if (!pt) return null;
                const cx = view.xScale(pt.year);
                const cy = view.yScale(pt.value);
                return (
                  <g key={`hp-${uid}-${ln.key}`}>
                    <circle cx={cx} cy={cy} r="3.5" fill={ln.color} />
                    <text
                      x={cx + 6}
                      y={cy - 6}
                      fontSize="10"
                      fontWeight="600"
                      fill={ln.color}
                    >
                      {multi ? `${ln.key}: ` : ""}
                      {formatValue(pt.value)}
                    </text>
                  </g>
                );
              })}
            </g>
          ) : null}
        </svg>
      ) : (
        <DataPending />
      )}
    </div>
  );
}
