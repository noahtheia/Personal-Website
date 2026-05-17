"use client";

// Input-supplier concentration (top firms' share of global commercial seed
// sales) vs. the fragmented demand side (~608M farms). Horizontal bars + a
// callout; an optional concentration time series if present. Degrades to
// "data pending" until seed-chem-concentration.json is populated.

import { ChartFrame, DataPending, LineChart } from "@/components/charts/ChartShell";
import { getSeedChemConcentration } from "@/lib/article-agriculture";
import { SERIES_COLORS, formatPct } from "@/lib/chart-helpers";

export function SeedChemConcentration() {
  const data = getSeedChemConcentration();
  const ready = data.topFirms.length > 0;
  const top3 = data.topFirms.slice(0, 3).reduce((s, f) => s + f.sharePct, 0);
  const maxShare = Math.max(1, ...data.topFirms.map((f) => f.sharePct));

  return (
    <ChartFrame
      title="A consolidated supply chain feeding a fragmented field"
      subtitle="Share of global commercial seed sales"
      source={data.source}
      sourceUrl={data.sourceUrl}
      retrievedAt={data.retrievedAt}
    >
      {ready ? (
        <div className="space-y-5">
          <div className="space-y-1.5">
            {data.topFirms.map((f) => (
              <div key={f.firm} className="flex items-center gap-3 text-xs">
                <div className="w-28 shrink-0 text-fg-soft">{f.firm}</div>
                <div className="h-3.5 flex-1 rounded-sm bg-[var(--bg)]">
                  <div
                    className="h-full rounded-sm"
                    style={{
                      width: `${(f.sharePct / maxShare) * 100}%`,
                      backgroundColor: "var(--accent)",
                    }}
                  />
                </div>
                <div className="w-12 shrink-0 text-right tabular-nums text-fg-soft">
                  {formatPct(f.sharePct / 100, 0)}
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-x-8 gap-y-2 border-t border-rule pt-3 text-xs">
            <div>
              <div className="font-display text-lg font-semibold text-fg tabular-nums">
                {formatPct(top3 / 100, 0)}
              </div>
              <div className="text-muted">top 3 firms&rsquo; share of commercial seed sales</div>
            </div>
            {data.globalFarmCountMillions != null ? (
              <div>
                <div className="font-display text-lg font-semibold text-fg tabular-nums">
                  ~{data.globalFarmCountMillions}M
                </div>
                <div className="text-muted">farms worldwide on the other side</div>
              </div>
            ) : null}
          </div>

          {data.concentrationSeries.length >= 2 ? (
            <LineChart
              series={[
                {
                  key: "Top-3 share",
                  color: SERIES_COLORS[0],
                  points: data.concentrationSeries.map((p) => ({ year: p.year, value: p.top3SharePct })),
                },
              ]}
              formatValue={(v) => formatPct(v / 100, 0)}
              formatTick={(v) => `${v.toFixed(0)}%`}
              includeZero
              ariaLabel="Top-3 seed-firm share over time"
            />
          ) : null}
        </div>
      ) : (
        <DataPending note="Concentration figures (ETC Group / academic literature) and global farm count (FAO) not yet sourced — see SOURCES.md." />
      )}
    </ChartFrame>
  );
}
