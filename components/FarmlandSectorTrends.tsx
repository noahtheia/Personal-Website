"use client";

// Per-period sector-block KPIs displayed as a tabbed single-chart view
// styled to match the Financial Snapshot. Reads from period.{block}.{field}
// (new nested shape) and falls back to flat per-period fields for legacy
// palm/tea data. Only metrics with 2+ populated points are surfaced as tabs.

import { useMemo, useRef, useState } from "react";
import type { Financials, FinancialsPeriod } from "@/lib/farmland-financials";
import { tipFor } from "@/lib/farmland-glossary";

type Extractor = (p: FinancialsPeriod) => number | null | undefined;

type Metric = {
  id: string;
  label: string;
  unit: string;
  format: (v: number) => string;
  formatTick: (v: number) => string;
  extract: Extractor;
};

const METRICS: Metric[] = [
  // Plantation — palm + tea
  {
    id: "ffbYield",
    label: "FFB yield",
    unit: "t/ha",
    format: (v) => `${v.toFixed(1)} t/ha`,
    formatTick: (v) => v.toFixed(1),
    extract: (p) => p.plantation?.ffbYieldTPerHa ?? p.ffbYieldTPerHa,
  },
  {
    id: "oer",
    label: "OER",
    unit: "%",
    format: (v) => `${v.toFixed(2)}%`,
    formatTick: (v) => `${v.toFixed(1)}%`,
    extract: (p) => p.plantation?.oerPct ?? p.cpoExtractionRatePct,
  },
  {
    id: "ker",
    label: "KER",
    unit: "%",
    format: (v) => `${v.toFixed(2)}%`,
    formatTick: (v) => `${v.toFixed(1)}%`,
    extract: (p) => p.plantation?.kerPct ?? p.pkExtractionRatePct,
  },
  {
    id: "cpoAsp",
    label: "CPO ASP",
    unit: "/t",
    format: (v) => fmtCompact(v),
    formatTick: (v) => fmtCompact(v),
    extract: (p) => p.plantation?.cpoAspPerMt,
  },
  {
    id: "cpoCost",
    label: "CPO cost",
    unit: "/t",
    format: (v) => fmtCompact(v),
    formatTick: (v) => fmtCompact(v),
    extract: (p) => p.plantation?.cpoCostPerMt,
  },
  {
    id: "ffbProd",
    label: "FFB production",
    unit: "kt",
    format: (v) => `${fmtCompact(v)} kt`,
    formatTick: (v) => fmtCompact(v),
    extract: (p) => p.ffbProductionTonnesK,
  },
  {
    id: "cpoProd",
    label: "CPO production",
    unit: "kt",
    format: (v) => `${fmtCompact(v)} kt`,
    formatTick: (v) => fmtCompact(v),
    extract: (p) => p.cpoProductionTonnesK,
  },
  {
    id: "matureHa",
    label: "Mature hectares",
    unit: "K",
    format: (v) => `${fmtCompact(v)} K ha`,
    formatTick: (v) => fmtCompact(v),
    extract: (p) => p.matureHectaresK,
  },
  {
    id: "rspo",
    label: "RSPO certified",
    unit: "%",
    format: (v) => `${v.toFixed(0)}%`,
    formatTick: (v) => `${v.toFixed(0)}%`,
    extract: (p) => p.plantation?.rspoPct,
  },
  // Tea
  {
    id: "madeTea",
    label: "Made tea",
    unit: "kt",
    format: (v) => `${fmtCompact(v)} kt`,
    formatTick: (v) => fmtCompact(v),
    extract: (p) => p.madeTeaProductionTonnesK ?? p.teaProductionTonnesK,
  },
  {
    id: "teaYield",
    label: "Tea yield",
    unit: "kg/ha",
    format: (v) => `${fmtCompact(v)} kg/ha`,
    formatTick: (v) => fmtCompact(v),
    extract: (p) => p.teaYieldKgPerHa,
  },
  // Aquaculture
  {
    id: "harvest",
    label: "Harvest",
    unit: "kt GWT",
    format: (v) => `${fmtCompact(v)} kt`,
    formatTick: (v) => fmtCompact(v),
    extract: (p) => p.aquaculture?.harvestVolumeKtGwt,
  },
  {
    id: "ebitPerKg",
    label: "EBIT / kg",
    unit: "NOK",
    format: (v) => `${v.toFixed(1)} NOK`,
    formatTick: (v) => v.toFixed(1),
    extract: (p) => p.aquaculture?.ebitPerKgNok,
  },
  {
    id: "costPerKg",
    label: "Cost / kg",
    unit: "NOK",
    format: (v) => `${v.toFixed(1)} NOK`,
    formatTick: (v) => v.toFixed(1),
    extract: (p) => p.aquaculture?.costPerKgNok,
  },
  // Protein
  {
    id: "capUtil",
    label: "Capacity utilization",
    unit: "%",
    format: (v) => `${v.toFixed(0)}%`,
    formatTick: (v) => `${v.toFixed(0)}%`,
    extract: (p) => p.protein?.capacityUtilizationPct,
  },
  {
    id: "plants",
    label: "Plants",
    unit: "count",
    format: (v) => `${Math.round(v)}`,
    formatTick: (v) => `${Math.round(v)}`,
    extract: (p) => p.protein?.plants,
  },
  // Crop Inputs
  {
    id: "gasCost",
    label: "Gas cost",
    unit: "$/MMBtu",
    format: (v) => `$${v.toFixed(2)}`,
    formatTick: (v) => `$${v.toFixed(1)}`,
    extract: (p) => p.cropInputs?.gasCostUSDPerMMBtu,
  },
  {
    id: "rdSales",
    label: "R&D / sales",
    unit: "%",
    format: (v) => `${v.toFixed(2)}%`,
    formatTick: (v) => `${v.toFixed(1)}%`,
    extract: (p) => p.cropInputs?.rdSpendPctOfRevenue,
  },
  // Dairy
  {
    id: "milkIntake",
    label: "Milk intake",
    unit: "ML",
    format: (v) => `${fmtCompact(v)} ML`,
    formatTick: (v) => fmtCompact(v),
    extract: (p) => p.dairy?.milkIntakeMlitres,
  },
  {
    id: "cowHerd",
    label: "Cow herd",
    unit: "K",
    format: (v) => `${fmtCompact(v)} K`,
    formatTick: (v) => fmtCompact(v),
    extract: (p) => p.dairy?.cowHerdK,
  },
  // Egg
  {
    id: "layingFlock",
    label: "Laying flock",
    unit: "M",
    format: (v) => `${v.toFixed(1)}M`,
    formatTick: (v) => v.toFixed(1),
    extract: (p) => p.egg?.layingHenFlockMM,
  },
  {
    id: "eggAsp",
    label: "ASP / dozen",
    unit: "$",
    format: (v) => `$${v.toFixed(2)}`,
    formatTick: (v) => `$${v.toFixed(2)}`,
    extract: (p) => p.egg?.avgSellingPricePerDozen,
  },
  // Trader
  {
    id: "throughput",
    label: "Throughput",
    unit: "MMT",
    format: (v) => `${v.toFixed(1)} MMT`,
    formatTick: (v) => v.toFixed(1),
    extract: (p) => p.trader?.throughputMtMM,
  },
  {
    id: "ethanol",
    label: "Ethanol",
    unit: "M gal",
    format: (v) => `${fmtCompact(v)} M gal`,
    formatTick: (v) => fmtCompact(v),
    extract: (p) => p.trader?.ethanolGalsMM,
  },
  // REIT
  {
    id: "occupancy",
    label: "Occupancy",
    unit: "%",
    format: (v) => `${v.toFixed(1)}%`,
    formatTick: (v) => `${v.toFixed(0)}%`,
    extract: (p) => p.reit?.occupancyPct,
  },
  {
    id: "affoPerShare",
    label: "AFFO / share",
    unit: "$",
    format: (v) => `$${v.toFixed(2)}`,
    formatTick: (v) => `$${v.toFixed(2)}`,
    extract: (p) => p.reit?.affoPerShare,
  },
];

const W = 760;
const H = 320;
const PAD = { top: 28, right: 32, bottom: 36, left: 64 };

type Series = {
  metric: Metric;
  points: { dateMs: number; value: number; endDate: string }[];
};

export function FarmlandSectorTrends({
  financials,
  marketShareSeries,
  sector,
}: {
  financials: Financials | null;
  marketShareSeries?: { endDate: string; value: number }[];
  sector?: string;
}) {
  if (!financials || financials.periods.length < 2) return null;

  const fyPeriods = useMemo(
    () =>
      [...financials.periods]
        .filter((p) => p.periodType === "FY" || p.periodType === "LTM")
        .sort((a, b) => a.endDate.localeCompare(b.endDate)),
    [financials],
  );

  const qPeriods = useMemo(
    () =>
      [...financials.periods]
        .filter((p) => p.periodType === "Q" || p.periodType === "H")
        .sort((a, b) => a.endDate.localeCompare(b.endDate)),
    [financials],
  );

  const populated: Series[] = useMemo(() => {
    const out: Series[] = [];

    if (marketShareSeries && marketShareSeries.length >= 2) {
      out.push({
        metric: {
          id: "marketShare",
          label: sector
            ? `Share of ${sector.replace(/ \/ .*$/, "")} sector`
            : "Sector market share",
          unit: "%",
          format: (v) => `${v.toFixed(2)}%`,
          formatTick: (v) => `${v.toFixed(1)}%`,
          extract: () => null,
        },
        points: marketShareSeries.map((s) => ({
          dateMs: new Date(s.endDate).getTime(),
          value: s.value,
          endDate: s.endDate,
        })),
      });
    }

    const buildPts = (rows: typeof fyPeriods, m: Metric) =>
      rows
        .map((p) => ({
          dateMs: new Date(p.endDate).getTime(),
          value: m.extract(p),
          endDate: p.endDate,
        }))
        .filter(
          (d): d is { dateMs: number; value: number; endDate: string } =>
            typeof d.value === "number" && Number.isFinite(d.value),
        );

    for (const m of METRICS) {
      // Prefer the highest-cadence series with sufficient density:
      // quarterly when 4+ Q rows are populated, otherwise FY/LTM. Keeps
      // the chart on a single cadence so no normalization gymnastics
      // (Q-flow vs FY-flow units would otherwise mix).
      const qPts = buildPts(qPeriods, m);
      const fyPts = buildPts(fyPeriods, m);
      const chosen = qPts.length >= 4 ? qPts : fyPts;
      if (chosen.length >= 2) out.push({ metric: m, points: chosen });
    }
    return out;
  }, [fyPeriods, qPeriods, marketShareSeries, sector]);

  const [activeId, setActiveId] = useState<string>(
    () => populated[0]?.metric.id ?? "",
  );
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const active = populated.find((s) => s.metric.id === activeId) ?? populated[0];

  const view = useMemo(() => (active ? buildView(active) : null), [active]);

  if (populated.length === 0) {
    return (
      <section className="mt-8 rounded-sm border border-rule bg-surface p-6">
        <h2 className="font-display text-lg font-semibold">
          No sector-trend data
        </h2>
        <p className="mt-2 text-sm text-muted">
          Per-period sector-specific KPIs (FFB yield, capacity utilization,
          harvest volume, etc.) haven&apos;t been populated for this issuer
          yet.
        </p>
      </section>
    );
  }

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!view) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    let idx = 0;
    let best = Infinity;
    for (let i = 0; i < view.xs.length; i++) {
      const d = Math.abs(view.xs[i] - x);
      if (d < best) {
        best = d;
        idx = i;
      }
    }
    setHoverIdx(idx);
  }

  function onLeave() {
    setHoverIdx(null);
  }

  if (!active || !view) return null;

  const last = active.points[active.points.length - 1];
  const first = active.points[0];
  const hovered = hoverIdx !== null ? active.points[hoverIdx] : null;
  const direction =
    last.value > first.value
      ? "var(--positive)"
      : last.value < first.value
      ? "var(--negative)"
      : "var(--accent)";
  const tip = tipFor(active.metric.label);

  return (
    <section className="mt-8">
      <SectionHeader
        title="Sector trends"
        subtitle={`${populated.length} populated KPIs · ${
          active.points[0].endDate.slice(0, 4)
        }–${active.points[active.points.length - 1].endDate.slice(0, 4)}`}
      />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-b border-rule pb-3">
        <div role="tablist" aria-label="KPI" className="flex flex-wrap gap-1">
          {populated.map((s) => {
            const on = s.metric.id === active.metric.id;
            return (
              <button
                key={s.metric.id}
                role="tab"
                aria-selected={on}
                onClick={() => {
                  setActiveId(s.metric.id);
                  setHoverIdx(null);
                }}
                className={`rounded-sm border px-2.5 py-1 text-xs transition-colors ${
                  on
                    ? "border-[var(--accent-warm)] bg-[var(--accent-warm)] !text-fg"
                    : "border-rule !text-fg hover:border-[var(--accent-warm)] hover:!text-[var(--accent-warm-hover)]"
                }`}
              >
                {s.metric.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <div
            className="font-display text-2xl font-semibold tabular-nums"
            style={{ color: direction }}
          >
            {hovered
              ? active.metric.format(hovered.value)
              : active.metric.format(last.value)}
          </div>
          <div
            className={`text-xs text-muted ${
              tip ? "cursor-help decoration-dotted underline-offset-2" : ""
            }`}
            style={tip ? { textDecorationLine: "underline" } : undefined}
            title={tip}
          >
            {hovered
              ? formatDate(hovered.dateMs)
              : `${formatDate(first.dateMs)} → ${formatDate(last.dateMs)}`}{" "}
            · {active.points.length} pts
          </div>
        </div>
        <div className="text-right text-xs">
          <div className="text-muted">First → Latest</div>
          <div className="text-sm font-medium tabular-nums">
            {active.metric.format(first.value)} →{" "}
            <span style={{ color: direction }}>
              {active.metric.format(last.value)}
            </span>
          </div>
        </div>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${active.metric.label} trend`}
        className="mt-3 w-full touch-none select-none"
        onPointerMove={onMove}
        onPointerLeave={onLeave}
      >
        {view.yTicks.map((t, i) => (
          <g key={`y-${i}`}>
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
              {active.metric.formatTick(t.value)}
            </text>
          </g>
        ))}

        {view.xTicks.map((t, i) => (
          <text
            key={`x-${i}`}
            x={t.x}
            y={H - PAD.bottom + 16}
            textAnchor={t.anchor}
            fontSize="10"
            fill="var(--muted)"
          >
            {t.label}
          </text>
        ))}

        <path
          d={view.path}
          fill="none"
          stroke={direction}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {view.xs.map((x, i) => (
          <circle
            key={`pt-${i}`}
            cx={x}
            cy={view.ys[i]}
            r={hoverIdx === i ? 4 : 2.5}
            fill={direction}
          />
        ))}

        {hoverIdx !== null && (
          <>
            <line
              x1={view.xs[hoverIdx]}
              x2={view.xs[hoverIdx]}
              y1={PAD.top}
              y2={H - PAD.bottom}
              stroke="var(--muted)"
              strokeDasharray="2 3"
            />
          </>
        )}
      </svg>
    </section>
  );
}

function buildView(s: Series) {
  const values = s.points.map((p) => p.value);
  const dates = s.points.map((p) => p.dateMs);
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (lo === hi) {
    const pad = Math.abs(lo) * 0.05 || 1;
    lo -= pad;
    hi += pad;
  }
  lo = niceFloor(lo);
  hi = niceCeil(hi);
  const dateMin = Math.min(...dates);
  const dateMax = Math.max(...dates);
  const dateRange = dateMax - dateMin || 1;

  const xs = s.points.map(
    (p) => PAD.left + ((p.dateMs - dateMin) / dateRange) * (W - PAD.left - PAD.right),
  );
  const ys = s.points.map(
    (p) =>
      H - PAD.bottom - ((p.value - lo) / (hi - lo)) * (H - PAD.top - PAD.bottom),
  );
  const path = xs
    .map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`)
    .join(" ");

  const yTicks = makeYTicks(lo, hi);
  const xTicks = makeXTicks(s.points);

  return { path, xs, ys, yTicks, xTicks };
}

function makeYTicks(lo: number, hi: number) {
  const n = 4;
  const step = (hi - lo) / n;
  const ticks: { value: number; y: number }[] = [];
  for (let i = 0; i <= n; i++) {
    const value = lo + step * i;
    const y =
      H - PAD.bottom - ((value - lo) / (hi - lo)) * (H - PAD.top - PAD.bottom);
    ticks.push({ value, y });
  }
  return ticks;
}

function makeXTicks(
  points: { dateMs: number; value: number; endDate: string }[],
) {
  if (points.length === 0) return [];
  const first = points[0];
  const last = points[points.length - 1];
  const dateMin = first.dateMs;
  const dateMax = last.dateMs;
  const range = dateMax - dateMin || 1;
  const yearSpan =
    new Date(last.endDate).getUTCFullYear() -
    new Date(first.endDate).getUTCFullYear();
  // Adapt tick density to span: 3 ticks for short series, 5 for >5yr,
  // 7 for >15yr — useful when quarterly data extends across decades.
  const nTicks = yearSpan > 15 ? 7 : yearSpan > 5 ? 5 : 3;
  const ticks: { x: number; label: string; anchor: "start" | "middle" | "end" }[] =
    [];
  for (let i = 0; i < nTicks; i++) {
    const t = i / (nTicks - 1);
    const x = PAD.left + t * (W - PAD.left - PAD.right);
    const targetMs = dateMin + t * range;
    const nearest = points.reduce((best, p) =>
      Math.abs(p.dateMs - targetMs) < Math.abs(best.dateMs - targetMs) ? p : best,
    );
    const anchor: "start" | "middle" | "end" =
      i === 0 ? "start" : i === nTicks - 1 ? "end" : "middle";
    ticks.push({ x, label: nearest.endDate.slice(0, 4), anchor });
  }
  return ticks;
}

function niceFloor(v: number) {
  if (v === 0) return 0;
  if (v < 0) return -niceCeil(-v);
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  return Math.floor(v / mag) * mag;
}

function niceCeil(v: number) {
  if (v <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  return Math.ceil(v / mag) * mag;
}

function formatDate(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e4) return `${(n / 1e3).toFixed(1)}K`;
  return Math.round(n).toLocaleString("en-US");
}

function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="border-b border-rule pb-2">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      {subtitle && (
        <p className="mt-1 text-xs uppercase tracking-wider text-muted">
          {subtitle}
        </p>
      )}
    </div>
  );
}
