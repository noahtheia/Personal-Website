// Tangible balance-sheet asset breakdown for the FMV Analysis tab.
// Surfaces all tangible asset classes the issuer carries — not just
// land — so users can see the full asset stack against market cap +
// EV. Pulls from the latest FY financials period (PP&E, inventory,
// intangibles, total assets) plus comps-row sector-block fields
// (biological assets, water rights, RMI) and the per-property detail
// when available (land at FMV).

import type { FarmlandFiling, PricedFarmlandComp } from "@/lib/farmland-comps";
import type { Financials } from "@/lib/farmland-financials";
import { totalFmvMM, type PropertyDetail } from "@/lib/farmland-properties";

type Stack = {
  label: string;
  bookMM: number | null;
  fmvMM?: number | null;
  note?: string;
};

export function FarmlandTangibleAssets({
  filing,
  priced,
  financials,
  detail,
}: {
  filing: FarmlandFiling;
  priced: PricedFarmlandComp | undefined;
  financials: Financials | null;
  detail: PropertyDetail | null;
}) {
  // Latest FY period (or LTM) for balance-sheet snapshots. Falls back
  // to latest period of any type when no FY exists.
  const latest = pickLatest(financials);
  if (!latest && !detail && !filing.bookLandMM) return null;

  const ccy = filing.currency;

  // Land book — prefer comps file's bookLandMM, fall back to detail's
  // aggregate book, fall back to financials propertyBookMM.
  const landBook =
    filing.bookLandMM ??
    (detail
      ? detail.properties.reduce((s, p) => s + (p.bookValueMM ?? 0), 0)
      : null) ??
    latest?.propertyBookMM ??
    null;
  const landFmv = detail ? totalFmvMM(detail) : filing.marketLandMM ?? null;

  // PP&E (preferred from filings; otherwise leave null — don't fake it
  // by subtracting from total assets, that mixes intangibles in).
  const ppeBook = latest?.ppeBookMM ?? null;

  // Biological assets — track standing crops / livestock at IAS 41 fair
  // value. Available on integrated-farm rows in the comps schema.
  const bioAssets = filing.integratedFarm?.biologicalAssetsMM ?? null;

  // Water rights — REIT cohort (LAND, RFF, MLP) carry separately.
  const waterRights = filing.reit?.waterRightsValueMM ?? null;

  // Inventory: prefer the financials latest-period figure; for commodity
  // traders the comps row may carry just the hedged RMI subset.
  const inventory =
    latest?.inventoryMM ?? filing.trader?.rmiMM ?? null;

  // Intangibles — surface so users can see the gap between total
  // assets and the tangible-only stack.
  const intangibles = latest?.intangibleAssetsMM ?? null;

  // Cash — already in comps (filing.cashMM); included for the bridge to
  // total assets.
  const cash = filing.cashMM;

  const totalAssets = latest?.totalAssetsMM ?? null;

  const stack: Stack[] = [];
  if (landBook != null || landFmv != null)
    stack.push({
      label: "Land / property",
      bookMM: landBook,
      fmvMM: landFmv,
      note: detail
        ? `Per-property breakdown below`
        : "Filing-level aggregate",
    });
  if (ppeBook != null)
    stack.push({
      label: "PP&E (mills, plants, machinery)",
      bookMM: ppeBook,
      note: "Net of accumulated depreciation",
    });
  if (bioAssets != null)
    stack.push({
      label: "Biological assets",
      bookMM: bioAssets,
      note: "IAS 41 fair value — standing crops / livestock",
    });
  if (inventory != null)
    stack.push({
      label: filing.trader?.rmiMM === inventory ? "Inventory (RMI)" : "Inventory",
      bookMM: inventory,
      note:
        filing.trader?.rmiMM === inventory
          ? "Readily-marketable hedged inventory"
          : undefined,
    });
  if (waterRights != null)
    stack.push({
      label: "Water rights",
      bookMM: waterRights,
      note: "Carried separately from land",
    });
  if (intangibles != null)
    stack.push({
      label: "Intangibles + goodwill",
      bookMM: intangibles,
      note: "Excluded from tangible total",
    });

  if (stack.length === 0) return null;

  const tangibleBook = stack
    .filter((s) => s.label !== "Intangibles + goodwill" && s.bookMM != null)
    .reduce((sum, s) => sum + (s.bookMM ?? 0), 0);
  const tangibleBookWithCash = tangibleBook + cash;
  const tangibleFmv = stack.reduce((sum, s) => {
    if (s.label === "Intangibles + goodwill") return sum;
    return sum + (s.fmvMM ?? s.bookMM ?? 0);
  }, 0);

  const marketCapLocal =
    priced && priced.localPrice != null
      ? priced.localPrice * filing.sharesOutMM
      : null;
  const evLocal =
    marketCapLocal !== null
      ? marketCapLocal + filing.debtMM - filing.cashMM
      : null;

  return (
    <section className="mt-8">
      <header className="mb-4">
        <h2 className="font-display text-lg font-semibold">
          Tangible Balance-Sheet Assets
        </h2>
        <p className="mt-1 text-sm text-muted">
          Asset-class composition from the latest FY filings, alongside
          market enterprise value for an asset-coverage view. Land at
          FMV when a per-property breakdown is available; other classes
          at filed book value.
        </p>
      </header>

      <div className="overflow-x-auto rounded-sm border border-rule bg-surface">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-rule-strong">
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted">
                Asset class
              </th>
              <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-muted">
                Book ({ccy} M)
              </th>
              <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-muted">
                FMV ({ccy} M)
              </th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted">
                Note
              </th>
            </tr>
          </thead>
          <tbody>
            {stack.map((s) => (
              <tr key={s.label} className="border-b border-rule">
                <td className="px-3 py-2 text-fg">{s.label}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {s.bookMM != null ? fmtInt(s.bookMM) : "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {s.fmvMM != null ? fmtInt(s.fmvMM) : "—"}
                </td>
                <td className="px-3 py-2 text-[11px] text-muted">
                  {s.note ?? ""}
                </td>
              </tr>
            ))}
            <tr className="border-b border-rule-strong bg-bg/40 font-semibold">
              <td className="px-3 py-2">Tangible total (ex-cash)</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {fmtInt(tangibleBook)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {tangibleFmv > 0 ? fmtInt(tangibleFmv) : "—"}
              </td>
              <td />
            </tr>
            <tr className="border-b border-rule">
              <td className="px-3 py-2 text-fg-soft">+ Cash &amp; equivalents</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {fmtInt(cash)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {fmtInt(cash)}
              </td>
              <td />
            </tr>
            <tr className="border-b border-rule font-semibold">
              <td className="px-3 py-2">Tangible total (incl. cash)</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {fmtInt(tangibleBookWithCash)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {tangibleFmv > 0 ? fmtInt(tangibleFmv + cash) : "—"}
              </td>
              <td />
            </tr>
            {totalAssets != null && (
              <tr className="border-b border-rule text-fg-soft">
                <td className="px-3 py-2">Reported total assets (BS)</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {fmtInt(totalAssets)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">—</td>
                <td className="px-3 py-2 text-[11px] text-muted">
                  Latest period {latest?.endDate}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Card
          label="Tangible book"
          value={`${ccy} ${fmtInt(tangibleBookWithCash)}M`}
          sub={
            totalAssets
              ? `${((tangibleBookWithCash / totalAssets) * 100).toFixed(0)}% of total assets`
              : undefined
          }
        />
        {marketCapLocal !== null && (
          <Card
            label="Market cap"
            value={`${ccy} ${fmtInt(marketCapLocal)}M`}
            sub={
              tangibleBookWithCash > 0
                ? `${((marketCapLocal / tangibleBookWithCash) * 100).toFixed(0)}% of tangible book`
                : undefined
            }
          />
        )}
        {evLocal !== null && (
          <Card
            label="Enterprise value"
            value={`${ccy} ${fmtInt(evLocal)}M`}
            sub={
              tangibleBookWithCash > 0
                ? `${((evLocal / tangibleBookWithCash) * 100).toFixed(0)}% of tangible book`
                : undefined
            }
          />
        )}
      </div>
    </section>
  );
}

function pickLatest(financials: Financials | null) {
  if (!financials || financials.periods.length === 0) return null;
  const fy = [...financials.periods]
    .filter((p) => p.periodType === "FY" || p.periodType === "LTM")
    .sort((a, b) => b.endDate.localeCompare(a.endDate));
  if (fy.length > 0) return fy[0];
  return [...financials.periods].sort((a, b) =>
    b.endDate.localeCompare(a.endDate),
  )[0];
}

function fmtInt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

function Card({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-sm border border-rule bg-surface p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 font-display text-lg font-semibold tabular-nums">
        {value}
      </p>
      {sub && <p className="mt-1 text-[11px] text-muted">{sub}</p>}
    </div>
  );
}
