import { getPricedFarmlandComps } from "@/lib/farmland-comps";
import { FarmlandCompare } from "@/components/FarmlandCompare";

export const metadata = {
  title: "Compare · Agriculture",
  description: "Side-by-side comparison of agriculture comps tickers.",
};

export const revalidate = 3600;

export default async function ComparePage() {
  const comps = await getPricedFarmlandComps();
  const fetchedAt = comps[0]?.fetchedAt ?? new Date().toISOString();

  return (
    <div>
      <header className="border-b border-rule pb-4">
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          Compare · Agriculture
        </h1>
        <p className="mt-1 text-sm text-muted">
          Side-by-side metric comparison across selected tickers. Best value in
          each row gets a positive tint; worst gets a negative tint (where the
          metric has a clear direction).
        </p>
        <p className="mt-2 text-[11px] uppercase tracking-wider text-muted">
          Last updated{" "}
          <time dateTime={fetchedAt}>
            {new Date(fetchedAt).toLocaleString("en-US", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </time>{" "}
          · {comps.length} tickers in universe
        </p>
      </header>

      <div className="mt-6">
        <FarmlandCompare rows={comps} />
      </div>
    </div>
  );
}
