import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

const PropertySchema = z.object({
  name: z.string(),
  location: z.string(),
  acres: z.number().positive(),
  cropOrUse: z.string(),
  acquired: z.string().optional(),
  acquisitionCostMM: z.number().nonnegative().optional(),
  bookValueMM: z.number().nonnegative().optional(),
  appraisedValueMM: z.number().nonnegative().optional(),
  appraisalDate: z.string().optional(),
  notes: z.string().optional(),
});

const ComparableSchema = z.object({
  description: z.string(),
  location: z.string(),
  acres: z.number().nonnegative().optional(),
  pricePerAcre: z.number().positive(),
  date: z.string(),
  source: z.string().optional(),
  url: z.string().url().optional(),
});

const FMVAssumptionSchema = z.object({
  category: z.string(),
  acres: z.number().positive(),
  assumedPricePerAcre: z.number().positive(),
  rationale: z.string().optional(),
});

const PropertyDetailSchema = z.object({
  ticker: z.string(),
  asOf: z.string(),
  // Currency for any $-denominated fields below; defaults to filing
  // currency on the comps row when omitted.
  currency: z.string().optional(),
  propertiesNote: z.string().optional(),
  properties: z.array(PropertySchema),
  comparables: z.array(ComparableSchema),
  fmvAssumptions: z.array(FMVAssumptionSchema),
  methodology: z.string(),
});

export type Property = z.infer<typeof PropertySchema>;
export type Comparable = z.infer<typeof ComparableSchema>;
export type FMVAssumption = z.infer<typeof FMVAssumptionSchema>;
export type PropertyDetail = z.infer<typeof PropertyDetailSchema>;

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

export function fmvAggregate(d: PropertyDetail): {
  totalAcres: number;
  totalFmv: number;
  weightedPerAcre: number;
} {
  let totalAcres = 0;
  let totalFmv = 0;
  for (const a of d.fmvAssumptions) {
    totalAcres += a.acres;
    totalFmv += a.acres * a.assumedPricePerAcre;
  }
  return {
    totalAcres,
    totalFmv,
    weightedPerAcre: totalAcres > 0 ? totalFmv / totalAcres : 0,
  };
}
