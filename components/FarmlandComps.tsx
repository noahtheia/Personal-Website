"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type {
  FarmlandGeography,
  FarmlandSector,
  PricedFarmlandComp,
} from "@/lib/farmland-comps";

const WATCHLIST_KEY = "farmland-comps-watchlist";

const WATCHLIST_SECTOR_KEY = "★ Watchlist";

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
  | "annualNetIncomeMM"
  | "ebitdaMargin"
  | "netIncomeMargin"
  | "roe"
  | "roic"
  | "evEbitda"
  | "priceSales"
  | "priceEarnings"
  | "evCapRate"
  | "divYield"
  | "fcfYield";

type Band = "market" | "land" | "operating" | "valuation";
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
  // Operating metrics
  { key: "annualRevenueMM", label: "Revenue", hint: "$M", band: "operating", format: "intDollar" },
  { key: "annualEbitdaMM", label: "EBITDA", hint: "$M", band: "operating", format: "intDollarSigned" },
  { key: "annualNetIncomeMM", label: "Net Income", hint: "$M", band: "operating", format: "intDollarSigned" },
  { key: "ebitdaMargin", label: "EBITDA Margin", hint: "EBITDA ÷ rev", band: "operating", format: "pct" },
  { key: "netIncomeMargin", label: "Net Income Margin", hint: "NI ÷ rev", band: "operating", format: "pct" },
  { key: "roe", label: "ROE", hint: "NI ÷ equity", band: "operating", format: "pct" },
  { key: "roic", label: "ROIC", hint: "NI ÷ (equity + net debt)", band: "operating", format: "pct" },
  // Valuation multiples
  { key: "evEbitda", label: "EV / EBITDA", hint: "×", band: "valuation", format: "mult" },
  { key: "priceSales", label: "P / S", hint: "mkt cap ÷ rev", band: "valuation", format: "mult" },
  { key: "priceEarnings", label: "P / E", hint: "price ÷ EPS", band: "valuation", format: "mult" },
  { key: "divYield", label: "Div Yield", hint: "div ÷ price", band: "valuation", format: "pct" },
  { key: "fcfYield", label: "FCF Yield", hint: "FCF ÷ mkt cap", band: "valuation", format: "pct" },
  // Land value (right-most band)
  { key: "acresK", label: "Acres", hint: "thousands", band: "land", format: "int" },
  { key: "bookPerAcre", label: "Book / Acre", hint: "$ filed", band: "land", format: "intDollar" },
  { key: "marketPerAcre", label: "Market / Acre", hint: "$ FMV", band: "land", format: "intDollar" },
  { key: "evPerAcre", label: "EV / Acre", hint: "$ implied", band: "land", format: "intDollar" },
  { key: "pNav", label: "P / NAV", hint: "price ÷ FMV NAV (per detail page)", band: "land", format: "mult" },
  { key: "fmvNavPerShareUsd", label: "FMV NAV / sh", hint: "$ implied", band: "land", format: "money" },
  { key: "evCapRate", label: "Cap Rate", hint: "NOI ÷ EV", band: "land", format: "pct" },
];

const BAND_LABEL: Record<Band, string> = {
  market: "Market Data",
  operating: "Operating Metrics",
  valuation: "Valuation Multiples",
  land: "Land Value",
};

const BAND_ORDER: Band[] = ["market", "operating", "valuation", "land"];

// Indices where a band changes — used to draw vertical separators.
const BAND_BREAKS = new Set(
  COLUMNS.map((c, i) => (i > 0 && c.band !== COLUMNS[i - 1].band ? i : -1)).filter(
    (n) => n !== -1,
  ),
);

function cellPadX(band: Band): string {
  // Multi-column bands (Market Data, Operating Metrics, Valuation Multiples)
  // use tighter padding; Land Value gets the looser px-3.
  return band === "land" ? "px-3" : "px-1.5";
}

// Direction for peer-relative coloring. "higher" → green when a cell
// is >+1σ above sector mean; "lower" → green when below the mean
// (e.g. cheaper EV/EBITDA is good). Columns not listed get no
// tinting (size / debt / per-acre — direction is ambiguous).
const DIRECTION: Partial<Record<SortKey, "higher" | "lower">> = {
  ebitdaMargin: "higher",
  netIncomeMargin: "higher",
  roe: "higher",
  roic: "higher",
  divYield: "higher",
  fcfYield: "higher",
  evCapRate: "higher",
  evEbitda: "lower",
  priceSales: "lower",
  priceEarnings: "lower",
  pNav: "lower",
};

// Returns an inline-style background tint, or undefined for no tint.
function peerToneStyle(
  val: number | null,
  key: SortKey,
  mean: number | null,
  std: number | null,
): React.CSSProperties | undefined {
  if (val === null || mean === null || std === null || std === 0) return undefined;
  const dir = DIRECTION[key];
  if (!dir) return undefined;
  const z = (val - mean) / std;
  if (Math.abs(z) < 1) return undefined;
  const isGood = dir === "higher" ? z > 0 : z < 0;
  // Lighter tint for 1-2σ, stronger for >2σ. Use the editorial
  // positive/negative variables with an alpha blend.
  const strong = Math.abs(z) >= 2;
  const color = isGood ? "var(--positive)" : "var(--negative)";
  // Color-mix is widely supported. Alpha 12% / 22% strong.
  return {
    backgroundColor: `color-mix(in srgb, ${color} ${strong ? 22 : 12}%, transparent)`,
  };
}

export function FarmlandComps({ rows }: { rows: PricedFarmlandComp[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("marketCapMM");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [search, setSearch] = useState<string>("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [visibleBands, setVisibleBands] = useState<Record<Band, boolean>>({
    market: true,
    operating: true,
    valuation: true,
    land: true,
  });
  const [filterOpen, setFilterOpen] = useState(false);
  const [watchlist, setWatchlist] = useState<Set<string>>(new Set());
  const [watchlistOnly, setWatchlistOnly] = useState(false);

  // Load watchlist from localStorage on mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(WATCHLIST_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setWatchlist(
            new Set(parsed.filter((x): x is string => typeof x === "string")),
          );
        }
      }
    } catch {
      // ignore corrupted storage
    }
  }, []);

  function toggleWatch(ticker: string) {
    setWatchlist((prev) => {
      const next = new Set(prev);
      if (next.has(ticker)) next.delete(ticker);
      else next.add(ticker);
      try {
        window.localStorage.setItem(
          WATCHLIST_KEY,
          JSON.stringify(Array.from(next)),
        );
      } catch {
        // ignore quota errors
      }
      return next;
    });
  }

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

  // Group rows by sector, preserve SECTOR_ORDER outer order; within
  // each group, sort by the user's chosen column. Apply the search
  // filter (matches ticker, name, or operating country, case-insensitive)
  // before grouping so empty sectors collapse out automatically.
  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    let filtered = q
      ? rows.filter(
          (r) =>
            r.ticker.toLowerCase().includes(q) ||
            r.name.toLowerCase().includes(q) ||
            r.geography.toLowerCase().includes(q) ||
            (r.operatingCountry ?? "").toLowerCase().includes(q),
        )
      : rows;
    if (watchlistOnly) {
      filtered = filtered.filter((r) => watchlist.has(r.ticker));
    }
    const buckets = new Map<string, PricedFarmlandComp[]>();
    // Pinned (★) tickers float to a synthetic Watchlist band at the
    // top — appear here AND in their normal sector below.
    const pinned = filtered.filter((r) => watchlist.has(r.ticker));
    if (pinned.length > 0) buckets.set(WATCHLIST_SECTOR_KEY, pinned);
    for (const r of filtered) {
      const k = categoryKey(r);
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k)!.push(r);
    }
    // Ordered group entries — Watchlist always first when present
    const ordered = Array.from(buckets.entries()).sort(([keyA, a], [keyB, b]) => {
      if (keyA === WATCHLIST_SECTOR_KEY) return -1;
      if (keyB === WATCHLIST_SECTOR_KEY) return 1;
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
  }, [rows, effectiveSortKey, dir, search, watchlist, watchlistOnly]);

  const overallStats = useMemo(() => computeStats(rows), [rows]);

  function onHeaderClick(k: SortKey) {
    if (k === sortKey) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setDir(k === "ticker" ? "asc" : "desc");
    }
  }

  const totalShown = useMemo(
    () => groups.reduce((s, g) => s + g.rows.length, 0),
    [groups],
  );

  function handleExportCsv() {
    const visibleKeys = visibleColumns.map((c) => c.key);
    const headers = ["Ticker", "Company", "Exchange", "Operations"].concat(
      visibleColumns.map((c) => c.label),
    );
    const lines: string[] = [headers.map(csvCell).join(",")];
    for (const g of groups) {
      for (const r of g.rows) {
        const row = [
          r.ticker,
          r.name,
          r.geography,
          r.operatingCountry ?? r.geography,
          ...visibleKeys.map((k) => {
            const v = r[k] as number | null;
            return v === null || v === undefined || !Number.isFinite(v as number)
              ? ""
              : String(v);
          }),
        ];
        lines.push(row.map(csvCell).join(","));
      }
    }
    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `agriculture-comps-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mt-6 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ticker, name, or country…"
            aria-label="Search comps table"
            className="rounded-sm border border-rule bg-surface px-3 py-1.5 text-xs placeholder:text-muted focus:border-accent focus:outline-none w-72"
          />
          <span className="text-[11px] uppercase tracking-wider text-muted">
            {totalShown} {totalShown === 1 ? "ticker" : "tickers"}
            {search ? ` matching "${search}"` : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {watchlist.size > 0 && (
            <button
              type="button"
              onClick={() => setWatchlistOnly((v) => !v)}
              aria-pressed={watchlistOnly}
              className={`inline-flex items-center gap-2 rounded-sm border px-3 py-1.5 text-xs font-medium transition-colors ${
                watchlistOnly
                  ? "border-accent bg-accent !text-bg"
                  : "border-rule bg-surface !text-fg hover:border-accent hover:!text-accent"
              }`}
            >
              <span aria-hidden="true">★</span>
              <span>Watchlist</span>
              <span className="text-[10px] opacity-70">{watchlist.size}</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-2 rounded-sm border border-rule bg-surface px-3 py-1.5 text-xs font-medium !text-fg transition-colors hover:border-accent hover:!text-accent"
          >
            <span>Export CSV</span>
          </button>
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
              isCollapsed={collapsed.has(group.key)}
              onToggle={() =>
                setCollapsed((c) => {
                  const next = new Set(c);
                  if (next.has(group.key)) next.delete(group.key);
                  else next.add(group.key);
                  return next;
                })
              }
              onToggleWatch={toggleWatch}
              isWatched={(t) => watchlist.has(t)}
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
  isCollapsed,
  onToggle,
  onToggleWatch,
  isWatched,
}: {
  label: string;
  rows: PricedFarmlandComp[];
  stats: { mean: Stats; median: Stats; std: Stats };
  colCount: number;
  visibleColumns: typeof COLUMNS;
  visibleBandBreaks: Set<number>;
  isCollapsed: boolean;
  onToggle: () => void;
  onToggleWatch: (ticker: string) => void;
  isWatched: (ticker: string) => boolean;
}) {
  return (
    <>
      <tr className="border-y border-rule-strong">
        <td
          colSpan={colCount}
          className="sticky left-0 z-[2] bg-[var(--accent-warm)] px-3 py-1.5 text-left font-display text-[13px] font-semibold uppercase tracking-wider !text-fg"
        >
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={!isCollapsed}
            className="inline-flex items-center gap-2 !text-fg no-underline hover:!text-fg-soft"
          >
            <span aria-hidden="true" className="text-[10px]">
              {isCollapsed ? "▸" : "▾"}
            </span>
            <span>{label}</span>
            <span className="opacity-60">· {rows.length}</span>
          </button>
        </td>
      </tr>
      {!isCollapsed && rows.map((r) => (
        <tr
          key={r.ticker}
          className="border-b border-rule transition-colors hover:bg-bg/60"
        >
          <td className="sticky left-0 z-[1] w-20 bg-surface px-3 py-3 text-left align-top">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onToggleWatch(r.ticker)}
                aria-pressed={isWatched(r.ticker)}
                aria-label={
                  isWatched(r.ticker)
                    ? `Remove ${r.ticker} from watchlist`
                    : `Add ${r.ticker} to watchlist`
                }
                className={`text-sm leading-none transition-colors ${
                  isWatched(r.ticker)
                    ? "!text-[var(--accent-warm)]"
                    : "!text-muted hover:!text-[var(--accent-warm)]"
                }`}
              >
                {isWatched(r.ticker) ? "★" : "☆"}
              </button>
              <Link
                href={`/analytics/public-farmland/${encodeURIComponent(r.ticker)}`}
                className="font-semibold !text-fg no-underline transition-colors hover:!text-accent"
              >
                {r.ticker}
              </Link>
            </div>
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
            const toneStyle = peerToneStyle(
              val,
              c.key,
              stats.mean[c.key],
              stats.std[c.key],
            );
            return (
              <td
                key={c.key}
                style={toneStyle}
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
      // Render negative percentages as parenthesized values (matches the
      // intDollarSigned convention) so the leading "(" doesn't drift the
      // whole column out of alignment with positive %s.
      if (val < 0) return `(${Math.abs(val).toFixed(1)}%)`;
      return `${val.toFixed(1)}%`;
    case "mult":
      return `${val.toFixed(2)}×`;
  }
}


type Stats = Record<SortKey, number | null>;

// Escape a CSV cell — wrap in double quotes if the value contains
// commas, quotes, or newlines; double up internal quotes.
function csvCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s === "") return "";
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function computeStats(
  rows: PricedFarmlandComp[],
): { mean: Stats; median: Stats; std: Stats } {
  const keys = COLUMNS.map((c) => c.key);
  const mean = {} as Stats;
  const median = {} as Stats;
  const std = {} as Stats;
  for (const k of keys) {
    const vals = rows
      .map((r) => r[k] as number | null)
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    if (vals.length === 0) {
      mean[k] = null;
      median[k] = null;
      std[k] = null;
      continue;
    }
    const sum = vals.reduce((a, b) => a + b, 0);
    const m = sum / vals.length;
    mean[k] = m;
    const sortedVals = [...vals].sort((a, b) => a - b);
    const mid = Math.floor(sortedVals.length / 2);
    median[k] =
      sortedVals.length % 2 === 0
        ? (sortedVals[mid - 1] + sortedVals[mid]) / 2
        : sortedVals[mid];
    if (vals.length < 2) {
      std[k] = null;
    } else {
      const variance =
        vals.reduce((acc, v) => acc + (v - m) * (v - m), 0) / (vals.length - 1);
      std[k] = Math.sqrt(variance);
    }
  }
  mean.ticker = null;
  median.ticker = null;
  std.ticker = null;
  return { mean, median, std };
}
