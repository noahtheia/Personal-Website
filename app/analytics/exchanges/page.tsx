import { getExchangeIpoSummary, SOURCE_DISPLAY } from "@/lib/exchange-ipos";
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

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        <span>Sources:</span>
        {SOURCE_DISPLAY.map(({ key, label }) => {
          const status = summary.sourcesOk[key];
          const ok = status?.ok ?? false;
          return (
            <span
              key={key}
              className={
                ok ? "text-fg" : "text-muted line-through decoration-rule"
              }
              title={`${label}: ${ok ? "ok" : "no events"}`}
            >
              {label}
              {status && status.count > 0 ? (
                <span className="ml-1 text-[10px] text-muted">
                  · {status.count}
                </span>
              ) : null}
            </span>
          );
        })}
      </div>

      <p className="mt-2 text-xs text-muted">
        Refreshed daily by <code>/api/refresh-ipos</code> (Vercel cron).
        Only exchanges with at least one IPO in the trailing 24 months
        are rendered.
      </p>

      <p className="mt-10 text-[11px] leading-relaxed text-muted">
        Pulled directly from the source exchange or its national
        regulator: SEC EDGAR (US), HKEXnews (Hong Kong Main Board +
        GEM), JPX (Japan), BME equities regulation feed (Spain), CVM
        Brazil&apos;s public-company registry (B3). Yahoo&apos;s IPO
        calendar is wired as a best-effort fallback for venues we
        don&apos;t yet have a direct route to. Additional direct
        adapters across Europe (LSE, Euronext, Xetra, SIX, Nordic),
        Asia-Pacific (KRX, TWSE, SGX, BSE/NSE India, ASX), Latin
        America, and Middle East / Africa are blocked by JS-only SPAs,
        Akamai/Cloudflare/Imperva anti-bot, or gated paid feeds; the
        source-adapter architecture is in place so they can be plugged
        back in once a usable endpoint surfaces. Adapters fail
        independently; a single bad source won&apos;t take down the
        page. Nothing here is investment advice.
      </p>
    </div>
  );
}
