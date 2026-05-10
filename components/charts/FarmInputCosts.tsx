"use client";

// Farm production expenses / input-cost index over time, with a CAGR table
// contrasting the post-COVID run-rate (~6.4%/yr) against the long-run average
// (~3–4%/yr). Degrades to "data pending" until farm-input-costs.json is populated.

import { ChartFrame, DataPending, LineChart } from "@/components/charts/ChartShell";
import { getFarmInputCosts } from "@/lib/article-agriculture";
import { SERIES_COLORS, formatCompact, formatPctSigned } from "@/lib/chart-helpers";

export function FarmInputCosts() {
  const data = getFarmInputCosts();
  const ready = data.series.length >= 2;

  return (
    <ChartFrame
      title="Farm input costs over time"
      subtitle={data.unit}
      source={data.source}
      sourceUrl={data.sourceUrl}
      retrievedAt={data.retrievedAt}
    >
      {ready ? (
        <>
          <LineChart
            series={[{ key: "Input-cost index", color: SERIES_COLORS[0], points: data.series }]}
            formatValue={formatCompact}
            formatTick={formatCompact}
            includeZero
            ariaLabel="Farm input cost index over time"
          />
          {data.cagrPeriods.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-xs tabular-nums">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted">
                    <th className="px-1.5 py-1 font-medium">Period</th>
                    <th className="px-1.5 py-1 text-right font-medium">Years</th>
                    <th className="px-1.5 py-1 text-right font-medium">CAGR</th>
                  </tr>
                </thead>
                <tbody className="text-fg-soft">
                  {data.cagrPeriods.map((p) => (
                    <tr key={p.label} className="border-t border-rule">
                      <td className="px-1.5 py-1">{p.label}</td>
                      <td className="px-1.5 py-1 text-right text-muted">
                        {p.fromYear}–{p.toYear}
                      </td>
                      <td className="px-1.5 py-1 text-right">{formatPctSigned(p.cagr, 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      ) : (
        <DataPending note="Farm-expense / input-cost series (USDA ERS / BLS PPI) not yet sourced — see SOURCES.md." />
      )}
    </ChartFrame>
  );
}
