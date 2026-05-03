import { FARMLAND_SERIES } from "@/lib/farmland";
import { getPricedFarmlandComps } from "@/lib/farmland-comps";
import { FarmlandComps } from "@/components/FarmlandComps";
import { FarmlandChart } from "@/components/FarmlandChart";

export const metadata = {
  title: "Public farmland",
  description:
    "Public US farmland REIT comps with live-price multiples, plus USDA NASS land values and cash rents.",
};

export const revalidate = 3600;

export default async function PublicFarmlandPage() {
  const comps = await getPricedFarmlandComps();
  const fetchedAt = comps[0]?.fetchedAt ?? new Date().toISOString();

  return (
    <div>
      <header className="border-b border-rule pb-4">
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          Public Farmland Comps
        </h1>
        <p className="mt-1 text-sm text-muted">
          ($ in millions except per-share and per-acre)
        </p>
      </header>

      <FarmlandComps rows={comps} />

      <p className="mt-3 text-xs text-muted">
        Updated{" "}
        <time dateTime={fetchedAt}>
          {new Date(fetchedAt).toLocaleString("en-US", {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </time>
        . Source: SEC filings (10-K) for filing inputs; Yahoo Finance for live
        price and 1y history. Multiples derive from price × shares
        (market cap), market cap + debt − cash (EV), NOI ÷ EV (cap rate),
        and price ÷ NAV.
      </p>

      <section className="mt-12 border-t border-rule pt-8">
        <h2 className="font-display text-xl font-semibold tracking-tight">
          USDA land &amp; rent series
        </h2>
        <p className="mt-1 text-sm text-muted">
          Long-run national averages from the USDA NASS Land Values and Cash
          Rents annual summaries.
        </p>
        <FarmlandChart series={FARMLAND_SERIES} />
      </section>

      <p className="mt-10 text-[11px] leading-relaxed text-muted">
        Filing inputs (shares outstanding, debt, cash, acres, NAV, annual NOI,
        annual dividend) live in <code>content/farmland-comps.json</code>;
        update the file when a new annual report drops. Nothing here is
        investment advice.
      </p>
    </div>
  );
}
