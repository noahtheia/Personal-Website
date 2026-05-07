import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

// Insider Form 4 transactions per US-listed ticker, written by the
// insider-data agent (SEC EDGAR submissions API + Form 4 parser).
// File location: content/farmland-insiders/{TICKER}.json

const TransactionSchema = z.object({
  date: z.string(),
  insider: z.string(),
  title: z.string(),
  // High-level category: Buy / Sell / Option grant / Vest / Gift / Other
  type: z.string(),
  // Original Form 4 transaction code (P, S, M, A, F, G, etc.)
  code: z.string().optional(),
  shares: z.number(),
  direction: z.enum(["acquired", "disposed"]).optional(),
  pricePerShare: z.number().nullable().optional(),
  valueUSD: z.number().nullable().optional(),
  remainingShares: z.number().nullable().optional(),
  filingUrl: z.string().optional(),
});

const SummarySchema = z.object({
  ttmBuyValueUSD: z.number(),
  ttmSellValueUSD: z.number(),
  ttmNetUSD: z.number(),
  ttmInsiders: z.number(),
  lastTransactionDate: z.string().optional(),
  transactionCount: z.number().optional(),
});

const InsiderFileSchema = z.object({
  ticker: z.string(),
  cik: z.number().optional(),
  asOf: z.string(),
  transactions: z.array(TransactionSchema),
  summary: SummarySchema,
});

export type InsiderTransaction = z.infer<typeof TransactionSchema>;
export type InsiderSummary = z.infer<typeof SummarySchema>;
export type InsiderFile = z.infer<typeof InsiderFileSchema>;

const DIR = path.join(process.cwd(), "content", "farmland-insiders");

export function getInsiders(ticker: string): InsiderFile | null {
  const safe = ticker.replace(/[^a-zA-Z0-9._-]/g, "");
  const filePath = path.join(DIR, `${safe}.json`);
  if (!fs.existsSync(filePath)) return null;
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  return InsiderFileSchema.parse(raw);
}

export function getInsiderTickers(): string[] {
  if (!fs.existsSync(DIR)) return [];
  return fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""));
}
