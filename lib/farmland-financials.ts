import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

// Manually-compiled historical financial data per issuer. Quarterly /
// annual periods, going back as far as each company's data is available.
//
// File location: content/farmland-financials/{TICKER}.json
//
// Schema is intentionally permissive — every metric except endDate +
// periodType is optional, so a partial backfill (e.g. only revenue +
// EBITDA, no balance sheet) still validates and renders.

const PeriodSchema = z.object({
  // ISO end date of the period (e.g. "2024-12-31" for Q4 2024).
  endDate: z.string(),
  // Period type. Q = fiscal quarter, FY = fiscal year, H = half-year,
  // LTM = trailing twelve months.
  periodType: z.enum(["Q", "FY", "H", "LTM"]),
  // ---- Income statement (filing-currency $ millions) ----
  // Gross revenue (before taxes/deductions). Useful for landlord-style
  // operators where the gross-to-net spread is just PIS/COFINS in Brazil
  // or VAT-equivalent elsewhere.
  grossRevenueMM: z.number().optional(),
  revenueMM: z.number().optional(),
  // Optional revenue breakdown by segment / product line. Keys are
  // free-form (e.g. "Lease income (SLC)", "Forestry", "Cattle sales") and
  // values are filing-currency $M for the period. Useful for operators
  // with multi-segment revenue (BrasilAgro, Adecoagro, etc.) — the
  // values should sum to revenueMM (or grossRevenueMM if pre-tax).
  revenueBySegmentMM: z.record(z.string(), z.number()).optional(),
  ebitdaMM: z.number().optional(),
  // Net Operating Income (REIT-style). For agribusiness operators
  // without a true REIT NOI line, can be left out.
  noiMM: z.number().optional(),
  netIncomeMM: z.number().optional(),
  // ---- Balance sheet (filing-currency $ millions) ----
  totalAssetsMM: z.number().optional(),
  totalDebtMM: z.number().optional(),
  cashMM: z.number().optional(),
  netDebtMM: z.number().optional(),
  totalEquityMM: z.number().optional(),
  // Property book / fair-value carrying amount (varies by reporting
  // basis — IFRS REITs carry at FV, US GAAP at depreciated cost).
  propertyBookMM: z.number().optional(),
  // Optional independent-appraisal mark when disclosed (e.g. SLC
  // Deloitte, AGRO Cushman, AAC LAWD, RFF directors').
  propertyFmvMM: z.number().optional(),
  // ---- Per share ----
  sharesOutMM: z.number().optional(),
  bookValuePerShare: z.number().optional(),
  navPerShare: z.number().optional(),
  fmvNavPerShare: z.number().optional(),
  epsBasic: z.number().optional(),
  epsDiluted: z.number().optional(),
  // ---- Operating ----
  totalAcresK: z.number().optional(),
  // ---- Dividends / distributions ----
  dividendPaidMM: z.number().optional(),
  dividendPerShare: z.number().optional(),
  // Free-form contextual note for the period (e.g. "Q3 24/25 reflects
  // El Meridiano disposition" for AGRO).
  notes: z.string().optional(),
});

const FinancialsSchema = z.object({
  ticker: z.string(),
  // Filing/reporting currency — should match the comps.json filing
  // currency for the same issuer.
  currency: z.string(),
  // Free-form notes about the source / methodology / coverage gaps.
  notes: z.string().optional(),
  // Source URL (annual report archive, IR page) for the data.
  sourceUrl: z.string().url().optional(),
  // Periods sorted ascending by endDate. The reader sorts on load.
  periods: z.array(PeriodSchema),
});

export type FinancialsPeriod = z.infer<typeof PeriodSchema>;
export type Financials = z.infer<typeof FinancialsSchema>;

const FINANCIALS_DIR = path.join(
  process.cwd(),
  "content",
  "farmland-financials",
);

export function getFinancials(ticker: string): Financials | null {
  const safe = ticker.replace(/[^a-zA-Z0-9._-]/g, "");
  const filePath = path.join(FINANCIALS_DIR, `${safe}.json`);
  if (!fs.existsSync(filePath)) return null;
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const parsed = FinancialsSchema.parse(raw);
  // Sort periods ascending by endDate for chart rendering.
  parsed.periods.sort((a, b) => a.endDate.localeCompare(b.endDate));
  return parsed;
}

export function getFinancialsTickers(): string[] {
  if (!fs.existsSync(FINANCIALS_DIR)) return [];
  return fs
    .readdirSync(FINANCIALS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""));
}
