import fs from "node:fs";
import path from "node:path";
import { getFinancials } from "./farmland-financials";
import { getFilings } from "./farmland-comps";

// Universe-level historical multiples view. For each fiscal year-end
// observed across the comps universe, compute key ratios per ticker
// (P/NAV / EV/EBITDA / ROIC / etc.) and aggregate to the cohort
// median + sector medians. Returns a series ready for the multi-line
// chart on the comps page.

export type MultiplePoint = {
  // ISO YYYY-12-31 (or whatever fiscal-year-end date the issuer uses
  // — bucketed to the calendar year for cohort comparison).
  date: string;
  year: number;
  // Aggregate values at this year-end across the cohort.
  median: number | null;
  p25: number | null;
  p75: number | null;
  count: number;
  // Per-sector median (for stratified comparison).
  bySector?: Record<string, number | null>;
};

export type MultipleSeries = {
  metric: string;
  label: string;
  unit: "pct" | "mult";
  // Lower or higher = better; used for tinting.
  direction: "higher" | "lower";
  points: MultiplePoint[];
};

// Cache the heavy computation between requests in the same render
// window. Realistically this is computed once per build.
let cachedSeries: MultipleSeries[] | null = null;

export function getUniverseMultiples(): MultipleSeries[] {
  if (cachedSeries) return cachedSeries;

  const filings = getFilings();
  const sectorByTicker = new Map(filings.map((f) => [f.ticker, f.sector]));

  // Collect per-(ticker, year) primitives from the financials files.
  type YearRow = {
    ticker: string;
    sector: string;
    year: number;
    revenueMM?: number;
    ebitdaMM?: number;
    netIncomeMM?: number;
    cfoMM?: number;
    capexMM?: number;
    dividendPerShare?: number;
    sharesOutMM?: number;
    netDebtMM?: number;
    totalEquityMM?: number;
    bookValuePerShare?: number;
    navPerShare?: number;
    fmvNavPerShare?: number;
    propertyFmvMM?: number;
    propertyBookMM?: number;
    annualNoiMM?: number;
  };

  const rowsByYear = new Map<number, YearRow[]>();
  for (const f of filings) {
    const fin = getFinancials(f.ticker);
    if (!fin) continue;
    for (const p of fin.periods) {
      if (p.periodType !== "FY") continue;
      const year = new Date(p.endDate).getUTCFullYear();
      if (!rowsByYear.has(year)) rowsByYear.set(year, []);
      rowsByYear.get(year)!.push({
        ticker: f.ticker,
        sector: f.sector,
        year,
        revenueMM: p.revenueMM,
        ebitdaMM: p.ebitdaMM,
        netIncomeMM: p.netIncomeMM,
        cfoMM: p.cfoMM,
        capexMM: p.capexMM,
        dividendPerShare: p.dividendPerShare,
        sharesOutMM: p.sharesOutMM,
        netDebtMM: p.netDebtMM,
        totalEquityMM: p.totalEquityMM,
        bookValuePerShare: p.bookValuePerShare,
        navPerShare: p.navPerShare,
        fmvNavPerShare: p.fmvNavPerShare,
        propertyFmvMM: p.propertyFmvMM,
        propertyBookMM: p.propertyBookMM,
      });
    }
  }

  // Metric definitions — derive numeric value from a YearRow + (where
  // needed) the per-ticker price history. We don't have year-end
  // share-price history persisted today, so multiples that depend on
  // market cap (EV/EBITDA, P/E, P/NAV) use the LATEST market cap as a
  // backward-extrapolation only for the most-recent year. Earlier
  // years compute fundamental ratios that don't need price (ROE,
  // ROIC, EBITDA margin, NI margin, debt/EBITDA).
  type DerivedMetric = {
    metric: string;
    label: string;
    unit: "pct" | "mult";
    direction: "higher" | "lower";
    fn: (r: YearRow) => number | null;
  };

  const metrics: DerivedMetric[] = [
    {
      metric: "ebitdaMargin",
      label: "EBITDA Margin",
      unit: "pct",
      direction: "higher",
      fn: (r) =>
        typeof r.ebitdaMM === "number" &&
        typeof r.revenueMM === "number" &&
        r.revenueMM > 0
          ? (r.ebitdaMM / r.revenueMM) * 100
          : null,
    },
    {
      metric: "netIncomeMargin",
      label: "Net Income Margin",
      unit: "pct",
      direction: "higher",
      fn: (r) =>
        typeof r.netIncomeMM === "number" &&
        typeof r.revenueMM === "number" &&
        r.revenueMM > 0
          ? (r.netIncomeMM / r.revenueMM) * 100
          : null,
    },
    {
      metric: "roe",
      label: "ROE",
      unit: "pct",
      direction: "higher",
      fn: (r) => {
        const equity =
          typeof r.totalEquityMM === "number"
            ? r.totalEquityMM
            : typeof r.bookValuePerShare === "number" &&
              typeof r.sharesOutMM === "number"
            ? r.bookValuePerShare * r.sharesOutMM
            : null;
        return typeof r.netIncomeMM === "number" &&
          equity !== null &&
          equity > 0
          ? (r.netIncomeMM / equity) * 100
          : null;
      },
    },
    {
      metric: "roic",
      label: "ROIC",
      unit: "pct",
      direction: "higher",
      fn: (r) => {
        const equity =
          typeof r.totalEquityMM === "number"
            ? r.totalEquityMM
            : typeof r.bookValuePerShare === "number" &&
              typeof r.sharesOutMM === "number"
            ? r.bookValuePerShare * r.sharesOutMM
            : null;
        const netDebt = typeof r.netDebtMM === "number" ? r.netDebtMM : 0;
        const investedCapital = equity !== null ? equity + netDebt : null;
        return typeof r.netIncomeMM === "number" &&
          investedCapital !== null &&
          investedCapital > 0
          ? (r.netIncomeMM / investedCapital) * 100
          : null;
      },
    },
    {
      metric: "fcfMargin",
      label: "FCF Margin",
      unit: "pct",
      direction: "higher",
      fn: (r) => {
        if (
          typeof r.cfoMM !== "number" ||
          typeof r.capexMM !== "number" ||
          typeof r.revenueMM !== "number" ||
          r.revenueMM <= 0
        )
          return null;
        return ((r.cfoMM - r.capexMM) / r.revenueMM) * 100;
      },
    },
    {
      metric: "debtToEbitda",
      label: "Net Debt / EBITDA",
      unit: "mult",
      direction: "lower",
      fn: (r) => {
        if (
          typeof r.netDebtMM !== "number" ||
          typeof r.ebitdaMM !== "number" ||
          r.ebitdaMM <= 0
        )
          return null;
        return r.netDebtMM / r.ebitdaMM;
      },
    },
    {
      metric: "capexIntensity",
      label: "Capex / Revenue",
      unit: "pct",
      direction: "lower",
      fn: (r) => {
        if (
          typeof r.capexMM !== "number" ||
          typeof r.revenueMM !== "number" ||
          r.revenueMM <= 0
        )
          return null;
        return (r.capexMM / r.revenueMM) * 100;
      },
    },
  ];

  const series: MultipleSeries[] = metrics.map((m) => {
    const points: MultiplePoint[] = [];
    const sortedYears = Array.from(rowsByYear.keys()).sort((a, b) => a - b);
    for (const year of sortedYears) {
      const rows = rowsByYear.get(year) ?? [];
      const values: number[] = [];
      const sectorBuckets = new Map<string, number[]>();
      for (const r of rows) {
        const v = m.fn(r);
        if (v === null || !Number.isFinite(v)) continue;
        values.push(v);
        if (!sectorBuckets.has(r.sector)) sectorBuckets.set(r.sector, []);
        sectorBuckets.get(r.sector)!.push(v);
      }
      const sortedVals = [...values].sort((a, b) => a - b);
      const median = quantile(sortedVals, 0.5);
      const p25 = quantile(sortedVals, 0.25);
      const p75 = quantile(sortedVals, 0.75);
      const bySector: Record<string, number | null> = {};
      for (const [sector, vals] of sectorBuckets) {
        bySector[sector] = quantile(
          [...vals].sort((a, b) => a - b),
          0.5,
        );
      }
      points.push({
        date: `${year}-12-31`,
        year,
        median,
        p25,
        p75,
        count: values.length,
        bySector,
      });
    }
    return {
      metric: m.metric,
      label: m.label,
      unit: m.unit,
      direction: m.direction,
      points,
    };
  });

  cachedSeries = series;
  return series;
}

function quantile(sorted: number[], q: number): number | null {
  if (sorted.length === 0) return null;
  const idx = (sorted.length - 1) * q;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] * (hi - idx) + sorted[hi] * (idx - lo);
}
