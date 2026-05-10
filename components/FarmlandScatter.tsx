"use client";

import { useMemo, useState } from "react";
import type { PricedFarmlandComp } from "@/lib/farmland-comps";

type Axis = {
  key: keyof PricedFarmlandComp;
  label: string;
  unit: "money" | "pct" | "mult" | "int";
  log?: boolean;
};

const AXES: Axis[] = [
  // Size
  { key: "marketCapMM", label: "Market Cap ($M)", unit: "money", log: true },
  { key: "evMM", label: "Enterprise Value ($M)", unit: "money", log: true },
  { key: "annualRevenueMM", label: "Revenue ($M)", unit: "money", log: true },
  { key: "annualEbitdaMM", label: "EBITDA ($M)", unit: "money", log: true },
  { key: "annualNetIncomeMM", label: "Net Income ($M)", unit: "money" },
  { key: "annualFcfMM", label: "FCF ($M)", unit: "money" },
  { key: "acresK", label: "Acres (thousands)", unit: "int", log: true },
  // Margins
  { key: "ebitdaMargin", label: "EBITDA Margin (%)", unit: "pct" },
  { key: "netIncomeMargin", label: "Net Income Margin (%)", unit: "pct" },
  { key: "roe", label: "ROE (%)", unit: "pct" },
  { key: "roic", label: "ROIC (%)", unit: "pct" },
  // Yields / cap rate
  { key: "divYield", label: "Dividend Yield (%)", unit: "pct" },
  { key: "fcfYield", label: "FCF Yield (%)", unit: "pct" },
  { key: "evCapRate", label: "Cap Rate (%)", unit: "pct" },
  // Multiples
  { key: "evEbitda", label: "EV / EBITDA (×)", unit: "mult" },
  { key: "priceSales", label: "P / S (×)", unit: "mult" },
  { key: "priceEarnings", label: "P / E (×)", unit: "mult" },
  { key: "pNav", label: "P / NAV (×)", unit: "mult" },
  // Per-acre
  { key: "bookPerAcre", label: "Book / Acre ($)", unit: "money" },
  { key: "marketPerAcre", label: "Market / Acre ($)", unit: "money" },
  { key: "evPerAcre", label: "EV / Acre ($)", unit: "money" },
];

// Color palette assigned in legend order. Editorial-style palette
// with enough hue separation for ~25 categories.
const PALETTE = [
  "#0a3d62", "#27ae60", "#d35400", "#c0392b", "#7d3c98",
  "#16a085", "#e67e22", "#2980b9", "#a93226", "#5d6d7e",
  "#8b4513", "#1e7a4f", "#b03a2e", "#6c3483", "#2874a6",
  "#9a7d0a", "#117a65", "#c39bd3", "#566573", "#7e5109",
  "#1a5276", "#943126", "#0e6655", "#9c640c", "#4a235a",
];

type GroupBy = "sector" | "geography" | "operatingCountry";

const GROUP_LABEL: Record<GroupBy, string> = {
  sector: "Sector",
  geography: "Exchange",
  operatingCountry: "Operations",
};

const W = 760;
const H = 480;
const PAD = { top: 24, right: 32, bottom: 56, left: 80 };

export function FarmlandScatter({ rows }: { rows: PricedFarmlandComp[] }) {
  const [xKey, setXKey] = useState<string>("evEbitda");
  const [yKey, setYKey] = useState<string>("roic");
  const [groupBy, setGroupBy] = useState<GroupBy>("sector");
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [removeOutliers, setRemoveOutliers] = useState(false);
  const [hoverTicker, setHoverTicker] = useState<string | null>(null);

  const xAxis = AXES.find((a) => a.key === xKey)!;
  const yAxis = AXES.find((a) => a.key === yKey)!;

  function categoryOf(r: PricedFarmlandComp): string {
    if (groupBy === "sector") return r.sector;
    if (groupBy === "geography") return r.geography;
    return r.operatingCountry ?? r.geography;
  }

  // Build dataset (pre-outlier-filter)
  const allPoints = useMemo(() => {
    const data: {
      ticker: string;
      name: string;
      category: string;
      x: number;
      y: number;
    }[] = [];
    for (const r of rows) {
      const xv = r[xAxis.key] as number | null;
      const yv = r[yAxis.key] as number | null;
      if (xv === null || yv === null || !Number.isFinite(xv) || !Number.isFinite(yv))
        continue;
      if (xAxis.log && xv <= 0) continue;
      if (yAxis.log && yv <= 0) continue;
      data.push({
        ticker: r.ticker,
        name: r.name,
        category: categoryOf(r),
        x: xv,
        y: yv,
      });
    }
    return data;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, xKey, yKey, xAxis, yAxis, groupBy]);

  // Categories ordered by frequency (most common first)
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of allPoints) {
      counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([k]) => k);
  }, [allPoints]);

  // Stable color per category, assigned in PALETTE order
  const colorByCategory = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((c, i) => map.set(c, PALETTE[i % PALETTE.length]));
    return map;
  }, [categories]);

  // Apply category-include filter
  const includedPoints = useMemo(
    () => allPoints.filter((p) => !excluded.has(p.category)),
    [allPoints, excluded],
  );

  // Optionally drop outliers using 1.5×IQR on each axis (computed on
  // the included subset so excluding sectors first then trimming).
  const points = useMemo(() => {
    if (!removeOutliers || includedPoints.length < 4) return includedPoints;
    const xVals = includedPoints.map((p) => p.x).sort((a, b) => a - b);
    const yVals = includedPoints.map((p) => p.y).sort((a, b) => a - b);
    const q = (arr: number[], p: number) => {
      const idx = (arr.length - 1) * p;
      const lo = Math.floor(idx);
      const hi = Math.ceil(idx);
      if (lo === hi) return arr[lo];
      return arr[lo] * (hi - idx) + arr[hi] * (idx - lo);
    };
    const xQ1 = q(xVals, 0.25);
    const xQ3 = q(xVals, 0.75);
    const xIQR = xQ3 - xQ1;
    const yQ1 = q(yVals, 0.25);
    const yQ3 = q(yVals, 0.75);
    const yIQR = yQ3 - yQ1;
    const xLo = xQ1 - 1.5 * xIQR;
    const xHi = xQ3 + 1.5 * xIQR;
    const yLo = yQ1 - 1.5 * yIQR;
    const yHi = yQ3 + 1.5 * yIQR;
    return includedPoints.filter(
      (p) => p.x >= xLo && p.x <= xHi && p.y >= yLo && p.y <= yHi,
    );
  }, [includedPoints, removeOutliers]);

  function toggleCategory(c: string) {
    setExcluded((cur) => {
      const next = new Set(cur);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  }
  function showOnly(c: string) {
    setExcluded(new Set(categories.filter((k) => k !== c)));
  }
  function showAll() {
    setExcluded(new Set());
  }

  // Scales (computed on visible points only)
  const xMin = points.length ? Math.min(...points.map((p) => p.x)) : 0;
  const xMax = points.length ? Math.max(...points.map((p) => p.x)) : 1;
  const yMin = points.length ? Math.min(...points.map((p) => p.y)) : 0;
  const yMax = points.length ? Math.max(...points.map((p) => p.y)) : 1;
  const xRange = xMax - xMin || 1;
  const yRange = yMax - yMin || 1;
  const xLo = xAxis.log ? xMin * 0.7 : xMin - xRange * 0.05;
  const xHi = xAxis.log ? xMax * 1.4 : xMax + xRange * 0.05;
  const yLo = yAxis.log ? yMin * 0.7 : yMin - yRange * 0.05;
  const yHi = yAxis.log ? yMax * 1.4 : yMax + yRange * 0.05;

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const xOf = (v: number) => {
    if (xAxis.log) {
      const lo = Math.log(Math.max(xLo, 1e-9));
      const hi = Math.log(Math.max(xHi, 1e-8));
      const lv = Math.log(Math.max(v, 1e-9));
      return PAD.left + ((lv - lo) / (hi - lo)) * innerW;
    }
    return PAD.left + ((v - xLo) / (xHi - xLo)) * innerW;
  };
  const yOf = (v: number) => {
    if (yAxis.log) {
      const lo = Math.log(Math.max(yLo, 1e-9));
      const hi = Math.log(Math.max(yHi, 1e-8));
      const lv = Math.log(Math.max(v, 1e-9));
      return PAD.top + (1 - (lv - lo) / (hi - lo)) * innerH;
    }
    return PAD.top + (1 - (v - yLo) / (yHi - yLo)) * innerH;
  };

  const xTicks = ticks(xLo, xHi, !!xAxis.log);
  const yTicks = ticks(yLo, yHi, !!yAxis.log);

  // Linear regression on the visible points. When an axis uses a log
  // scale, fit on log-space values so the line is straight in screen
  // coordinates (i.e. log-log or semi-log fit).
  const fit = useMemo(() => {
    if (points.length < 3) return null;
    const tx = (v: number) => (xAxis.log ? Math.log(Math.max(v, 1e-9)) : v);
    const ty = (v: number) => (yAxis.log ? Math.log(Math.max(v, 1e-9)) : v);
    const n = points.length;
    let sx = 0, sy = 0, sxx = 0, sxy = 0, syy = 0;
    for (const p of points) {
      const x = tx(p.x);
      const y = ty(p.y);
      sx += x; sy += y; sxx += x * x; sxy += x * y; syy += y * y;
    }
    const denom = n * sxx - sx * sx;
    if (denom === 0) return null;
    const slope = (n * sxy - sx * sy) / denom;
    const intercept = (sy - slope * sx) / n;
    const meanY = sy / n;
    let ssRes = 0, ssTot = 0;
    for (const p of points) {
      const yhat = slope * tx(p.x) + intercept;
      ssRes += (ty(p.y) - yhat) ** 2;
      ssTot += (ty(p.y) - meanY) ** 2;
    }
    const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;
    return { slope, intercept, r2 };
  }, [points, xAxis.log, yAxis.log]);

  // Endpoints of the regression line in screen space, clipped to the
  // plot rectangle. Sample a few interior X values too so a curved
  // semi-log fit still renders smoothly.
  const fitPath = useMemo(() => {
    if (!fit) return null;
    const tx = (v: number) => (xAxis.log ? Math.log(Math.max(v, 1e-9)) : v);
    const invY = (y: number) => (yAxis.log ? Math.exp(y) : y);
    const samples: { x: number; y: number }[] = [];
    const N = 64;
    for (let i = 0; i <= N; i++) {
      const xv = xAxis.log
        ? Math.exp(Math.log(xLo) + (i / N) * (Math.log(xHi) - Math.log(xLo)))
        : xLo + (i / N) * (xHi - xLo);
      const yv = invY(fit.slope * tx(xv) + fit.intercept);
      samples.push({ x: xv, y: yv });
    }
    const within = samples.filter((s) => s.y >= yLo && s.y <= yHi);
    if (within.length < 2) return null;
    return within
      .map((s, i) => `${i === 0 ? "M" : "L"}${xOf(s.x).toFixed(1)},${yOf(s.y).toFixed(1)}`)
      .join(" ");
  }, [fit, xAxis.log, yAxis.log, xLo, xHi, yLo, yHi, xOf, yOf]);

  return (
    <section className="mt-12 border-t border-rule pt-8">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-xl font-semibold tracking-tight">
          Scatter
        </h2>
        <p className="text-xs text-muted">
          {points.length} of {allPoints.length} tickers shown
          {excluded.size > 0 ? ` · ${excluded.size} ${GROUP_LABEL[groupBy].toLowerCase()} hidden` : ""}
          {removeOutliers ? " · outliers removed" : ""}
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3 text-xs">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-muted">
            X axis
          </span>
          <select
            value={xKey}
            onChange={(e) => setXKey(e.target.value)}
            className="rounded-sm border border-rule bg-surface px-2 py-1 text-xs"
          >
            {AXES.map((a) => (
              <option key={String(a.key)} value={String(a.key)}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-muted">
            Y axis
          </span>
          <select
            value={yKey}
            onChange={(e) => setYKey(e.target.value)}
            className="rounded-sm border border-rule bg-surface px-2 py-1 text-xs"
          >
            {AXES.map((a) => (
              <option key={String(a.key)} value={String(a.key)}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-muted">
            Color by
          </span>
          <div className="flex gap-1">
            {(["sector", "geography", "operatingCountry"] as GroupBy[]).map(
              (g) => {
                const on = groupBy === g;
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => {
                      setGroupBy(g);
                      setExcluded(new Set());
                    }}
                    aria-pressed={on}
                    className={`rounded-sm border px-2.5 py-1 text-xs transition-colors ${
                      on
                        ? "border-accent bg-accent !text-bg"
                        : "border-rule bg-surface !text-fg hover:border-accent hover:!text-accent"
                    }`}
                  >
                    {GROUP_LABEL[g]}
                  </button>
                );
              },
            )}
          </div>
        </label>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={removeOutliers}
            onChange={(e) => setRemoveOutliers(e.target.checked)}
            className="accent-[var(--accent)]"
          />
          <span>Remove outliers (1.5×IQR)</span>
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
                {formatTick(t, yAxis.unit)}
              </text>
            </g>
          ))}
          {/* X gridlines + labels */}
          {xTicks.map((t, i) => (
            <g key={`x-${i}`}>
              <line
                x1={xOf(t)}
                x2={xOf(t)}
                y1={PAD.top}
                y2={H - PAD.bottom}
                stroke="var(--border)"
                strokeDasharray="2 3"
              />
              <text
                x={xOf(t)}
                y={H - PAD.bottom + 14}
                textAnchor="middle"
                fontSize="10"
                fill="var(--muted)"
              >
                {formatTick(t, xAxis.unit)}
              </text>
            </g>
          ))}
          {/* Axis labels */}
          <text
            x={PAD.left + innerW / 2}
            y={H - 8}
            textAnchor="middle"
            fontSize="11"
            fill="var(--fg)"
          >
            {xAxis.label}
          </text>
          <text
            x={-PAD.top - innerH / 2}
            y={16}
            textAnchor="middle"
            fontSize="11"
            fill="var(--fg)"
            transform={`rotate(-90)`}
          >
            {yAxis.label}
          </text>

          {/* Regression line */}
          {fitPath && (
            <path
              d={fitPath}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="1.25"
              strokeDasharray="4 3"
              opacity={0.85}
            />
          )}
          {fit && (
            <text
              x={W - PAD.right - 6}
              y={PAD.top + 12}
              textAnchor="end"
              fontSize="10"
              fill="var(--accent)"
              fontWeight="600"
            >
              {`r² = ${fit.r2.toFixed(3)}`}
              {xAxis.log || yAxis.log ? " · log fit" : ""}
            </text>
          )}

          {/* Points */}
          {points.map((p) => {
            const cx = xOf(p.x);
            const cy = yOf(p.y);
            const color = colorByCategory.get(p.category) ?? "#888";
            const isHover = hoverTicker === p.ticker;
            return (
              <g key={p.ticker}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={isHover ? 6 : 4}
                  fill={color}
                  fillOpacity={isHover ? 1 : 0.7}
                  stroke="var(--bg)"
                  strokeWidth="1"
                  onMouseEnter={() => setHoverTicker(p.ticker)}
                  onMouseLeave={() => setHoverTicker(null)}
                  style={{ cursor: "pointer" }}
                />
                {isHover && (
                  <text
                    x={cx + 8}
                    y={cy - 8}
                    fontSize="10"
                    fill="var(--fg)"
                    fontWeight="600"
                  >
                    {p.ticker} · {p.name}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Interactive legend */}
      <div className="mt-3 space-y-2">
        <div className="flex items-baseline justify-between text-[11px]">
          <span className="uppercase tracking-wider text-muted">
            {GROUP_LABEL[groupBy]} · click to toggle
          </span>
          {excluded.size > 0 && (
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
          {categories.map((c) => {
            const isOff = excluded.has(c);
            const color = colorByCategory.get(c) ?? "#888";
            return (
              <button
                key={c}
                type="button"
                onClick={() => toggleCategory(c)}
                onDoubleClick={() => showOnly(c)}
                aria-pressed={!isOff}
                title={`Click to ${isOff ? "show" : "hide"} · double-click to show only`}
                className={`inline-flex items-center gap-1.5 transition-opacity ${
                  isOff ? "opacity-30" : ""
                }`}
              >
                <span
                  aria-hidden="true"
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ background: color }}
                />
                <span className={isOff ? "text-muted line-through" : "text-fg-soft"}>
                  {c}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ticks(lo: number, hi: number, log: boolean): number[] {
  if (!log) {
    const range = hi - lo;
    const step = niceStep(range / 5);
    const start = Math.ceil(lo / step) * step;
    const out: number[] = [];
    for (let v = start; v <= hi + 1e-9; v += step) out.push(round(v));
    return out;
  }
  const out: number[] = [];
  if (lo <= 0) lo = 1e-3;
  const lo10 = Math.floor(Math.log10(lo));
  const hi10 = Math.ceil(Math.log10(hi));
  for (let p = lo10; p <= hi10; p++) {
    const v = Math.pow(10, p);
    if (v >= lo && v <= hi) out.push(v);
  }
  return out;
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

function round(v: number): number {
  return Math.round(v * 1000) / 1000;
}

function formatTick(v: number, unit: Axis["unit"]): string {
  if (unit === "money") {
    if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(1)}B`;
    if (Math.abs(v) >= 1) return `$${Math.round(v)}M`;
    return `$${v.toFixed(2)}`;
  }
  if (unit === "pct") return `${v.toFixed(1)}%`;
  if (unit === "mult") return `${v.toFixed(1)}×`;
  return Math.round(v).toLocaleString("en-US");
}
