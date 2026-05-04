import {
  fmvAggregate,
  type Comparable,
  type FMVAssumption,
  type Property,
  type PropertyDetail,
} from "@/lib/farmland-properties";
import type {
  FarmlandFiling,
  PricedFarmlandComp,
} from "@/lib/farmland-comps";

export function FarmlandPropertyDetail({
  filing,
  priced,
  detail,
}: {
  filing: FarmlandFiling;
  priced: PricedFarmlandComp | undefined;
  detail: PropertyDetail;
}) {
  const ccy = detail.currency ?? filing.currency;
  const agg = fmvAggregate(detail);
  // agg.totalFmv = acres × $/acre = dollars; convert to $M.
  const totalFmvMM = agg.totalFmv / 1_000_000;
  const bookMM = filing.bookLandMM;
  const fmvVsBookPct =
    bookMM > 0 ? ((totalFmvMM - bookMM) / bookMM) * 100 : null;

  // Implied per-share NAV at FMV (uses filing-currency totals)
  const navAtFmv =
    bookMM > 0 && totalFmvMM > 0
      ? totalFmvMM - (filing.debtMM - filing.cashMM)
      : null;
  const navPerShareAtFmv =
    navAtFmv !== null && filing.sharesOutMM > 0
      ? navAtFmv / filing.sharesOutMM
      : null;

  return (
    <div className="space-y-12">
      <section className="mt-8">
        <SectionHeader
          title="Implied fair market analysis"
          subtitle={`As of ${detail.asOf}`}
        />
        <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="rounded-sm border border-rule bg-surface p-5">
            <div className="text-[10px] uppercase tracking-wider text-muted">
              Aggregate FMV
            </div>
            <div className="mt-1 font-display text-3xl font-semibold tabular-nums">
              {ccy} {fmtInt(totalFmvMM)}M
            </div>
            <div className="mt-2 text-xs text-muted">
              {fmtInt(agg.totalAcres)} acres ×{" "}
              {fmtInt(agg.weightedPerAcre)} {ccy}/acre weighted
            </div>
          </div>
          <div className="rounded-sm border border-rule bg-surface p-5">
            <div className="text-[10px] uppercase tracking-wider text-muted">
              FMV vs. book
            </div>
            <div
              className={`mt-1 font-display text-3xl font-semibold tabular-nums ${
                fmvVsBookPct === null
                  ? ""
                  : fmvVsBookPct >= 0
                  ? "text-[var(--positive)]"
                  : "text-[var(--negative)]"
              }`}
            >
              {fmvVsBookPct === null
                ? "—"
                : `${fmvVsBookPct >= 0 ? "+" : ""}${fmvVsBookPct.toFixed(1)}%`}
            </div>
            <div className="mt-2 text-xs text-muted">
              Book {ccy} {fmtInt(bookMM)}M · FMV {ccy} {fmtInt(totalFmvMM)}M
            </div>
          </div>
          <div className="rounded-sm border border-rule bg-surface p-5">
            <div className="text-[10px] uppercase tracking-wider text-muted">
              Implied NAV / share
            </div>
            <div className="mt-1 font-display text-3xl font-semibold tabular-nums">
              {navPerShareAtFmv === null
                ? "—"
                : `${ccy} ${navPerShareAtFmv.toFixed(2)}`}
            </div>
            <div className="mt-2 text-xs text-muted">
              FMV − net debt ÷ {fmtInt(filing.sharesOutMM)}M shares
            </div>
          </div>
          <div className="rounded-sm border border-rule bg-surface p-5">
            <div className="text-[10px] uppercase tracking-wider text-muted">
              Live price (USD) vs. FMV NAV
            </div>
            <div className="mt-1 font-display text-3xl font-semibold tabular-nums">
              {priced?.price && navPerShareAtFmv
                ? renderFmvDiscount(
                    priced.localPrice ?? null,
                    navPerShareAtFmv,
                  )
                : "—"}
            </div>
            <div className="mt-2 text-xs text-muted">
              Local price ÷ implied NAV
            </div>
          </div>
        </div>

        {detail.fmvAssumptions.length > 0 && (
          <FmvBreakdownTable assumptions={detail.fmvAssumptions} ccy={ccy} />
        )}

        <div className="mt-6 rounded-sm border border-rule bg-bg p-5">
          <div className="text-[10px] uppercase tracking-wider text-muted">
            Methodology
          </div>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-fg-soft">
            {detail.methodology}
          </p>
        </div>
      </section>

      <section>
        <SectionHeader
          title="Properties"
          subtitle={detail.propertiesNote ?? `${detail.properties.length} properties`}
        />
        <PropertiesTable properties={detail.properties} ccy={ccy} />
      </section>

      <section>
        <SectionHeader
          title="Comparable land transactions"
          subtitle={`${detail.comparables.length} reference points`}
        />
        <ComparablesTable comparables={detail.comparables} />
      </section>
    </div>
  );
}

function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-baseline justify-between border-b border-rule pb-2">
      <h2 className="font-display text-xl font-semibold tracking-tight">
        {title}
      </h2>
      <span className="text-xs text-muted">{subtitle}</span>
    </div>
  );
}

function FmvBreakdownTable({
  assumptions,
  ccy,
}: {
  assumptions: FMVAssumption[];
  ccy: string;
}) {
  const totalAcres = assumptions.reduce((s, a) => s + a.acres, 0);
  // acres × $/acre → dollars; / 1,000,000 → $M.
  const totalFmv = assumptions.reduce(
    (s, a) => s + (a.acres * a.assumedPricePerAcre) / 1_000_000,
    0,
  );
  return (
    <div className="mt-6 overflow-x-auto rounded-sm border border-rule bg-surface">
      <table className="w-full border-collapse font-sans text-xs tabular-nums">
        <thead>
          <tr className="border-b border-rule-strong text-left">
            <Th>Category</Th>
            <Th align="right">Acres</Th>
            <Th align="right">Assumed {ccy}/acre</Th>
            <Th align="right">FMV ({ccy} M)</Th>
            <Th align="right">Mix %</Th>
          </tr>
        </thead>
        <tbody>
          {assumptions.map((a) => {
            const fmvMM = (a.acres * a.assumedPricePerAcre) / 1_000_000;
            return (
              <tr key={a.category} className="border-b border-rule">
                <td className="px-3 py-2 align-top text-fg">
                  <div className="font-medium">{a.category}</div>
                  {a.rationale && (
                    <div className="mt-0.5 text-[11px] text-muted">
                      {a.rationale}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 text-right">{fmtInt(a.acres)}</td>
                <td className="px-3 py-2 text-right">
                  {fmtInt(a.assumedPricePerAcre)}
                </td>
                <td className="px-3 py-2 text-right">{fmtInt(fmvMM)}</td>
                <td className="px-3 py-2 text-right text-muted">
                  {totalAcres > 0
                    ? `${((a.acres / totalAcres) * 100).toFixed(0)}%`
                    : "—"}
                </td>
              </tr>
            );
          })}
          <tr className="border-t-2 border-rule-strong bg-bg/60 font-semibold">
            <td className="px-3 py-2">Total</td>
            <td className="px-3 py-2 text-right">{fmtInt(totalAcres)}</td>
            <td className="px-3 py-2 text-right">
              {totalAcres > 0
                ? fmtInt((totalFmv * 1_000_000) / totalAcres)
                : "—"}
            </td>
            <td className="px-3 py-2 text-right">{fmtInt(totalFmv)}</td>
            <td className="px-3 py-2 text-right">100%</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function PropertiesTable({
  properties,
  ccy,
}: {
  properties: Property[];
  ccy: string;
}) {
  return (
    <div className="mt-4 overflow-x-auto rounded-sm border border-rule bg-surface">
      <table className="w-full border-collapse font-sans text-xs tabular-nums">
        <thead>
          <tr className="border-b border-rule-strong text-left">
            <Th>Property</Th>
            <Th>Location</Th>
            <Th align="right">Acres</Th>
            <Th>Crop / use</Th>
            <Th align="right">Acquired</Th>
            <Th align="right">Cost ({ccy} M)</Th>
            <Th align="right">Book ({ccy} M)</Th>
            <Th align="right">{ccy}/acre book</Th>
          </tr>
        </thead>
        <tbody>
          {properties.map((p) => (
            <tr key={`${p.name}-${p.location}`} className="border-b border-rule">
              <td className="px-3 py-2 align-top">
                <div className="font-medium text-fg">{p.name}</div>
                {p.notes && (
                  <div className="mt-0.5 text-[11px] text-muted">{p.notes}</div>
                )}
              </td>
              <td className="px-3 py-2 align-top text-fg-soft">{p.location}</td>
              <td className="px-3 py-2 text-right align-top">{fmtInt(p.acres)}</td>
              <td className="px-3 py-2 align-top text-fg-soft">{p.cropOrUse}</td>
              <td className="px-3 py-2 text-right align-top text-muted">
                {p.acquired ? formatYear(p.acquired) : "—"}
              </td>
              <td className="px-3 py-2 text-right align-top">
                {p.acquisitionCostMM != null ? fmtMoney(p.acquisitionCostMM) : "—"}
              </td>
              <td className="px-3 py-2 text-right align-top">
                {p.bookValueMM != null ? fmtMoney(p.bookValueMM) : "—"}
              </td>
              <td className="px-3 py-2 text-right align-top">
                {p.bookValueMM != null && p.acres > 0
                  ? fmtInt((p.bookValueMM / p.acres) * 1_000_000)
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ComparablesTable({ comparables }: { comparables: Comparable[] }) {
  return (
    <div className="mt-4 overflow-x-auto rounded-sm border border-rule bg-surface">
      <table className="w-full border-collapse font-sans text-xs tabular-nums">
        <thead>
          <tr className="border-b border-rule-strong text-left">
            <Th>Description</Th>
            <Th>Location</Th>
            <Th align="right">Acres</Th>
            <Th align="right">$ / acre</Th>
            <Th align="right">Date</Th>
            <Th>Source</Th>
          </tr>
        </thead>
        <tbody>
          {comparables.map((c, i) => (
            <tr key={`${c.description}-${i}`} className="border-b border-rule">
              <td className="px-3 py-2 align-top text-fg">{c.description}</td>
              <td className="px-3 py-2 align-top text-fg-soft">{c.location}</td>
              <td className="px-3 py-2 text-right align-top">
                {c.acres ? fmtInt(c.acres) : "—"}
              </td>
              <td className="px-3 py-2 text-right align-top font-medium">
                ${fmtInt(c.pricePerAcre)}
              </td>
              <td className="px-3 py-2 text-right align-top text-muted">
                {formatYear(c.date)}
              </td>
              <td className="px-3 py-2 align-top text-muted">
                {c.url ? (
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="!text-accent no-underline hover:underline"
                  >
                    {c.source ?? "Link"}
                  </a>
                ) : (
                  c.source ?? "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`whitespace-nowrap px-3 pb-2 pt-3 text-[11px] font-medium uppercase tracking-wider text-muted ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function fmtInt(n: number) {
  return Math.round(n).toLocaleString("en-US");
}

function fmtMoney(n: number) {
  return n.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

function formatYear(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

function renderFmvDiscount(
  localPrice: number | null,
  navPerShareAtFmv: number,
): string {
  if (localPrice === null) return "—";
  const ratio = localPrice / navPerShareAtFmv;
  const pct = (ratio - 1) * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
}
