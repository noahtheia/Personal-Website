"use client";

import { useMemo, useState } from "react";
import type {
  Cadence,
  MultipleSeries,
} from "@/lib/farmland-multiples-history";

const W = 760;
const H = 380;
const PAD = { top: 24, right: 32, bottom: 48, left: 80 };

const SECTOR_PALETTE = [
  "#0a3d62", "#27ae60", "#d35400", "#c0392b", "#7d3c98",
  "#16a085", "#e67e22", "#2980b9", "#a93226", "#5d6d7e",
  "#8b4513",
];

export function FarmlandMultiplesHistory({
  fy,
  q,
}: {
  fy: MultipleSeries[];
  q: MultipleSeries[];
}) {
  const [cadence, setCadence] = useState<Cadence>("FY");
  const [activeMetric, setActiveMetric] = useState<string>(
    fy[0]?.metric ?? "",
  );
  const [showSectors, setShowSectors] = useState(false);
  const [excludedSectors, setExcludedSectors] = useState<Set<string>>(
    new Set(),
  );
  const [hover, setHover] = useState<string | null>(null);

  const series = cadence === "FY" ? fy : q;
  const active = series.find((s) => s.metric === activeMetric) ?? series[0];

  // Trim leading buckets where the cohort is too small to be useful.
  const minCount = 5;
  const allPoints = useMemo(() => {
    if (!active) return [];
    return active.points.filter((p) => p.count >= minCount);
  }, [active]);

  // Categories from the (cohort-wide) bySector keys, sorted by mean
  // count across buckets.
  const sectors = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of allPoints) {
      if (!p.bySector) continue;
      for (const [s, v] of Object.entries(p.bySector)) {
        if (v !== null) counts.set(s, (counts.get(s) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([k]) => k);
  }, [allPoints]);

  // Apply sector exclusion to recompute median / IQR. When a sector is
  // excluded, drop its entries from the per-bucket sample set.
  const points = useMemo(() => {
    if (!active) return [];
    if (excludedSectors.size === 0) return allPoints;
    return allPoints.map((p) => {
      // Rebuild from bySector contributions: take the included
      // sectors' median values as a per-sector approximation, then
      // compute median/IQR across the included sectors.
      const includedVals: number[] = [];
      const includedBySector: Record<string, number | null> = {};
      if (p.bySector) {
        for (const [s, v] of Object.entries(p.bySector)) {
          if (excludedSectors.has(s)) continue;
          if (v !== null) includedVals.push(v);
          includedBySector[s] = v;
        }
      }
      if (includedVals.length === 0) {
        return { ...p, median: null, p25: null, p75: null, count: 0, bySector: includedBySector };
      }
      const sorted = [...includedVals].sort((a, b) => a - b);
      return {
        ...p,
        median: quantile(sorted, 0.5),
        p25: quantile(sorted, 0.25),
        p75: quantile(sorted, 0.75),
        count: sorted.length,
        bySector: includedBySector,
      };
    });
  }, [active, allPoints, excludedSectors]);

  const sectorColor = useMemo(() => {
    const m = new Map<string, string>();
    sectors.forEach((s, i) => m.set(s, SECTOR_PALETTE[i % SECTOR_PALETTE.length]));
    return m;
  }, [sectors]);

  function toggleSector(s: string) {
    setExcludedSectors((cur) => {
      const next = new Set(cur);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }
  function showOnly(s: string) {
    setExcludedSectors(new Set(sectors.filter((k) => k !== s)));
  }
  function showAll() {
    setExcludedSectors(new Set());
  }

  const visiblePts = points.filter((p) => p.median !== null);
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  // X-axis: dates.
  const xMin = visiblePts.length ? toMs(visiblePts[0].date) : 0;
  const xMax = visiblePts.length ? toMs(visiblePts[visiblePts.length - 1].date) : 1;
  const xSpan = Math.max(1, xMax - xMin);

  // Y range — values from median + IQR + (when toggled) per-sector lines
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

  const xOf = (ms: number) =>
    PAD.left + ((ms - xMin) / xSpan) * innerW;
  const yOf = (v: number) =>
    PAD.top + (1 - (v - yLo) / Math.max(1e-9, yHi - yLo)) * innerH;

  const xTicks = useMemo(() => {
    if (!active || visiblePts.length === 0) return [];
    const startYear = new Date(visiblePts[0].date).getUTCFullYear();
    const endYear = new Date(visiblePts[visiblePts.length - 1].date).getUTCFullYear();
    const span = endYear - startYear;
    const step = span > 20 ? 5 : span > 10 ? 2 : 1;
    const out: { ms: number; label: string }[] = [];
    for (let y = Math.ceil(startYear / step) * step; y <= endYear; y += step) {
      out.push({ ms: Date.UTC(y, 0, 1), label: String(y) });
    }
    return out;
  }, [active, visiblePts]);

  const yTicks = useMemo(() => {
    const span = yHi - yLo;
    const step = niceStep(span / 5);
    const out: number[] = [];
    for (let v = Math.ceil(yLo / step) * step; v <= yHi; v += step) {
      out.push(roundTo(v, 3));
    }
    return out;
  }, [yLo, yHi]);

  function pathFromPoints(pts: { x: number; y: number | null }[]): string {
    let started = false;
    let d = "";
    for (const p of pts) {
      if (p.y === null) continue;
      d += `${started ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)} `;
      started = true;
    }
    return d.trim();
  }

  if (!active || visiblePts.length === 0) {
    return null;
  }

  return (
    <section className="mt-12 border-t border-rule pt-8">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-xl font-semibold tracking-tight">
          Multiples & margins history
        </h2>
        <p className="text-xs text-muted">
          Cohort {showSectors ? "by sector" : "median + IQR"} ·{" "}
          {visiblePts[0]?.count}-{visiblePts[visiblePts.length - 1]?.count}{" "}
          tickers per {cadence === "FY" ? "year" : "quarter"}
          {excludedSectors.size > 0
            ? ` · ${excludedSectors.size} sector${excludedSectors.size === 1 ? "" : "s"} hidden`
            : ""}
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
        <div className="flex gap-1">
          {(["FY", "Q"] as Cadence[]).map((c) => {
            const on = cadence === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setCadence(c)}
                aria-pressed={on}
                className={`rounded-sm border px-2.5 py-1 text-xs transition-colors ${
                  on
                    ? "border-accent bg-accent !text-bg"
                    : "border-rule bg-surface !text-fg hover:border-accent hover:!text-accent"
                }`}
              >
                {c === "FY" ? "Annual" : "Quarterly"}
              </button>
            );
          })}
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
          {xTicks.map((t) => (
            <text
              key={t.label}
              x={xOf(t.ms)}
              y={H - PAD.bottom + 14}
              textAnchor="middle"
              fontSize="10"
              fill="var(--muted)"
            >
              {t.label}
            </text>
          ))}
          {/* IQR band (when not showing sectors) */}
          {!showSectors && (
            <>
              <path
                d={
                  visiblePts
                    .filter((p) => p.p75 !== null)
                    .map(
                      (p, i) =>
                        `${i === 0 ? "M" : "L"}${xOf(toMs(p.date)).toFixed(1)},${yOf(p.p75 as number).toFixed(1)}`,
                    )
                    .join(" ") +
                  " " +
                  visiblePts
                    .slice()
                    .reverse()
                    .filter((p) => p.p25 !== null)
                    .map(
                      (p) =>
                        `L${xOf(toMs(p.date)).toFixed(1)},${yOf(p.p25 as number).toFixed(1)}`,
                    )
                    .join(" ") +
                  " Z"
                }
                fill="var(--accent)"
                fillOpacity="0.12"
              />
              <path
                d={pathFromPoints(
                  visiblePts.map((p) => ({
                    x: xOf(toMs(p.date)),
                    y: p.median !== null ? yOf(p.median) : null,
                  })),
                )}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2"
              />
              {visiblePts.map((p) =>
                p.median !== null ? (
                  <circle
                    key={p.bucket}
                    cx={xOf(toMs(p.date))}
                    cy={yOf(p.median)}
                    r="3"
                    fill="var(--accent)"
                    onMouseEnter={() => setHover(p.bucket)}
                    onMouseLeave={() => setHover(null)}
                    style={{ cursor: "pointer" }}
                  />
                ) : null,
              )}
            </>
          )}
          {/* Sector lines */}
          {showSectors &&
            sectors
              .filter((s) => !excludedSectors.has(s))
              .map((sector) => {
                const color = sectorColor.get(sector) ?? "#888";
                const sectorPts = visiblePts.map((p) => ({
                  x: xOf(toMs(p.date)),
                  y:
                    p.bySector && typeof p.bySector[sector] === "number"
                      ? yOf(p.bySector[sector] as number)
                      : null,
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
          {hover && (() => {
            const p = points.find((x) => x.bucket === hover);
            if (!p || p.median === null) return null;
            return (
              <text
                x={xOf(toMs(p.date))}
                y={PAD.top - 6}
                textAnchor="middle"
                fontSize="10"
                fill="var(--fg)"
                fontWeight="600"
              >
                {hover} · {formatTick(p.median, active.unit)} ({p.count} tickers)
              </text>
            );
          })()}
        </svg>
      </div>

      {/* Sector legend (always interactive) */}
      <div className="mt-3 space-y-1">
        <div className="flex items-baseline justify-between text-[11px]">
          <span className="uppercase tracking-wider text-muted">
            Sector · click to hide / show, double-click for show only
          </span>
          {excludedSectors.size > 0 && (
            <button
              type="button"
              onClick={showAll}
              className="!text-fg-soft hover:!text-accent"
            >
              Show all
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[11px]">
          {sectors.map((s) => {
            const isOff = excludedSectors.has(s);
            const color = sectorColor.get(s) ?? "#888";
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggleSector(s)}
                onDoubleClick={() => showOnly(s)}
                aria-pressed={!isOff}
                className={`inline-flex items-center gap-1.5 transition-opacity ${
                  isOff ? "opacity-30" : ""
                }`}
              >
                <span
                  aria-hidden="true"
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ background: color }}
                />
                <span
                  className={isOff ? "text-muted line-through" : "text-fg-soft"}
                >
                  {s}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function quantile(sorted: number[], q: number): number | null {
  if (sorted.length === 0) return null;
  const idx = (sorted.length - 1) * q;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] * (hi - idx) + sorted[hi] * (idx - lo);
}

function toMs(iso: string): number {
  return new Date(iso).getTime();
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
