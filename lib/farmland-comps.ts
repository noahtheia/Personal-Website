import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import {
  getPropertyDetail,
  totalFmvMM,
} from "./farmland-properties";

const CurrencySchema = z.enum([
  "USD",
  "BRL",
  "AUD",
  "EUR",
  "GBP",
  "PLN",
  "MYR",
  "SAR",
  "KES",
  "IDR",
  "SGD",
  "NZD",
  "THB",
  "NOK",
  "DKK",
  "HKD",
  "CNY",
  "INR",
  "VND",
  "ZAR",
  "PHP",
  "ARS",
  "MXN",
  "EGP",
  "CHF",
  "NGN",
]);
type Currency = z.infer<typeof CurrencySchema>;

const SectorSchema = z.enum([
  "Farmland Owner / REIT",
  "Integrated Farm Operator",
  "Plantation Operator",
  "Pastoral / Livestock",
  "Diversified Agribusiness",
  "Protein Producer",
  "Dairy / Egg Producer",
  "Aquaculture / Seafood",
  "Agribusiness / Trader",
  "Crop Inputs / Fertilizer",
  "Rural Services",
]);
type Sector = z.infer<typeof SectorSchema>;

const GeographySchema = z.enum([
  "US",
  "Canada",
  "Mexico",
  "Brazil",
  "Argentina",
  "UK",
  "EU",
  "Norway",
  "Switzerland",
  "Poland",
  "Ukraine",
  "Australia",
  "New Zealand",
  "Malaysia",
  "Indonesia",
  "Singapore",
  "Thailand",
  "Vietnam",
  "Philippines",
  "China",
  "Hong Kong",
  "India",
  "Saudi Arabia",
  "Egypt",
  "Kenya",
  "South Africa",
  "Nigeria",
]);
type Geography = z.infer<typeof GeographySchema>;

const FilingSchema = z.object({
  ticker: z.string(),
  name: z.string(),
  // Reporting / filing currency for all financial inputs below.
  currency: CurrencySchema.default("USD"),
  // Listing currency that Yahoo returns for the live quote. Most issuers
  // list and report in the same currency (so this is omitted), but a few
  // do not — e.g. MP Evans reports in USD but lists on LSE in GBp/GBP,
  // and Astarta reports in EUR but lists in Warsaw in PLN.
  priceCurrency: CurrencySchema.optional(),
  // Sector drives the section bands in the comps table. `geography`
  // = exchange country (where the security lists). `operatingCountry`
  // = where the company's primary assets/operations sit. Often the
  // same, but for ag operators that list in London/Warsaw/NYSE while
  // operating in Ukraine, Indonesia, or Argentina, they diverge — the
  // table shows both as adjacent columns.
  sector: SectorSchema,
  geography: GeographySchema,
  operatingCountry: GeographySchema.optional(),
  primaryCrops: z.string(),
  filingDate: z.string(),
  filingUrl: z.string().url().optional(),
  // All financial inputs are denominated in `currency` (filing currency).
  sharesOutMM: z.number().positive(),
  debtMM: z.number().nonnegative(),
  cashMM: z.number().nonnegative(),
  // Operated / managed acres. Optional for non-land-owners (protein
  // processors, fertilizer producers, agribusiness traders) where the
  // metric isn't meaningful.
  acresK: z.number().nonnegative().optional(),
  navPerShare: z.number().positive().optional(),
  annualDividend: z.number().nonnegative(),
  annualNoiMM: z.number().nonnegative(),
  annualRevenueMM: z.number().nonnegative(),
  annualEbitdaMM: z.number(),
  // Optional — net income is back-fillable from the per-ticker
  // financials file (latest FY netIncomeMM). Allowed to be negative
  // (loss-making issuers) or undefined (data gap).
  annualNetIncomeMM: z.number().optional(),
  // Optional — free cash flow (CFO − capex). Few ag issuers
  // disclose cleanly; null when not available.
  annualFcfMM: z.number().optional(),
  // Optional — total shareholders' equity (book value), used to
  // derive ROE and ROIC. When absent, downstream ratios fall back
  // to navPerShare × sharesOut as an approximation.
  annualEquityMM: z.number().optional(),
  epsTTM: z.number(),
  // Book value of property/land. Optional for issuers that don't carry
  // significant land on the balance sheet (processors, traders).
  bookLandMM: z.number().nonnegative().optional(),
  marketLandMM: z.number().positive().optional(),
});

export type FarmlandFiling = z.infer<typeof FilingSchema>;
export type FarmlandSector = Sector;
export type FarmlandGeography = Geography;

export type PricedFarmlandComp = Omit<
  FarmlandFiling,
  "annualNetIncomeMM" | "annualFcfMM" | "annualEquityMM"
> & {
  // Live local-currency price (raw Yahoo quote).
  localPrice: number | null;

  // Output overrides: every absolute-$ field below is USD-equivalent.
  // (FarmlandFiling spreads in first; we overwrite same-named fields.)
  price: number | null;
  marketCapMM: number | null;
  netDebtMM: number;
  evMM: number | null;

  // Land value
  bookPerAcre: number | null;
  marketPerAcre: number | null;
  evPerAcre: number | null;
  pNav: number | null;
  // FMV NAV/share in USD — derived from each issuer's detail page.
  // Total FMV from detail (filing-currency) − net debt, divided by
  // shares, then translated to USD. Null if no detail file exists.
  fmvNavPerShareUsd: number | null;

  // Earnings value (these override the local-currency filing fields).
  annualRevenueMM: number;
  annualEbitdaMM: number;
  annualNetIncomeMM: number | null;
  annualFcfMM: number | null;
  annualEquityMM: number | null;
  ebitdaMargin: number | null;
  netIncomeMargin: number | null;
  roe: number | null;
  roic: number | null;
  evEbitda: number | null;
  priceSales: number | null;
  priceEarnings: number | null;
  evCapRate: number | null;
  divYield: number | null;
  fcfYield: number | null;

  fxToUsd: number;
  fetchedAt: string;
};

const COMPS_FILE = path.join(process.cwd(), "content", "farmland-comps.json");

export function getFilings(): FarmlandFiling[] {
  if (!fs.existsSync(COMPS_FILE)) return [];
  const raw = JSON.parse(fs.readFileSync(COMPS_FILE, "utf8"));
  return z.array(FilingSchema).parse(raw);
}

export async function getPricedFarmlandComps(): Promise<PricedFarmlandComp[]> {
  const filings = getFilings();
  const fetchedAt = new Date().toISOString();

  // Resolve all unique non-USD currencies (filing OR price) once per render.
  const currencies = Array.from(
    new Set(
      filings.flatMap((f) => [f.currency, f.priceCurrency ?? f.currency]),
    ),
  ).filter((c) => c !== "USD");
  const fxEntries = await Promise.all(
    currencies.map(async (c) => [c, await fetchFxToUsd(c)] as const),
  );
  const fxMap = new Map<Currency, number>([
    ["USD", 1],
    ...fxEntries.map(([c, v]) => [c, v ?? 0] as [Currency, number]),
  ]);

  return Promise.all(
    filings.map(async (f): Promise<PricedFarmlandComp> => {
      const fx = fxMap.get(f.currency) ?? 1;
      const priceCcy = f.priceCurrency ?? f.currency;
      const priceFx = fxMap.get(priceCcy) ?? 1;
      const q = await fetchQuote(f.ticker);
      // Yahoo returns the quote in `priceCcy`. For comp math we want it in
      // the filing currency. Cross via USD: priceFiling = priceLocal × priceFx ÷ filingFx.
      const yahooPrice = q?.price ?? null;
      const priceInFiling =
        yahooPrice !== null && fx > 0
          ? yahooPrice * (priceFx / fx)
          : null;
      // For display we keep the live local quote separately.
      const localPrice = yahooPrice;

      // All intermediate calcs done in filing currency; USD conversion at the
      // end (only for absolute-$ values — multiples are dimensionless).
      const netDebtLocal = f.debtMM - f.cashMM;
      const marketCapLocal =
        priceInFiling !== null ? priceInFiling * f.sharesOutMM : null;
      const evLocal =
        marketCapLocal !== null ? marketCapLocal + netDebtLocal : null;
      // Per-acre metrics only meaningful when issuer owns/operates land.
      const acresK = f.acresK ?? 0;
      const evPerAcreLocal =
        evLocal !== null && acresK > 0 ? (evLocal / acresK) * 1000 : null;
      const bookPerAcreLocal =
        f.bookLandMM !== undefined && acresK > 0
          ? (f.bookLandMM / acresK) * 1000
          : null;
      // Market / Acre uses the total FMV from the detail page (matching the
      // 'Aggregate FMV' card on the individual ticker page) divided by the
      // comps-file acresK. This includes industrial / water / plasma rows
      // that contribute to the FMV total but not to per-acre denominators
      // on the detail page itself, so the resulting per-acre is on a
      // 'enterprise-equivalent per land acre' basis (consistent with how
      // FMV NAV is computed: totalFmvMM − net debt). Falls back to a
      // static marketLandMM where the detail page hasn't been compiled.
      const detail = getPropertyDetail(f.ticker);
      const detailFmvLocal = detail ? totalFmvMM(detail) : null;
      const marketPerAcreLocal =
        detailFmvLocal !== null && acresK > 0
          ? (detailFmvLocal / acresK) * 1000
          : f.marketLandMM !== undefined && acresK > 0
          ? (f.marketLandMM / acresK) * 1000
          : null;

      // FMV NAV per share (filing currency): subtract net debt from the
      // detail-page total FMV (already loaded above for Market/Acre), divide
      // by shares. Used both for P/NAV (multiplier) and the USD-translated
      // FMV NAV/sh display column. Null if no detail file or non-positive.
      const fmvNavLocal =
        detailFmvLocal !== null ? detailFmvLocal - netDebtLocal : null;
      const fmvNavPerShareLocal =
        fmvNavLocal !== null && fmvNavLocal > 0 && f.sharesOutMM > 0
          ? fmvNavLocal / f.sharesOutMM
          : null;
      const fmvNavPerShareUsd =
        fmvNavPerShareLocal !== null ? fmvNavPerShareLocal * fx : null;

      // Dimensionless ratios — computed in filing currency for correctness
      // (price has been translated into filing currency above).
      // P/NAV uses the detail-page FMV NAV when available (the bottoms-up
      // mark from each issuer's per-property valuation); falls back to book
      // NAV from the comps file for issuers without a detail page.
      const navPerShareForPNav =
        fmvNavPerShareLocal !== null
          ? fmvNavPerShareLocal
          : f.navPerShare ?? null;
      const pNav =
        priceInFiling !== null &&
        navPerShareForPNav !== null &&
        navPerShareForPNav > 0
          ? priceInFiling / navPerShareForPNav
          : null;
      const divYield =
        priceInFiling !== null && priceInFiling > 0
          ? (f.annualDividend / priceInFiling) * 100
          : null;
      // Cap rate is only a meaningful metric for issuers whose
      // productive asset is land they own — REITs, integrated farm
      // operators, plantation operators, pastoral/livestock outfits.
      // For processors / traders / aquaculture / crop-inputs, NOI ÷
      // EV is just an EBITDA-yield proxy and would mislead readers
      // who expect a real-estate-style cap rate.
      const LAND_OWNING_SECTORS: ReadonlySet<Sector> = new Set([
        "Farmland Owner / REIT",
        "Integrated Farm Operator",
        "Plantation Operator",
        "Pastoral / Livestock",
      ]);
      const isLandOwner = LAND_OWNING_SECTORS.has(f.sector);
      const evCapRate =
        isLandOwner &&
        evLocal !== null &&
        evLocal > 0 &&
        f.annualNoiMM > 0
          ? (f.annualNoiMM / evLocal) * 100
          : null;
      const ebitdaMargin =
        f.annualRevenueMM > 0
          ? (f.annualEbitdaMM / f.annualRevenueMM) * 100
          : null;
      // Net income — prefer the explicit field; fall back to
      // epsTTM × sharesOut where the seed file hasn't been backfilled.
      const annualNetIncomeMMLocal =
        f.annualNetIncomeMM !== undefined
          ? f.annualNetIncomeMM
          : Number.isFinite(f.epsTTM) && f.sharesOutMM > 0
          ? f.epsTTM * f.sharesOutMM
          : null;
      const netIncomeMargin =
        annualNetIncomeMMLocal !== null && f.annualRevenueMM > 0
          ? (annualNetIncomeMMLocal / f.annualRevenueMM) * 100
          : null;
      const evEbitda =
        evLocal !== null && f.annualEbitdaMM > 0
          ? evLocal / f.annualEbitdaMM
          : null;
      const priceSales =
        marketCapLocal !== null && f.annualRevenueMM > 0
          ? marketCapLocal / f.annualRevenueMM
          : null;
      const priceEarnings =
        priceInFiling !== null && f.epsTTM > 0
          ? priceInFiling / f.epsTTM
          : null;
      // FCF yield = annual FCF ÷ market cap × 100. Both in local
      // (filing) currency for correctness.
      const fcfYield =
        f.annualFcfMM !== undefined &&
        marketCapLocal !== null &&
        marketCapLocal > 0
          ? (f.annualFcfMM / marketCapLocal) * 100
          : null;
      // Shareholders' equity — prefer the explicit field; fall back
      // to navPerShare × sharesOutMM (book/NAV per share × shares).
      const equityLocal =
        f.annualEquityMM !== undefined
          ? f.annualEquityMM
          : f.navPerShare !== undefined && f.navPerShare > 0
          ? f.navPerShare * f.sharesOutMM
          : null;
      const roe =
        annualNetIncomeMMLocal !== null && equityLocal !== null && equityLocal > 0
          ? (annualNetIncomeMMLocal / equityLocal) * 100
          : null;
      // ROIC ≈ NI ÷ (Equity + Net Debt). Simple invested-capital
      // proxy without splitting out NOPAT (most ag P&Ls don't break
      // out interest cleanly enough to bother).
      const investedCapital =
        equityLocal !== null ? equityLocal + netDebtLocal : null;
      const roic =
        annualNetIncomeMMLocal !== null &&
        investedCapital !== null &&
        investedCapital > 0
          ? (annualNetIncomeMMLocal / investedCapital) * 100
          : null;

      return {
        ...f,
        localPrice,
        // USD-converted absolute $ values. Stock Price uses priceCcy → USD;
        // everything else has been computed in filing currency, so use
        // filingCcy → USD.
        price: localPrice !== null ? localPrice * priceFx : null,
        marketCapMM: marketCapLocal !== null ? marketCapLocal * fx : null,
        netDebtMM: netDebtLocal * fx,
        evMM: evLocal !== null ? evLocal * fx : null,
        bookPerAcre: bookPerAcreLocal !== null ? bookPerAcreLocal * fx : null,
        marketPerAcre:
          marketPerAcreLocal !== null ? marketPerAcreLocal * fx : null,
        evPerAcre: evPerAcreLocal !== null ? evPerAcreLocal * fx : null,
        annualRevenueMM: f.annualRevenueMM * fx,
        annualEbitdaMM: f.annualEbitdaMM * fx,
        annualNetIncomeMM:
          annualNetIncomeMMLocal !== null
            ? annualNetIncomeMMLocal * fx
            : null,
        annualFcfMM:
          f.annualFcfMM !== undefined ? f.annualFcfMM * fx : null,
        annualEquityMM: equityLocal !== null ? equityLocal * fx : null,
        // Dimensionless multiples — passed through
        pNav,
        fmvNavPerShareUsd,
        ebitdaMargin,
        netIncomeMargin,
        roe,
        roic,
        evEbitda,
        priceSales,
        priceEarnings,
        evCapRate,
        divYield,
        fcfYield,
        fxToUsd: fx,
        fetchedAt,
      };
    }),
  );
}

async function fetchQuote(
  ticker: string,
): Promise<{ price: number; currency: string } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      ticker,
    )}?interval=1d&range=1d`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; PersonalBlog/1.0; +https://noahsideas.com)",
        Accept: "application/json",
      },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    let price = meta?.regularMarketPrice;
    if (typeof price !== "number") return null;
    let currency = typeof meta?.currency === "string" ? meta.currency : "USD";
    // LSE quotes come back in pence (GBp). Normalize to pounds.
    if (currency === "GBp" || currency === "GBX") {
      price = price / 100;
      currency = "GBP";
    }
    return { price, currency };
  } catch {
    return null;
  }
}

async function fetchFxToUsd(currency: Currency): Promise<number | null> {
  if (currency === "USD") return 1;
  // Yahoo's FX symbol convention: <BASE><QUOTE>=X. We want USD per local unit.
  const symbol = `${currency}USD=X`;
  const q = await fetchQuote(symbol);
  return q?.price ?? null;
}
