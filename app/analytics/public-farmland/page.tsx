import { FARMLAND_SERIES } from "@/lib/farmland";
import { getPricedFarmlandComps } from "@/lib/farmland-comps";
import { FarmlandComps } from "@/components/FarmlandComps";
import { FarmlandChart } from "@/components/FarmlandChart";

export const metadata = {
  title: "Public farmland",
  description:
    "Public US farmland REIT comps with live-price multiples and a long-run view of USDA NASS land values and cash rents.",
};

// Page rebuilds hourly; live-price fetch is itself cached for an hour.
// Comfortably exceeds the at-least-daily refresh requirement.
export const revalidate = 3600;

export default async function PublicFarmlandPage() {
  const comps = await getPricedFarmlandComps();
  const fetchedAt = comps[0]?.fetchedAt ?? new Date().toISOString();

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
        Public farmland
      </h1>
      <p className="mt-4 max-w-[36rem] font-sans text-base leading-relaxed text-fg-soft">
        The two pure-play US farmland REITs side by side, plus a long-run view
        of underlying USDA land values and cash rents. Filing inputs are
        static; price is live and drives market cap, EV, and every multiple
        in the comps table.
      </p>

      <section className="mt-10">
        <h2 className="font-display text-xl font-semibold tracking-tight">
          Pure-play comps
        </h2>
        <FarmlandComps rows={comps} />
        <p className="mt-3 font-sans text-xs text-muted">
          Last refreshed{" "}
          <time dateTime={fetchedAt}>
            {new Date(fetchedAt).toLocaleString("en-US", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </time>
          . Quotes sourced from public Yahoo Finance endpoints, may be delayed
          up to an hour.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-xl font-semibold tracking-tight">
          USDA land &amp; rent series
        </h2>
        <FarmlandChart series={FARMLAND_SERIES} />
      </section>

      <p className="mt-10 font-sans text-xs leading-relaxed text-muted">
        Filing inputs (shares outstanding, debt, cash, acres, NAV, annual NOI,
        annual dividend) are pulled from each issuer&apos;s most recent 10-K
        and stored in <code>content/farmland-comps.json</code>. Update that
        file when a new annual report drops. Series figures are sourced from
        the USDA NASS Land Values and Cash Rents annual summaries. Nothing
        here is investment advice.
      </p>
    </div>
  );
}
