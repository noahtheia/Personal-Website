import Link from "next/link";
import { notFound } from "next/navigation";
import { getExchangeIpoDetail } from "@/lib/exchange-ipos";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ mic: string }>;
}) {
  const { mic } = await params;
  return {
    title: `${mic.toUpperCase()} · IPO listings`,
    description: `Recent IPO listings on ${mic.toUpperCase()} sourced from SEC EDGAR and Yahoo Finance.`,
  };
}

function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function fmtProceedsUsd(n: number | null): string {
  if (n === null) return "—";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  return `$${n.toLocaleString("en-US")}`;
}

export default async function ExchangeDetailPage({
  params,
}: {
  params: Promise<{ mic: string }>;
}) {
  const { mic } = await params;
  const upper = mic.toUpperCase();
  const detail = await getExchangeIpoDetail(upper);
  if (!detail.exchange) notFound();

  const { exchange, events, fetchedAt } = detail;

  return (
    <div>
      <header className="border-b border-rule pb-4">
        <p className="text-xs text-muted">
          <Link href="/analytics/exchanges" className="hover:!text-accent">
            ← All exchanges
          </Link>
        </p>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          {exchange.name}{" "}
          <span className="text-base font-normal text-muted">
            ({exchange.mic})
          </span>
        </h1>
        <p className="mt-1 text-sm text-muted">
          {exchange.country} · {exchange.region} ·{" "}
          <a
            href={exchange.website}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:!text-accent"
          >
            {exchange.website.replace(/^https?:\/\//, "")}
          </a>
        </p>
        <p className="mt-2 text-[11px] uppercase tracking-wider text-muted">
          Last updated{" "}
          <time dateTime={fetchedAt}>
            {new Date(fetchedAt).toLocaleString("en-US", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </time>{" "}
          · {events.length} listings (trailing 24 months)
        </p>
      </header>

      {events.length === 0 ? (
        <div className="mt-6 rounded-sm border border-rule bg-surface p-6 text-sm text-muted">
          No listings recorded for this exchange in the trailing 24 months.
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-sm border border-rule bg-surface">
          <table className="min-w-full border-collapse text-sm">
            <thead className="border-b border-rule bg-bg">
              <tr>
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted">
                  Listing Date
                </th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted">
                  Issuer
                </th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted">
                  Ticker
                </th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-muted">
                  Proceeds (USD)
                </th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted">
                  Sector
                </th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted">
                  Source
                </th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr
                  key={`${ev.ticker}-${ev.listingDate}-${ev.source}`}
                  className="border-t border-rule hover:bg-bg"
                >
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums text-muted">
                    {fmtDate(ev.listingDate)}
                  </td>
                  <td className="px-3 py-2 font-medium">{ev.issuer}</td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {ev.ticker}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {fmtProceedsUsd(ev.proceedsUsd)}
                  </td>
                  <td className="px-3 py-2 text-muted">
                    {ev.sector ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <a
                      href={ev.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="!text-muted hover:!text-accent"
                    >
                      {ev.source === "sec" ? "EDGAR" : "Yahoo"} ↗
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
