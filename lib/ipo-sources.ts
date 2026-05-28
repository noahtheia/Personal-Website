// Fetchers for IPO event data. All sources are free and pulled
// directly from the issuing exchange or its national regulator — no
// third-party aggregators:
//
//   1. SEC EDGAR (US regulator) — 424B4 / 424B3 final-prospectus
//      filings, enriched with `company_tickers_exchange.json` for
//      venue attribution. Authoritative US coverage.
//   2. Yahoo Finance IPO calendar — best-effort fallback for some
//      non-US listings when Yahoo's page schema allows extraction.
//   3. JPX/TSE — English new-listings page for Tokyo.
//   4. HKEX (Main Board + GEM) — HKEXnews dedicated new-listings
//      static HTML page.
//   5. BME (Spain) — official equities-regulation RSS feed; filter
//      for "Initial trading" (English) / "PRIMERA ADMISIÓN" entries.
//   6. CVM (Brazil regulator) — `cad_cia_aberta.csv` open-data file;
//      filter on registration date (DT_REG) and market type
//      (TP_MERC = "Bolsa") to identify recent IPOs on B3.
//
// Every fetcher wraps its network calls with Next's Data Cache
// (`next: { revalidate: 86400, tags: ["ipos"] }`) so the daily cron at
// /api/refresh-ipos can prime the cache without writing files —
// identical to the price-refresh pattern in /api/refresh-prices.
// Every fetcher swallows errors and returns [] so one bad source
// can't take down the orchestrator.
//
// Additional direct-from-exchange adapters were explored (ESMA,
// Euronext, LSE, TMX, ASX, FCA NSM, JSE, NSE India, SGX, TWSE,
// Bursa Malaysia, IDX, TASE, KAP Turkey) but their endpoints either
// 404, are gated behind paid feeds, return 403 to non-residential IPs
// (Akamai/Imperva/Cloudflare), or render via JavaScript-only SPAs.
// The `SOURCES` array in lib/exchange-ipos.ts is the single integration
// point — adding a new source is a one-line change once a working
// endpoint is found.

import { resolveMicFromLabel } from "@/lib/exchanges-reference";

export type IpoSource =
  | "sec"
  | "yahoo"
  | "jpx"
  | "hkex"
  | "bme"
  | "cvm";

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
// 3. JPX / Tokyo Stock Exchange (English new-listings page)
// ──────────────────────────────────────────────────────────────────────
//
// JPX renders new listings in a two-row-per-listing HTML table:
//
//   Row 1 (rowspan=2 on date + issuer):
//     [Listing Date | Issuer Name | Code | PDF | PDF | (range) | Shares | Unit]
//   Row 2:
//     [Market Segment | PDF | PDF | Offering Price | Secondary | Earnings]
//
// Codes are 4-char alphanumeric in the modern JPX scheme (e.g. "589A"),
// not always pure 4-digit. The listing date cell often contains the
// approval date in parentheses: "Jun. 30, 2026\n(May 27, 2026)" — we
// strip the parenthesised portion before parsing.

const JPX_CODE_RE = /^\d{3,4}[A-Z]?$/;
const JPX_PAREN_RE = /\s*\([^)]*\)\s*$/;

export async function fetchJpxIpos(): Promise<IpoEvent[]> {
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
  const seen = new Set<string>();
  for (const cells of parseHtmlTableRows(html)) {
    if (cells.length < 3) continue;
    let date: string | null = null;
    let ticker = "";
    let issuer = "";
    for (const c of cells) {
      if (!date) {
        const stripped = c.replace(JPX_PAREN_RE, "").trim();
        const iso = toIsoDate(stripped);
        if (iso) {
          date = iso;
          continue;
        }
      }
      if (!ticker && JPX_CODE_RE.test(c)) {
        ticker = c;
        continue;
      }
      // Issuer is the longest text-bearing cell that isn't the date
      // or ticker. Prefer the first hit but fall back to length on
      // ambiguity — the JPX layout always puts it before the code.
      if (
        !issuer &&
        c.length >= 3 &&
        /[A-Za-z]{3,}/.test(c) &&
        !JPX_CODE_RE.test(c) &&
        !/^[A-Z]{1,3}$/.test(c) // skip "Growth" / "Prime" market labels
      ) {
        issuer = c;
      }
    }
    if (!date || !ticker || !issuer) continue;
    const key = `${ticker}|${date}`;
    if (seen.has(key)) continue;
    seen.add(key);
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

// ──────────────────────────────────────────────────────────────────────
// 4. HKEX — Main Board + GEM dedicated new-listings pages
// ──────────────────────────────────────────────────────────────────────
//
// HKEXnews publishes a static HTML page per market segment listing
// every recent IPO with stock code, issuer, and PDF links to the
// announcement / prospectus / allotment results. The PDF URLs embed
// the announcement date (`/sehk/YYYY/MMDD/...pdf`), which we use as
// the listing date proxy. Both pages share the same table layout.

const HKEX_PAGES: { url: string; market: string }[] = [
  {
    url: "https://www2.hkexnews.hk/New-Listings/New-Listing-Information/Main-Board?sc_lang=en",
    market: "Main Board",
  },
  {
    url: "https://www2.hkexnews.hk/New-Listings/New-Listing-Information/GEM?sc_lang=en",
    market: "GEM",
  },
];

const HKEX_PDF_DATE_RE = /\/sehk\/(\d{4})\/(\d{2})(\d{2})\//;

export async function fetchHkexIpos(): Promise<IpoEvent[]> {
  const out: IpoEvent[] = [];
  const seen = new Set<string>();
  for (const { url, market } of HKEX_PAGES) {
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
    // Each <tr> in the data table is one IPO: [code, name, ann pdf,
    // prospectus pdf, allotment pdf]. We use the row's first PDF href
    // to derive a listing date.
    const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch: RegExpExecArray | null;
    while ((rowMatch = rowRe.exec(html))) {
      const block = rowMatch[1];
      // Skip header rows (no <td>).
      if (!/<td/i.test(block)) continue;
      const cells: string[] = [];
      const cellRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      let c: RegExpExecArray | null;
      while ((c = cellRe.exec(block))) cells.push(c[1]);
      if (cells.length < 2) continue;
      const ticker = cells[0]
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/g, " ")
        .trim();
      const issuer = cells[1]
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&ndash;/g, "–")
        .replace(/&#\d+;/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (!/^\d{1,5}$/.test(ticker) || !issuer) continue;
      // Find the earliest PDF date in the row's hrefs.
      let date: string | null = null;
      const hrefRe = /href=["']([^"']+\.pdf)["']/gi;
      let h: RegExpExecArray | null;
      while ((h = hrefRe.exec(block))) {
        const m = h[1].match(HKEX_PDF_DATE_RE);
        if (m) {
          const candidate = `${m[1]}-${m[2]}-${m[3]}`;
          if (!date || candidate < date) date = candidate;
        }
      }
      if (!date) continue;
      const padded = ticker.padStart(4, "0");
      const key = `${padded}|${date}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        exchangeMic: "XHKG",
        ticker: padded,
        issuer,
        listingDate: date,
        currency: "HKD",
        proceedsUsd: null,
        sector: market,
        sourceUrl: url,
        source: "hkex",
      });
    }
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────────
// 5. BME (Spain) — equities regulation RSS feed
// ──────────────────────────────────────────────────────────────────────
//
// BME's official RSS at `/en/bme-exchange/regulation/equities.rss.xml`
// publishes regulation events. New IPOs appear as items titled
// "Initial trading of {Name} ({Ticker}) in the Spanish Stock Exchange…".
// We filter on that English phrase and extract the ticker from the
// parenthesised suffix.

const BME_ITEM_RE = /<item>([\s\S]*?)<\/item>/g;
const BME_TITLE_RE = /<title>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/title>/;
const BME_PUBDATE_RE = /<pubDate>([^<]+)<\/pubDate>/;
const BME_INITIAL_TRADING_RE =
  /Initial trading of\s+([^()]+?)\s*\(([A-Z0-9.]{1,8})\)/i;

export async function fetchBmeIpos(): Promise<IpoEvent[]> {
  const url =
    "https://www.bolsasymercados.es/en/bme-exchange/regulation/equities.rss.xml";
  let xml: string;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": politeUserAgent(),
        Accept: "application/rss+xml, application/xml, text/xml",
      },
      ...CACHE_OPTS,
    });
    if (!res.ok) return [];
    xml = await res.text();
  } catch {
    return [];
  }
  const out: IpoEvent[] = [];
  let m: RegExpExecArray | null;
  while ((m = BME_ITEM_RE.exec(xml))) {
    const item = m[1];
    const title = item.match(BME_TITLE_RE)?.[1] ?? "";
    const pubDate = item.match(BME_PUBDATE_RE)?.[1] ?? "";
    const initial = title.match(BME_INITIAL_TRADING_RE);
    if (!initial) continue;
    const issuer = initial[1].trim();
    const ticker = initial[2].trim();
    const date = toIsoDate(pubDate);
    if (!date || !ticker || !issuer) continue;
    out.push({
      exchangeMic: "XMAD",
      ticker,
      issuer,
      listingDate: date,
      currency: "EUR",
      proceedsUsd: null,
      sector: null,
      sourceUrl: url,
      source: "bme",
    });
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────────
// 6. CVM (Brazil regulator) — cad_cia_aberta.csv open data
// ──────────────────────────────────────────────────────────────────────
//
// CVM publishes a master CSV of every publicly-registered company in
// Brazil at `https://dados.cvm.gov.br/dados/CIA_ABERTA/CAD/DADOS/`.
// Columns of interest:
//   DT_REG     — date the issuer registered as a public company
//   DENOM_COMERC / DENOM_SOCIAL — trade and legal names
//   CD_CVM     — CVM identifier (used as ticker proxy; B3 trade codes
//                aren't in this file but can be cross-referenced later)
//   TP_MERC    — "Bolsa" filters to exchange-traded companies
//   SIT        — active situation; we keep "ATIVO" and "SUSPENSO" but
//                drop "CANCELADO" since cancellations aren't IPOs
//   CATEG_REG  — "Categoria A" means full equity registration
//
// File is Latin-1 (ISO-8859-1) encoded and uses ";" as the field
// separator. ~2.6k rows, ~1.5MB.

const CVM_CAD_URL =
  "https://dados.cvm.gov.br/dados/CIA_ABERTA/CAD/DADOS/cad_cia_aberta.csv";

function parseCsvLine(line: string): string[] {
  // The file has no embedded quotes or escaped semicolons in the
  // fields we care about (regulatory text uses commas, not ";"),
  // so a straight split is safe.
  return line.split(";");
}

function decodeLatin1(buf: ArrayBuffer): string {
  // Node 18+ has TextDecoder available in the global scope.
  return new TextDecoder("iso-8859-1").decode(buf);
}

export async function fetchCvmIpos(sinceISO: string): Promise<IpoEvent[]> {
  let body: string;
  try {
    const res = await fetch(CVM_CAD_URL, {
      headers: { "User-Agent": politeUserAgent(), Accept: "text/csv" },
      ...CACHE_OPTS,
    });
    if (!res.ok) return [];
    body = decodeLatin1(await res.arrayBuffer());
  } catch {
    return [];
  }
  const lines = body.split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = parseCsvLine(lines[0]);
  const idxDtReg = header.indexOf("DT_REG");
  const idxNameComerc = header.indexOf("DENOM_COMERC");
  const idxNameSocial = header.indexOf("DENOM_SOCIAL");
  const idxCdCvm = header.indexOf("CD_CVM");
  const idxTpMerc = header.indexOf("TP_MERC");
  const idxSit = header.indexOf("SIT");
  const idxCateg = header.indexOf("CATEG_REG");
  if (idxDtReg < 0 || idxCdCvm < 0) return [];

  const out: IpoEvent[] = [];
  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]);
    if (row.length < header.length - 2) continue;
    const dtReg = row[idxDtReg]?.trim();
    if (!dtReg || dtReg < sinceISO) continue;
    const tpMerc = row[idxTpMerc]?.toUpperCase() ?? "";
    if (tpMerc && !tpMerc.includes("BOLSA")) continue;
    const sit = row[idxSit]?.toUpperCase() ?? "";
    if (sit.includes("CANCELADO")) continue;
    const categ = row[idxCateg] ?? "";
    if (categ && !/categoria\s*a/i.test(categ)) continue;
    const cdCvm = row[idxCdCvm]?.trim();
    if (!cdCvm) continue;
    const issuer =
      (row[idxNameComerc]?.trim() || row[idxNameSocial]?.trim() || cdCvm).replace(
        /\s+/g,
        " ",
      );
    out.push({
      exchangeMic: "BVMF",
      ticker: cdCvm,
      issuer,
      listingDate: dtReg,
      currency: "BRL",
      proceedsUsd: null,
      sector: null,
      sourceUrl: CVM_CAD_URL,
      source: "cvm",
    });
  }
  return out;
}
