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
  // Estimated fair-market value per acre (in `currency`).
  fmvPerAcre: z.number().positive(),
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
  weightedBookPerAcre: number;
  weightedFmvPerAcre: number;
  fmvVsBookPct: number | null;
};

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

export function propertyFmvVsBookPct(p: Property): number | null {
  if (p.bookValueMM == null || p.bookValueMM <= 0) return null;
  const fmv = propertyFmvMM(p);
  return ((fmv - p.bookValueMM) / p.bookValueMM) * 100;
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
    const acres = props.reduce((s, p) => s + p.acres, 0);
    const totalBookMM = props.reduce((s, p) => s + (p.bookValueMM ?? 0), 0);
    const totalFmvMM = props.reduce((s, p) => s + propertyFmvMM(p), 0);
    aggregates.push({
      category,
      count: props.length,
      acres,
      totalBookMM,
      totalFmvMM,
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

export function totalAcres(d: PropertyDetail): number {
  return d.properties.reduce((s, p) => s + p.acres, 0);
}

export function totalBookMM(d: PropertyDetail): number {
  return d.properties.reduce((s, p) => s + (p.bookValueMM ?? 0), 0);
}
