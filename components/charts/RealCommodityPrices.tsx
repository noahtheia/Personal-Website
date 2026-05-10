"use client";

// Real agricultural commodity prices (sugar / soybeans / wheat / cotton …),
// multi-line with a click-to-toggle legend, plus dashed mean-reversion target
// lines (the author's estimate, labeled as such). Date-stamped source points
// are collapsed to annual (last observation per calendar year) so the x-axis
// stays clean. Degrades to "data pending" until real-commodity-prices.json is
// populated.

import { useMemo } from "react";
import { ChartFrame, DataPending, LineChart, type LineSeries } from "@/components/charts/ChartShell";
import { getRealCommodityPrices } from "@/lib/article-agriculture";
import { SERIES_COLORS, formatCompact } from "@/lib/chart-helpers";

function yearOf(date: string): number {
  const m = /^(\d{4})/.exec(date.trim());
  return m ? Number(m[1]) : NaN;
}

function toAnnual(points: { date: string; value: number }[]): { year: number; value: number }[] {
  const byYear = new Map<number, { date: string; value: number }>();
  for (const p of points) {
    const y = yearOf(p.date);
    if (!Number.isFinite(y)) continue;
    const prev = byYear.get(y);
    if (!prev || p.date >= prev.date) byYear.set(y, p);
  }
  return Array.from(byYear.entries())
    .map(([year, p]) => ({ year, value: p.value }))
    .sort((a, b) => a.year - b.year);
}

export function RealCommodityPrices({ showTarget = true }: { showTarget?: boolean }) {
  const data = getRealCommodityPrices();

  const built = useMemo(() => {
    const usable = data.series
      .map((s) => ({ ...s, annual: toAnnual(s.points) }))
      .filter((s) => s.annual.length >= 2);
    if (usable.length === 0) return null;
    const series: LineSeries[] = usable.map((s, i) => ({
      key: s.commodity,
      color: SERIES_COLORS[i % SERIES_COLORS.length],
      points: s.annual,
    }));
    const markers = showTarget
      ? usable
          .filter((s) => s.meanReversionTarget != null)
          .map((s, i) => ({
            value: s.meanReversionTarget!.value,
            label: `${s.commodity} target (est.)`,
            color: SERIES_COLORS[i % SERIES_COLORS.length],
          }))
      : [];
    return { series, markers, hasTargets: markers.length > 0 };
  }, [data, showTarget]);

  return (
    <ChartFrame
      title="Real agricultural commodity prices"
      subtitle={`deflated by ${data.deflator}${data.baseYear ? `, base ${data.baseYear}` : ""}`}
      source={data.source}
      retrievedAt={data.retrievedAt}
    >
      {built ? (
        <>
          <LineChart
            series={built.series}
            markers={built.markers}
            formatValue={formatCompact}
            formatTick={formatCompact}
            includeZero
            ariaLabel="Real agricultural commodity prices over time"
          />
          {built.hasTargets ? (
            <p className="mt-3 text-[11px] leading-snug text-muted">
              Dashed lines are the author&rsquo;s mean-reversion targets (roughly +20–30% off recent
              lows), not data or a price forecast of record.
            </p>
          ) : null}
        </>
      ) : (
        <DataPending note="Real commodity-price series (World Bank Pink Sheet / IMF / FRED) not yet sourced — see SOURCES.md." />
      )}
    </ChartFrame>
  );
}
