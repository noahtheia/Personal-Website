import { getFinancials } from "./farmland-financials";
import { getFilings } from "./farmland-comps";
import { fetchPriceHistory, type PriceHistory } from "./farmland-history";

// Universe-level historical multiples view. Computes for each
// fiscal-year-end OR calendar quarter observed across the comps
// universe a slate of fundamental + price-based ratios per ticker,
// then aggregates to cohort median + IQR + per-sector median.
//
// Price-based ratios (EV/EBITDA, P/E, P/NAV, Cap Rate) require a
// price-history lookup at each period end — the universe lookup
// fetches all 135 tickers' Yahoo history (cached 24h) once and
// passes the map into the computation.

export type Cadence = "FY" | "Q";

export type MultiplePoint = {
  date: string;
  // Calendar year (FY cadence) or "YYYY-Qn" (Q cadence).
  bucket: string;
  median: number | null;
  p25: number | null;
  p75: number | null;
  count: number;
  bySector?: Record<string, number | null>;
};

export type MultipleSeries = {
  metric: string;
  label: string;
  unit: "pct" | "mult";
  direction: "higher" | "lower";
  cadence: Cadence;
  points: MultiplePoint[];
};

const cache = new Map<string, MultipleSeries[]>();

export async function getUniverseMultiples(
  cadence: Cadence = "FY",
): Promise<MultipleSeries[]> {
  const cached = cache.get(cadence);
  if (cached) return cached;

  const filings = getFilings();

  // Fetch all 135 tickers' price histories in parallel. Each fetch
  // is wrapped in next: { revalidate: 86400 } so subsequent renders
  // are served from cache.
  const histories: (PriceHistory | null)[] = await Promise.all(
    filings.map((f) => fetchPriceHistory(f.ticker)),
  );
  const historyByTicker = new Map(
    filings.map((f, i) => [f.ticker, histories[i]]),
  );

  // Collect per-(ticker, period) primitives.
  type PeriodRow = {
    ticker: string;
    sector: string;
    endDate: string;
    bucket: string;
    revenueMM?: number;
    ebitdaMM?: number;
    netIncomeMM?: number;
    cfoMM?: number;
    capexMM?: number;
    sharesOutMM?: number;
    netDebtMM?: number;
    totalEquityMM?: number;
    bookValuePerShare?: number;
    navPerShare?: number;
    fmvNavPerShare?: number;
    propertyFmvMM?: number;
    epsBasic?: number;
    epsDiluted?: number;
    // Price (filing currency) at period end — looked up from history.
    pricePerShare?: number;
  };

  const rowsByBucket = new Map<string, PeriodRow[]>();
  for (const f of filings) {
    const fin = getFinancials(f.ticker);
    if (!fin) continue;
    const ph = historyByTicker.get(f.ticker);
    for (const p of fin.periods) {
      if (cadence === "FY" && p.periodType !== "FY") continue;
      if (cadence === "Q" && p.periodType !== "Q") continue;
      const d = new Date(p.endDate);
      const bucket =
        cadence === "FY"
          ? String(d.getUTCFullYear())
          : `${d.getUTCFullYear()}-Q${Math.floor(d.getUTCMonth() / 3) + 1}`;

      // Look up year-end (or quarter-end) close from price history.
      // Walk backwards to nearest trading day at-or-before endDate.
      let pricePerShare: number | undefined;
      if (ph && ph.points.length > 0) {
        for (let i = ph.points.length - 1; i >= 0; i--) {
          if (ph.points[i].date <= p.endDate) {
            pricePerShare = ph.points[i].close;
            break;
          }
        }
      }

      const row: PeriodRow = {
        ticker: f.ticker,
        sector: f.sector,
        endDate: p.endDate,
        bucket,
        revenueMM: p.revenueMM,
        ebitdaMM: p.ebitdaMM,
        netIncomeMM: p.netIncomeMM,
        cfoMM: p.cfoMM,
        capexMM: p.capexMM,
        sharesOutMM: p.sharesOutMM,
        netDebtMM: p.netDebtMM,
        totalEquityMM: p.totalEquityMM,
        bookValuePerShare: p.bookValuePerShare,
        navPerShare: p.navPerShare,
        fmvNavPerShare: p.fmvNavPerShare,
        propertyFmvMM: p.propertyFmvMM,
        epsBasic: p.epsBasic,
        epsDiluted: p.epsDiluted,
        pricePerShare,
      };
      if (!rowsByBucket.has(bucket)) rowsByBucket.set(bucket, []);
      rowsByBucket.get(bucket)!.push(row);
    }
  }

  // Helpers
  const getEquity = (r: PeriodRow): number | null => {
    if (typeof r.totalEquityMM === "number") return r.totalEquityMM;
    if (
      typeof r.bookValuePerShare === "number" &&
      typeof r.sharesOutMM === "number"
    )
      return r.bookValuePerShare * r.sharesOutMM;
    return null;
  };
  const getMarketCap = (r: PeriodRow): number | null => {
    if (typeof r.pricePerShare !== "number" || typeof r.sharesOutMM !== "number")
      return null;
    return r.pricePerShare * r.sharesOutMM;
  };
  const getEv = (r: PeriodRow): number | null => {
    const mc = getMarketCap(r);
    if (mc === null) return null;
    const nd = typeof r.netDebtMM === "number" ? r.netDebtMM : 0;
    return mc + nd;
  };
  const getEps = (r: PeriodRow): number | null => {
    if (typeof r.epsBasic === "number") return r.epsBasic;
    if (typeof r.epsDiluted === "number") return r.epsDiluted;
    if (typeof r.netIncomeMM === "number" && typeof r.sharesOutMM === "number" && r.sharesOutMM > 0)
      return r.netIncomeMM / r.sharesOutMM;
    return null;
  };

  type DerivedMetric = {
    metric: string;
    label: string;
    unit: "pct" | "mult";
    direction: "higher" | "lower";
    fn: (r: PeriodRow) => number | null;
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
        const eq = getEquity(r);
        return typeof r.netIncomeMM === "number" && eq !== null && eq > 0
          ? (r.netIncomeMM / eq) * 100
          : null;
      },
    },
    {
      metric: "roic",
      label: "ROIC",
      unit: "pct",
      direction: "higher",
      fn: (r) => {
        const eq = getEquity(r);
        const nd = typeof r.netDebtMM === "number" ? r.netDebtMM : 0;
        const ic = eq !== null ? eq + nd : null;
        return typeof r.netIncomeMM === "number" && ic !== null && ic > 0
          ? (r.netIncomeMM / ic) * 100
          : null;
      },
    },
    {
      metric: "fcfMargin",
      label: "FCF Margin",
      unit: "pct",
      direction: "higher",
      fn: (r) =>
        typeof r.cfoMM === "number" &&
        typeof r.capexMM === "number" &&
        typeof r.revenueMM === "number" &&
        r.revenueMM > 0
          ? ((r.cfoMM - r.capexMM) / r.revenueMM) * 100
          : null,
    },
    {
      metric: "debtToEbitda",
      label: "Net Debt / EBITDA",
      unit: "mult",
      direction: "lower",
      fn: (r) =>
        typeof r.netDebtMM === "number" &&
        typeof r.ebitdaMM === "number" &&
        r.ebitdaMM > 0
          ? r.netDebtMM / r.ebitdaMM
          : null,
    },
    {
      metric: "capexIntensity",
      label: "Capex / Revenue",
      unit: "pct",
      direction: "lower",
      fn: (r) =>
        typeof r.capexMM === "number" &&
        typeof r.revenueMM === "number" &&
        r.revenueMM > 0
          ? (r.capexMM / r.revenueMM) * 100
          : null,
    },
    {
      metric: "evEbitda",
      label: "EV / EBITDA",
      unit: "mult",
      direction: "lower",
      fn: (r) => {
        const ev = getEv(r);
        return ev !== null && typeof r.ebitdaMM === "number" && r.ebitdaMM > 0
          ? ev / r.ebitdaMM
          : null;
      },
    },
    {
      metric: "priceEarnings",
      label: "P / E",
      unit: "mult",
      direction: "lower",
      fn: (r) => {
        const eps = getEps(r);
        return typeof r.pricePerShare === "number" && eps !== null && eps > 0
          ? r.pricePerShare / eps
          : null;
      },
    },
    {
      metric: "pNav",
      label: "P / NAV (book)",
      unit: "mult",
      direction: "lower",
      fn: (r) => {
        // Use FMV NAV / share if available; else book value / share;
        // else equity / shares.
        const navPS =
          typeof r.fmvNavPerShare === "number"
            ? r.fmvNavPerShare
            : typeof r.navPerShare === "number"
            ? r.navPerShare
            : typeof r.bookValuePerShare === "number"
            ? r.bookValuePerShare
            : (() => {
                const eq = getEquity(r);
                return eq !== null &&
                  typeof r.sharesOutMM === "number" &&
                  r.sharesOutMM > 0
                  ? eq / r.sharesOutMM
                  : null;
              })();
        return typeof r.pricePerShare === "number" &&
          navPS !== null &&
          navPS > 0
          ? r.pricePerShare / navPS
          : null;
      },
    },
    {
      metric: "capRate",
      label: "Cap Rate (EBITDA / EV)",
      unit: "pct",
      direction: "higher",
      fn: (r) => {
        const ev = getEv(r);
        return ev !== null && typeof r.ebitdaMM === "number" && r.ebitdaMM > 0
          ? (r.ebitdaMM / ev) * 100
          : null;
      },
    },
  ];

  const series: MultipleSeries[] = metrics.map((m) => {
    const points: MultiplePoint[] = [];
    const sortedBuckets = Array.from(rowsByBucket.keys()).sort();
    for (const bucket of sortedBuckets) {
      const rows = rowsByBucket.get(bucket) ?? [];
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
      // Build a representative date for the bucket.
      const date =
        cadence === "FY"
          ? `${bucket}-12-31`
          : (() => {
              const [y, q] = bucket.split("-Q");
              const month = parseInt(q, 10) * 3; // Q1→3, Q2→6, Q3→9, Q4→12
              const lastDay = new Date(
                Date.UTC(parseInt(y, 10), month, 0),
              ).getUTCDate();
              return `${y}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
            })();
      points.push({ date, bucket, median, p25, p75, count: values.length, bySector });
    }
    return {
      metric: m.metric,
      label: m.label,
      unit: m.unit,
      direction: m.direction,
      cadence,
      points,
    };
  });

  cache.set(cadence, series);
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
