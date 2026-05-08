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
  // Operating expense breakdown by category (e.g. "COGS", "G&A", "D&A",
  // "Other opex"). Values are POSITIVE filing-currency $M (the chart
  // renders them as negative segments below zero). Sum of these +
  // EBITDA should approximate net revenue.
  expensesBySegmentMM: z.record(z.string(), z.number()).optional(),
  // Optional revenue breakdown by geography (e.g. "Asia", "Europe",
  // "Americas", "Other" — or country-level "US", "Brazil", "China"...).
  // Values are filing-currency $M and should sum to revenueMM.
  // Sourced from segment-by-geography note in the latest 10-K / 20-F /
  // annual report.
  revenueByGeographyMM: z.record(z.string(), z.number()).optional(),
  ebitdaMM: z.number().optional(),
  // Net Operating Income (REIT-style). For agribusiness operators
  // without a true REIT NOI line, can be left out.
  noiMM: z.number().optional(),
  netIncomeMM: z.number().optional(),
  // ---- Cash flow (filing-currency $ millions, POSITIVE values) ----
  // Capital expenditures during the period (CapEx — payments for
  // PP&E + property additions). Used to chart reinvestment cycles
  // and compute capex / revenue intensity.
  capexMM: z.number().optional(),
  // Depreciation + amortization expense for the period. Lets us
  // separate the non-cash drag on EBITDA from real cash outflow.
  daMM: z.number().optional(),
  // Cash flow from operations during the period — the headline
  // CFO line on the cash flow statement.
  cfoMM: z.number().optional(),
  // ---- Balance sheet (filing-currency $ millions) ----
  totalAssetsMM: z.number().optional(),
  totalDebtMM: z.number().optional(),
  cashMM: z.number().optional(),
  netDebtMM: z.number().optional(),
  totalEquityMM: z.number().optional(),
  // ---- Capital structure / debt note ----
  // P&L interest expense (positive, filing-currency $M) — pulled from
  // the income statement or finance-cost note.
  interestExpenseMM: z.number().optional(),
  // Weighted-average interest cost on outstanding debt in % (e.g. 5.2
  // for 5.2%). Often disclosed in the debt note.
  weightedAvgDebtRate: z.number().optional(),
  // Debt maturity profile — map of maturity bucket label
  // ("<1y", "1-3y", "3-5y", "5+y") to outstanding principal in
  // filing-currency $M. Sourced from the maturity profile of
  // borrowings table in the debt note.
  debtMaturityProfileMM: z.record(z.string(), z.number()).optional(),
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
  // ---- Operational metrics: palm oil (per period) ----
  // Productive (mature) planted area in thousands of hectares — differs
  // from totalAcresK which often includes immature + reserve land.
  matureHectaresK: z.number().optional(),
  // FFB (fresh fruit bunches) harvested in thousands of tonnes.
  ffbProductionTonnesK: z.number().optional(),
  // CPO (crude palm oil) produced in thousands of tonnes — refined from FFB.
  cpoProductionTonnesK: z.number().optional(),
  // Palm Kernel produced in thousands of tonnes — typically 4-6% of FFB.
  pkProductionTonnesK: z.number().optional(),
  // FFB yield per planted hectare per year (t/ha/yr) — typically
  // 18-25 for mature palm.
  ffbYieldTPerHa: z.number().optional(),
  // CPO extraction rate = CPO / FFB processed × 100 — typically 20-23%.
  cpoExtractionRatePct: z.number().optional(),
  // PK extraction rate = PK / FFB processed × 100 — typically 4-6%.
  pkExtractionRatePct: z.number().optional(),
  // ---- Operational metrics: tea (per period) ----
  // Made (processed) tea production in thousands of tonnes.
  teaProductionTonnesK: z.number().optional(),
  // Made tea production in thousands of tonnes (alias for finished tea).
  madeTeaProductionTonnesK: z.number().optional(),
  // Green leaf harvested in thousands of tonnes (input to factory).
  greenLeafTonnesK: z.number().optional(),
  // Tea yield (made tea kg per planted hectare per year) — typically
  // 1,500-3,000 kg/ha for productive estates.
  teaYieldKgPerHa: z.number().optional(),
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
