"use client";

// Representative Midwest corn farm: per-acre P&L (cost stack, revenue, and the
// owner-vs-renter margin) plus a cap-rate comparison strip. Rendered as tables
// (wrapped in `not-prose`) rather than SVG. Degrades to "data pending" until
// corn-farm-economics.json is populated.

import { ChartFrame, DataPending } from "@/components/charts/ChartShell";
import { getCornFarmEconomics } from "@/lib/article-agriculture";
import { formatPct, formatUsd } from "@/lib/chart-helpers";

export function CornFarmEconomics() {
  const data = getCornFarmEconomics();
  const { perAcre } = data;
  const ready = perAcre.revenueUsd != null && perAcre.costLines.length > 0;
  const totalCost = perAcre.costLines.reduce((s, l) => s + l.usdPerAcre, 0);

  return (
    <ChartFrame
      title="Representative Midwest corn farm — per-acre economics"
      subtitle={
        data.cornPriceUsdPerBu != null ? `at $${data.cornPriceUsdPerBu.toFixed(2)}/bu corn` : undefined
      }
      source={data.source}
      sourceUrl={data.sourceUrl}
      retrievedAt={data.retrievedAt}
    >
      {ready ? (
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <table className="w-full text-xs tabular-nums">
              <caption className="mb-1 text-left text-[11px] uppercase tracking-wider text-muted">
                Per acre
              </caption>
              <tbody className="text-fg-soft">
                <tr className="border-t border-rule">
                  <td className="px-1.5 py-1">Revenue</td>
                  <td className="px-1.5 py-1 text-right">{formatUsd(perAcre.revenueUsd ?? 0)}</td>
                </tr>
                {perAcre.costLines.map((l) => (
                  <tr key={l.label} className="border-t border-rule">
                    <td className="px-1.5 py-1 text-muted">— {l.label}</td>
                    <td className="px-1.5 py-1 text-right text-muted">({formatUsd(l.usdPerAcre)})</td>
                  </tr>
                ))}
                <tr className="border-t border-rule-strong font-medium">
                  <td className="px-1.5 py-1">Total cost</td>
                  <td className="px-1.5 py-1 text-right">({formatUsd(totalCost)})</td>
                </tr>
                <tr className="border-t border-rule-strong font-semibold text-fg">
                  <td className="px-1.5 py-1">Owner margin</td>
                  <td className="px-1.5 py-1 text-right">{formatPct(perAcre.ownerMarginPct ?? NaN)}</td>
                </tr>
                {perAcre.renterMarginPct != null ? (
                  <tr className="font-semibold text-fg">
                    <td className="px-1.5 py-1">Cash-renter margin</td>
                    <td className="px-1.5 py-1 text-right">{formatPct(perAcre.renterMarginPct)}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {data.capRates.length > 0 ? (
            <div>
              <table className="w-full text-xs tabular-nums">
                <caption className="mb-1 text-left text-[11px] uppercase tracking-wider text-muted">
                  Yield comparison
                </caption>
                <tbody className="text-fg-soft">
                  {data.capRates.map((r) => (
                    <tr key={r.label} className="border-t border-rule">
                      <td className="px-1.5 py-1">
                        {r.label}
                        {r.note ? <span className="ml-1 text-muted">({r.note})</span> : null}
                      </td>
                      <td className="px-1.5 py-1 text-right">{formatPct(r.pct, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : (
        <DataPending note="Corn-farm budget (USDA ERS / U. of Illinois farmdoc) and farmland cap rates (NCREIF) not yet sourced — see SOURCES.md." />
      )}
    </ChartFrame>
  );
}
