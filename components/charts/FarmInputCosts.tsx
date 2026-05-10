"use client";

// Farm input prices over time (fertilizer, diesel, pesticides/ag chemicals),
// re-based to a recent year = 100, with a CAGR table contrasting the pre-COVID
// trend against the post-COVID surge. Degrades to "data pending" until
// farm-input-costs.json is populated.

import { useMemo } from "react";
import { ChartFrame, DataPending, LineChart, type LineSeries } from "@/components/charts/ChartShell";
import { getFarmInputCosts } from "@/lib/article-agriculture";
import { SERIES_COLORS, formatCompact, formatPctSigned } from "@/lib/chart-helpers";

export function FarmInputCosts({ showCagr = true }: { showCagr?: boolean }) {
  const data = getFarmInputCosts();

  const built = useMemo(() => {
    const usable = data.series.filter((s) => s.points.length >= 2);
    if (usable.length === 0) return null;
    const series: LineSeries[] = usable.map((s, i) => ({
      key: s.name,
      color: SERIES_COLORS[i % SERIES_COLORS.length],
      points: s.points,
    }));
    return { series };
  }, [data]);

  const baseLabel = data.baseYear != null ? `${data.baseYear} = 100` : undefined;

  return (
    <ChartFrame
      title={data.title}
      subtitle={data.unit}
      source={data.source}
      sourceUrl={data.sourceUrl}
      retrievedAt={data.retrievedAt}
    >
      {built ? (
        <>
          <LineChart
            series={built.series}
            markers={
              data.baseYear != null
                ? [{ value: 100, label: baseLabel ?? "base = 100", color: "var(--muted)" }]
                : []
            }
            formatValue={formatCompact}
            formatTick={formatCompact}
            includeZero
            ariaLabel="Farm input prices over time"
          />
          {showCagr && data.cagrPeriods.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-xs tabular-nums">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted">
                    <th className="px-1.5 py-1 font-medium">Input</th>
                    <th className="px-1.5 py-1 font-medium">Period</th>
                    <th className="px-1.5 py-1 text-right font-medium">CAGR</th>
                  </tr>
                </thead>
                <tbody className="text-fg-soft">
                  {data.cagrPeriods.map((p, i) => (
                    <tr key={`${p.series}-${p.fromYear}-${p.toYear}`} className="border-t border-rule">
                      <td className="px-1.5 py-1">
                        {i > 0 && data.cagrPeriods[i - 1].series === p.series ? "" : p.series}
                      </td>
                      <td className="px-1.5 py-1 text-muted">{p.label}</td>
                      <td className="px-1.5 py-1 text-right">{formatPctSigned(p.cagr, 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      ) : (
        <DataPending note="Farm input-price series (BLS PPI via FRED) not yet sourced — see SOURCES.md." />
      )}
    </ChartFrame>
  );
}
