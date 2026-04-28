import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

const TargetSchema = z.object({
  ticker: z.string(),
  name: z.string(),
  target: z.number().positive(),
  side: z.enum(["long", "short"]).default("long"),
  thesisDate: z.string(),
  postSlug: z.string().optional(),
  notes: z.string().optional(),
});

export type Target = z.infer<typeof TargetSchema>;

export type PricedTarget = Target & {
  lastPrice: number | null;
  currency: string;
  impliedReturn: number | null;
  fetchedAt: string;
};

const TARGETS_FILE = path.join(process.cwd(), "content", "targets.json");

export function getTargets(): Target[] {
  if (!fs.existsSync(TARGETS_FILE)) return [];
  const raw = JSON.parse(fs.readFileSync(TARGETS_FILE, "utf8"));
  return z.array(TargetSchema).parse(raw);
}

export async function getPricedTargets(): Promise<PricedTarget[]> {
  const targets = getTargets();
  const fetchedAt = new Date().toISOString();

  const priced = await Promise.all(
    targets.map(async (t): Promise<PricedTarget> => {
      const quote = await fetchQuote(t.ticker);
      const lastPrice = quote?.price ?? null;
      const currency = quote?.currency ?? "USD";
      const impliedReturn =
        lastPrice !== null ? ((t.target - lastPrice) / lastPrice) * 100 : null;
      return { ...t, lastPrice, currency, impliedReturn, fetchedAt };
    }),
  );

  return priced;
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
      next: { revalidate: 900 }, // 15 minutes
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

export function formatCurrency(value: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

export function formatImplied(pct: number): string {
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}
