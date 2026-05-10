"use client";

// Global cropland by region, 1700–2026, as a multi-line chart with a per-decade
// CAGR table for the global total. Region taxonomy and stacked-vs-line styling
// are still open (see SOURCES.md / the plan); this renders the line form and
// degrades to "data pending" until cropland-by-region.json is populated.

import { useMemo } from "react";
import { ChartFrame, DataPending, LineChart, type LineSeries } from "@/components/charts/ChartShell";
import { getCroplandByRegion } from "@/lib/article-agriculture";
import {
  SERIES_COLORS,
  formatCompact,
  formatPctSigned,
  perDecadeCagr,
} from "@/lib/chart-helpers";

export function CroplandByRegion({ showDecadeCagr = true }: { showDecadeCagr?: boolean }) {
  const data = getCroplandByRegion();

  const built = useMemo(() => {
    if (data.series.length < 2) return null;
    const regions =
      data.regions.length > 0
        ? data.regions
        : Array.from(
            new Set(data.series.flatMap((r) => Object.keys(r.byRegion))),
          );
    const regionSeries: LineSeries[] = regions.map((region, i) => ({
      key: region,
      color: SERIES_COLORS[(i + 1) % SERIES_COLORS.length],
      points: data.series
        .filter((r) => typeof r.byRegion[region] === "number")
        .map((r) => ({ year: r.year, value: r.byRegion[region] })),
    }));
    const totalPoints = data.series.map((r) => ({
      year: r.year,
      value: regions.reduce((s, region) => s + (r.byRegion[region] ?? 0), 0),
    }));
    const total: LineSeries = { key: "Global total", color: SERIES_COLORS[0], points: totalPoints };
    const decades = perDecadeCagr(totalPoints);
    return { series: [total, ...regionSeries], decades };
  }, [data]);

  return (
    <ChartFrame
      title="Global cropland by region, 1700–2026"
      subtitle={data.unit}
      source={data.source}
      retrievedAt={data.retrievedAt}
    >
      {built ? (
        <>
          <LineChart
            series={built.series}
            formatValue={(v) => `${formatCompact(v)} ${data.unit}`}
            formatTick={formatCompact}
            includeZero
            ariaLabel="Global cropland by region over time"
          />
          {showDecadeCagr && built.decades.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-xs tabular-nums">
                <caption className="mb-1 text-left text-[11px] uppercase tracking-wider text-muted">
                  Global total — CAGR by decade
                </caption>
                <tbody>
                  <tr className="text-muted">
                    {built.decades.map((d) => (
                      <th key={`d-${d.decadeStartYear}`} className="px-1.5 py-1 text-right font-medium">
                        {d.decadeStartYear}s
                      </th>
                    ))}
                  </tr>
                  <tr className="text-fg-soft">
                    {built.decades.map((d) => (
                      <td key={`v-${d.decadeStartYear}`} className="px-1.5 py-1 text-right">
                        {formatPctSigned(d.cagr, 2)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      ) : (
        <DataPending note="Cropland-by-region series (HYDE 3.2 / Our World in Data) not yet sourced — see SOURCES.md." />
      )}
    </ChartFrame>
  );
}
