"use client";

import { useMemo, useState } from "react";
import type { PricedFarmlandComp } from "@/lib/farmland-comps";

type Weighting = "equal" | "marketcap";

const SECTOR_ORDER: string[] = [
  "Farmland Owner / REIT",
  "Integrated Farm Operator",
  "Plantation Operator",
  "Pastoral / Livestock",
  "Diversified Agribusiness",
  "Protein Producer",
  "Dairy / Egg Producer",
  "Aquaculture / Seafood",
  "Agribusiness / Trader",
  "Crop Inputs / Fertilizer",
  "Rural Services",
];

// Metrics included in the sector synthetic. Each can be aggregated
// equal-weight (mean) or market-cap-weighted (sumproduct).
type Metric = {
  key: keyof PricedFarmlandComp;
  label: string;
  unit: "pct" | "mult";
};

const METRICS: Metric[] = [
  { key: "evEbitda", label: "EV / EBITDA", unit: "mult" },
  { key: "priceSales", label: "P / S", unit: "mult" },
  { key: "priceEarnings", label: "P / E", unit: "mult" },
  { key: "pNav", label: "P / NAV", unit: "mult" },
  { key: "evCapRate", label: "Cap Rate", unit: "pct" },
  { key: "ebitdaMargin", label: "EBITDA Margin", unit: "pct" },
  { key: "netIncomeMargin", label: "NI Margin", unit: "pct" },
  { key: "roe", label: "ROE", unit: "pct" },
  { key: "roic", label: "ROIC", unit: "pct" },
  { key: "divYield", label: "Div Yield", unit: "pct" },
  { key: "fcfYield", label: "FCF Yield", unit: "pct" },
];

export function FarmlandSectorIndex({
  rows,
}: {
  rows: PricedFarmlandComp[];
}) {
  const [weighting, setWeighting] = useState<Weighting>("equal");

  const sectorRows = useMemo(() => {
    const bySector = new Map<string, PricedFarmlandComp[]>();
    for (const r of rows) {
      if (!bySector.has(r.sector)) bySector.set(r.sector, []);
      bySector.get(r.sector)!.push(r);
    }
    const out: {
      sector: string;
      constituents: number;
      totalMcapMM: number;
      values: Record<string, number | null>;
    }[] = [];
    const order = [
      ...SECTOR_ORDER.filter((s) => bySector.has(s)),
      ...Array.from(bySector.keys()).filter((s) => !SECTOR_ORDER.includes(s)),
    ];
    for (const sector of order) {
      const constituents = bySector.get(sector) ?? [];
      const totalMcap = constituents.reduce(
        (s, r) => s + (r.marketCapMM ?? 0),
        0,
      );
      const values: Record<string, number | null> = {};
      for (const m of METRICS) {
        const pairs = constituents
          .map((r) => ({
            v: r[m.key] as number | null,
            w:
              weighting === "marketcap"
                ? Number.isFinite(r.marketCapMM as number)
                  ? (r.marketCapMM as number) ?? 0
                  : 0
                : 1,
          }))
          .filter(
            (p) => p.v !== null && Number.isFinite(p.v as number) && p.w > 0,
          );
        if (pairs.length === 0) {
          values[String(m.key)] = null;
          continue;
        }
        const totalW = pairs.reduce((s, p) => s + p.w, 0);
        const weighted = pairs.reduce(
          (s, p) => s + (p.v as number) * p.w,
          0,
        );
        values[String(m.key)] = totalW > 0 ? weighted / totalW : null;
      }
      out.push({
        sector,
        constituents: constituents.length,
        totalMcapMM: totalMcap,
        values,
      });
    }
    return out;
  }, [rows, weighting]);

  return (
    <section className="mt-12 border-t border-rule pt-8">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-xl font-semibold tracking-tight">
          Sector index
        </h2>
        <div className="flex gap-1 text-xs">
          {(["equal", "marketcap"] as Weighting[]).map((w) => {
            const on = weighting === w;
            return (
              <button
                key={w}
                onClick={() => setWeighting(w)}
                aria-pressed={on}
                className={`rounded-sm border px-2.5 py-1 text-xs transition-colors ${
                  on
                    ? "border-accent bg-accent !text-bg"
                    : "border-rule !text-fg hover:border-accent hover:!text-accent"
                }`}
              >
                {w === "equal" ? "Equal-weight" : "Market-cap-weight"}
              </button>
            );
          })}
        </div>
      </div>
      <p className="mb-3 text-xs text-muted">
        Synthetic basket per sector. {weighting === "equal"
          ? "Each constituent contributes equally to the average."
          : "Each constituent is weighted by its market cap (USD)."}{" "}
        Constituent counts and aggregate market caps in the first two columns.
      </p>
      <div className="overflow-x-auto rounded-sm border border-rule bg-surface">
        <table className="w-full border-collapse font-sans text-xs tabular-nums">
          <thead>
            <tr className="border-b border-rule-strong">
              <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wider text-muted">
                Sector
              </th>
              <th className="px-3 py-2 text-right text-[11px] uppercase tracking-wider text-muted">
                #
              </th>
              <th className="px-3 py-2 text-right text-[11px] uppercase tracking-wider text-muted">
                Mkt Cap ($M)
              </th>
              {METRICS.map((m) => (
                <th
                  key={String(m.key)}
                  className="px-3 py-2 text-right text-[11px] uppercase tracking-wider text-muted"
                >
                  {m.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sectorRows.map((row) => (
              <tr key={row.sector} className="border-b border-rule">
                <td className="px-3 py-2 text-fg">{row.sector}</td>
                <td className="px-3 py-2 text-right">{row.constituents}</td>
                <td className="px-3 py-2 text-right">
                  ${formatMM(row.totalMcapMM)}
                </td>
                {METRICS.map((m) => {
                  const v = row.values[String(m.key)];
                  return (
                    <td key={String(m.key)} className="px-3 py-2 text-right">
                      {v === null
                        ? "—"
                        : m.unit === "pct"
                        ? `${v.toFixed(1)}%`
                        : `${v.toFixed(1)}×`}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function formatMM(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}T`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}B`;
  return `${Math.round(v).toLocaleString("en-US")}M`;
}
