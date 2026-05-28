// Fetchers for IPO event data. Two free, no-API-key sources:
//
//   1. SEC EDGAR — full-text filing search for 424B4 / 424B3 (final
//      prospectus) filings, enriched with `company_tickers_exchange.json`
//      to resolve the listing exchange (NYSE vs Nasdaq vs NYSE American).
//      Comprehensive for US IPOs.
//
//   2. Yahoo Finance IPO calendar HTML page — best-effort scraping of
//      the embedded Next.js __NEXT_DATA__ payload. Gives partial coverage
//      for some non-US exchanges. May return empty if Yahoo restructures
//      the page; failures are non-fatal and the orchestrator degrades
//      gracefully.
//
// Both fetchers wrap their network calls with Next's Data Cache
// (`next: { revalidate: 86400, tags: ["ipos"] }`) so the daily cron at
// /api/refresh-ipos can prime the cache without writing files —
// identical to the price-refresh pattern in /api/refresh-prices.

import { resolveMicFromLabel } from "@/lib/exchanges-reference";

export type IpoEvent = {
  exchangeMic: string;
  ticker: string;
  issuer: string;
  // ISO date (YYYY-MM-DD) of the listing / final-prospectus filing.
  listingDate: string;
  currency: string;
  proceedsUsd: number | null;
  sector: string | null;
  sourceUrl: string;
  source: "sec" | "yahoo";
};

const IPO_CACHE_TAG = "ipos";
const ONE_DAY_SECONDS = 86_400;

function edgarUserAgent(): string {
  // SEC requires a contact-style UA for programmatic requests. See:
  // https://www.sec.gov/os/accessing-edgar-data
  return (
    process.env.SEC_EDGAR_UA ||
    "Noah Theia Blockchain Personal Website noah@theiablockchain.com"
  );
}

// ──────────────────────────────────────────────────────────────────────
// SEC EDGAR
// ──────────────────────────────────────────────────────────────────────

type EdgarTickersByExchange = {
  fields: string[];
  data: (string | number)[][];
};

type EdgarTickerEntry = {
  cik: number;
  name: string;
  ticker: string;
  exchange: string;
};

type EdgarSearchHit = {
  _id: string;
  _source: {
    ciks?: string[];
    display_names?: string[];
    file_date: string;
    adsh: string;
    form: string;
    file_type?: string;
    tickers?: string[];
  };
};

type EdgarSearchResponse = {
  hits?: { hits?: EdgarSearchHit[] };
};

async function fetchEdgarTickerExchangeMap(): Promise<Map<number, EdgarTickerEntry>> {
  const url = "https://www.sec.gov/files/company_tickers_exchange.json";
  const res = await fetch(url, {
    headers: { "User-Agent": edgarUserAgent(), Accept: "application/json" },
    next: { revalidate: ONE_DAY_SECONDS, tags: [IPO_CACHE_TAG] },
  });
  if (!res.ok) throw new Error(`EDGAR ticker map ${res.status}`);
  const data = (await res.json()) as EdgarTickersByExchange;
  const cikIdx = data.fields.indexOf("cik");
  const nameIdx = data.fields.indexOf("name");
  const tickerIdx = data.fields.indexOf("ticker");
  const exIdx = data.fields.indexOf("exchange");
  const map = new Map<number, EdgarTickerEntry>();
  for (const row of data.data) {
    const cik = Number(row[cikIdx]);
    if (!Number.isFinite(cik)) continue;
    map.set(cik, {
      cik,
      name: String(row[nameIdx] ?? ""),
      ticker: String(row[tickerIdx] ?? ""),
      exchange: String(row[exIdx] ?? ""),
    });
  }
  return map;
}

// EDGAR full-text search. Endpoint returns up to 100 hits per page;
// we page through until exhausted or `pageCap` is reached.
async function searchEdgarFilings(opts: {
  forms: string[];
  startdt: string;
  enddt: string;
  pageCap?: number;
}): Promise<EdgarSearchHit[]> {
  const { forms, startdt, enddt } = opts;
  const pageCap = opts.pageCap ?? 5;
  const hits: EdgarSearchHit[] = [];
  for (let page = 0; page < pageCap; page++) {
    const params = new URLSearchParams({
      q: "",
      dateRange: "custom",
      startdt,
      enddt,
      forms: forms.join(","),
      from: String(page * 100),
    });
    const url = `https://efts.sec.gov/LATEST/search-index?${params.toString()}`;
    const res = await fetch(url, {
      headers: { "User-Agent": edgarUserAgent(), Accept: "application/json" },
      next: { revalidate: ONE_DAY_SECONDS, tags: [IPO_CACHE_TAG] },
    });
    if (!res.ok) {
      // EDGAR rate-limits to ~10 req/s. A 429 means slow down — abort
      // this page set and return what we have.
      break;
    }
    const data = (await res.json()) as EdgarSearchResponse;
    const pageHits = data.hits?.hits ?? [];
    if (pageHits.length === 0) break;
    hits.push(...pageHits);
    if (pageHits.length < 100) break;
  }
  return hits;
}

function edgarFilingUrl(cik: string, adsh: string): string {
  // Filing index page. Strip dashes from adsh for the path segment.
  const adshNoDash = adsh.replace(/-/g, "");
  return `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=&dateb=&owner=include&count=10&action=getcompany#${adshNoDash}`;
}

// Public: fetch SEC IPO-like filings between two ISO dates.
export async function fetchSecIpos(
  startISO: string,
  endISO: string,
): Promise<IpoEvent[]> {
  let exchangeMap: Map<number, EdgarTickerEntry>;
  try {
    exchangeMap = await fetchEdgarTickerExchangeMap();
  } catch {
    return [];
  }

  let hits: EdgarSearchHit[];
  try {
    hits = await searchEdgarFilings({
      forms: ["424B4", "424B3"],
      startdt: startISO,
      enddt: endISO,
      pageCap: 8,
    });
  } catch {
    return [];
  }

  // De-dupe by (CIK, file_date): a single IPO can produce multiple
  // 424 supplements on the same day.
  const seen = new Set<string>();
  const events: IpoEvent[] = [];
  for (const h of hits) {
    const cikRaw = h._source.ciks?.[0];
    if (!cikRaw) continue;
    const cik = Number(cikRaw);
    if (!Number.isFinite(cik)) continue;
    const key = `${cik}|${h._source.file_date}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const entry = exchangeMap.get(cik);
    if (!entry) continue; // No mapped ticker → can't attribute to an exchange.
    const mic = resolveMicFromLabel(entry.exchange);
    if (!mic) continue;

    events.push({
      exchangeMic: mic,
      ticker: entry.ticker,
      issuer: entry.name || (h._source.display_names?.[0] ?? entry.ticker),
      listingDate: h._source.file_date,
      currency: "USD",
      proceedsUsd: null,
      sector: null,
      sourceUrl: edgarFilingUrl(String(cik).padStart(10, "0"), h._source.adsh),
      source: "sec",
    });
  }
  return events;
}

// ──────────────────────────────────────────────────────────────────────
// Yahoo Finance IPO calendar (best-effort)
// ──────────────────────────────────────────────────────────────────────

type YahooIpoRow = {
  ticker?: string;
  companyShortName?: string;
  exchangeShortName?: string;
  date?: string;
  priceFrom?: number;
  priceTo?: number;
  currencyName?: string;
  amount?: number;
  sector?: string;
};

// Yahoo's calendar page embeds the Next.js data in <script id="__NEXT_DATA__">.
// We extract the IPO rows from the pageProps. If the markup changes, we
// just return [] and the orchestrator carries on with EDGAR-only data.
export async function fetchYahooIpos(dayISO: string): Promise<IpoEvent[]> {
  const url = `https://finance.yahoo.com/calendar/ipo?day=${encodeURIComponent(dayISO)}`;
  let html: string;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; PersonalBlog/1.0; +https://noahsideas.com)",
        Accept: "text/html",
      },
      next: { revalidate: ONE_DAY_SECONDS, tags: [IPO_CACHE_TAG] },
    });
    if (!res.ok) return [];
    html = await res.text();
  } catch {
    return [];
  }

  const match = html.match(
    /<script[^>]+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/,
  );
  if (!match) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(match[1]);
  } catch {
    return [];
  }

  // Walk the parsed tree looking for arrays of IPO-shaped rows. Yahoo's
  // exact path has changed several times — a duck-type walk is more
  // resilient than hardcoding the path.
  const rows: YahooIpoRow[] = [];
  const visit = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const child of node) visit(child);
      return;
    }
    const obj = node as Record<string, unknown>;
    if (
      typeof obj.ticker === "string" &&
      (typeof obj.exchangeShortName === "string" ||
        typeof obj.exchange === "string")
    ) {
      rows.push({
        ticker: obj.ticker,
        companyShortName:
          (obj.companyShortName as string | undefined) ??
          (obj.shortName as string | undefined) ??
          (obj.longName as string | undefined),
        exchangeShortName:
          (obj.exchangeShortName as string | undefined) ??
          (obj.exchange as string | undefined),
        date: (obj.date as string | undefined) ?? dayISO,
        priceFrom: typeof obj.priceFrom === "number" ? obj.priceFrom : undefined,
        priceTo: typeof obj.priceTo === "number" ? obj.priceTo : undefined,
        currencyName:
          (obj.currencyName as string | undefined) ??
          (obj.currency as string | undefined),
        amount: typeof obj.amount === "number" ? obj.amount : undefined,
        sector: obj.sector as string | undefined,
      });
    }
    for (const v of Object.values(obj)) visit(v);
  };
  visit(parsed);

  const out: IpoEvent[] = [];
  for (const r of rows) {
    if (!r.ticker) continue;
    const mic = resolveMicFromLabel(r.exchangeShortName);
    if (!mic) continue;
    const proceedsUsd =
      typeof r.amount === "number" && r.currencyName?.toUpperCase() === "USD"
        ? r.amount
        : null;
    out.push({
      exchangeMic: mic,
      ticker: r.ticker,
      issuer: r.companyShortName ?? r.ticker,
      listingDate: r.date ?? dayISO,
      currency: (r.currencyName ?? "USD").toUpperCase(),
      proceedsUsd,
      sector: r.sector ?? null,
      sourceUrl: url,
      source: "yahoo",
    });
  }
  return out;
}
