import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

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
]);
type Currency = z.infer<typeof CurrencySchema>;

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
  primaryCrops: z.string(),
  filingDate: z.string(),
  filingUrl: z.string().url().optional(),
  // All financial inputs are denominated in `currency` (filing currency).
  sharesOutMM: z.number().positive(),
  debtMM: z.number().nonnegative(),
  cashMM: z.number().nonnegative(),
  acresK: z.number().positive(),
  navPerShare: z.number().positive(),
  annualDividend: z.number().nonnegative(),
  annualNoiMM: z.number().nonnegative(),
  annualRevenueMM: z.number().nonnegative(),
  annualEbitdaMM: z.number(),
  epsTTM: z.number(),
  bookLandMM: z.number().positive(),
  marketLandMM: z.number().positive().optional(),
});

export type FarmlandFiling = z.infer<typeof FilingSchema>;

export type PricedFarmlandComp = FarmlandFiling & {
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

  // Earnings value (these override the local-currency filing fields).
  annualRevenueMM: number;
  annualEbitdaMM: number;
  ebitdaMargin: number | null;
  evEbitda: number | null;
  priceSales: number | null;
  priceEarnings: number | null;
  evCapRate: number | null;
  divYield: number | null;

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
      const evPerAcreLocal =
        evLocal !== null ? (evLocal / f.acresK) * 1000 : null;
      const bookPerAcreLocal = (f.bookLandMM / f.acresK) * 1000;
      const marketPerAcreLocal =
        f.marketLandMM !== undefined
          ? (f.marketLandMM / f.acresK) * 1000
          : null;

      // Dimensionless ratios — computed in filing currency for correctness
      // (price has been translated into filing currency above).
      const pNav =
        priceInFiling !== null ? priceInFiling / f.navPerShare : null;
      const divYield =
        priceInFiling !== null && priceInFiling > 0
          ? (f.annualDividend / priceInFiling) * 100
          : null;
      const evCapRate =
        evLocal !== null && evLocal > 0
          ? (f.annualNoiMM / evLocal) * 100
          : null;
      const ebitdaMargin =
        f.annualRevenueMM > 0
          ? (f.annualEbitdaMM / f.annualRevenueMM) * 100
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
        bookPerAcre: bookPerAcreLocal * fx,
        marketPerAcre:
          marketPerAcreLocal !== null ? marketPerAcreLocal * fx : null,
        evPerAcre: evPerAcreLocal !== null ? evPerAcreLocal * fx : null,
        annualRevenueMM: f.annualRevenueMM * fx,
        annualEbitdaMM: f.annualEbitdaMM * fx,
        // Dimensionless multiples — passed through
        pNav,
        ebitdaMargin,
        evEbitda,
        priceSales,
        priceEarnings,
        evCapRate,
        divYield,
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
