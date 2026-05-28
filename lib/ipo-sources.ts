// Fetchers for IPO event data. All sources are free and pulled
// directly from the issuing exchange or its national/regional
// regulator — no third-party aggregators.
//
//   1. SEC EDGAR (US regulator) — 424B4 / 424B3 final-prospectus
//      filings, enriched with `company_tickers_exchange.json` for
//      venue attribution. Authoritative US coverage.
//   2. Yahoo Finance IPO calendar — best-effort scrape kept for
//      historical fallback; will be retired once direct adapters
//      cover the same ground.
//   3. ESMA Register of Prospectuses (EU regulator) — pan-EU equity
//      prospectus approvals, mapped via issuer home-member-state.
//   4. Euronext "New Listings" feed — Paris, Amsterdam, Brussels,
//      Lisbon, Milan, Oslo, Dublin in one source.
//   5. London Stock Exchange RNS — "New Listing" headline type
//      (Main Market + AIM).
//   6. TMX (TSX / TSXV) — Canadian new-listings page.
//   7. ASX — Markit Digital JSON used by the public listings page.
//   8. HKEX news — "New Listings" announcement type.
//   9. JPX/TSE — English-language new-listings page.
//
// Every fetcher wraps its network calls with Next's Data Cache
// (`next: { revalidate: 86400, tags: ["ipos"] }`) so the daily cron at
// /api/refresh-ipos can prime the cache without writing files —
// identical to the price-refresh pattern in /api/refresh-prices.
// Every fetcher swallows errors and returns [] so one bad source
// can't take down the orchestrator.

import {
  resolveMicFromCountry,
  resolveMicFromLabel,
} from "@/lib/exchanges-reference";

export type IpoSource =
  | "sec"
  | "yahoo"
  | "esma"
  | "euronext"
  | "lse"
  | "tsx"
  | "asx"
  | "hkex"
  | "jpx";

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
  source: IpoSource;
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

// ──────────────────────────────────────────────────────────────────────
// Shared helpers for the direct-exchange / regulator adapters
// ──────────────────────────────────────────────────────────────────────

function politeUserAgent(): string {
  return (
    process.env.IPO_FETCH_UA ||
    "Personal Website IPO tracker (noah@theiablockchain.com)"
  );
}

const CACHE_OPTS: RequestInit = {
  next: { revalidate: ONE_DAY_SECONDS, tags: [IPO_CACHE_TAG] },
};

// Parse rows out of a simple HTML <table> by scanning <tr>...</tr> and
// then <td>...</td>. Tolerant of attributes and inner markup; returns
// each row as an array of text cells.
function parseHtmlTableRows(html: string): string[][] {
  const rows: string[][] = [];
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRe.exec(html))) {
    const cells: string[] = [];
    let cellMatch: RegExpExecArray | null;
    cellRe.lastIndex = 0;
    while ((cellMatch = cellRe.exec(rowMatch[1]))) {
      cells.push(
        cellMatch[1]
          .replace(/<[^>]*>/g, " ")
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/\s+/g, " ")
          .trim(),
      );
    }
    if (cells.length) rows.push(cells);
  }
  return rows;
}

function toIsoDate(input: string): string | null {
  if (!input) return null;
  // Already ISO?
  if (/^\d{4}-\d{2}-\d{2}/.test(input)) return input.slice(0, 10);
  const t = Date.parse(input);
  if (!Number.isFinite(t)) return null;
  return new Date(t).toISOString().slice(0, 10);
}

// ──────────────────────────────────────────────────────────────────────
// 3. ESMA Register of Prospectuses (EU regulator)
// ──────────────────────────────────────────────────────────────────────

type EsmaDoc = {
  issuer_name?: string;
  home_member_state?: string;
  approval_date?: string;
  instrument_isin?: string;
  prosp_type?: string;
  instrument_type?: string;
};

type EsmaResponse = {
  response?: { docs?: EsmaDoc[]; numFound?: number };
};

export async function fetchEsmaIpos(sinceISO: string): Promise<IpoEvent[]> {
  // ESMA's public Solr endpoint backs registers.esma.europa.eu. We
  // pull prospectus approvals with instrument_type "Shares" so we
  // focus on equity issuances. The cutoff filter uses Solr date math.
  const out: IpoEvent[] = [];
  const PAGE = 200;
  for (let start = 0; start < 1000; start += PAGE) {
    const params = new URLSearchParams({
      q: "*:*",
      fq: `instrument_type:Shares AND approval_date:[${sinceISO}T00:00:00Z TO *]`,
      sort: "approval_date desc",
      rows: String(PAGE),
      start: String(start),
      wt: "json",
    });
    const url = `https://registers.esma.europa.eu/solr/esma_registers_prr_prosp/select?${params.toString()}`;
    let data: EsmaResponse;
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": politeUserAgent(), Accept: "application/json" },
        ...CACHE_OPTS,
      });
      if (!res.ok) break;
      data = (await res.json()) as EsmaResponse;
    } catch {
      break;
    }
    const docs = data.response?.docs ?? [];
    if (docs.length === 0) break;
    for (const d of docs) {
      const date = toIsoDate(d.approval_date ?? "");
      if (!date) continue;
      const mic = resolveMicFromCountry(d.home_member_state);
      if (!mic) continue;
      const ticker = (d.instrument_isin ?? "").trim();
      if (!ticker) continue;
      out.push({
        exchangeMic: mic,
        ticker,
        issuer: d.issuer_name ?? ticker,
        listingDate: date,
        currency: "EUR",
        proceedsUsd: null,
        sector: null,
        sourceUrl: "https://registers.esma.europa.eu/publication/searchProspectus",
        source: "esma",
      });
    }
    if (docs.length < PAGE) break;
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────────
// 4. Euronext (Paris / Amsterdam / Brussels / Lisbon / Milan / Oslo / Dublin)
// ──────────────────────────────────────────────────────────────────────

const EURONEXT_MARKETS: { slug: string; mic: string }[] = [
  { slug: "paris", mic: "XPAR" },
  { slug: "amsterdam", mic: "XAMS" },
  { slug: "brussels", mic: "XBRU" },
  { slug: "lisbon", mic: "XLIS" },
  { slug: "milan", mic: "MTAA" },
  { slug: "oslo", mic: "XOSL" },
  { slug: "dublin", mic: "XMSM" },
];

export async function fetchEuronextIpos(): Promise<IpoEvent[]> {
  const out: IpoEvent[] = [];
  for (const { slug, mic } of EURONEXT_MARKETS) {
    const url = `https://live.euronext.com/en/products/equities/new-listings/${slug}`;
    let html: string;
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": politeUserAgent(), Accept: "text/html" },
        ...CACHE_OPTS,
      });
      if (!res.ok) continue;
      html = await res.text();
    } catch {
      continue;
    }
    // Euronext renders the list in a <table>. We don't care about
    // header rows — they'll fail the date-parse and get dropped.
    for (const cells of parseHtmlTableRows(html)) {
      if (cells.length < 3) continue;
      // Heuristic column hunt: find a column that parses as a date and
      // a column that looks like an ISIN / ticker.
      let date: string | null = null;
      let ticker = "";
      let issuer = "";
      for (const c of cells) {
        if (!date) {
          const iso = toIsoDate(c);
          if (iso) {
            date = iso;
            continue;
          }
        }
        if (!ticker && /^[A-Z0-9]{2,12}$/.test(c)) ticker = c;
        else if (!issuer && /[A-Za-z]{3,}/.test(c)) issuer = c;
      }
      if (!date || !issuer || !ticker) continue;
      out.push({
        exchangeMic: mic,
        ticker,
        issuer,
        listingDate: date,
        currency: "EUR",
        proceedsUsd: null,
        sector: null,
        sourceUrl: url,
        source: "euronext",
      });
    }
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────────
// 5. London Stock Exchange — RNS "New Listing" headline (code 1078)
// ──────────────────────────────────────────────────────────────────────

type LseNewsItem = {
  companyShortName?: string;
  tidm?: string;
  market?: string;
  dateTime?: string;
  newsId?: number;
};

type LseNewsResponse = {
  items?: LseNewsItem[];
};

export async function fetchLseIpos(daysBack: number): Promise<IpoEvent[]> {
  const url = `https://api.londonstockexchange.com/api/v1/news/getNewsList?headlinetypes=1078&days=${encodeURIComponent(
    String(daysBack),
  )}&page=0&size=500`;
  let data: LseNewsResponse;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": politeUserAgent(), Accept: "application/json" },
      ...CACHE_OPTS,
    });
    if (!res.ok) return [];
    data = (await res.json()) as LseNewsResponse;
  } catch {
    return [];
  }
  const out: IpoEvent[] = [];
  for (const item of data.items ?? []) {
    const date = toIsoDate(item.dateTime ?? "");
    if (!date || !item.tidm) continue;
    const mic = resolveMicFromLabel(item.market ?? "Main Market") ?? "XLON";
    out.push({
      exchangeMic: mic,
      ticker: item.tidm,
      issuer: item.companyShortName ?? item.tidm,
      listingDate: date,
      currency: "GBP",
      proceedsUsd: null,
      sector: null,
      sourceUrl: item.newsId
        ? `https://www.londonstockexchange.com/news-article/${item.tidm}/${item.newsId}`
        : "https://www.londonstockexchange.com/news",
      source: "lse",
    });
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────────
// 6. TMX (TSX + TSX Venture)
// ──────────────────────────────────────────────────────────────────────

export async function fetchTsxIpos(): Promise<IpoEvent[]> {
  // TMX publishes recent listings on a public HTML page; both TSX and
  // TSXV share the same view, distinguished by an "Exchange" column.
  const url =
    "https://www.tsx.com/listings/listing-with-us/listed-company-directory/recent-listings";
  let html: string;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": politeUserAgent(), Accept: "text/html" },
      ...CACHE_OPTS,
    });
    if (!res.ok) return [];
    html = await res.text();
  } catch {
    return [];
  }
  const out: IpoEvent[] = [];
  for (const cells of parseHtmlTableRows(html)) {
    if (cells.length < 3) continue;
    let date: string | null = null;
    let ticker = "";
    let issuer = "";
    let market = "";
    for (const c of cells) {
      if (!date) {
        const iso = toIsoDate(c);
        if (iso) {
          date = iso;
          continue;
        }
      }
      if (!market && /(tsx|tsxv|venture)/i.test(c)) market = c;
      else if (!ticker && /^[A-Z][A-Z0-9.]{0,8}$/.test(c)) ticker = c;
      else if (!issuer && /[A-Za-z]{3,}/.test(c)) issuer = c;
    }
    if (!date || !ticker || !issuer) continue;
    const mic = /venture|tsxv/i.test(market) ? "XTSX" : "XTSE";
    out.push({
      exchangeMic: mic,
      ticker,
      issuer,
      listingDate: date,
      currency: "CAD",
      proceedsUsd: null,
      sector: null,
      sourceUrl: url,
      source: "tsx",
    });
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────────
// 7. ASX (Markit Digital JSON)
// ──────────────────────────────────────────────────────────────────────

type AsxListing = {
  symbol?: string;
  asxCode?: string;
  displayName?: string;
  companyName?: string;
  listingDate?: string;
  industryGroupName?: string;
  capitalRaised?: number;
};

type AsxResponse = {
  data?: { items?: AsxListing[] } | AsxListing[];
};

export async function fetchAsxIpos(): Promise<IpoEvent[]> {
  const url =
    "https://asx.api.markitdigital.com/asx-research/1.0/listings/recent?count=200";
  let data: AsxResponse;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": politeUserAgent(),
        Accept: "application/json",
        // ASX's Markit Digital gateway expects a referer matching the
        // public listings page.
        Referer: "https://www2.asx.com.au/listings/upcoming-floats-and-listings",
      },
      ...CACHE_OPTS,
    });
    if (!res.ok) return [];
    data = (await res.json()) as AsxResponse;
  } catch {
    return [];
  }
  const items = Array.isArray(data.data)
    ? data.data
    : data.data?.items ?? [];
  const out: IpoEvent[] = [];
  for (const it of items) {
    const date = toIsoDate(it.listingDate ?? "");
    const ticker = it.asxCode ?? it.symbol ?? "";
    if (!date || !ticker) continue;
    out.push({
      exchangeMic: "XASX",
      ticker,
      issuer: it.displayName ?? it.companyName ?? ticker,
      listingDate: date,
      currency: "AUD",
      proceedsUsd: null,
      sector: it.industryGroupName ?? null,
      sourceUrl: "https://www2.asx.com.au/listings/upcoming-floats-and-listings",
      source: "asx",
    });
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────────
// 8. HKEX (HKEXnews New Listing announcements)
// ──────────────────────────────────────────────────────────────────────

export async function fetchHkexIpos(daysBack: number): Promise<IpoEvent[]> {
  // HKEXnews exposes a title-search servlet. t1code=40000 is the
  // "Listing-Related Information" category; t2code=40100 narrows to
  // "Allotment Results / Trading Arrangements" which proxies for new
  // listings reliably.
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - daysBack);
  const fmt = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
  const url =
    `https://www1.hkexnews.hk/search/titleSearchServlet.do?` +
    `sortDir=0&sortByOptions=DateTime&category=0&market=SEHK&searchType=1` +
    `&documentType=-1&t1code=40000&t2Gcode=-2&t2code=40100&rowRange=200` +
    `&from=${fmt(start)}&to=${fmt(end)}&lang=EN`;
  let body: string;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": politeUserAgent(), Accept: "*/*" },
      ...CACHE_OPTS,
    });
    if (!res.ok) return [];
    body = await res.text();
  } catch {
    return [];
  }
  // The servlet returns a JSON-looking payload wrapped in a `result`
  // string. Extract rows defensively.
  const out: IpoEvent[] = [];
  const rowRe =
    /"DATE_TIME":"([^"]+)"[^{}]*?"STOCK_CODE":"(\d{1,5})"[^{}]*?"STOCK_NAME":"([^"]+)"/g;
  let m: RegExpExecArray | null;
  const seen = new Set<string>();
  while ((m = rowRe.exec(body))) {
    const date = toIsoDate(m[1]);
    const ticker = m[2].padStart(4, "0");
    const issuer = m[3];
    if (!date) continue;
    const key = `${ticker}|${date}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      exchangeMic: "XHKG",
      ticker,
      issuer,
      listingDate: date,
      currency: "HKD",
      proceedsUsd: null,
      sector: null,
      sourceUrl: "https://www1.hkexnews.hk/",
      source: "hkex",
    });
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────────
// 9. JPX / Tokyo Stock Exchange
// ──────────────────────────────────────────────────────────────────────

export async function fetchJpxIpos(): Promise<IpoEvent[]> {
  // English-language new-listings index. JPX renders a year-grouped
  // table with date / code / company / market segment. The page is
  // static, so a daily cache is plenty.
  const url = "https://www.jpx.co.jp/english/listing/stocks/new/index.html";
  let html: string;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": politeUserAgent(), Accept: "text/html" },
      ...CACHE_OPTS,
    });
    if (!res.ok) return [];
    html = await res.text();
  } catch {
    return [];
  }
  const out: IpoEvent[] = [];
  for (const cells of parseHtmlTableRows(html)) {
    if (cells.length < 3) continue;
    let date: string | null = null;
    let ticker = "";
    let issuer = "";
    for (const c of cells) {
      if (!date) {
        const iso = toIsoDate(c);
        if (iso) {
          date = iso;
          continue;
        }
      }
      if (!ticker && /^\d{4}$/.test(c)) ticker = c;
      else if (!issuer && /[A-Za-z]{3,}/.test(c)) issuer = c;
    }
    if (!date || !ticker || !issuer) continue;
    out.push({
      exchangeMic: "XTKS",
      ticker,
      issuer,
      listingDate: date,
      currency: "JPY",
      proceedsUsd: null,
      sector: null,
      sourceUrl: url,
      source: "jpx",
    });
  }
  return out;
}
