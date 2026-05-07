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

const SECTOR_COLORS: Record<string, string> = {
  "Farmland Owner / REIT": "#0a3d62",
  "Integrated Farm Operator": "#16a085",
  "Plantation Operator": "#27ae60",
  "Pastoral / Livestock": "#8b4513",
  "Diversified Agribusiness": "#d35400",
  "Protein Producer": "#c0392b",
  "Dairy / Egg Producer": "#e67e22",
  "Aquaculture / Seafood": "#2980b9",
  "Agribusiness / Trader": "#7d3c98",
  "Crop Inputs / Fertilizer": "#a93226",
  "Rural Services": "#5d6d7e",
};

const W = 760;
const H = 480;
const PAD = { top: 24, right: 32, bottom: 56, left: 80 };

export function FarmlandScatter({ rows }: { rows: PricedFarmlandComp[] }) {
  const [xKey, setXKey] = useState<string>("evEbitda");
  const [yKey, setYKey] = useState<string>("roic");
  const [hoverTicker, setHoverTicker] = useState<string | null>(null);

  const xAxis = AXES.find((a) => a.key === xKey)!;
  const yAxis = AXES.find((a) => a.key === yKey)!;

  // Build dataset
  const points = useMemo(() => {
    const data: {
      ticker: string;
      name: string;
      sector: string;
      x: number;
      y: number;
    }[] = [];
    for (const r of rows) {
      const xv = r[xAxis.key] as number | null;
      const yv = r[yAxis.key] as number | null;
      if (xv === null || yv === null || !Number.isFinite(xv) || !Number.isFinite(yv))
        continue;
      // For log axes, drop non-positive values
      if (xAxis.log && xv <= 0) continue;
      if (yAxis.log && yv <= 0) continue;
      data.push({
        ticker: r.ticker,
        name: r.name,
        sector: r.sector,
        x: xv,
        y: yv,
      });
    }
    return data;
  }, [rows, xKey, yKey, xAxis, yAxis]);

  // Scales
  const xMin = points.length ? Math.min(...points.map((p) => p.x)) : 0;
  const xMax = points.length ? Math.max(...points.map((p) => p.x)) : 1;
  const yMin = points.length ? Math.min(...points.map((p) => p.y)) : 0;
  const yMax = points.length ? Math.max(...points.map((p) => p.y)) : 1;

  // Pad ranges
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

  // Tick generation
  const xTicks = ticks(xLo, xHi, !!xAxis.log);
  const yTicks = ticks(yLo, yHi, !!yAxis.log);

  const sectors = Array.from(new Set(rows.map((r) => r.sector))).sort();

  return (
    <section className="mt-12 border-t border-rule pt-8">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-xl font-semibold tracking-tight">
          Scatter
        </h2>
        <p className="text-xs text-muted">
          {points.length} of {rows.length} tickers (rows missing either
          axis are dropped)
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

          {/* Points */}
          {points.map((p) => {
            const cx = xOf(p.x);
            const cy = yOf(p.y);
            const color = SECTOR_COLORS[p.sector] ?? "#888";
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

      {/* Sector legend */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
        {sectors.map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: SECTOR_COLORS[s] ?? "#888" }}
            />
            <span className="text-muted">{s}</span>
          </span>
        ))}
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
  // Log: pick decade ticks
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
