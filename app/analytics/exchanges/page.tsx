import { getExchangeIpoSummary } from "@/lib/exchange-ipos";
import { ExchangeIpoTracker } from "@/components/ExchangeIpoTracker";

export const metadata = {
  title: "Exchange IPO tracker",
  description:
    "Daily IPO activity across global equities exchanges, sourced from SEC EDGAR and Yahoo Finance.",
};

export const revalidate = 3600;

export default async function ExchangesPage() {
  const summary = await getExchangeIpoSummary();
  const fetchedAt = summary.fetchedAt;

  return (
    <div>
      <header className="border-b border-rule pb-4">
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          Exchange IPO Tracker
        </h1>
        <p className="mt-1 text-sm text-muted">
          Which equities exchanges are seeing new companies come to market.
          Rolling IPO counts, capital raised, and a 24-month trend per
          exchange. Click an exchange row for the underlying listings.
        </p>
        <p className="mt-2 text-[11px] uppercase tracking-wider text-muted">
          Last updated{" "}
          <time dateTime={fetchedAt}>
            {new Date(fetchedAt).toLocaleString("en-US", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </time>{" "}
          · {summary.rows.length} exchanges · {summary.totalIpos} listings
          (24m)
        </p>
      </header>

      <ExchangeIpoTracker rows={summary.rows} />

      <p className="mt-3 text-xs text-muted">
        Sources:{" "}
        <span
          className={
            summary.sourcesOk.sec
              ? "text-fg"
              : "text-muted line-through decoration-rule"
          }
          title="SEC EDGAR 424B4 / 424B3 prospectus filings"
        >
          SEC EDGAR
        </span>{" "}
        ·{" "}
        <span
          className={
            summary.sourcesOk.yahoo
              ? "text-fg"
              : "text-muted line-through decoration-rule"
          }
          title="Yahoo Finance IPO calendar"
        >
          Yahoo Finance IPO calendar
        </span>
        . Refreshed daily by{" "}
        <code>/api/refresh-ipos</code> (Vercel cron). Only exchanges with
        at least one IPO in the trailing 24 months are rendered.
      </p>

      <p className="mt-10 text-[11px] leading-relaxed text-muted">
        SEC EDGAR provides comprehensive coverage for US listings (NYSE,
        Nasdaq, NYSE American). Yahoo&apos;s IPO calendar provides
        partial coverage for several non-US venues. Smaller exchanges
        will appear as soon as a source returns data for them. Nothing
        here is investment advice.
      </p>
    </div>
  );
}
