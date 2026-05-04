import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getFilings,
  getPricedFarmlandComps,
  type PricedFarmlandComp,
} from "@/lib/farmland-comps";
import {
  getPropertyDetail,
  type PropertyDetail,
} from "@/lib/farmland-properties";
import { FarmlandPropertyDetail } from "@/components/FarmlandPropertyDetail";

export const revalidate = 3600;

export async function generateStaticParams() {
  return getFilings().map((f) => ({ ticker: f.ticker }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;
  const decoded = decodeURIComponent(ticker);
  const filing = getFilings().find((f) => f.ticker === decoded);
  if (!filing) return {};
  return {
    title: `${filing.name} (${filing.ticker}) — land analysis`,
    description: `Property-level land value analysis for ${filing.name}.`,
  };
}

export default async function PublicFarmlandTickerPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;
  const decoded = decodeURIComponent(ticker);

  const filings = getFilings();
  const filing = filings.find((f) => f.ticker === decoded);
  if (!filing) notFound();

  const detail = getPropertyDetail(decoded);
  const comps = await getPricedFarmlandComps();
  const priced = comps.find((c) => c.ticker === decoded);

  return (
    <div>
      <Link
        href="/analytics/public-farmland"
        className="text-xs uppercase tracking-wider !text-muted no-underline hover:!text-accent"
      >
        ← All comps
      </Link>

      <header className="mt-3 border-b border-rule pb-4">
        <p className="eyebrow">{filing.currency} reporting</p>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          {filing.name}{" "}
          <span className="text-muted">· {filing.ticker}</span>
        </h1>
        <p className="mt-1 text-sm text-muted">
          {filing.primaryCrops}
          {filing.filingUrl && (
            <>
              {" · "}
              <a
                href={filing.filingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="!text-accent no-underline hover:underline"
              >
                Filing
              </a>
            </>
          )}
        </p>
      </header>

      <SummaryStats filing={filing} priced={priced} />

      {detail ? (
        <FarmlandPropertyDetail
          filing={filing}
          priced={priced}
          detail={detail}
        />
      ) : (
        <PendingDetail filing={filing} />
      )}
    </div>
  );
}

function SummaryStats({
  filing,
  priced,
}: {
  filing: ReturnType<typeof getFilings>[number];
  priced: PricedFarmlandComp | undefined;
}) {
  const ccy = filing.currency;
  const bookPerAcre = (filing.bookLandMM / filing.acresK) * 1000;
  return (
    <dl className="mt-6 grid grid-cols-2 gap-4 border-b border-rule pb-6 sm:grid-cols-4">
      <Stat label="Acres" value={`${fmtInt(filing.acresK * 1000)}`} />
      <Stat label="Book / acre" value={`${ccy} ${fmtInt(bookPerAcre)}`} />
      <Stat
        label="Market cap (USD)"
        value={priced?.marketCapMM != null ? `$${fmtInt(priced.marketCapMM)}M` : "—"}
      />
      <Stat
        label="EV / acre (USD)"
        value={priced?.evPerAcre != null ? `$${fmtInt(priced.evPerAcre)}` : "—"}
      />
    </dl>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-muted">
        {label}
      </dt>
      <dd className="mt-1 font-display text-xl font-semibold tabular-nums">
        {value}
      </dd>
    </div>
  );
}

function PendingDetail({
  filing,
}: {
  filing: ReturnType<typeof getFilings>[number];
}) {
  return (
    <section className="mt-8 rounded-sm border border-rule bg-surface p-6">
      <h2 className="font-display text-lg font-semibold">
        In-depth land analysis pending
      </h2>
      <p className="mt-2 text-sm text-fg-soft">
        Property-by-property land detail and an implied fair-market analysis
        haven&apos;t been compiled for {filing.ticker} yet. The schema and page
        are ready — adding{" "}
        <code className="rounded bg-bg px-1 py-0.5 text-[12px]">
          content/farmland-properties/{filing.ticker}.json
        </code>{" "}
        will populate this page automatically.
      </p>
      <p className="mt-4 text-xs text-muted">
        For now, see the{" "}
        <Link
          href="/analytics/public-farmland"
          className="!text-accent no-underline hover:underline"
        >
          comps table
        </Link>{" "}
        for {filing.ticker}&apos;s aggregate book value, EV, and per-acre
        multiples.
      </p>
    </section>
  );
}

function fmtInt(n: number) {
  return Math.round(n).toLocaleString("en-US");
}
