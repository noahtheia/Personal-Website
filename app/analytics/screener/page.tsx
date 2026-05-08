import { getPricedFarmlandComps } from "@/lib/farmland-comps";
import { FarmlandScreener } from "@/components/FarmlandScreener";

export const metadata = {
  title: "Screener · Agriculture",
  description:
    "Multi-condition stock screener across the agriculture comp universe.",
};

export const revalidate = 3600;

export default async function ScreenerPage() {
  const comps = await getPricedFarmlandComps();
  const fetchedAt = comps[0]?.fetchedAt ?? new Date().toISOString();

  return (
    <div>
      <header className="border-b border-rule pb-4">
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          Screener · Agriculture
        </h1>
        <p className="mt-1 text-sm text-muted">
          Build a multi-condition filter (e.g. ROIC &ge; 15%, EV/EBITDA &le;
          10×, Cap Rate &ge; 5%) across the {comps.length}-ticker universe.
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

      <div className="mt-6">
        <FarmlandScreener rows={comps} />
      </div>
    </div>
  );
}
