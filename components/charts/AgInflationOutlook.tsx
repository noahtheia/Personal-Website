"use client";

// Agricultural commodity inflation: realized year-over-year history plus the
// author's forward view (a low/mid/high band, thesis ≈ >3%/yr for a decade),
// drawn distinctly and labeled as an estimate. Degrades to "data pending" until
// ag-inflation-outlook.json is populated.

import { useMemo } from "react";
import { ChartFrame, DataPending, LineChart, type LineSeries } from "@/components/charts/ChartShell";
import { getAgInflationOutlook } from "@/lib/article-agriculture";
import { SERIES_COLORS, formatPct } from "@/lib/chart-helpers";

export function AgInflationOutlook() {
  const data = getAgInflationOutlook();

  const built = useMemo(() => {
    if (data.history.length < 2) return null;
    const series: LineSeries[] = [
      { key: "Realized (YoY)", color: SERIES_COLORS[0], points: data.history },
    ];
    const p = data.projection;
    const markers: { value: number; label: string; color?: string }[] = [];
    if (
      p.fromYear != null &&
      p.toYear != null &&
      p.midPct != null
    ) {
      series.push({
        key: "Projected (mid, est.)",
        color: SERIES_COLORS[1],
        points: [
          { year: p.fromYear, value: p.midPct },
          { year: p.toYear, value: p.midPct },
        ],
      });
      if (p.lowPct != null) markers.push({ value: p.lowPct, label: "low (est.)", color: "var(--muted)" });
      if (p.highPct != null) markers.push({ value: p.highPct, label: "high (est.)", color: "var(--muted)" });
    }
    return { series, markers, hasProjection: series.length > 1 };
  }, [data]);

  return (
    <ChartFrame
      title="Agricultural commodity inflation — history and outlook"
      subtitle="year-over-year %"
      source={data.source}
      sourceUrl={data.sourceUrl}
      retrievedAt={data.retrievedAt}
    >
      {built ? (
        <>
          <LineChart
            series={built.series}
            markers={built.markers}
            formatValue={(v) => formatPct(v, 1)}
            formatTick={(v) => formatPct(v, 0)}
            includeZero
            ariaLabel="Agricultural commodity inflation over time, with outlook"
          />
          {built.hasProjection ? (
            <p className="mt-3 text-[11px] leading-snug text-muted">
              The projected path and band are the author&rsquo;s estimate (thesis: agricultural
              commodity inflation above ~3% a year for roughly a decade), not a forecast of record.
            </p>
          ) : null}
        </>
      ) : (
        <DataPending note="Agricultural-inflation history (FAO Food Price Index / World Bank / BLS) not yet sourced; the outlook band is the author's estimate — see SOURCES.md." />
      )}
    </ChartFrame>
  );
}
