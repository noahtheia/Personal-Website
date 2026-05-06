import {
  aggregateByCategory,
  propertyFmvHighPerAcre,
  propertyFmvLowPerAcre,
  propertyFmvMM,
  propertyFmvVsBookPct,
  totalAcres,
  totalBookMM,
  totalFmvHighMM,
  totalFmvLowMM,
  totalFmvMM,
  type CategoryAggregate,
  type Comparable,
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
  const fmvMM = totalFmvMM(detail);
  const fmvLowMM = totalFmvLowMM(detail);
  const fmvHighMM = totalFmvHighMM(detail);
  const bookMM = totalBookMM(detail);
  const acres = totalAcres(detail);
  const fmvVsBookPct =
    bookMM > 0 ? ((fmvMM - bookMM) / bookMM) * 100 : null;

  // Implied NAV at FMV uses the company-level filing (filing.bookLandMM may
  // be slightly larger than aggregated property book if some asset rows
  // aren't in Schedule III; using the per-property aggregate is more
  // accurate against the FMV side of the equation).
  const netDebt = filing.debtMM - filing.cashMM;
  const navAtFmv = fmvMM - netDebt;
  const navAtFmvLow = fmvLowMM - netDebt;
  const navAtFmvHigh = fmvHighMM - netDebt;
  const navPerShareAtFmv =
    filing.sharesOutMM > 0 ? navAtFmv / filing.sharesOutMM : null;
  const navPerShareLow =
    filing.sharesOutMM > 0 ? navAtFmvLow / filing.sharesOutMM : null;
  const navPerShareHigh =
    filing.sharesOutMM > 0 ? navAtFmvHigh / filing.sharesOutMM : null;

  const aggregates = aggregateByCategory(detail);
  const compById = new Map(detail.comparables.map((c) => [c.id, c]));

  return (
    <div className="space-y-12">
      <section className="mt-8">
        <SectionHeader
          title="Implied fair market analysis"
          subtitle={`As of ${detail.asOf}`}
        />
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card
            label="Aggregate FMV"
            value={`${ccy} ${fmtInt(fmvMM)}M`}
            sub={`Range ${ccy} ${fmtInt(fmvLowMM)}–${fmtInt(fmvHighMM)}M · ${fmtInt(acres)} acres`}
          />
          <Card
            label="FMV vs. book"
            value={
              fmvVsBookPct === null
                ? "—"
                : `${fmvVsBookPct >= 0 ? "+" : ""}${fmvVsBookPct.toFixed(1)}%`
            }
            sub={`Book ${ccy} ${fmtInt(bookMM)}M · FMV ${ccy} ${fmtInt(fmvMM)}M`}
            tone={
              fmvVsBookPct === null
                ? undefined
                : fmvVsBookPct >= 0
                ? "positive"
                : "negative"
            }
          />
          <Card
            label="Implied NAV / share"
            value={
              navPerShareAtFmv === null
                ? "—"
                : `${ccy} ${navPerShareAtFmv.toFixed(2)}`
            }
            sub={
              navPerShareLow !== null && navPerShareHigh !== null
                ? `Range ${ccy} ${navPerShareLow.toFixed(2)}–${navPerShareHigh.toFixed(2)}`
                : `(FMV ${fmtInt(fmvMM)} − net debt ${fmtInt(netDebt)}) ÷ ${fmtInt(filing.sharesOutMM)}M sh`
            }
          />
          <Card
            label="Live price vs. FMV NAV"
            value={
              priced?.localPrice && navPerShareAtFmv && navPerShareAtFmv > 0
                ? renderPct((priced.localPrice / navPerShareAtFmv - 1) * 100)
                : "—"
            }
            sub={
              priced?.localPrice &&
              navPerShareLow !== null &&
              navPerShareHigh !== null &&
              navPerShareLow > 0 &&
              navPerShareHigh > 0
                ? `Range ${renderPct((priced.localPrice / navPerShareHigh - 1) * 100)} (high) to ${renderPct((priced.localPrice / navPerShareLow - 1) * 100)} (low)`
                : priced?.localPrice
                ? `Local price ${priced.localPrice.toFixed(2)} ${ccy}`
                : "Live price unavailable"
            }
            tone={
              priced?.localPrice && navPerShareAtFmv && navPerShareAtFmv > 0
                ? priced.localPrice / navPerShareAtFmv - 1 >= 0
                  ? "positive"
                  : "negative"
                : undefined
            }
          />
        </div>
      </section>

      <section>
        <SectionHeader
          title="FMV by category"
          subtitle="Aggregated from per-property assumptions below"
        />
        <CategoryTable aggregates={aggregates} ccy={ccy} />
      </section>

      <section>
        <SectionHeader
          title="Properties"
          subtitle={detail.propertiesNote ?? `${detail.properties.length} properties`}
        />
        <PropertiesTable
          properties={detail.properties}
          comparables={compById}
          ccy={ccy}
        />
      </section>

      <section>
        <SectionHeader
          title="Comparable land transactions and surveys"
          subtitle={`${detail.comparables.length} reference points · all dated within last 24 months`}
        />
        <ComparablesTable comparables={detail.comparables} />
      </section>

      <section className="rounded-sm border border-rule bg-bg p-5">
        <div className="text-[10px] uppercase tracking-wider text-muted">
          Methodology
        </div>
        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-fg-soft">
          {detail.methodology}
        </p>
      </section>
    </div>
  );
}

function Card({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "positive" | "negative";
}) {
  const valueClass =
    tone === "positive"
      ? "text-[var(--positive)]"
      : tone === "negative"
      ? "text-[var(--negative)]"
      : "";
  return (
    <div className="rounded-sm border border-rule bg-surface p-5">
      <div className="text-[10px] uppercase tracking-wider text-muted">
        {label}
      </div>
      <div className={`mt-1 font-display text-2xl font-semibold tabular-nums ${valueClass}`}>
        {value}
      </div>
      <div className="mt-2 text-xs text-muted">{sub}</div>
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

function CategoryTable({
  aggregates,
  ccy,
}: {
  aggregates: CategoryAggregate[];
  ccy: string;
}) {
  const totals = aggregates.reduce(
    (acc, a) => {
      acc.acres += a.acres;
      acc.book += a.totalBookMM;
      acc.fmv += a.totalFmvMM;
      acc.fmvLow += a.totalFmvLowMM;
      acc.fmvHigh += a.totalFmvHighMM;
      return acc;
    },
    { acres: 0, book: 0, fmv: 0, fmvLow: 0, fmvHigh: 0 },
  );
  const totalsFmvVsBook =
    totals.book > 0 ? ((totals.fmv - totals.book) / totals.book) * 100 : null;
  return (
    <div className="mt-4 overflow-x-auto rounded-sm border border-rule bg-surface">
      <table className="w-full border-collapse font-sans text-xs tabular-nums">
        <thead>
          <tr className="border-b border-rule-strong text-left">
            <Th>Category</Th>
            <Th align="right">Properties</Th>
            <Th align="right">Acres</Th>
            <Th align="right">Avg book {ccy}/acre</Th>
            <Th align="right">Avg FMV {ccy}/acre</Th>
            <Th align="right">Book ({ccy} M)</Th>
            <Th align="right">FMV ({ccy} M)</Th>
            <Th align="right">FMV range ({ccy} M)</Th>
            <Th align="right">FMV vs book</Th>
          </tr>
        </thead>
        <tbody>
          {aggregates.map((a) => (
            <tr key={a.category} className="border-b border-rule">
              <td className="px-3 py-2 align-top text-fg">{a.category}</td>
              <td className="px-3 py-2 text-right">{a.count}</td>
              <td className="px-3 py-2 text-right">{fmtInt(a.acres)}</td>
              <td className="px-3 py-2 text-right">
                {fmtInt(a.weightedBookPerAcre)}
              </td>
              <td className="px-3 py-2 text-right">
                {fmtInt(a.weightedFmvPerAcre)}
              </td>
              <td className="px-3 py-2 text-right">{fmtInt(a.totalBookMM)}</td>
              <td className="px-3 py-2 text-right">{fmtInt(a.totalFmvMM)}</td>
              <td className="px-3 py-2 text-right text-muted">
                {fmtInt(a.totalFmvLowMM)}–{fmtInt(a.totalFmvHighMM)}
              </td>
              <td
                className={`px-3 py-2 text-right ${
                  a.fmvVsBookPct === null
                    ? "text-muted"
                    : a.fmvVsBookPct >= 0
                    ? "text-[var(--positive)]"
                    : "text-[var(--negative)]"
                }`}
              >
                {a.fmvVsBookPct === null
                  ? "—"
                  : renderPct(a.fmvVsBookPct)}
              </td>
            </tr>
          ))}
          <tr className="border-t-2 border-rule-strong bg-bg/60 font-semibold">
            <td className="px-3 py-2">Total</td>
            <td className="px-3 py-2 text-right">
              {aggregates.reduce((s, a) => s + a.count, 0)}
            </td>
            <td className="px-3 py-2 text-right">{fmtInt(totals.acres)}</td>
            <td className="px-3 py-2 text-right">
              {totals.acres > 0
                ? fmtInt((totals.book * 1_000_000) / totals.acres)
                : "—"}
            </td>
            <td className="px-3 py-2 text-right">
              {totals.acres > 0
                ? fmtInt((totals.fmv * 1_000_000) / totals.acres)
                : "—"}
            </td>
            <td className="px-3 py-2 text-right">{fmtInt(totals.book)}</td>
            <td className="px-3 py-2 text-right">{fmtInt(totals.fmv)}</td>
            <td className="px-3 py-2 text-right text-muted">
              {fmtInt(totals.fmvLow)}–{fmtInt(totals.fmvHigh)}
            </td>
            <td
              className={`px-3 py-2 text-right ${
                totalsFmvVsBook === null
                  ? ""
                  : totalsFmvVsBook >= 0
                  ? "text-[var(--positive)]"
                  : "text-[var(--negative)]"
              }`}
            >
              {totalsFmvVsBook === null ? "—" : renderPct(totalsFmvVsBook)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function PropertiesTable({
  properties,
  comparables,
  ccy,
}: {
  properties: Property[];
  comparables: Map<string, Comparable>;
  ccy: string;
}) {
  const sorted = [...properties].sort((a, b) => {
    const aFmv = propertyFmvMM(a);
    const bFmv = propertyFmvMM(b);
    return bFmv - aFmv;
  });
  return (
    <div className="mt-4 overflow-x-auto rounded-sm border border-rule bg-surface">
      <table className="w-full border-collapse font-sans text-xs tabular-nums">
        <thead>
          <tr className="border-b border-rule-strong text-left">
            <Th>Property</Th>
            <Th>Category / crop</Th>
            <Th align="right">Acres</Th>
            <Th align="right">Acquired</Th>
            <Th align="right">Cost ({ccy} M)</Th>
            <Th align="right">Book ({ccy} M)</Th>
            <Th align="right">{ccy}/acre book</Th>
            <Th align="right">FMV {ccy}/acre</Th>
            <Th align="right">FMV ({ccy} M)</Th>
            <Th align="right">vs book</Th>
            <Th>Comps</Th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p, i) => {
            const fmvMM = propertyFmvMM(p);
            const vsBook = propertyFmvVsBookPct(p);
            return (
              <tr
                key={`${p.name}-${p.location}-${i}`}
                className="border-b border-rule align-top"
              >
                <td className="px-3 py-2">
                  <div className="font-medium text-fg">{p.name}</div>
                  <div className="text-[11px] text-muted">{p.location}</div>
                  {p.notes && (
                    <div className="mt-0.5 text-[10px] text-muted">
                      {p.notes}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 text-fg-soft">
                  <div>{p.category}</div>
                  {p.cropOrUse && p.cropOrUse !== p.category && (
                    <div className="mt-0.5 text-[11px] text-muted">
                      {p.cropOrUse}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 text-right">{fmtInt(p.acres)}</td>
                <td className="px-3 py-2 text-right text-muted">
                  {p.acquired ? formatYear(p.acquired) : "—"}
                </td>
                <td className="px-3 py-2 text-right">
                  {p.acquisitionCostMM != null ? fmtMoney(p.acquisitionCostMM) : "—"}
                </td>
                <td className="px-3 py-2 text-right">
                  {p.bookValueMM != null ? fmtMoney(p.bookValueMM) : "—"}
                </td>
                <td className="px-3 py-2 text-right">
                  {p.bookValueMM != null && p.acres > 0
                    ? fmtInt((p.bookValueMM / p.acres) * 1_000_000)
                    : "—"}
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="font-medium">{fmtInt(p.fmvPerAcre)}</div>
                  <div className="mt-0.5 text-[10px] text-muted">
                    {fmtInt(propertyFmvLowPerAcre(p))}–{fmtInt(propertyFmvHighPerAcre(p))}
                  </div>
                </td>
                <td className="px-3 py-2 text-right">
                  {fmtMoney(fmvMM)}
                </td>
                <td
                  className={`px-3 py-2 text-right ${
                    vsBook === null
                      ? "text-muted"
                      : vsBook >= 0
                      ? "text-[var(--positive)]"
                      : "text-[var(--negative)]"
                  }`}
                >
                  {vsBook === null ? "—" : renderPct(vsBook)}
                </td>
                <td className="px-3 py-2">
                  {p.comparablesUsed && p.comparablesUsed.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {p.comparablesUsed.map((id) => {
                        const c = comparables.get(id);
                        return (
                          <span
                            key={id}
                            title={c ? `${c.description} · ${c.location} · $${c.pricePerAcre.toLocaleString()}/acre · ${c.date}` : id}
                            className="rounded-sm border border-rule px-1 py-0.5 text-[9px] uppercase tracking-wider text-muted"
                          >
                            {id}
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                  {p.fmvRationale && (
                    <div className="mt-1 text-[10px] leading-snug text-muted">
                      {p.fmvRationale}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ComparablesTable({ comparables }: { comparables: Comparable[] }) {
  // Sort by date descending (newest first)
  const sorted = [...comparables].sort((a, b) =>
    b.date.localeCompare(a.date),
  );
  return (
    <div className="mt-4 overflow-x-auto rounded-sm border border-rule bg-surface">
      <table className="w-full border-collapse font-sans text-xs tabular-nums">
        <thead>
          <tr className="border-b border-rule-strong text-left">
            <Th>ID</Th>
            <Th>Description</Th>
            <Th>Location</Th>
            <Th align="right">Acres</Th>
            <Th align="right">$ / acre</Th>
            <Th align="right">Date</Th>
            <Th>Source</Th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((c) => (
            <tr key={c.id} className="border-b border-rule">
              <td className="px-3 py-2 align-top text-[10px] uppercase tracking-wider text-muted">
                {c.id}
              </td>
              <td className="px-3 py-2 align-top text-fg">{c.description}</td>
              <td className="px-3 py-2 align-top text-fg-soft">{c.location}</td>
              <td className="px-3 py-2 text-right align-top">
                {c.acres ? fmtInt(c.acres) : "—"}
              </td>
              <td className="px-3 py-2 text-right align-top font-medium">
                ${fmtInt(c.pricePerAcre)}
              </td>
              <td className="px-3 py-2 text-right align-top text-muted">
                {formatYearMonth(c.date)}
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

function renderPct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

function formatYear(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

function formatYearMonth(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}
