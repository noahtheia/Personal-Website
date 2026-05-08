import { getPricedFarmlandComps } from "@/lib/farmland-comps";
import { FarmlandMultiplesHistory } from "@/components/FarmlandMultiplesHistory";
import { FarmlandSectorIndex } from "@/components/FarmlandSectorIndex";
import { FarmlandSectorRankings } from "@/components/FarmlandSectorRankings";
import { getUniverseMultiples } from "@/lib/farmland-multiples-history";

export const metadata = {
  title: "Trends · Agriculture",
  description:
    "Universe-level multiples / margin history and sector-level synthetic indices across the 135-ticker public agriculture comp universe.",
};

export const revalidate = 3600;

export default async function AgricultureTrendsPage() {
  const [comps, multiplesFY, multiplesQ] = await Promise.all([
    getPricedFarmlandComps(),
    getUniverseMultiples("FY"),
    getUniverseMultiples("Q"),
  ]);
  const fetchedAt = comps[0]?.fetchedAt ?? new Date().toISOString();

  return (
    <div>
      <header className="border-b border-rule pb-4">
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          Trends · Agriculture
        </h1>
        <p className="mt-1 text-sm text-muted">
          Multiples and margin history across the universe (median + IQR
          fan, with optional sector exclusions and quarterly cadence), plus
          sector-level synthetic indices.
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

      <FarmlandMultiplesHistory fy={multiplesFY} q={multiplesQ} />

      <FarmlandSectorIndex rows={comps} />

      <FarmlandSectorRankings rows={comps} />
    </div>
  );
}
