// Shared SVG-chart math: nice axis bounds, tick generation, path building,
// stacking, value formatting, and CAGR helpers. Plain TS — no React, no deps —
// in keeping with the site's hand-rolled-SVG charting style.
//
// TODO: the Farmland* chart components each redefine their own copies of
// niceFloor/niceCeil/makeYTicks/makeXTicks/pathFromPoints. Migrating them onto
// this module is a worthwhile but separate cleanup; for now this is used only by
// components/charts/*.

// ---------------------------------------------------------------------------
// Axis bounds
// ---------------------------------------------------------------------------

export function niceFloor(v: number): number {
  if (v === 0) return 0;
  if (v < 0) return -niceCeil(-v);
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  return Math.floor(v / mag) * mag;
}

export function niceCeil(v: number): number {
  if (v <= 0) return v === 0 ? 0 : -niceFloor(-v);
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  return Math.ceil(v / mag) * mag;
}

/**
 * Pad [lo, hi] outward to round-ish bounds suitable for an axis.
 * `padFrac` adds a fraction of the range to each side before rounding;
 * if lo === hi the bounds are spread symmetrically.
 */
export function niceBounds(
  lo: number,
  hi: number,
  { padFrac = 0, includeZero = false }: { padFrac?: number; includeZero?: boolean } = {},
): { lo: number; hi: number } {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return { lo: 0, hi: 1 };
  if (includeZero) {
    lo = Math.min(lo, 0);
    hi = Math.max(hi, 0);
  }
  if (lo === hi) {
    const pad = Math.abs(lo) * 0.05 || 1;
    lo -= pad;
    hi += pad;
  } else if (padFrac > 0) {
    const pad = (hi - lo) * padFrac;
    lo -= pad;
    hi += pad;
  }
  return { lo: niceFloor(lo), hi: niceCeil(hi) };
}

// ---------------------------------------------------------------------------
// Scales
// ---------------------------------------------------------------------------

export type Scale = (v: number) => number;

export function scaleLinear({
  domain,
  range,
}: {
  domain: [number, number];
  range: [number, number];
}): Scale {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0 || 1;
  return (v: number) => r0 + ((v - d0) / span) * (r1 - r0);
}

// ---------------------------------------------------------------------------
// Ticks
// ---------------------------------------------------------------------------

export type YTick = { value: number; y: number };

/** Evenly spaced y ticks across [lo, hi], mapped to pixel y via the scale. */
export function makeYTicks(lo: number, hi: number, n: number, yScale: Scale): YTick[] {
  const ticks: YTick[] = [];
  const step = (hi - lo) / n;
  for (let i = 0; i <= n; i++) {
    const value = lo + step * i;
    ticks.push({ value, y: yScale(value) });
  }
  return ticks;
}

export type XTick = { x: number; label: string; anchor: "start" | "middle" | "end" };

/**
 * Year-labeled x ticks. `years` is the sorted list of years present in the
 * series; we sample `n` evenly across the value range and label with the
 * nearest actual year, anchoring the first/last tick inward.
 */
export function makeXTicksByYear(years: number[], n: number, xScale: Scale): XTick[] {
  if (years.length === 0) return [];
  const lo = years[0];
  const hi = years[years.length - 1];
  const ticks: XTick[] = [];
  const count = Math.max(2, n);
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const target = lo + t * (hi - lo);
    const nearest = years.reduce((best, y) =>
      Math.abs(y - target) < Math.abs(best - target) ? y : best,
    );
    const anchor: XTick["anchor"] = i === 0 ? "start" : i === count - 1 ? "end" : "middle";
    ticks.push({ x: xScale(nearest), label: String(Math.round(nearest)), anchor });
  }
  return ticks;
}

// ---------------------------------------------------------------------------
// Paths / stacking
// ---------------------------------------------------------------------------

export type XY = { x: number; y: number };

/** Build an SVG path string ("M.. L..") from already-scaled pixel points. */
export function pathFromPoints(points: XY[]): string {
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
}

/** Closed area path between a top edge (forward) and a bottom edge (reversed). */
export function areaPath(top: XY[], bottom: XY[]): string {
  if (top.length === 0) return "";
  const fwd = top.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`);
  const back = [...bottom]
    .reverse()
    .map((p) => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`);
  return `${fwd.join(" ")} ${back.join(" ")} Z`;
}

/**
 * Turn keyed series into cumulative bands for a stacked area chart.
 * Input: rows aligned on x, each carrying a value per key. Output: for each
 * key, the running [base, top] value at every x (in data units, not pixels).
 */
export function stackSeries<K extends string>(
  rows: { x: number; values: Record<K, number> }[],
  keys: K[],
): { key: K; band: { x: number; base: number; top: number }[] }[] {
  return keys.map((key, ki) => ({
    key,
    band: rows.map((row) => {
      let base = 0;
      for (let i = 0; i < ki; i++) base += row.values[keys[i]] ?? 0;
      const top = base + (row.values[key] ?? 0);
      return { x: row.x, base, top };
    }),
  }));
}

export function stackedTotals<K extends string>(
  rows: { x: number; values: Record<K, number> }[],
  keys: K[],
): { x: number; total: number }[] {
  return rows.map((row) => ({
    x: row.x,
    total: keys.reduce((s, k) => s + (row.values[k] ?? 0), 0),
  }));
}

// ---------------------------------------------------------------------------
// CAGR
// ---------------------------------------------------------------------------

/** Compound annual growth rate from `start` to `end` over `years` years. */
export function cagr(start: number, end: number, years: number): number {
  if (!(start > 0) || !(end > 0) || !(years > 0)) return NaN;
  return Math.pow(end / start, 1 / years) - 1;
}

/** CAGR between two indices of a year/value series. */
export function cagrOverSeries(
  points: { year: number; value: number }[],
  fromIdx: number,
  toIdx: number,
): number {
  const a = points[fromIdx];
  const b = points[toIdx];
  if (!a || !b) return NaN;
  return cagr(a.value, b.value, b.year - a.year);
}

export type DecadeCagr = { decadeStartYear: number; fromYear: number; toYear: number; cagr: number };

/**
 * Per-decade CAGR. Buckets points by calendar decade (1700s, 1710s, ...) and
 * computes the CAGR from the first to the last point that falls in (or borders)
 * each decade — so partial first/last decades still get a figure. Returns one
 * entry per decade that has at least two usable points.
 */
export function perDecadeCagr(points: { year: number; value: number }[]): DecadeCagr[] {
  if (points.length < 2) return [];
  const sorted = [...points].sort((a, b) => a.year - b.year);
  const out: DecadeCagr[] = [];
  const firstDecade = Math.floor(sorted[0].year / 10) * 10;
  const lastDecade = Math.floor(sorted[sorted.length - 1].year / 10) * 10;
  for (let d = firstDecade; d <= lastDecade; d += 10) {
    const inDecade = sorted.filter((p) => p.year >= d && p.year < d + 10);
    if (inDecade.length === 0) continue;
    // Anchor to the last point at/just-before the decade start so the CAGR
    // reflects growth *through* the decade, not just within sampled years.
    const start =
      [...sorted].reverse().find((p) => p.year <= d) ?? inDecade[0];
    const end = inDecade[inDecade.length - 1];
    if (start === end) continue;
    const g = cagr(start.value, end.value, end.year - start.year);
    if (Number.isFinite(g)) {
      out.push({ decadeStartYear: d, fromYear: start.year, toYear: end.year, cagr: g });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export function formatCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e4) return `${(n / 1e3).toFixed(1)}K`;
  if (abs >= 1e3) return Math.round(n).toLocaleString("en-US");
  if (abs >= 1) return n.toFixed(0);
  return n.toFixed(2);
}

export function formatPct(frac: number, digits = 1): string {
  if (!Number.isFinite(frac)) return "—";
  return `${(frac * 100).toFixed(digits)}%`;
}

/** Signed percent, for growth rates (e.g. "+6.4%", "-1.2%"). */
export function formatPctSigned(frac: number, digits = 1): string {
  if (!Number.isFinite(frac)) return "—";
  const v = frac * 100;
  return `${v >= 0 ? "+" : ""}${v.toFixed(digits)}%`;
}

export function formatUsd(n: number, digits = 0): string {
  if (!Number.isFinite(n)) return "—";
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

/** A small categorical palette derived from the site's accent vars. */
export const SERIES_COLORS = [
  "var(--accent)",
  "var(--accent-warm)",
  "var(--positive)",
  "var(--negative)",
  "#3a5a7a",
  "#7a5a3a",
  "#5a7a4a",
] as const;
