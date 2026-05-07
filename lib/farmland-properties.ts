import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

const PropertySchema = z.object({
  name: z.string(),
  location: z.string(),
  acres: z.number().positive(),
  cropOrUse: z.string(),
  // Cluster key for the auto-aggregated FMV-by-category table.
  category: z.string(),
  acquired: z.string().optional(),
  acquisitionCostMM: z.number().nonnegative().optional(),
  bookValueMM: z.number().nonnegative().optional(),
  appraisedValueMM: z.number().nonnegative().optional(),
  appraisalDate: z.string().optional(),
  // Estimated fair-market value per acre (in `currency`). For non-land
  // asset rows (e.g. water rights), this is per unit and `acres` is a
  // count of those units (e.g. acre-feet).
  fmvPerAcre: z.number().positive(),
  // Optional sensitivity bands. When omitted, default to base × 0.85
  // and base × 1.15 respectively. Author can override per row.
  fmvPerAcreLow: z.number().positive().optional(),
  fmvPerAcreHigh: z.number().positive().optional(),
  // For non-land asset rows (water rights, infrastructure carve-outs,
  // etc.), set true so the row contributes to FMV but not to acre
  // totals on the detail page.
  excludeFromAcreTotals: z.boolean().optional(),
  // Optional per-property cap rate range (typical at-FMV yield benchmark
  // for this asset class / sub-tier). When set, the NOI cross-check
  // FMV-weighted-averages these across the portfolio rather than using
  // keyword detection or an issuer-level override. Use it for sub-tier
  // refinement (e.g. CA pistachio at 3.0-4.0% vs CA citrus at 4.0-5.5%).
  capRateLow: z.number().positive().optional(),
  capRateHigh: z.number().positive().optional(),
  // One-line justification for the per-acre estimate.
  fmvRationale: z.string().optional(),
  // IDs of `comparables` entries cited for this property.
  comparablesUsed: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

const ComparableSchema = z.object({
  // Stable identifier so properties can cite a comp without duplicating it.
  id: z.string(),
  description: z.string(),
  location: z.string(),
  acres: z.number().nonnegative().optional(),
  pricePerAcre: z.number().positive(),
  date: z.string(),
  source: z.string().optional(),
  url: z.string().url().optional(),
});

const PropertyDetailSchema = z.object({
  ticker: z.string(),
  asOf: z.string(),
  currency: z.string().optional(),
  propertiesNote: z.string().optional(),
  properties: z.array(PropertySchema),
  comparables: z.array(ComparableSchema),
  methodology: z.string(),
  // Optional per-issuer asset-class cap rate range used by the NOI
  // cross-check. When set, overrides the keyword-based defaults so
  // hybrid issuers (e.g. Almarai mostly dairy + small farmland) get
  // benchmarked against the right yield range.
  noiCheckCapRateLow: z.number().positive().optional(),
  noiCheckCapRateHigh: z.number().positive().optional(),
  noiCheckLabel: z.string().optional(),
});

export type Property = z.infer<typeof PropertySchema>;
export type Comparable = z.infer<typeof ComparableSchema>;
export type PropertyDetail = z.infer<typeof PropertyDetailSchema>;

export type CategoryAggregate = {
  category: string;
  count: number;
  acres: number;
  totalBookMM: number;
  totalFmvMM: number;
  totalFmvLowMM: number;
  totalFmvHighMM: number;
  weightedBookPerAcre: number;
  weightedFmvPerAcre: number;
  fmvVsBookPct: number | null;
};

// Default ±15% sensitivity bands when not explicitly provided.
const DEFAULT_LOW_RATIO = 0.85;
const DEFAULT_HIGH_RATIO = 1.15;

const DETAILS_DIR = path.join(
  process.cwd(),
  "content",
  "farmland-properties",
);

export function getPropertyDetail(ticker: string): PropertyDetail | null {
  const safe = ticker.replace(/[^a-zA-Z0-9._-]/g, "");
  const filePath = path.join(DETAILS_DIR, `${safe}.json`);
  if (!fs.existsSync(filePath)) return null;
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  return PropertyDetailSchema.parse(raw);
}

export function getDetailedTickers(): string[] {
  if (!fs.existsSync(DETAILS_DIR)) return [];
  return fs
    .readdirSync(DETAILS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""));
}

// $M for a property: fmvPerAcre × acres ÷ 1,000,000.
export function propertyFmvMM(p: Property): number {
  return (p.acres * p.fmvPerAcre) / 1_000_000;
}

export function propertyFmvLowPerAcre(p: Property): number {
  return p.fmvPerAcreLow ?? p.fmvPerAcre * DEFAULT_LOW_RATIO;
}

export function propertyFmvHighPerAcre(p: Property): number {
  return p.fmvPerAcreHigh ?? p.fmvPerAcre * DEFAULT_HIGH_RATIO;
}

export function propertyFmvLowMM(p: Property): number {
  return (p.acres * propertyFmvLowPerAcre(p)) / 1_000_000;
}

export function propertyFmvHighMM(p: Property): number {
  return (p.acres * propertyFmvHighPerAcre(p)) / 1_000_000;
}

export function propertyFmvVsBookPct(p: Property): number | null {
  if (p.bookValueMM == null || p.bookValueMM <= 0) return null;
  const fmv = propertyFmvMM(p);
  return ((fmv - p.bookValueMM) / p.bookValueMM) * 100;
}

// Acres are only counted from rows that aren't flagged as non-land
// (e.g. water rights, infrastructure).
export function propertyContributesAcres(p: Property): boolean {
  return p.excludeFromAcreTotals !== true;
}

// Aggregate all properties by their `category` field.
export function aggregateByCategory(d: PropertyDetail): CategoryAggregate[] {
  const groups = new Map<string, Property[]>();
  for (const p of d.properties) {
    if (!groups.has(p.category)) groups.set(p.category, []);
    groups.get(p.category)!.push(p);
  }
  const aggregates: CategoryAggregate[] = [];
  for (const [category, props] of groups.entries()) {
    // Acres only counted for land-asset rows (excludes water rights, etc.).
    const acres = props
      .filter(propertyContributesAcres)
      .reduce((s, p) => s + p.acres, 0);
    const totalBookMM = props.reduce((s, p) => s + (p.bookValueMM ?? 0), 0);
    const totalFmvMM = props.reduce((s, p) => s + propertyFmvMM(p), 0);
    const totalFmvLowMM = props.reduce(
      (s, p) => s + propertyFmvLowMM(p),
      0,
    );
    const totalFmvHighMM = props.reduce(
      (s, p) => s + propertyFmvHighMM(p),
      0,
    );
    aggregates.push({
      category,
      count: props.length,
      acres,
      totalBookMM,
      totalFmvMM,
      totalFmvLowMM,
      totalFmvHighMM,
      weightedBookPerAcre:
        acres > 0 ? (totalBookMM * 1_000_000) / acres : 0,
      weightedFmvPerAcre:
        acres > 0 ? (totalFmvMM * 1_000_000) / acres : 0,
      fmvVsBookPct:
        totalBookMM > 0
          ? ((totalFmvMM - totalBookMM) / totalBookMM) * 100
          : null,
    });
  }
  // Sort by total FMV descending.
  aggregates.sort((a, b) => b.totalFmvMM - a.totalFmvMM);
  return aggregates;
}

export function totalFmvMM(d: PropertyDetail): number {
  return d.properties.reduce((s, p) => s + propertyFmvMM(p), 0);
}

export function totalFmvLowMM(d: PropertyDetail): number {
  return d.properties.reduce((s, p) => s + propertyFmvLowMM(p), 0);
}

export function totalFmvHighMM(d: PropertyDetail): number {
  return d.properties.reduce((s, p) => s + propertyFmvHighMM(p), 0);
}

export function totalAcres(d: PropertyDetail): number {
  return d.properties
    .filter(propertyContributesAcres)
    .reduce((s, p) => s + p.acres, 0);
}

export function totalBookMM(d: PropertyDetail): number {
  return d.properties.reduce((s, p) => s + (p.bookValueMM ?? 0), 0);
}

// Weighted-average FMV per acre across all LAND properties (water rights
// and other non-land rows excluded from both numerator and denominator).
export function weightedFmvPerAcre(d: PropertyDetail): number {
  const landProps = d.properties.filter(propertyContributesAcres);
  const acres = landProps.reduce((s, p) => s + p.acres, 0);
  if (acres <= 0) return 0;
  const fmv = landProps.reduce((s, p) => s + propertyFmvMM(p), 0);
  return (fmv * 1_000_000) / acres;
}

// Quick lookup wrapper: read a ticker's detail file and return its
// weighted FMV/acre, or null if no detail exists.
export function getWeightedFmvPerAcreForTicker(
  ticker: string,
): number | null {
  const d = getPropertyDetail(ticker);
  if (!d) return null;
  const w = weightedFmvPerAcre(d);
  return w > 0 ? w : null;
}
