import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

const CurrencySchema = z.enum(["USD", "BRL", "AUD"]);
type Currency = z.infer<typeof CurrencySchema>;

const FilingSchema = z.object({
  ticker: z.string(),
  name: z.string(),
  currency: CurrencySchema.default("USD"),
  primaryCrops: z.string(),
  filingDate: z.string(),
  filingUrl: z.string().url().optional(),
  // All financial inputs are denominated in the issuer's listing currency.
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

  // Resolve unique non-USD currencies once per page render.
  const currencies = Array.from(
    new Set(filings.map((f) => f.currency).filter((c) => c !== "USD")),
  );
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
      const q = await fetchQuote(f.ticker);
      const localPrice = q?.price ?? null;

      // All intermediate calcs done in local currency; USD conversion at the
      // end (only for absolute-$ values — multiples are dimensionless).
      const netDebtLocal = f.debtMM - f.cashMM;
      const marketCapLocal =
        localPrice !== null ? localPrice * f.sharesOutMM : null;
      const evLocal =
        marketCapLocal !== null ? marketCapLocal + netDebtLocal : null;
      const evPerAcreLocal =
        evLocal !== null ? (evLocal / f.acresK) * 1000 : null;
      const bookPerAcreLocal = (f.bookLandMM / f.acresK) * 1000;
      const marketPerAcreLocal =
        f.marketLandMM !== undefined
          ? (f.marketLandMM / f.acresK) * 1000
          : null;

      // Dimensionless ratios — independent of FX.
      const pNav = localPrice !== null ? localPrice / f.navPerShare : null;
      const divYield =
        localPrice !== null && localPrice > 0
          ? (f.annualDividend / localPrice) * 100
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
        localPrice !== null && f.epsTTM > 0 ? localPrice / f.epsTTM : null;

      return {
        ...f,
        localPrice,
        // USD-converted absolute $ values
        price: localPrice !== null ? localPrice * fx : null,
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
    const price = meta?.regularMarketPrice;
    if (typeof price !== "number") return null;
    return {
      price,
      currency: typeof meta?.currency === "string" ? meta.currency : "USD",
    };
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
