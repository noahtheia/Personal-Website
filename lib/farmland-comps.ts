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
});

export type FarmlandFiling = z.infer<typeof FilingSchema>;

export type PricedFarmlandComp = FarmlandFiling & {
  price: number | null;
  currency: string;
  marketCapMM: number | null;
  evMM: number | null;
  evPerAcre: number | null;
  pNav: number | null;
  divYield: number | null;
  evCapRate: number | null;
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
      const quote = await fetchQuote(f.ticker);
      const price = quote?.price ?? null;
      const currency = quote?.currency ?? "USD";

      const marketCapMM = price !== null ? price * f.sharesOutMM : null;
      const evMM =
        marketCapMM !== null ? marketCapMM + f.debtMM - f.cashMM : null;
      // EV is in $M; acres in thousands → divide $M by k-acres → $/acre.
      const evPerAcre = evMM !== null ? (evMM / f.acresK) * 1000 : null;
      const pNav = price !== null ? price / f.navPerShare : null;
      const divYield =
        price !== null && price > 0 ? (f.annualDividend / price) * 100 : null;
      const evCapRate =
        evMM !== null && evMM > 0 ? (f.annualNoiMM / evMM) * 100 : null;

      return {
        ...f,
        price,
        currency,
        marketCapMM,
        evMM,
        evPerAcre,
        pNav,
        divYield,
        evCapRate,
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
      next: { revalidate: 3600 }, // 1 hour — exceeds the daily-refresh requirement.
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
