"use client";

import { useMemo, useState } from "react";
import type { PricedFarmlandComp } from "@/lib/farmland-comps";

type SortKey =
  | "ticker"
  | "marketCapMM"
  | "evMM"
  | "price"
  | "pctOf52wHigh"
  | "pctOf52wLow"
  | "ytdReturn"
  | "threeMReturn"
  | "twelveMReturn"
  | "evPerAcre"
  | "pNav"
  | "evCapRate"
  | "divYield";

type Format = "money" | "int" | "intDollar" | "pct" | "pctSigned" | "mult";

type Column = {
  key: SortKey;
  label: string;
  hint?: string;
  band: "market" | "valuation";
  format: Format;
  pill?: boolean; // wrap value in red/green pill
};

const COLUMNS: Column[] = [
  // Market data
  { key: "marketCapMM", label: "Market Cap", hint: "$M", band: "market", format: "intDollar" },
  { key: "evMM", label: "Enterprise Value", hint: "$M", band: "market", format: "intDollar" },
  { key: "price", label: "Stock Price", hint: "live $", band: "market", format: "money" },
  { key: "pctOf52wHigh", label: "% of 52-Wk High", band: "market", format: "pct" },
  { key: "pctOf52wLow", label: "% of 52-Wk Low", band: "market", format: "pct" },
  { key: "ytdReturn", label: "% Price (YTD)", band: "market", format: "pctSigned", pill: true },
  { key: "threeMReturn", label: "% Price (3-Mo)", band: "market", format: "pctSigned", pill: true },
  { key: "twelveMReturn", label: "% Price (12-Mo)", band: "market", format: "pctSigned", pill: true },
  // Valuation multiples
  { key: "evPerAcre", label: "EV / Acre", hint: "$", band: "valuation", format: "intDollar" },
  { key: "pNav", label: "P / NAV", band: "valuation", format: "mult" },
  { key: "evCapRate", label: "Cap Rate", hint: "NOI ÷ EV", band: "valuation", format: "pct" },
  { key: "divYield", label: "Div Yield", band: "valuation", format: "pct" },
];

const MARKET_COLS = COLUMNS.filter((c) => c.band === "market");
const VALUATION_COLS = COLUMNS.filter((c) => c.band === "valuation");

export function FarmlandComps({ rows }: { rows: PricedFarmlandComp[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("marketCapMM");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "string" && typeof bv === "string") {
        return dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      const an = av as number | null;
      const bn = bv as number | null;
      if (an === null && bn === null) return 0;
      if (an === null) return 1;
      if (bn === null) return -1;
      return dir === "asc" ? an - bn : bn - an;
    });
    return copy;
  }, [rows, sortKey, dir]);

  const stats = useMemo(() => computeStats(rows), [rows]);

  function onHeaderClick(k: SortKey) {
    if (k === sortKey) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setDir(k === "ticker" ? "asc" : "desc");
    }
  }

  return (
    <div className="mt-6 overflow-x-auto rounded-sm border border-rule bg-surface">
      <table className="w-full border-collapse font-sans text-xs tabular-nums">
        <thead>
          {/* Band row */}
          <tr>
            <th
              className="sticky left-0 z-10 bg-surface px-4 py-2 text-left"
              rowSpan={2}
            >
              <span className="text-[11px] uppercase tracking-wider text-muted">
                Company
              </span>
            </th>
            <th
              colSpan={MARKET_COLS.length}
              className="border-b border-rule bg-accent px-3 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wider text-bg"
            >
              Market Data
            </th>
            <th
              colSpan={VALUATION_COLS.length}
              className="border-b border-rule border-l border-rule-strong bg-accent px-3 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wider text-bg"
            >
              Valuation Multiples
            </th>
          </tr>
          {/* Column header row */}
          <tr className="border-b border-rule-strong">
            {COLUMNS.map((c, i) => {
              const active = c.key === sortKey;
              const bandBreak =
                i === MARKET_COLS.length ? "border-l border-rule-strong" : "";
              return (
                <th
                  key={c.key}
                  scope="col"
                  className={`whitespace-nowrap px-3 py-2 text-right align-bottom font-medium ${bandBreak}`}
                >
                  <button
                    type="button"
                    onClick={() => onHeaderClick(c.key)}
                    className={`inline-flex items-baseline gap-1 transition-colors hover:!text-accent ${
                      active ? "!text-accent" : "!text-fg"
                    }`}
                    aria-sort={
                      active
                        ? dir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    <span>{c.label}</span>
                    <span
                      aria-hidden="true"
                      className={`text-[9px] ${active ? "opacity-100" : "opacity-30"}`}
                    >
                      {active ? (dir === "asc" ? "▲" : "▼") : "▾"}
                    </span>
                  </button>
                  {c.hint && (
                    <div className="mt-0.5 text-[9px] font-normal uppercase tracking-wider text-muted">
                      {c.hint}
                    </div>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {/* Mean / Median rows */}
          <tr className="border-b border-rule bg-bg/60 font-semibold">
            <td className="sticky left-0 bg-bg/95 px-4 py-2 text-left">Mean</td>
            {COLUMNS.map((c, i) => (
              <td
                key={c.key}
                className={`px-3 py-2 text-right ${
                  i === MARKET_COLS.length ? "border-l border-rule-strong" : ""
                }`}
              >
                {renderCell(stats.mean[c.key], c, false)}
              </td>
            ))}
          </tr>
          <tr className="border-b-2 border-rule-strong bg-bg/40 font-semibold">
            <td className="sticky left-0 bg-bg/95 px-4 py-2 text-left">Median</td>
            {COLUMNS.map((c, i) => (
              <td
                key={c.key}
                className={`px-3 py-2 text-right ${
                  i === MARKET_COLS.length ? "border-l border-rule-strong" : ""
                }`}
              >
                {renderCell(stats.median[c.key], c, false)}
              </td>
            ))}
          </tr>
          {/* Data rows */}
          {sorted.map((r) => (
            <tr
              key={r.ticker}
              className="border-b border-rule transition-colors hover:bg-bg/60"
            >
              <td className="sticky left-0 z-[1] bg-surface px-4 py-3 text-left">
                <div className="font-semibold text-fg">{r.ticker}</div>
                <div className="text-[11px] text-muted">{r.name}</div>
                <div className="text-[10px] text-muted">{r.primaryCrops}</div>
                <div className="mt-0.5 text-[9px] uppercase tracking-wider text-muted">
                  Filing {formatFilingDate(r.filingDate)}
                </div>
              </td>
              {COLUMNS.map((c, i) => {
                const val = r[c.key] as number | null;
                return (
                  <td
                    key={c.key}
                    className={`px-3 py-3 text-right ${
                      i === MARKET_COLS.length ? "border-l border-rule-strong" : ""
                    }`}
                  >
                    {renderCell(val, c, true)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderCell(val: number | null, col: Column, allowPill: boolean) {
  if (val === null || (typeof val === "number" && !Number.isFinite(val))) {
    return <span className="text-muted">—</span>;
  }
  const text = formatValue(val, col.format);
  if (col.pill && allowPill) {
    const positive = val >= 0;
    return (
      <span
        className={`inline-block rounded-sm px-1.5 py-0.5 text-[11px] font-medium ${
          positive
            ? "bg-[color-mix(in_srgb,var(--positive)_14%,transparent)] text-[var(--positive)]"
            : "bg-[color-mix(in_srgb,var(--negative)_14%,transparent)] text-[var(--negative)]"
        }`}
      >
        {positive ? "▲" : "▼"} {text}
      </span>
    );
  }
  if (col.key === "pNav") {
    const positive = val >= 1;
    return (
      <span
        className={
          positive ? "text-[var(--positive)]" : "text-[var(--negative)]"
        }
      >
        {text}
      </span>
    );
  }
  return text;
}

function formatValue(val: number, format: Format): string {
  switch (format) {
    case "money":
      return val.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2,
      });
    case "intDollar":
      return `$${Math.round(val).toLocaleString("en-US")}`;
    case "int":
      return Math.round(val).toLocaleString("en-US");
    case "pct":
      return `${val.toFixed(1)}%`;
    case "pctSigned": {
      const abs = Math.abs(val).toFixed(1);
      return `${abs}%`;
    }
    case "mult":
      return `${val.toFixed(2)}×`;
  }
}

function formatFilingDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

type Stats = Record<SortKey, number | null>;

function computeStats(rows: PricedFarmlandComp[]): { mean: Stats; median: Stats } {
  const keys = COLUMNS.map((c) => c.key);
  const mean = {} as Stats;
  const median = {} as Stats;
  for (const k of keys) {
    const vals = rows
      .map((r) => r[k] as number | null)
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    if (vals.length === 0) {
      mean[k] = null;
      median[k] = null;
      continue;
    }
    const sum = vals.reduce((a, b) => a + b, 0);
    mean[k] = sum / vals.length;
    const sortedVals = [...vals].sort((a, b) => a - b);
    const mid = Math.floor(sortedVals.length / 2);
    median[k] =
      sortedVals.length % 2 === 0
        ? (sortedVals[mid - 1] + sortedVals[mid]) / 2
        : sortedVals[mid];
  }
  // ticker is non-numeric; null it out for stat rows.
  mean.ticker = null;
  median.ticker = null;
  return { mean, median };
}
