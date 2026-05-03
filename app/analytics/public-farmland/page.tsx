import { FARMLAND_COMPS, FARMLAND_SERIES } from "@/lib/farmland";
import { FarmlandComps } from "@/components/FarmlandComps";
import { FarmlandChart } from "@/components/FarmlandChart";

export const metadata = {
  title: "Public farmland",
  description:
    "Public US farmland REIT comps and a long-run view of USDA NASS land values and cash rents.",
};

export default function PublicFarmlandPage() {
  return (
    <div>
      <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
        Public farmland
      </h1>
      <p className="mt-4 max-w-[36rem] font-sans text-base leading-relaxed text-fg-soft">
        The two pure-play US farmland REITs side by side, plus a long-run view
        of underlying USDA land values and cash rents. Sort the comps table or
        switch series on the chart to compare.
      </p>

      <section className="mt-10">
        <h2 className="font-display text-xl font-semibold tracking-tight">
          Pure-play comps
        </h2>
        <FarmlandComps comps={FARMLAND_COMPS} />
      </section>

      <section className="mt-12">
        <h2 className="font-display text-xl font-semibold tracking-tight">
          USDA land &amp; rent series
        </h2>
        <FarmlandChart series={FARMLAND_SERIES} />
      </section>

      <p className="mt-10 font-sans text-xs leading-relaxed text-muted">
        Comp figures are rounded snapshots from the latest 10-Ks and investor
        materials and are not live quotes. Series values are sourced from the
        USDA NASS Land Values and Cash Rents annual summaries. Nothing here is
        investment advice.
      </p>
    </div>
  );
}
