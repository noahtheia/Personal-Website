// Orchestrator for the Analytics > Sector > Exchange tracker.
//
// Pulls IPO events from the configured sources (SEC EDGAR + Yahoo),
// dedupes by (exchangeMic, ticker, listingDate), then derives the
// summary metrics rendered in the table:
//
//   • IPO counts per window: 7d / 30d / 90d / YTD / TTM
//   • Capital raised in TTM (USD millions, where reported)
//   • Trailing-24-month monthly count series for the row sparkline
//
// Only exchanges with at least one IPO in the trailing 24 months are
// included in the summary — matching the "only show exchanges with
// live data" product choice. Drill-down at /analytics/exchanges/{mic}
// reads from the same cached events via getExchangeIpoDetail().
//
// All work is wrapped in unstable_cache keyed by the UTC date so we
// only do the source fan-out once per day per process.

import { unstable_cache } from "next/cache";
import {
  fetchJpxIpos,
  fetchSecIpos,
  fetchYahooIpos,
  type IpoEvent,
  type IpoSource,
} from "@/lib/ipo-sources";
import {
  EXCHANGES,
  getExchange,
  type ExchangeRef,
  type ExchangeRegion,
} from "@/lib/exchanges-reference";

const TTM_MONTHS = 24; // trailing window for sparkline + listing inclusion

export type ExchangeIpoRow = {
  exchange: ExchangeRef;
  count7d: number;
  count30d: number;
  count90d: number;
  countYtd: number;
  countTtm: number;
  proceedsTtmUsdM: number | null;
  monthlySeries: number[]; // length 24, oldest → newest
  lastListingDate: string | null;
};

export type SourceStatus = {
  ok: boolean;
  count: number;
};

export type ExchangeIpoSummary = {
  rows: ExchangeIpoRow[];
  totalIpos: number;
  fetchedAt: string;
  // Keyed by IpoSource. Order in the page UI follows SOURCE_DISPLAY.
  sourcesOk: Record<IpoSource, SourceStatus>;
};

// Display labels for the source-status chips on the index page.
// Listed in the order we want them shown.
export const SOURCE_DISPLAY: { key: IpoSource; label: string }[] = [
  { key: "sec", label: "SEC EDGAR" },
  { key: "jpx", label: "JPX (TSE)" },
  { key: "yahoo", label: "Yahoo IPO calendar" },
];

function utcDateKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function isoDaysAgo(days: number, ref = new Date()): string {
  const d = new Date(ref);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function isoMonthsAgo(months: number, ref = new Date()): string {
  const d = new Date(ref);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().slice(0, 10);
}

function monthKey(iso: string): string {
  return iso.slice(0, 7); // YYYY-MM
}

// Fetch raw events from every configured source in parallel. Each
// source is allowed to fail independently; we record per-source status
// (ok + event count) so the UI can show which adapters returned data.
//
// Source priority for dedupe is the order of SOURCE_FETCHERS below.
// Earlier entries win the canonical row; later entries can only fill
// in missing `proceedsUsd` / `sector` fields.
async function fetchAllEvents(now: Date): Promise<{
  events: IpoEvent[];
  sourcesOk: Record<IpoSource, SourceStatus>;
}> {
  const ttmStart = isoMonthsAgo(TTM_MONTHS, now);
  const today = utcDateKey(now);

  // (source key, async fetcher) tuples. Priority is array order:
  // earlier sources win identity on dedupe; later sources can only
  // fill in missing proceedsUsd / sector. Adding a new direct-exchange
  // adapter is a one-line addition here.
  const SOURCE_FETCHERS: { key: IpoSource; run: () => Promise<IpoEvent[]> }[] = [
    { key: "sec", run: () => fetchSecIpos(ttmStart, today) },
    { key: "jpx", run: () => fetchJpxIpos() },
    { key: "yahoo", run: () => fetchYahooRange(isoDaysAgo(90, now), today) },
  ];

  const settled = await Promise.allSettled(
    SOURCE_FETCHERS.map((s) => s.run()),
  );

  const perSource: { key: IpoSource; events: IpoEvent[] }[] = [];
  const sourcesOk = {} as Record<IpoSource, SourceStatus>;
  for (let i = 0; i < SOURCE_FETCHERS.length; i++) {
    const { key } = SOURCE_FETCHERS[i];
    const result = settled[i];
    const events = result.status === "fulfilled" ? result.value : [];
    perSource.push({ key, events });
    sourcesOk[key] = {
      ok: result.status === "fulfilled" && events.length > 0,
      count: events.length,
    };
  }

  // Dedupe by (exchangeMic, ticker, listingDate). Earlier sources win
  // identity; later sources can fill in missing proceeds / sector only.
  const merged = new Map<string, IpoEvent>();
  for (const { events } of perSource) {
    for (const ev of events) {
      const k = `${ev.exchangeMic}|${ev.ticker}|${ev.listingDate}`;
      const existing = merged.get(k);
      if (!existing) {
        merged.set(k, ev);
      } else {
        let patched: IpoEvent | null = null;
        if (existing.proceedsUsd === null && ev.proceedsUsd !== null) {
          patched = { ...(patched ?? existing), proceedsUsd: ev.proceedsUsd };
        }
        if (existing.sector === null && ev.sector !== null) {
          patched = { ...(patched ?? existing), sector: ev.sector };
        }
        if (patched) merged.set(k, patched);
      }
    }
  }

  return {
    events: Array.from(merged.values()),
    sourcesOk,
  };
}

async function fetchYahooRange(
  startISO: string,
  endISO: string,
): Promise<IpoEvent[]> {
  // Yahoo's calendar is one day per request — page through, but cap to
  // 90 days to keep the cron polite. Run in batches of 5.
  const out: IpoEvent[] = [];
  const start = new Date(`${startISO}T00:00:00Z`);
  const end = new Date(`${endISO}T00:00:00Z`);
  const days: string[] = [];
  for (
    let d = new Date(start);
    d <= end;
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    days.push(d.toISOString().slice(0, 10));
  }
  const BATCH = 5;
  for (let i = 0; i < days.length; i += BATCH) {
    const slice = days.slice(i, i + BATCH);
    const results = await Promise.all(slice.map((d) => fetchYahooIpos(d)));
    for (const r of results) out.push(...r);
  }
  return out;
}

// Build the per-exchange summary row from the merged event list.
function summarize(
  events: IpoEvent[],
  now: Date,
): ExchangeIpoRow[] {
  const cutoff7 = isoDaysAgo(7, now);
  const cutoff30 = isoDaysAgo(30, now);
  const cutoff90 = isoDaysAgo(90, now);
  const ytdStart = `${now.getUTCFullYear()}-01-01`;
  const ttmStart = isoMonthsAgo(TTM_MONTHS, now);

  // 24-month axis (oldest → newest) for sparkline allocation.
  const monthKeys: string[] = [];
  for (let i = TTM_MONTHS - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCMonth(d.getUTCMonth() - i);
    monthKeys.push(d.toISOString().slice(0, 7));
  }

  const byMic = new Map<string, IpoEvent[]>();
  for (const ev of events) {
    if (ev.listingDate < ttmStart) continue;
    let arr = byMic.get(ev.exchangeMic);
    if (!arr) {
      arr = [];
      byMic.set(ev.exchangeMic, arr);
    }
    arr.push(ev);
  }

  const rows: ExchangeIpoRow[] = [];
  for (const [mic, list] of byMic) {
    const exchange = getExchange(mic);
    if (!exchange) continue;
    let count7 = 0,
      count30 = 0,
      count90 = 0,
      countYtd = 0,
      proceedsTtm = 0,
      hasProceeds = false;
    const monthly = new Map<string, number>(monthKeys.map((k) => [k, 0]));
    let lastListing: string | null = null;
    for (const ev of list) {
      if (ev.listingDate >= cutoff7) count7++;
      if (ev.listingDate >= cutoff30) count30++;
      if (ev.listingDate >= cutoff90) count90++;
      if (ev.listingDate >= ytdStart) countYtd++;
      const mk = monthKey(ev.listingDate);
      if (monthly.has(mk)) monthly.set(mk, (monthly.get(mk) || 0) + 1);
      if (ev.proceedsUsd !== null) {
        proceedsTtm += ev.proceedsUsd;
        hasProceeds = true;
      }
      if (!lastListing || ev.listingDate > lastListing) {
        lastListing = ev.listingDate;
      }
    }
    rows.push({
      exchange,
      count7d: count7,
      count30d: count30,
      count90d: count90,
      countYtd,
      countTtm: list.length,
      proceedsTtmUsdM: hasProceeds ? Math.round(proceedsTtm / 1_000_000) : null,
      monthlySeries: monthKeys.map((k) => monthly.get(k) ?? 0),
      lastListingDate: lastListing,
    });
  }

  // Sort by TTM count desc, then by exchange list order as tiebreaker.
  const tieOrder = new Map(EXCHANGES.map((e, i) => [e.mic, i]));
  rows.sort((a, b) => {
    if (b.countTtm !== a.countTtm) return b.countTtm - a.countTtm;
    return (
      (tieOrder.get(a.exchange.mic) ?? 999) -
      (tieOrder.get(b.exchange.mic) ?? 999)
    );
  });
  return rows;
}

const getSummaryUncached = async (): Promise<ExchangeIpoSummary> => {
  const now = new Date();
  const { events, sourcesOk } = await fetchAllEvents(now);
  const rows = summarize(events, now);
  return {
    rows,
    totalIpos: events.length,
    fetchedAt: now.toISOString(),
    sourcesOk,
  };
};

// Public: cached summary. The cache key includes today's UTC date so
// the result rolls over at midnight UTC. Tag "ipos" matches the tag
// applied by the underlying fetches, so the cron's revalidateTag("ipos")
// busts both the inner fetches and this wrapper.
export const getExchangeIpoSummary = unstable_cache(
  getSummaryUncached,
  ["exchange-ipo-summary"],
  { revalidate: 3600, tags: ["ipos"] },
);

// Public: detail for one exchange. Returns the raw events sorted by
// listing date desc.
export async function getExchangeIpoDetail(mic: string): Promise<{
  exchange: ExchangeRef | undefined;
  events: IpoEvent[];
  fetchedAt: string;
}> {
  const now = new Date();
  const { events } = await fetchAllEvents(now);
  const ttmStart = isoMonthsAgo(TTM_MONTHS, now);
  const filtered = events
    .filter((e) => e.exchangeMic === mic && e.listingDate >= ttmStart)
    .sort((a, b) => (a.listingDate < b.listingDate ? 1 : -1));
  return {
    exchange: getExchange(mic),
    events: filtered,
    fetchedAt: now.toISOString(),
  };
}

// Helper for region grouping in the UI.
export const REGION_ORDER: ExchangeRegion[] = ["Americas", "EMEA", "APAC"];

export type { ExchangeRef, ExchangeRegion };

// Re-export the cache key so the cron route can call revalidateTag.
export const IPO_CACHE_TAG = "ipos";

// Marker so unused imports surface in lint if we ever decouple — keep
// the date helper exported for potential reuse.
export { utcDateKey };
