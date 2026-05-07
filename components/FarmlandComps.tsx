"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type {
  FarmlandGeography,
  FarmlandSector,
  PricedFarmlandComp,
} from "@/lib/farmland-comps";

// Display order for category bands. Each row is grouped under a
// "{Sector} — {Geography}" header. Sort first by sector, then by
// geography within sector.
const SECTOR_ORDER: FarmlandSector[] = [
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

const GEOGRAPHY_ORDER: FarmlandGeography[] = [
  "US",
  "Canada",
  "Mexico",
  "Brazil",
  "Argentina",
  "UK",
  "EU",
  "Switzerland",
  "Norway",
  "Poland",
  "Ukraine",
  "Australia",
  "New Zealand",
  "Malaysia",
  "Indonesia",
  "Singapore",
  "Thailand",
  "Vietnam",
  "Philippines",
  "China",
  "Hong Kong",
  "India",
  "Saudi Arabia",
  "Egypt",
  "Kenya",
  "South Africa",
  "Nigeria",
];

function categoryKey(r: { sector: string }): string {
  return r.sector;
}

function categoryRank(r: { sector: string }): number {
  const s = SECTOR_ORDER.indexOf(r.sector as FarmlandSector);
  return s < 0 ? 999 : s;
}

type SortKey =
  | "ticker"
  | "name"
  | "price"
  | "marketCapMM"
  | "netDebtMM"
  | "evMM"
  | "acresK"
  | "bookPerAcre"
  | "marketPerAcre"
  | "evPerAcre"
  | "pNav"
  | "fmvNavPerShareUsd"
  | "annualRevenueMM"
  | "annualEbitdaMM"
  | "ebitdaMargin"
  | "evEbitda"
  | "priceSales"
  | "priceEarnings"
  | "evCapRate"
  | "divYield";

type Band = "market" | "land" | "earnings";
type Format =
  | "money"
  | "intDollar"
  | "intDollarSigned"
  | "int"
  | "pct"
  | "mult";

type Column = {
  key: SortKey;
  label: string;
  hint?: string;
  band: Band;
  format: Format;
};

const COLUMNS: Column[] = [
  // Market data — tighter horizontal padding (see cellPadX).
  { key: "price", label: "Stock Price", hint: "live $", band: "market", format: "money" },
  { key: "marketCapMM", label: "Market Cap", hint: "$M", band: "market", format: "intDollar" },
  { key: "netDebtMM", label: "Net Debt", hint: "$M", band: "market", format: "intDollarSigned" },
  { key: "evMM", label: "Enterprise Value", hint: "$M", band: "market", format: "intDollar" },
  // Land value
  { key: "acresK", label: "Acres", hint: "thousands", band: "land", format: "int" },
  { key: "bookPerAcre", label: "Book / Acre", hint: "$ filed", band: "land", format: "intDollar" },
  { key: "marketPerAcre", label: "Market / Acre", hint: "$ FMV", band: "land", format: "intDollar" },
  { key: "evPerAcre", label: "EV / Acre", hint: "$ implied", band: "land", format: "intDollar" },
  { key: "pNav", label: "P / NAV", hint: "price ÷ FMV NAV (per detail page)", band: "land", format: "mult" },
  { key: "fmvNavPerShareUsd", label: "FMV NAV / sh", hint: "$ implied", band: "land", format: "money" },
  // Earnings value — tighter padding like Market Data since it's a long band.
  { key: "annualRevenueMM", label: "Revenue", hint: "$M", band: "earnings", format: "intDollar" },
  { key: "annualEbitdaMM", label: "EBITDA", hint: "$M", band: "earnings", format: "intDollarSigned" },
  { key: "ebitdaMargin", label: "EBITDA Margin", hint: "EBITDA ÷ rev", band: "earnings", format: "pct" },
  { key: "evEbitda", label: "EV / EBITDA", hint: "×", band: "earnings", format: "mult" },
  { key: "priceSales", label: "P / S", hint: "mkt cap ÷ rev", band: "earnings", format: "mult" },
  { key: "priceEarnings", label: "P / E", hint: "price ÷ EPS", band: "earnings", format: "mult" },
  { key: "evCapRate", label: "Cap Rate", hint: "NOI ÷ EV", band: "earnings", format: "pct" },
  { key: "divYield", label: "Div Yield", hint: "div ÷ price", band: "earnings", format: "pct" },
];

const BAND_LABEL: Record<Band, string> = {
  market: "Market Data",
  land: "Land Value",
  earnings: "Earnings Value",
};

const BAND_ORDER: Band[] = ["market", "land", "earnings"];

// Indices where a band changes — used to draw vertical separators.
const BAND_BREAKS = new Set(
  COLUMNS.map((c, i) => (i > 0 && c.band !== COLUMNS[i - 1].band ? i : -1)).filter(
    (n) => n !== -1,
  ),
);

function cellPadX(band: Band): string {
  // Multi-column bands (Market Data, Earnings Value) use tighter padding;
  // Land Value uses normal spacing.
  return band === "land" ? "px-3" : "px-1.5";
}

export function FarmlandComps({ rows }: { rows: PricedFarmlandComp[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("marketCapMM");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [visibleBands, setVisibleBands] = useState<Record<Band, boolean>>({
    market: true,
    land: true,
    earnings: true,
  });
  const [filterOpen, setFilterOpen] = useState(false);

  const visibleBandList = BAND_ORDER.filter((b) => visibleBands[b]);
  const visibleColumns = COLUMNS.filter((c) => visibleBands[c.band]);
  // Indices in visibleColumns where a band changes — for vertical separators.
  const visibleBandBreaks = new Set<number>();
  for (let i = 1; i < visibleColumns.length; i++) {
    if (visibleColumns[i].band !== visibleColumns[i - 1].band) {
      visibleBandBreaks.add(i);
    }
  }

  // If the current sort column got hidden, fall back to marketCapMM
  // (which lives in "market", a band whose visibility likely toggles
  // back on quickly). Avoids dead sort state.
  const sortStillVisible = visibleColumns.some((c) => c.key === sortKey);
  const effectiveSortKey: SortKey = sortStillVisible ? sortKey : "marketCapMM";

  // Group rows by {Sector — Geography}, preserve SECTOR/GEOGRAPHY_ORDER
  // outer order; within each group, sort by the user's chosen column.
  const groups = useMemo(() => {
    const buckets = new Map<string, PricedFarmlandComp[]>();
    for (const r of rows) {
      const k = categoryKey(r);
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k)!.push(r);
    }
    // Ordered group entries
    const ordered = Array.from(buckets.entries()).sort(([, a], [, b]) => {
      return categoryRank(a[0]) - categoryRank(b[0]);
    });
    // Sort rows inside each group by current sort column.
    for (const [, groupRows] of ordered) {
      groupRows.sort((a, b) => {
        const av = a[effectiveSortKey];
        const bv = b[effectiveSortKey];
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
    }
    return ordered.map(([key, groupRows]) => ({
      key,
      rows: groupRows,
      stats: computeStats(groupRows),
    }));
  }, [rows, effectiveSortKey, dir]);

  const overallStats = useMemo(() => computeStats(rows), [rows]);

  function onHeaderClick(k: SortKey) {
    if (k === sortKey) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setDir(k === "ticker" ? "asc" : "desc");
    }
  }

  return (
    <div className="mt-6 space-y-3">
      <div className="flex justify-end">
        <div className="relative">
          <button
            type="button"
            onClick={() => setFilterOpen((o) => !o)}
            className="inline-flex items-center gap-2 rounded-sm border border-rule bg-surface px-3 py-1.5 text-xs font-medium !text-fg transition-colors hover:border-accent hover:!text-accent"
            aria-haspopup="true"
            aria-expanded={filterOpen}
          >
            <span>Filter</span>
            <span className="text-[10px] opacity-60">
              {visibleBandList.length}/{BAND_ORDER.length}
            </span>
            <span aria-hidden="true" className="text-[10px]">+</span>
          </button>
          {filterOpen && (
            <>
              {/* Click-away */}
              <div
                className="fixed inset-0 z-20"
                onClick={() => setFilterOpen(false)}
                aria-hidden="true"
              />
              <div
                role="menu"
                className="absolute right-0 z-30 mt-1 w-56 rounded-sm border border-rule bg-surface shadow-lg"
              >
                <div className="border-b border-rule px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted">
                  Column groups
                </div>
                <ul className="py-1">
                  {BAND_ORDER.map((b) => {
                    const on = visibleBands[b];
                    return (
                      <li key={b}>
                        <button
                          type="button"
                          onClick={() =>
                            setVisibleBands((v) => ({ ...v, [b]: !v[b] }))
                          }
                          className="flex w-full items-center justify-between px-3 py-2 text-xs transition-colors hover:bg-bg/60"
                        >
                          <span className={on ? "!text-fg" : "!text-muted"}>
                            {BAND_LABEL[b]}
                          </span>
                          <span
                            aria-hidden="true"
                            className={`inline-flex h-4 w-7 items-center rounded-full transition-colors ${
                              on ? "bg-[var(--accent-warm)]" : "bg-rule"
                            }`}
                          >
                            <span
                              className={`inline-block h-3 w-3 rounded-full bg-bg transition-transform ${
                                on ? "translate-x-3.5" : "translate-x-0.5"
                              }`}
                            />
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </>
          )}
        </div>
      </div>
      <div className="overflow-x-auto rounded-sm border border-rule bg-surface">
      <table className="w-full border-collapse font-sans text-xs tabular-nums">
        <thead>
          {/* Band row */}
          <tr>
            {(["ticker", "name"] as const).map((k, idx) => {
              const active = k === sortKey;
              return (
                <th
                  key={k}
                  rowSpan={2}
                  className={`sticky z-10 w-20 bg-surface px-3 py-2 text-left align-bottom ${
                    idx === 0 ? "left-0" : "left-20"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onHeaderClick(k)}
                    className={`inline-flex items-baseline gap-1 text-[11px] uppercase tracking-wider transition-colors hover:!text-accent ${
                      active ? "!text-accent" : "!text-muted"
                    }`}
                    aria-sort={
                      active
                        ? dir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    <span>{k === "ticker" ? "Ticker" : "Company"}</span>
                    <span
                      aria-hidden="true"
                      className={`text-[9px] ${active ? "opacity-100" : "opacity-30"}`}
                    >
                      {active ? (dir === "asc" ? "▲" : "▼") : "▾"}
                    </span>
                  </button>
                </th>
              );
            })}
            {[
              { key: "exchange", label: "Exchange" },
              { key: "operations", label: "Operations" },
            ].map((c) => (
              <th
                key={c.key}
                rowSpan={2}
                className="bg-surface px-3 py-2 text-left align-bottom text-[11px] uppercase tracking-wider text-muted"
              >
                {c.label}
              </th>
            ))}
            {visibleBandList.map((b, idx) => {
              const span = visibleColumns.filter((c) => c.band === b).length;
              return (
                <th
                  key={b}
                  colSpan={span}
                  className={`border-b border-rule bg-[var(--accent-warm)] px-3 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wider text-fg ${
                    idx > 0 ? "border-l border-rule-strong" : ""
                  }`}
                >
                  {BAND_LABEL[b]}
                </th>
              );
            })}
          </tr>
          {/* Column header row */}
          <tr className="border-b border-rule-strong">
            {visibleColumns.map((c, i) => {
              const active = c.key === effectiveSortKey;
              const bandBreak = visibleBandBreaks.has(i)
                ? "border-l border-rule-strong"
                : "";
              return (
                <th
                  key={c.key}
                  scope="col"
                  className={`whitespace-nowrap ${cellPadX(c.band)} py-2 text-right align-bottom font-medium ${bandBreak}`}
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
          {groups.map((group) => (
            <CategorySection
              key={group.key}
              label={group.key}
              rows={group.rows}
              stats={group.stats}
              colCount={4 + visibleColumns.length}
              visibleColumns={visibleColumns}
              visibleBandBreaks={visibleBandBreaks}
            />
          ))}
          <tr className="border-t-2 border-rule-strong bg-bg/60 font-semibold">
            <td className="sticky left-0 w-20 bg-bg/95 px-3 py-2 text-left">Mean</td>
            <td className="sticky left-20 bg-bg/95 px-3 py-2 text-left" />
            <td className="bg-bg/95 px-3 py-2" />
            <td className="bg-bg/95 px-3 py-2" />
            {visibleColumns.map((c, i) => (
              <td
                key={c.key}
                className={`${cellPadX(c.band)} py-2 text-right ${
                  visibleBandBreaks.has(i) ? "border-l border-rule-strong" : ""
                }`}
              >
                {renderCell(overallStats.mean[c.key], c)}
              </td>
            ))}
          </tr>
          <tr className="bg-bg/40 font-semibold">
            <td className="sticky left-0 w-20 bg-bg/95 px-3 py-2 text-left">Median</td>
            <td className="sticky left-20 bg-bg/95 px-3 py-2 text-left" />
            <td className="bg-bg/95 px-3 py-2" />
            <td className="bg-bg/95 px-3 py-2" />
            {visibleColumns.map((c, i) => (
              <td
                key={c.key}
                className={`${cellPadX(c.band)} py-2 text-right ${
                  visibleBandBreaks.has(i) ? "border-l border-rule-strong" : ""
                }`}
              >
                {renderCell(overallStats.median[c.key], c)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      </div>
    </div>
  );
}

function CategorySection({
  label,
  rows,
  stats,
  colCount,
  visibleColumns,
  visibleBandBreaks,
}: {
  label: string;
  rows: PricedFarmlandComp[];
  stats: { mean: Stats; median: Stats };
  colCount: number;
  visibleColumns: typeof COLUMNS;
  visibleBandBreaks: Set<number>;
}) {
  return (
    <>
      <tr className="border-y border-rule-strong">
        <td
          colSpan={colCount}
          className="sticky left-0 z-[2] bg-[var(--accent-warm)] px-3 py-1.5 text-left font-display text-[13px] font-semibold uppercase tracking-wider !text-fg"
        >
          {label} <span className="opacity-60">· {rows.length}</span>
        </td>
      </tr>
      {rows.map((r) => (
        <tr
          key={r.ticker}
          className="border-b border-rule transition-colors hover:bg-bg/60"
        >
          <td className="sticky left-0 z-[1] w-20 bg-surface px-3 py-3 text-left align-top">
            <Link
              href={`/analytics/public-farmland/${encodeURIComponent(r.ticker)}`}
              className="font-semibold !text-fg no-underline transition-colors hover:!text-accent"
            >
              {r.ticker}
            </Link>
          </td>
          <td className="sticky left-20 z-[1] bg-surface px-3 py-3 text-left align-middle">
            <Link
              href={`/analytics/public-farmland/${encodeURIComponent(r.ticker)}`}
              className="text-[12px] !text-fg no-underline transition-colors hover:!text-accent"
            >
              {r.name}
            </Link>
          </td>
          <td className="bg-surface px-3 py-3 text-left text-[11px] text-fg-soft">
            {r.geography}
          </td>
          <td className="bg-surface px-3 py-3 text-left text-[11px] text-fg-soft">
            {r.operatingCountry ?? r.geography}
          </td>
          {visibleColumns.map((c, i) => {
            const val = r[c.key] as number | null;
            return (
              <td
                key={c.key}
                className={`${cellPadX(c.band)} py-3 text-right ${
                  visibleBandBreaks.has(i) ? "border-l border-rule-strong" : ""
                }`}
              >
                {renderCell(val, c)}
              </td>
            );
          })}
        </tr>
      ))}
      <tr className="border-b border-rule bg-bg/30 text-[11px] font-medium text-fg-soft">
        <td className="sticky left-0 z-[1] bg-bg/95 px-3 py-1.5 text-left">
          Mean
        </td>
        <td className="sticky left-20 z-[1] bg-bg/95 px-3 py-1.5 text-left" />
        <td className="bg-bg/95 px-3 py-1.5" />
        <td className="bg-bg/95 px-3 py-1.5" />
        {visibleColumns.map((c, i) => (
          <td
            key={c.key}
            className={`${cellPadX(c.band)} py-1.5 text-right ${
              visibleBandBreaks.has(i) ? "border-l border-rule-strong" : ""
            }`}
          >
            {renderCell(stats.mean[c.key], c)}
          </td>
        ))}
      </tr>
      <tr className="border-b border-rule-strong bg-bg/30 text-[11px] font-medium text-fg-soft">
        <td className="sticky left-0 z-[1] bg-bg/95 px-3 py-1.5 text-left">
          Median
        </td>
        <td className="sticky left-20 z-[1] bg-bg/95 px-3 py-1.5 text-left" />
        <td className="bg-bg/95 px-3 py-1.5" />
        <td className="bg-bg/95 px-3 py-1.5" />
        {visibleColumns.map((c, i) => (
          <td
            key={c.key}
            className={`${cellPadX(c.band)} py-1.5 text-right ${
              visibleBandBreaks.has(i) ? "border-l border-rule-strong" : ""
            }`}
          >
            {renderCell(stats.median[c.key], c)}
          </td>
        ))}
      </tr>
    </>
  );
}

function renderCell(val: number | null, col: Column) {
  if (val === null || (typeof val === "number" && !Number.isFinite(val))) {
    return <span className="text-muted">—</span>;
  }
  const text = formatValue(val, col.format);
  if (col.key === "pNav") {
    return (
      <span
        className={
          val >= 1 ? "text-[var(--positive)]" : "text-[var(--negative)]"
        }
      >
        {text}
      </span>
    );
  }
  if (col.format === "intDollarSigned") {
    return (
      <span
        className={
          val < 0
            ? "text-[var(--positive)]"
            : val > 0
            ? "text-[var(--negative)]"
            : ""
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
    case "int":
      return Math.round(val).toLocaleString("en-US");
    case "intDollar":
      return `$${Math.round(val).toLocaleString("en-US")}`;
    case "intDollarSigned": {
      const rounded = Math.round(val);
      if (rounded < 0) return `($${Math.abs(rounded).toLocaleString("en-US")})`;
      return `$${rounded.toLocaleString("en-US")}`;
    }
    case "pct":
      return `${val.toFixed(1)}%`;
    case "mult":
      return `${val.toFixed(2)}×`;
  }
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
  mean.ticker = null;
  median.ticker = null;
  return { mean, median };
}
