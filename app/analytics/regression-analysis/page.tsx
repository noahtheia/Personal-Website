import { getPricedFarmlandComps } from "@/lib/farmland-comps";
import { FarmlandScatter } from "@/components/FarmlandScatter";

export const metadata = {
  title: "Regression analysis · Agriculture",
  description:
    "Two-axis scatter regression across the 135-ticker public agriculture comp universe.",
};

export const revalidate = 3600;

export default async function RegressionAnalysisPage() {
  const comps = await getPricedFarmlandComps();
  const fetchedAt = comps[0]?.fetchedAt ?? new Date().toISOString();

  return (
    <div>
      <header className="border-b border-rule pb-4">
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          Regression Analysis · Agriculture
        </h1>
        <p className="mt-1 text-sm text-muted">
          Pick any X / Y pair from market, operating, valuation, and land
          metrics. Each ticker plots as a sector-colored dot; hover to surface
          the company name.
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

      <FarmlandScatter rows={comps} />
    </div>
  );
}
