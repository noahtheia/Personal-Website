"use client";

// Per-period sector-block KPIs as a grid of mini sparklines on the
// detail page. Reads from period.{block}.{field} (new nested shape) and
// falls back to flat per-period fields (existing palm/tea data already
// in the financials JSONs for ~32 plantation tickers). Only renders
// metrics with 2+ periods of populated data.

import type { Financials, FinancialsPeriod } from "@/lib/farmland-financials";
import { tipFor } from "@/lib/farmland-glossary";

type Extractor = (p: FinancialsPeriod) => number | null | undefined;

type Metric = {
  label: string;
  unit: string;
  format: (v: number) => string;
  extract: Extractor;
};

// Metrics shown in the trend grid. Includes both nested (new) and flat
// (legacy palm/tea) shapes; the renderer accepts whichever is populated.
const METRICS: Metric[] = [
  // Plantation — palm + tea
  {
    label: "FFB yield",
    unit: "t/ha",
    format: (v) => v.toFixed(1),
    extract: (p) => p.plantation?.ffbYieldTPerHa ?? p.ffbYieldTPerHa,
  },
  {
    label: "OER",
    unit: "%",
    format: (v) => `${v.toFixed(1)}%`,
    extract: (p) => p.plantation?.oerPct ?? p.cpoExtractionRatePct,
  },
  {
    label: "KER",
    unit: "%",
    format: (v) => `${v.toFixed(1)}%`,
    extract: (p) => p.plantation?.kerPct ?? p.pkExtractionRatePct,
  },
  {
    label: "CPO ASP",
    unit: "/t",
    format: (v) => fmtCompact(v),
    extract: (p) => p.plantation?.cpoAspPerMt,
  },
  {
    label: "CPO cost",
    unit: "/t",
    format: (v) => fmtCompact(v),
    extract: (p) => p.plantation?.cpoCostPerMt,
  },
  {
    label: "FFB production",
    unit: "kt",
    format: (v) => fmtCompact(v),
    extract: (p) => p.ffbProductionTonnesK,
  },
  {
    label: "CPO production",
    unit: "kt",
    format: (v) => fmtCompact(v),
    extract: (p) => p.cpoProductionTonnesK,
  },
  {
    label: "Mature hectares",
    unit: "K",
    format: (v) => fmtCompact(v),
    extract: (p) => p.matureHectaresK,
  },
  {
    label: "RSPO certified",
    unit: "%",
    format: (v) => `${v.toFixed(0)}%`,
    extract: (p) => p.plantation?.rspoPct,
  },
  // Tea
  {
    label: "Made tea",
    unit: "kt",
    format: (v) => fmtCompact(v),
    extract: (p) => p.madeTeaProductionTonnesK ?? p.teaProductionTonnesK,
  },
  {
    label: "Tea yield",
    unit: "kg/ha",
    format: (v) => fmtCompact(v),
    extract: (p) => p.teaYieldKgPerHa,
  },
  // Aquaculture
  {
    label: "Harvest",
    unit: "kt GWT",
    format: (v) => fmtCompact(v),
    extract: (p) => p.aquaculture?.harvestVolumeKtGwt,
  },
  {
    label: "EBIT / kg",
    unit: "NOK",
    format: (v) => v.toFixed(1),
    extract: (p) => p.aquaculture?.ebitPerKgNok,
  },
  {
    label: "Cost / kg",
    unit: "NOK",
    format: (v) => v.toFixed(1),
    extract: (p) => p.aquaculture?.costPerKgNok,
  },
  // Protein
  {
    label: "Capacity utilization",
    unit: "%",
    format: (v) => `${v.toFixed(0)}%`,
    extract: (p) => p.protein?.capacityUtilizationPct,
  },
  {
    label: "Plants",
    unit: "count",
    format: (v) => `${Math.round(v)}`,
    extract: (p) => p.protein?.plants,
  },
  // Crop Inputs
  {
    label: "Gas cost",
    unit: "$/MMBtu",
    format: (v) => `$${v.toFixed(2)}`,
    extract: (p) => p.cropInputs?.gasCostUSDPerMMBtu,
  },
  {
    label: "R&D / sales",
    unit: "%",
    format: (v) => `${v.toFixed(1)}%`,
    extract: (p) => p.cropInputs?.rdSpendPctOfRevenue,
  },
  // Dairy
  {
    label: "Milk intake",
    unit: "ML",
    format: (v) => fmtCompact(v),
    extract: (p) => p.dairy?.milkIntakeMlitres,
  },
  {
    label: "Cow herd",
    unit: "K",
    format: (v) => fmtCompact(v),
    extract: (p) => p.dairy?.cowHerdK,
  },
  // Egg
  {
    label: "Laying flock",
    unit: "M",
    format: (v) => v.toFixed(1),
    extract: (p) => p.egg?.layingHenFlockMM,
  },
  {
    label: "ASP / dozen",
    unit: "$",
    format: (v) => `$${v.toFixed(2)}`,
    extract: (p) => p.egg?.avgSellingPricePerDozen,
  },
  // Trader
  {
    label: "Throughput",
    unit: "MMT",
    format: (v) => v.toFixed(1),
    extract: (p) => p.trader?.throughputMtMM,
  },
  {
    label: "Ethanol",
    unit: "M gal",
    format: (v) => fmtCompact(v),
    extract: (p) => p.trader?.ethanolGalsMM,
  },
  // REIT
  {
    label: "Occupancy",
    unit: "%",
    format: (v) => `${v.toFixed(1)}%`,
    extract: (p) => p.reit?.occupancyPct,
  },
  {
    label: "AFFO / share",
    unit: "$",
    format: (v) => `$${v.toFixed(2)}`,
    extract: (p) => p.reit?.affoPerShare,
  },
];

export function FarmlandSectorTrends({
  financials,
}: {
  financials: Financials | null;
}) {
  if (!financials || financials.periods.length < 2) return null;

  // FY-and-LTM only: quarterly noise hides the trend signal we care
  // about for sector-block KPIs. (Most operational metrics are reported
  // annually anyway.)
  const periods = [...financials.periods]
    .filter((p) => p.periodType === "FY" || p.periodType === "LTM")
    .sort((a, b) => a.endDate.localeCompare(b.endDate));

  if (periods.length < 2) return null;

  const populated = METRICS.flatMap((m) => {
    const series = periods
      .map((p) => ({ endDate: p.endDate, value: m.extract(p) }))
      .filter(
        (d): d is { endDate: string; value: number } =>
          typeof d.value === "number" && Number.isFinite(d.value),
      );
    if (series.length < 2) return [];
    return [{ metric: m, series }];
  });

  if (populated.length === 0) {
    return (
      <section className="mt-8 rounded-sm border border-rule bg-surface p-6">
        <h2 className="font-display text-lg font-semibold">
          No sector-trend data
        </h2>
        <p className="mt-2 text-sm text-muted">
          Per-period sector-specific KPIs (FFB yield, capacity utilization,
          harvest volume, etc.) haven&apos;t been populated for this issuer
          yet. Cross-section snapshot is in the &quot;Sector KPIs&quot; card
          above.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-8">
      <header className="mb-4">
        <h2 className="font-display text-lg font-semibold">
          Sector Trends
        </h2>
        <p className="mt-1 text-sm text-muted">
          Per-period operational KPIs across the disclosed history.
          Sparklines show full series; the chip on the right is the most
          recent value.
        </p>
      </header>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {populated.map(({ metric, series }) => (
          <MetricSpark key={metric.label} metric={metric} series={series} />
        ))}
      </div>
    </section>
  );
}

function MetricSpark({
  metric,
  series,
}: {
  metric: Metric;
  series: { endDate: string; value: number }[];
}) {
  const W = 220;
  const H = 38;
  const PAD = 4;
  const min = Math.min(...series.map((s) => s.value));
  const max = Math.max(...series.map((s) => s.value));
  const range = max - min || 1;
  const stepX = (W - PAD * 2) / (series.length - 1);
  const path = series
    .map((s, i) => {
      const x = (PAD + i * stepX).toFixed(1);
      const y = (
        H - PAD - ((s.value - min) / range) * (H - PAD * 2)
      ).toFixed(1);
      return `${i === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");
  const lastX = (PAD + (series.length - 1) * stepX).toFixed(1);
  const lastY = (
    H - PAD - ((series[series.length - 1].value - min) / range) * (H - PAD * 2)
  ).toFixed(1);
  const direction =
    series[series.length - 1].value > series[0].value
      ? "var(--positive)"
      : series[series.length - 1].value < series[0].value
      ? "var(--negative)"
      : "var(--accent)";
  const tip = tipFor(metric.label);
  const latest = series[series.length - 1];

  return (
    <div className="rounded-sm border border-rule bg-surface p-3">
      <div className="flex items-baseline justify-between gap-2">
        <p
          className={`text-[10px] uppercase tracking-wider text-muted ${
            tip ? "cursor-help decoration-dotted underline-offset-2" : ""
          }`}
          style={tip ? { textDecorationLine: "underline" } : undefined}
          title={tip}
        >
          {metric.label}
        </p>
        <span className="text-[10px] text-muted">
          {series.length} pts · {series[0].endDate.slice(0, 4)}–
          {latest.endDate.slice(0, 4)}
        </span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width={W}
          height={H}
          role="img"
          aria-label={`${metric.label} trend`}
        >
          <path
            d={path}
            fill="none"
            stroke={direction}
            strokeWidth="1.5"
          />
          <circle cx={lastX} cy={lastY} r="2" fill={direction} />
        </svg>
        <span
          className="font-display text-sm font-semibold tabular-nums"
          style={{ color: direction }}
        >
          {metric.format(latest.value)}
        </span>
      </div>
    </div>
  );
}

function fmtCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e4) return `${(n / 1e3).toFixed(1)}K`;
  return Math.round(n).toLocaleString("en-US");
}
