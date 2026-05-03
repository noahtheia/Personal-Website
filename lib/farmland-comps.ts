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

  // Market data
  marketCapMM: number | null;
  evMM: number | null;
  pctOf52wHigh: number | null;
  pctOf52wLow: number | null;
  ytdReturn: number | null;
  threeMReturn: number | null;
  twelveMReturn: number | null;

  // Valuation multiples
  evPerAcre: number | null;
  pNav: number | null;
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
      const q = await fetchPriceData(f.ticker);
      const price = q?.price ?? null;
      const currency = q?.currency ?? "USD";

      const marketCapMM = price !== null ? price * f.sharesOutMM : null;
      const evMM =
        marketCapMM !== null ? marketCapMM + f.debtMM - f.cashMM : null;
      // EV $M / acres-thousands → $/acre.
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
        pctOf52wHigh: q?.pctOf52wHigh ?? null,
        pctOf52wLow: q?.pctOf52wLow ?? null,
        ytdReturn: q?.ytdReturn ?? null,
        threeMReturn: q?.threeMReturn ?? null,
        twelveMReturn: q?.twelveMReturn ?? null,
        evPerAcre,
        pNav,
        evCapRate,
        divYield,
        fetchedAt,
      };
    }),
  );
}

type PriceData = {
  price: number;
  currency: string;
  pctOf52wHigh: number | null;
  pctOf52wLow: number | null;
  ytdReturn: number | null;
  threeMReturn: number | null;
  twelveMReturn: number | null;
};

async function fetchPriceData(ticker: string): Promise<PriceData | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      ticker,
    )}?interval=1d&range=1y`;
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
    const result = data?.chart?.result?.[0];
    if (!result) return null;
    const meta = result.meta ?? {};
    const ts: number[] = result.timestamp ?? [];
    const closes: (number | null)[] =
      result.indicators?.quote?.[0]?.close ?? [];

    const series = ts
      .map((t, i) => ({ t, c: closes[i] }))
      .filter((d): d is { t: number; c: number } => typeof d.c === "number");

    const livePrice =
      typeof meta.regularMarketPrice === "number"
        ? meta.regularMarketPrice
        : series[series.length - 1]?.c;
    if (typeof livePrice !== "number") return null;

    const currency = typeof meta.currency === "string" ? meta.currency : "USD";

    const high =
      typeof meta.fiftyTwoWeekHigh === "number"
        ? meta.fiftyTwoWeekHigh
        : series.length
        ? Math.max(...series.map((d) => d.c))
        : null;
    const low =
      typeof meta.fiftyTwoWeekLow === "number"
        ? meta.fiftyTwoWeekLow
        : series.length
        ? Math.min(...series.map((d) => d.c))
        : null;

    const findClose = (cutoff: number) =>
      series.find((d) => d.t >= cutoff)?.c ?? null;

    const lastT = series[series.length - 1]?.t ?? Math.floor(Date.now() / 1000);
    const lastDate = new Date(lastT * 1000);
    const yearStart =
      Date.UTC(lastDate.getUTCFullYear(), 0, 1) / 1000;
    const threeMAgo = lastT - 90 * 86400;
    const twelveMAgo = lastT - 365 * 86400;

    const pctChange = (ref: number | null) =>
      ref !== null && ref > 0 ? ((livePrice - ref) / ref) * 100 : null;

    return {
      price: livePrice,
      currency,
      pctOf52wHigh: high && high > 0 ? (livePrice / high) * 100 : null,
      pctOf52wLow: low && low > 0 ? (livePrice / low) * 100 : null,
      ytdReturn: pctChange(findClose(yearStart)),
      threeMReturn: pctChange(findClose(threeMAgo)),
      twelveMReturn: pctChange(findClose(twelveMAgo)),
    };
  } catch {
    return null;
  }
}
