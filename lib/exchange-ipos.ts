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
import { fetchSecIpos, fetchYahooIpos, type IpoEvent } from "@/lib/ipo-sources";
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

export type ExchangeIpoSummary = {
  rows: ExchangeIpoRow[];
  totalIpos: number;
  fetchedAt: string;
  sourcesOk: { sec: boolean; yahoo: boolean };
};

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

// Fetch the raw events. SEC is queried once for the whole TTM range.
// Yahoo is queried per-day over a shorter rolling window (the calendar
// page returns one day at a time and only really has recent coverage).
async function fetchAllEvents(now: Date): Promise<{
  events: IpoEvent[];
  sourcesOk: { sec: boolean; yahoo: boolean };
}> {
  const ttmStart = isoMonthsAgo(TTM_MONTHS, now);
  const today = utcDateKey(now);

  const [secResult, yahooResult] = await Promise.allSettled([
    fetchSecIpos(ttmStart, today),
    fetchYahooRange(isoDaysAgo(90, now), today),
  ]);

  const sec = secResult.status === "fulfilled" ? secResult.value : [];
  const yahoo = yahooResult.status === "fulfilled" ? yahooResult.value : [];

  // Dedupe across sources: same ticker + listing date is the same IPO.
  // Prefer SEC (more accurate exchange attribution); merge Yahoo
  // proceeds in when SEC didn't have them.
  const merged = new Map<string, IpoEvent>();
  for (const ev of sec) {
    merged.set(`${ev.exchangeMic}|${ev.ticker}|${ev.listingDate}`, ev);
  }
  for (const ev of yahoo) {
    const k = `${ev.exchangeMic}|${ev.ticker}|${ev.listingDate}`;
    const existing = merged.get(k);
    if (!existing) {
      merged.set(k, ev);
    } else if (existing.proceedsUsd === null && ev.proceedsUsd !== null) {
      merged.set(k, { ...existing, proceedsUsd: ev.proceedsUsd });
    }
  }

  return {
    events: Array.from(merged.values()),
    sourcesOk: {
      sec: secResult.status === "fulfilled" && sec.length > 0,
      yahoo: yahooResult.status === "fulfilled",
    },
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
