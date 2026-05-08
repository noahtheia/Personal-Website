"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { PricedFarmlandComp } from "@/lib/farmland-comps";

type RowDef = {
  key: keyof PricedFarmlandComp;
  label: string;
  unit: "money" | "moneySigned" | "pct" | "mult" | "int" | "string";
  // Color the highest (or lowest) value across the selected tickers green.
  best?: "highest" | "lowest";
};

type Section = { label: string; rows: RowDef[] };

const SECTIONS: Section[] = [
  {
    label: "Overview",
    rows: [
      { key: "sector", label: "Sector", unit: "string" },
      { key: "geography", label: "Exchange", unit: "string" },
      { key: "operatingCountry", label: "Operations", unit: "string" },
      { key: "primaryCrops", label: "Primary crops", unit: "string" },
      { key: "currency", label: "Reporting currency", unit: "string" },
      { key: "filingDate", label: "Filing date", unit: "string" },
    ],
  },
  {
    label: "Market data",
    rows: [
      { key: "price", label: "Stock price ($)", unit: "money" },
      { key: "marketCapMM", label: "Market cap ($M)", unit: "moneySigned", best: "highest" },
      { key: "evMM", label: "Enterprise value ($M)", unit: "moneySigned", best: "highest" },
      { key: "netDebtMM", label: "Net debt ($M)", unit: "moneySigned", best: "lowest" },
    ],
  },
  {
    label: "Operating",
    rows: [
      { key: "annualRevenueMM", label: "Revenue ($M)", unit: "moneySigned", best: "highest" },
      { key: "annualEbitdaMM", label: "EBITDA ($M)", unit: "moneySigned", best: "highest" },
      { key: "annualNetIncomeMM", label: "Net income ($M)", unit: "moneySigned", best: "highest" },
      { key: "annualFcfMM", label: "FCF ($M)", unit: "moneySigned", best: "highest" },
      { key: "ebitdaMargin", label: "EBITDA margin", unit: "pct", best: "highest" },
      { key: "netIncomeMargin", label: "NI margin", unit: "pct", best: "highest" },
      { key: "roe", label: "ROE", unit: "pct", best: "highest" },
      { key: "roic", label: "ROIC", unit: "pct", best: "highest" },
    ],
  },
  {
    label: "Valuation multiples",
    rows: [
      { key: "evEbitda", label: "EV / EBITDA", unit: "mult", best: "lowest" },
      { key: "priceSales", label: "P / S", unit: "mult", best: "lowest" },
      { key: "priceEarnings", label: "P / E", unit: "mult", best: "lowest" },
      { key: "pNav", label: "P / NAV", unit: "mult", best: "lowest" },
      { key: "divYield", label: "Dividend yield", unit: "pct", best: "highest" },
      { key: "fcfYield", label: "FCF yield", unit: "pct", best: "highest" },
    ],
  },
  {
    label: "Land value",
    rows: [
      { key: "acresK", label: "Acres (K)", unit: "int", best: "highest" },
      { key: "bookPerAcre", label: "Book / acre", unit: "money" },
      { key: "marketPerAcre", label: "Market / acre", unit: "money" },
      { key: "evPerAcre", label: "EV / acre", unit: "money" },
      { key: "fmvNavPerShareUsd", label: "FMV NAV / share ($)", unit: "money" },
      { key: "evCapRate", label: "Cap rate", unit: "pct", best: "highest" },
    ],
  },
];

export function FarmlandCompare({ rows }: { rows: PricedFarmlandComp[] }) {
  const [selected, setSelected] = useState<string[]>([]);

  const tickers = useMemo(
    () => rows.map((r) => r.ticker).sort((a, b) => a.localeCompare(b)),
    [rows],
  );
  const selectedRows = selected
    .map((t) => rows.find((r) => r.ticker === t))
    .filter((r): r is PricedFarmlandComp => r !== undefined);

  function add(ticker: string) {
    if (!ticker) return;
    setSelected((cur) => (cur.includes(ticker) ? cur : [...cur, ticker]));
  }
  function remove(ticker: string) {
    setSelected((cur) => cur.filter((t) => t !== ticker));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label
            htmlFor="compare-add"
            className="text-[10px] uppercase tracking-wider text-muted"
          >
            Add ticker
          </label>
          <select
            id="compare-add"
            onChange={(e) => {
              add(e.target.value);
              e.currentTarget.value = "";
            }}
            className="rounded-sm border border-rule bg-surface px-2 py-1.5 text-xs w-64"
            defaultValue=""
          >
            <option value="" disabled>
              Pick a ticker…
            </option>
            {tickers
              .filter((t) => !selected.includes(t))
              .map((t) => {
                const r = rows.find((x) => x.ticker === t);
                return (
                  <option key={t} value={t}>
                    {t} — {r?.name}
                  </option>
                );
              })}
          </select>
        </div>
        {selectedRows.length > 0 && (
          <button
            type="button"
            onClick={() => setSelected([])}
            className="rounded-sm border border-rule bg-surface px-3 py-1.5 text-xs !text-fg-soft hover:border-accent hover:!text-accent"
          >
            Clear all
          </button>
        )}
      </div>

      {selectedRows.length === 0 ? (
        <div className="rounded-sm border border-rule bg-surface p-8 text-center text-sm text-muted">
          Pick 2+ tickers from the dropdown above to see them side by side.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-sm border border-rule bg-surface">
          <table className="w-full border-collapse font-sans text-xs tabular-nums">
            <thead>
              <tr className="border-b border-rule-strong">
                <th className="sticky left-0 z-10 bg-surface px-3 py-2 text-left text-[11px] uppercase tracking-wider text-muted min-w-[200px]">
                  Metric
                </th>
                {selectedRows.map((r) => (
                  <th
                    key={r.ticker}
                    className="px-3 py-2 text-right text-[11px] uppercase tracking-wider text-fg min-w-[160px]"
                  >
                    <div className="flex items-baseline justify-end gap-1">
                      <Link
                        href={`/analytics/public-farmland/${encodeURIComponent(r.ticker)}`}
                        className="!text-fg no-underline hover:!text-accent font-medium"
                      >
                        {r.ticker}
                      </Link>
                      <button
                        type="button"
                        onClick={() => remove(r.ticker)}
                        aria-label={`Remove ${r.ticker}`}
                        className="!text-muted hover:!text-[var(--negative)] text-[12px]"
                      >
                        ×
                      </button>
                    </div>
                    <div className="text-[10px] font-normal text-muted">
                      {r.name}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SECTIONS.map((section) => (
                <SectionRows
                  key={section.label}
                  section={section}
                  rows={selectedRows}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SectionRows({
  section,
  rows,
}: {
  section: Section;
  rows: PricedFarmlandComp[];
}) {
  return (
    <>
      <tr className="border-y border-rule-strong">
        <td
          colSpan={1 + rows.length}
          className="bg-[var(--accent-warm)] px-3 py-1.5 text-left font-display text-[12px] font-semibold uppercase tracking-wider !text-fg"
        >
          {section.label}
        </td>
      </tr>
      {section.rows.map((rd) => {
        const vals = rows.map((r) => r[rd.key]);
        // Find best/worst when applicable
        let bestIdx = -1;
        let worstIdx = -1;
        if (rd.best && rd.unit !== "string") {
          const numericVals = vals.map((v) =>
            typeof v === "number" && Number.isFinite(v) ? v : null,
          );
          const valid = numericVals
            .map((v, i) => ({ v, i }))
            .filter((x): x is { v: number; i: number } => x.v !== null);
          if (valid.length > 1) {
            const sorted = [...valid].sort((a, b) =>
              rd.best === "highest" ? b.v - a.v : a.v - b.v,
            );
            bestIdx = sorted[0].i;
            worstIdx = sorted[sorted.length - 1].i;
          }
        }
        return (
          <tr key={String(rd.key)} className="border-b border-rule">
            <td className="sticky left-0 z-[1] bg-surface px-3 py-2 text-left text-fg-soft">
              {rd.label}
            </td>
            {vals.map((v, i) => {
              const tone =
                i === bestIdx
                  ? "text-[var(--positive)] font-medium"
                  : i === worstIdx
                  ? "text-[var(--negative)]"
                  : "";
              return (
                <td
                  key={i}
                  className={`px-3 py-2 text-right ${tone}`}
                >
                  {formatCell(v, rd.unit)}
                </td>
              );
            })}
          </tr>
        );
      })}
    </>
  );
}

function formatCell(v: unknown, unit: RowDef["unit"]): string {
  if (v === null || v === undefined || (typeof v === "number" && !Number.isFinite(v)))
    return "—";
  if (unit === "string") return String(v);
  if (typeof v !== "number") return String(v);
  if (unit === "money") {
    if (Math.abs(v) < 1) return `$${v.toFixed(3)}`;
    if (Math.abs(v) < 100) return `$${v.toFixed(2)}`;
    return `$${Math.round(v).toLocaleString("en-US")}`;
  }
  if (unit === "moneySigned") {
    const r = Math.round(v);
    if (r < 0) return `($${Math.abs(r).toLocaleString("en-US")})`;
    return `$${r.toLocaleString("en-US")}`;
  }
  if (unit === "pct") {
    if (v < 0) return `(${Math.abs(v).toFixed(1)}%)`;
    return `${v.toFixed(1)}%`;
  }
  if (unit === "mult") return `${v.toFixed(2)}×`;
  return Math.round(v).toLocaleString("en-US");
}
