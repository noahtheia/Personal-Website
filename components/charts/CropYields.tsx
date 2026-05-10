"use client";

// Global crop yields over time (t/ha), multi-line by crop, with a CAGR readout
// strip (full-period and trailing-decade). Degrades to "data pending" until
// crop-yields.json is populated.

import { useMemo } from "react";
import { ChartFrame, DataPending, LineChart, type LineSeries } from "@/components/charts/ChartShell";
import { getCropYields } from "@/lib/article-agriculture";
import { SERIES_COLORS, cagr, formatPctSigned } from "@/lib/chart-helpers";

function trailingDecadeCagr(points: { year: number; value: number }[]): number {
  if (points.length < 2) return NaN;
  const sorted = [...points].sort((a, b) => a.year - b.year);
  const last = sorted[sorted.length - 1];
  const start = [...sorted].reverse().find((p) => p.year <= last.year - 10) ?? sorted[0];
  return cagr(start.value, last.value, last.year - start.year);
}

function fullPeriodCagr(points: { year: number; value: number }[]): number {
  if (points.length < 2) return NaN;
  const sorted = [...points].sort((a, b) => a.year - b.year);
  const a = sorted[0];
  const b = sorted[sorted.length - 1];
  return cagr(a.value, b.value, b.year - a.year);
}

export function CropYields({ showCagr = true }: { showCagr?: boolean }) {
  const data = getCropYields();

  const built = useMemo(() => {
    const usable = data.series.filter((s) => s.points.length >= 2);
    if (usable.length === 0) return null;
    const series: LineSeries[] = usable.map((s, i) => ({
      key: s.crop,
      color: SERIES_COLORS[i % SERIES_COLORS.length],
      points: s.points,
    }));
    const cagrs = usable.map((s) => ({
      crop: s.crop,
      full: fullPeriodCagr(s.points),
      decade: trailingDecadeCagr(s.points),
    }));
    return { series, cagrs };
  }, [data]);

  return (
    <ChartFrame
      title="Global crop yields over time"
      subtitle={data.unit}
      source={data.source}
      retrievedAt={data.retrievedAt}
    >
      {built ? (
        <>
          <LineChart
            series={built.series}
            formatValue={(v) => `${v.toFixed(2)} ${data.unit}`}
            formatTick={(v) => v.toFixed(1)}
            ariaLabel="Global crop yields over time"
          />
          {showCagr ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-xs tabular-nums">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted">
                    <th className="px-1.5 py-1 font-medium">Crop</th>
                    <th className="px-1.5 py-1 text-right font-medium">CAGR (full period)</th>
                    <th className="px-1.5 py-1 text-right font-medium">CAGR (last decade)</th>
                  </tr>
                </thead>
                <tbody className="text-fg-soft">
                  {built.cagrs.map((c) => (
                    <tr key={c.crop} className="border-t border-rule">
                      <td className="px-1.5 py-1">{c.crop}</td>
                      <td className="px-1.5 py-1 text-right">{formatPctSigned(c.full, 2)}</td>
                      <td className="px-1.5 py-1 text-right">{formatPctSigned(c.decade, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      ) : (
        <DataPending note="Crop-yield series (FAOSTAT / USDA) not yet sourced — see SOURCES.md." />
      )}
    </ChartFrame>
  );
}
