"use client";

import { useMemo, useState } from "react";
import type { MultipleSeries } from "@/lib/farmland-multiples-history";

const W = 760;
const H = 380;
const PAD = { top: 24, right: 32, bottom: 48, left: 80 };

export function FarmlandMultiplesHistory({
  series,
}: {
  series: MultipleSeries[];
}) {
  const [activeMetric, setActiveMetric] = useState<string>(
    series[0]?.metric ?? "",
  );
  const [showSectors, setShowSectors] = useState(false);
  const [hover, setHover] = useState<{ year: number; label?: string } | null>(
    null,
  );

  const active = series.find((s) => s.metric === activeMetric) ?? series[0];

  // Trim leading years where the cohort is too small to be meaningful
  const minCount = 5;
  const points = useMemo(() => {
    if (!active) return [];
    return active.points.filter((p) => p.count >= minCount);
  }, [active]);

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const allValues: number[] = [];
  for (const p of points) {
    if (p.median !== null) allValues.push(p.median);
    if (p.p25 !== null) allValues.push(p.p25);
    if (p.p75 !== null) allValues.push(p.p75);
    if (showSectors && p.bySector) {
      for (const v of Object.values(p.bySector)) {
        if (typeof v === "number") allValues.push(v);
      }
    }
  }
  const yMin = allValues.length ? Math.min(...allValues) : 0;
  const yMax = allValues.length ? Math.max(...allValues) : 1;
  const yPad = (yMax - yMin) * 0.1 || 1;
  const yLo = yMin - yPad;
  const yHi = yMax + yPad;
  const yearMin = points[0]?.year ?? 2020;
  const yearMax = points[points.length - 1]?.year ?? 2024;

  const xOf = (year: number) =>
    PAD.left +
    ((year - yearMin) / Math.max(1, yearMax - yearMin)) * innerW;
  const yOf = (v: number) =>
    PAD.top + (1 - (v - yLo) / Math.max(1e-9, yHi - yLo)) * innerH;

  // Pretty year ticks
  const yearTicks = useMemo(() => {
    const span = yearMax - yearMin;
    if (span <= 0) return [yearMin];
    const step = span > 20 ? 5 : span > 10 ? 2 : 1;
    const out: number[] = [];
    for (let y = Math.ceil(yearMin / step) * step; y <= yearMax; y += step) {
      out.push(y);
    }
    return out;
  }, [yearMin, yearMax]);

  const yTicks = useMemo(() => {
    const span = yHi - yLo;
    const step = niceStep(span / 5);
    const out: number[] = [];
    for (let v = Math.ceil(yLo / step) * step; v <= yHi; v += step) {
      out.push(roundTo(v, 3));
    }
    return out;
  }, [yLo, yHi]);

  // Sector palette
  const sectorPalette = [
    "#0a3d62", "#27ae60", "#d35400", "#c0392b", "#7d3c98",
    "#16a085", "#e67e22", "#2980b9", "#a93226", "#5d6d7e",
    "#8b4513",
  ];
  const sectors = useMemo(() => {
    const set = new Set<string>();
    for (const p of points) {
      if (p.bySector) for (const k of Object.keys(p.bySector)) set.add(k);
    }
    return Array.from(set).sort();
  }, [points]);
  const sectorColor = useMemo(() => {
    const map = new Map<string, string>();
    sectors.forEach((s, i) =>
      map.set(s, sectorPalette[i % sectorPalette.length]),
    );
    return map;
  }, [sectors]);

  function pathFromPoints(
    pts: { year: number; v: number | null }[],
  ): string {
    let started = false;
    let d = "";
    for (const p of pts) {
      if (p.v === null) continue;
      const x = xOf(p.year).toFixed(1);
      const y = yOf(p.v).toFixed(1);
      d += `${started ? "L" : "M"}${x},${y} `;
      started = true;
    }
    return d.trim();
  }

  if (!active || points.length === 0) {
    return null;
  }

  return (
    <section className="mt-12 border-t border-rule pt-8">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-xl font-semibold tracking-tight">
          Multiples & margins history
        </h2>
        <p className="text-xs text-muted">
          Cohort {showSectors ? "by sector" : "median + IQR"} across{" "}
          {points[0]?.count}-{points[points.length - 1]?.count} tickers per
          year
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3 text-xs">
        <div className="flex flex-wrap gap-1">
          {series.map((s) => (
            <button
              key={s.metric}
              type="button"
              onClick={() => setActiveMetric(s.metric)}
              aria-pressed={s.metric === active.metric}
              className={`rounded-sm border px-2.5 py-1 text-xs transition-colors ${
                s.metric === active.metric
                  ? "border-accent bg-accent !text-bg"
                  : "border-rule bg-surface !text-fg hover:border-accent hover:!text-accent"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={showSectors}
            onChange={(e) => setShowSectors(e.target.checked)}
            className="accent-[var(--accent)]"
          />
          <span>By sector (vs IQR band)</span>
        </label>
      </div>

      <div className="overflow-x-auto rounded-sm border border-rule bg-surface p-3">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img">
          {/* Y gridlines + labels */}
          {yTicks.map((t, i) => (
            <g key={`y-${i}`}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={yOf(t)}
                y2={yOf(t)}
                stroke="var(--border)"
                strokeDasharray="2 3"
              />
              <text
                x={PAD.left - 8}
                y={yOf(t)}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize="10"
                fill="var(--muted)"
              >
                {formatTick(t, active.unit)}
              </text>
            </g>
          ))}
          {/* X labels */}
          {yearTicks.map((y) => (
            <text
              key={`x-${y}`}
              x={xOf(y)}
              y={H - PAD.bottom + 14}
              textAnchor="middle"
              fontSize="10"
              fill="var(--muted)"
            >
              {y}
            </text>
          ))}
          {/* IQR band (when not showing sectors) */}
          {!showSectors && (
            <>
              <path
                d={
                  // Forward p75
                  points
                    .filter((p) => p.p75 !== null)
                    .map(
                      (p, i) =>
                        `${i === 0 ? "M" : "L"}${xOf(p.year).toFixed(1)},${yOf(p.p75 as number).toFixed(1)}`,
                    )
                    .join(" ") +
                  " " +
                  // Backward p25
                  points
                    .slice()
                    .reverse()
                    .filter((p) => p.p25 !== null)
                    .map(
                      (p) =>
                        `L${xOf(p.year).toFixed(1)},${yOf(p.p25 as number).toFixed(1)}`,
                    )
                    .join(" ") +
                  " Z"
                }
                fill="var(--accent)"
                fillOpacity="0.12"
              />
              <path
                d={pathFromPoints(
                  points.map((p) => ({ year: p.year, v: p.median })),
                )}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2"
              />
              {points.map((p) =>
                p.median !== null ? (
                  <circle
                    key={p.year}
                    cx={xOf(p.year)}
                    cy={yOf(p.median)}
                    r="3"
                    fill="var(--accent)"
                    onMouseEnter={() =>
                      setHover({ year: p.year, label: "median" })
                    }
                    onMouseLeave={() => setHover(null)}
                    style={{ cursor: "pointer" }}
                  />
                ) : null,
              )}
            </>
          )}
          {/* Sector lines */}
          {showSectors &&
            sectors.map((sector) => {
              const color = sectorColor.get(sector) ?? "#888";
              const sectorPts = points.map((p) => ({
                year: p.year,
                v: p.bySector?.[sector] ?? null,
              }));
              return (
                <path
                  key={sector}
                  d={pathFromPoints(sectorPts)}
                  fill="none"
                  stroke={color}
                  strokeWidth="1.5"
                  strokeOpacity="0.85"
                />
              );
            })}
          {/* Hover tooltip */}
          {hover && (
            <text
              x={xOf(hover.year)}
              y={PAD.top - 6}
              textAnchor="middle"
              fontSize="10"
              fill="var(--fg)"
              fontWeight="600"
            >
              {hover.year} ·{" "}
              {formatTick(
                points.find((p) => p.year === hover.year)?.median ?? 0,
                active.unit,
              )}{" "}
              ({points.find((p) => p.year === hover.year)?.count} tickers)
            </text>
          )}
        </svg>
      </div>

      {showSectors && sectors.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
          {sectors.map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: sectorColor.get(s) }}
              />
              <span className="text-muted">{s}</span>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

function niceStep(s: number): number {
  if (s <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(s)));
  const r = s / mag;
  if (r < 1.5) return mag;
  if (r < 3) return 2 * mag;
  if (r < 7) return 5 * mag;
  return 10 * mag;
}

function roundTo(v: number, dp: number): number {
  const f = Math.pow(10, dp);
  return Math.round(v * f) / f;
}

function formatTick(v: number, unit: "pct" | "mult"): string {
  if (unit === "pct") {
    if (v < 0) return `(${Math.abs(v).toFixed(1)}%)`;
    return `${v.toFixed(1)}%`;
  }
  return `${v.toFixed(1)}×`;
}
