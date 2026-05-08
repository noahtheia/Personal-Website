"use client";

// Per-sector KPI rankings. For each sector that has populated sector-
// block data, render horizontal-bar charts ranking tickers by 2–3
// representative KPIs. Surfaces the universe-wide audit-driven
// schema work as a cross-ticker view rather than only per-ticker
// detail cards or aggregate summary rows.

import { useMemo, useState } from "react";
import Link from "next/link";
import type { PricedFarmlandComp } from "@/lib/farmland-comps";

type Metric = {
  label: string;
  unit: string;
  // Higher = better (green) when true; lower = better (e.g. cost/kg) when
  // false. Drives the bar-tone direction.
  higherIsBetter: boolean;
  extract: (r: PricedFarmlandComp) => number | null | undefined;
  format: (v: number) => string;
};

type SectorSpec = {
  sector: string;
  metrics: Metric[];
};

const SECTORS: SectorSpec[] = [
  {
    sector: "Farmland Owner / REIT",
    metrics: [
      {
        label: "WALT",
        unit: "yrs",
        higherIsBetter: true,
        extract: (r) => r.reit?.walt,
        format: (v) => `${v.toFixed(1)}`,
      },
      {
        label: "Occupancy",
        unit: "%",
        higherIsBetter: true,
        extract: (r) => r.reit?.occupancyPct,
        format: (v) => `${v.toFixed(0)}%`,
      },
      {
        label: "Water rights",
        unit: "$M",
        higherIsBetter: true,
        extract: (r) => r.reit?.waterRightsValueMM,
        format: (v) => `$${Math.round(v)}M`,
      },
    ],
  },
  {
    sector: "Plantation Operator",
    metrics: [
      {
        label: "FFB yield",
        unit: "t/ha",
        higherIsBetter: true,
        extract: (r) => r.plantation?.ffbYieldTPerHa,
        format: (v) => `${v.toFixed(1)}`,
      },
      {
        label: "OER",
        unit: "%",
        higherIsBetter: true,
        extract: (r) => r.plantation?.oerPct,
        format: (v) => `${v.toFixed(1)}%`,
      },
      {
        label: "RSPO certified",
        unit: "%",
        higherIsBetter: true,
        extract: (r) => r.plantation?.rspoPct,
        format: (v) => `${v.toFixed(0)}%`,
      },
    ],
  },
  {
    sector: "Aquaculture / Seafood",
    metrics: [
      {
        label: "Harvest volume",
        unit: "kt",
        higherIsBetter: true,
        extract: (r) => r.aquaculture?.harvestVolumeKtGwt,
        format: (v) => `${Math.round(v)}`,
      },
      {
        label: "EBIT / kg",
        unit: "NOK",
        higherIsBetter: true,
        extract: (r) => r.aquaculture?.ebitPerKgNok,
        format: (v) => `NOK ${v.toFixed(1)}`,
      },
      {
        label: "Cost / kg",
        unit: "NOK",
        higherIsBetter: false,
        extract: (r) => r.aquaculture?.costPerKgNok,
        format: (v) => `NOK ${v.toFixed(1)}`,
      },
    ],
  },
  {
    sector: "Protein Producer",
    metrics: [
      {
        label: "Plants",
        unit: "count",
        higherIsBetter: true,
        extract: (r) => r.protein?.plants,
        format: (v) => `${Math.round(v)}`,
      },
      {
        label: "Capacity utilization",
        unit: "%",
        higherIsBetter: true,
        extract: (r) => r.protein?.capacityUtilizationPct,
        format: (v) => `${v.toFixed(0)}%`,
      },
    ],
  },
  {
    sector: "Crop Inputs / Fertilizer",
    metrics: [
      {
        label: "R&D / sales",
        unit: "%",
        higherIsBetter: true,
        extract: (r) => r.cropInputs?.rdSpendPctOfRevenue,
        format: (v) => `${v.toFixed(1)}%`,
      },
      {
        label: "Capacity utilization",
        unit: "%",
        higherIsBetter: true,
        extract: (r) => r.cropInputs?.capacityUtilizationPct,
        format: (v) => `${v.toFixed(0)}%`,
      },
    ],
  },
  {
    sector: "Dairy / Egg Producer",
    metrics: [
      {
        label: "Milk intake",
        unit: "ML",
        higherIsBetter: true,
        extract: (r) => r.dairy?.milkIntakeMlitres,
        format: (v) => `${Math.round(v)} ML`,
      },
      {
        label: "Cow herd",
        unit: "K",
        higherIsBetter: true,
        extract: (r) => r.dairy?.cowHerdK,
        format: (v) => `${Math.round(v)}K`,
      },
      {
        label: "Branded revenue",
        unit: "%",
        higherIsBetter: true,
        extract: (r) => r.dairy?.brandedRevenuePct,
        format: (v) => `${v.toFixed(0)}%`,
      },
    ],
  },
  {
    sector: "Integrated Farm Operator",
    metrics: [
      {
        label: "Planted area",
        unit: "K ha",
        higherIsBetter: true,
        extract: (r) => r.integratedFarm?.plantedAreaHa,
        format: (v) => `${Math.round(v / 1000)}K`,
      },
      {
        label: "Bio assets",
        unit: "$M",
        higherIsBetter: true,
        extract: (r) => r.integratedFarm?.biologicalAssetsMM,
        format: (v) => `${Math.round(v)}M`,
      },
    ],
  },
  {
    sector: "Agribusiness / Trader",
    metrics: [
      {
        label: "Throughput",
        unit: "MMT",
        higherIsBetter: true,
        extract: (r) => r.trader?.throughputMtMM,
        format: (v) => `${v.toFixed(1)}`,
      },
      {
        label: "RMI",
        unit: "$M",
        higherIsBetter: true,
        extract: (r) => r.trader?.rmiMM,
        format: (v) => `$${Math.round(v / 1000)}B`,
      },
      {
        label: "Specialty rev",
        unit: "%",
        higherIsBetter: true,
        extract: (r) => r.trader?.ingredients?.specialtyRevenuePct,
        format: (v) => `${v.toFixed(0)}%`,
      },
    ],
  },
  {
    sector: "Diversified Agribusiness",
    metrics: [
      {
        label: "Non-ag revenue",
        unit: "%",
        higherIsBetter: false,
        extract: (r) => r.nonAgricultureRevenuePct,
        format: (v) => `${v.toFixed(0)}%`,
      },
    ],
  },
];

const TOP_N = 10;

export function FarmlandSectorRankings({ rows }: { rows: PricedFarmlandComp[] }) {
  const [topOnly, setTopOnly] = useState(true);
  // Group rows by sector for fast lookup.
  const bySector = useMemo(() => {
    const m = new Map<string, PricedFarmlandComp[]>();
    for (const r of rows) {
      if (!m.has(r.sector)) m.set(r.sector, []);
      m.get(r.sector)!.push(r);
    }
    return m;
  }, [rows]);

  const sectorsWithData = useMemo(() => {
    return SECTORS.filter((spec) => {
      const sectorRows = bySector.get(spec.sector) ?? [];
      return spec.metrics.some((m) =>
        sectorRows.some((r) => {
          const v = m.extract(r);
          return typeof v === "number" && Number.isFinite(v);
        }),
      );
    });
  }, [bySector]);

  return (
    <section className="mt-12 border-t border-rule pt-8">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-xl font-semibold tracking-tight">
          Sector Rankings
        </h2>
        <label className="flex items-center gap-2 text-xs text-muted">
          <input
            type="checkbox"
            checked={topOnly}
            onChange={(e) => setTopOnly(e.target.checked)}
            className="accent-[var(--accent)]"
          />
          <span>Top {TOP_N} only</span>
        </label>
      </div>
      <p className="mb-4 text-xs text-muted">
        Sector-block KPIs ranked across each cohort. Bars are scaled to
        the sector max; ticker links jump to the detail page.
      </p>

      <div className="space-y-8">
        {sectorsWithData.map((spec) => (
          <SectorBlock
            key={spec.sector}
            spec={spec}
            rows={bySector.get(spec.sector) ?? []}
            topOnly={topOnly}
          />
        ))}
      </div>
    </section>
  );
}

function SectorBlock({
  spec,
  rows,
  topOnly,
}: {
  spec: SectorSpec;
  rows: PricedFarmlandComp[];
  topOnly: boolean;
}) {
  const populatedMetrics = spec.metrics.filter((m) =>
    rows.some((r) => {
      const v = m.extract(r);
      return typeof v === "number" && Number.isFinite(v);
    }),
  );
  if (populatedMetrics.length === 0) return null;

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold tracking-tight text-fg">
        {spec.sector}
        <span className="ml-2 text-[10px] uppercase tracking-wider text-muted">
          {rows.length} tickers
        </span>
      </h3>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {populatedMetrics.map((m) => (
          <MetricChart key={m.label} metric={m} rows={rows} topOnly={topOnly} />
        ))}
      </div>
    </div>
  );
}

function MetricChart({
  metric,
  rows,
  topOnly,
}: {
  metric: Metric;
  rows: PricedFarmlandComp[];
  topOnly: boolean;
}) {
  const data = rows
    .map((r) => ({ ticker: r.ticker, value: metric.extract(r) }))
    .filter(
      (d): d is { ticker: string; value: number } =>
        typeof d.value === "number" && Number.isFinite(d.value),
    )
    .sort((a, b) =>
      metric.higherIsBetter ? b.value - a.value : a.value - b.value,
    );

  const visible = topOnly ? data.slice(0, TOP_N) : data;
  if (visible.length === 0) return null;
  const max = Math.max(...data.map((d) => d.value));

  return (
    <div className="rounded-sm border border-rule bg-surface p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted">
        {metric.label}
        <span className="ml-1 opacity-60">({data.length} populated)</span>
      </p>
      <ul className="mt-2 space-y-1.5">
        {visible.map((d) => {
          const pct = max > 0 ? (d.value / max) * 100 : 0;
          return (
            <li key={d.ticker} className="grid grid-cols-[3.25rem_1fr_4.25rem] items-center gap-2">
              <Link
                href={`/analytics/public-farmland/${encodeURIComponent(d.ticker)}`}
                className="truncate text-[11px] !text-fg-soft no-underline hover:!text-accent"
                title={d.ticker}
              >
                {d.ticker}
              </Link>
              <div className="h-2 rounded-sm bg-bg/40">
                <div
                  className="h-full rounded-sm"
                  style={{
                    width: `${pct.toFixed(1)}%`,
                    background: "var(--accent)",
                  }}
                />
              </div>
              <span className="text-right text-[11px] tabular-nums text-fg">
                {metric.format(d.value)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
