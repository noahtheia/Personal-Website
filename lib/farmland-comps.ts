import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

const FilingSchema = z.object({
  ticker: z.string(),
  name: z.string(),
  primaryCrops: z.string(),
  filingDate: z.string(),
  filingUrl: z.string().url().optional(),
  sharesOutMM: z.number().positive(),
  debtMM: z.number().nonnegative(),
  cashMM: z.number().nonnegative(),
  acresK: z.number().positive(),
  navPerShare: z.number().positive(),
  annualDividend: z.number().nonnegative(),
  annualNoiMM: z.number().nonnegative(),
  annualRevenueMM: z.number().nonnegative(),
  annualEbitdaMM: z.number(), // can be negative
  epsTTM: z.number(), // can be negative
  // Total farmland on the balance sheet ($M).
  bookLandMM: z.number().positive(),
  // Third-party-appraised or comparable-market value of the portfolio
  // ($M). Optional — some issuers don't disclose a portfolio appraisal.
  marketLandMM: z.number().positive().optional(),
});

export type FarmlandFiling = z.infer<typeof FilingSchema>;

export type PricedFarmlandComp = FarmlandFiling & {
  price: number | null;
  currency: string;

  // Market data
  marketCapMM: number | null;
  netDebtMM: number;
  evMM: number | null;

  // Land value
  bookPerAcre: number | null;
  marketPerAcre: number | null;
  evPerAcre: number | null;
  pNav: number | null;

  // Earnings value
  annualRevenueMM: number;
  annualEbitdaMM: number;
  ebitdaMargin: number | null;
  evEbitda: number | null;
  priceSales: number | null;
  priceEarnings: number | null;
  evCapRate: number | null;
  divYield: number | null;

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

  return Promise.all(
    filings.map(async (f): Promise<PricedFarmlandComp> => {
      const q = await fetchQuote(f.ticker);
      const price = q?.price ?? null;
      const currency = q?.currency ?? "USD";

      const netDebtMM = f.debtMM - f.cashMM;
      const marketCapMM = price !== null ? price * f.sharesOutMM : null;
      const evMM = marketCapMM !== null ? marketCapMM + netDebtMM : null;
      // $M / k-acres → $/acre.
      const evPerAcre = evMM !== null ? (evMM / f.acresK) * 1000 : null;
      const bookPerAcre = (f.bookLandMM / f.acresK) * 1000;
      const marketPerAcre =
        f.marketLandMM !== undefined
          ? (f.marketLandMM / f.acresK) * 1000
          : null;
      const pNav = price !== null ? price / f.navPerShare : null;
      const divYield =
        price !== null && price > 0 ? (f.annualDividend / price) * 100 : null;
      const evCapRate =
        evMM !== null && evMM > 0 ? (f.annualNoiMM / evMM) * 100 : null;
      const ebitdaMargin =
        f.annualRevenueMM > 0
          ? (f.annualEbitdaMM / f.annualRevenueMM) * 100
          : null;
      const evEbitda =
        evMM !== null && f.annualEbitdaMM > 0 ? evMM / f.annualEbitdaMM : null;
      const priceSales =
        marketCapMM !== null && f.annualRevenueMM > 0
          ? marketCapMM / f.annualRevenueMM
          : null;
      const priceEarnings =
        price !== null && f.epsTTM > 0 ? price / f.epsTTM : null;

      return {
        ...f,
        price,
        currency,
        marketCapMM,
        netDebtMM,
        evMM,
        bookPerAcre,
        marketPerAcre,
        evPerAcre,
        pNav,
        ebitdaMargin,
        evEbitda,
        priceSales,
        priceEarnings,
        evCapRate,
        divYield,
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
