import {
  getPricedFarmlandComps,
  type PricedFarmlandComp,
} from "@/lib/farmland-comps";
import { FarmlandComps } from "@/components/FarmlandComps";
import { FarmlandLeaderboards } from "@/components/FarmlandLeaderboards";
import { FarmlandMultiplesHistory } from "@/components/FarmlandMultiplesHistory";
import { FarmlandSectorIndex } from "@/components/FarmlandSectorIndex";
import { getUniverseMultiples } from "@/lib/farmland-multiples-history";

function fxNote(rows: PricedFarmlandComp[]): string {
  const seen = new Map<string, number>();
  for (const r of rows) {
    if (r.currency !== "USD" && r.fxToUsd > 0) seen.set(r.currency, r.fxToUsd);
  }
  if (seen.size === 0) return "";
  const parts = Array.from(seen.entries()).map(
    ([c, fx]) => `1 ${c} = $${fx.toFixed(4)}`,
  );
  return ` (FX: ${parts.join(", ")})`;
}

export const metadata = {
  title: "Agriculture comps",
  description:
    "Public US farmland REIT comps with live-price multiples.",
};

export const revalidate = 3600;

export default async function PublicFarmlandPage() {
  const comps = await getPricedFarmlandComps();
  const fetchedAt = comps[0]?.fetchedAt ?? new Date().toISOString();
  const multiplesHistory = getUniverseMultiples();

  return (
    <div>
      <header className="border-b border-rule pb-4">
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          Agriculture Comps
        </h1>
        <p className="mt-1 text-sm text-muted">
          (USD millions except per-share and per-acre · non-USD listings
          translated to USD at live FX)
        </p>
        <p className="mt-2 text-[11px] uppercase tracking-wider text-muted">
          Last updated{" "}
          <time dateTime={fetchedAt}>
            {new Date(fetchedAt).toLocaleString("en-US", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </time>{" "}
          · {comps.length} tickers
        </p>
      </header>

      <FarmlandComps rows={comps} />

      <FarmlandLeaderboards rows={comps} />

      <FarmlandMultiplesHistory series={multiplesHistory} />

      <FarmlandSectorIndex rows={comps} />

      <p className="mt-3 text-xs text-muted">
        Updated{" "}
        <time dateTime={fetchedAt}>
          {new Date(fetchedAt).toLocaleString("en-US", {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </time>
        . Source: issuer 10-K / 20-F / annual report filings for filing
        inputs; Yahoo Finance for live price and FX. Filing values are
        captured in each issuer&apos;s reporting currency
        {fxNote(comps)}; market cap, EV, and absolute-$ multiples are
        translated to USD at live FX, while ratios (P/NAV, EV/EBITDA,
        cap rate, yield) are computed in local currency to avoid FX
        distortion.
      </p>

      <p className="mt-10 text-[11px] leading-relaxed text-muted">
        Filing inputs (shares outstanding, debt, cash, acres, NAV, annual NOI,
        annual dividend) live in <code>content/farmland-comps.json</code>;
        update the file when a new annual report drops. Nothing here is
        investment advice.
      </p>
    </div>
  );
}
