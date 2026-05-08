"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { PricedFarmlandComp } from "@/lib/farmland-comps";

type LeaderMetric = {
  key: keyof PricedFarmlandComp;
  label: string;
  unit: "pct" | "mult" | "money";
  // "highest" → big values bubble to top; "lowest" → small values do
  direction: "highest" | "lowest";
  // "Cheapest" / "Top" word in the heading
  superlative: string;
};

const METRICS: LeaderMetric[] = [
  { key: "roic", label: "ROIC", unit: "pct", direction: "highest", superlative: "Highest" },
  { key: "roe", label: "ROE", unit: "pct", direction: "highest", superlative: "Highest" },
  { key: "ebitdaMargin", label: "EBITDA margin", unit: "pct", direction: "highest", superlative: "Highest" },
  { key: "fcfYield", label: "FCF yield", unit: "pct", direction: "highest", superlative: "Highest" },
  { key: "divYield", label: "Dividend yield", unit: "pct", direction: "highest", superlative: "Highest" },
  { key: "evCapRate", label: "Cap rate", unit: "pct", direction: "highest", superlative: "Highest" },
  { key: "evEbitda", label: "EV / EBITDA", unit: "mult", direction: "lowest", superlative: "Cheapest" },
  { key: "pNav", label: "P / NAV", unit: "mult", direction: "lowest", superlative: "Cheapest" },
];

const TOP_N = 5;

export function FarmlandLeaderboards({
  rows,
}: {
  rows: PricedFarmlandComp[];
}) {
  const [active, setActive] = useState<string>("roic");
  const metric = METRICS.find((m) => m.key === active) ?? METRICS[0];

  const ranked = useMemo(() => {
    const valid = rows
      .map((r) => ({ r, v: r[metric.key] as number | null }))
      .filter(
        (x): x is { r: PricedFarmlandComp; v: number } =>
          typeof x.v === "number" && Number.isFinite(x.v),
      );
    valid.sort((a, b) =>
      metric.direction === "highest" ? b.v - a.v : a.v - b.v,
    );
    return valid.slice(0, TOP_N);
  }, [rows, metric]);

  return (
    <section className="mt-12 border-t border-rule pt-8">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-xl font-semibold tracking-tight">
          Leaderboards
        </h2>
        <p className="text-xs text-muted">
          Top {TOP_N} across the full universe of {rows.length} tickers
        </p>
      </div>
      <div className="mb-4 flex flex-wrap gap-1">
        {METRICS.map((m) => (
          <button
            key={String(m.key)}
            type="button"
            onClick={() => setActive(String(m.key))}
            aria-pressed={active === m.key}
            className={`rounded-sm border px-2.5 py-1 text-xs transition-colors ${
              active === m.key
                ? "border-accent bg-accent !text-bg"
                : "border-rule !text-fg hover:border-accent hover:!text-accent"
            }`}
          >
            {m.superlative} {m.label}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto rounded-sm border border-rule bg-surface">
        <table className="w-full border-collapse font-sans text-xs tabular-nums">
          <thead>
            <tr className="border-b border-rule-strong">
              <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wider text-muted">
                Rank
              </th>
              <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wider text-muted">
                Ticker
              </th>
              <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wider text-muted">
                Company
              </th>
              <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wider text-muted">
                Sector
              </th>
              <th className="px-3 py-2 text-right text-[11px] uppercase tracking-wider text-muted">
                {metric.label}
              </th>
              <th className="px-3 py-2 text-right text-[11px] uppercase tracking-wider text-muted">
                Mkt Cap (USD M)
              </th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((entry, i) => (
              <tr key={entry.r.ticker} className="border-b border-rule">
                <td className="px-3 py-2 text-fg-soft">{i + 1}</td>
                <td className="px-3 py-2">
                  <Link
                    href={`/analytics/public-farmland/${encodeURIComponent(entry.r.ticker)}`}
                    className="font-semibold !text-fg no-underline hover:!text-accent"
                  >
                    {entry.r.ticker}
                  </Link>
                </td>
                <td className="px-3 py-2">{entry.r.name}</td>
                <td className="px-3 py-2 text-fg-soft">{entry.r.sector}</td>
                <td className="px-3 py-2 text-right font-medium">
                  {formatValue(entry.v, metric.unit)}
                </td>
                <td className="px-3 py-2 text-right text-muted">
                  {entry.r.marketCapMM != null
                    ? `$${Math.round(entry.r.marketCapMM).toLocaleString("en-US")}`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function formatValue(v: number, unit: LeaderMetric["unit"]): string {
  if (unit === "pct") {
    if (v < 0) return `(${Math.abs(v).toFixed(1)}%)`;
    return `${v.toFixed(1)}%`;
  }
  if (unit === "mult") return `${v.toFixed(2)}×`;
  return `$${Math.round(v).toLocaleString("en-US")}`;
}
