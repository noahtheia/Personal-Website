// Typed access to the datasets behind the "A Bear Market in Agriculture Is
// Ending" article. The JSON lives under content/articles/agriculture-bear-market/
// and is imported statically (tsconfig has resolveJsonModule), so these helpers
// work in both server and client components — the chart components in
// components/charts/* call them directly.
//
// Datasets ship initially empty (`series: []` etc.); every chart degrades to a
// "data pending" state when its series has fewer than 2 points. Populate the
// JSON + content/articles/agriculture-bear-market/SOURCES.md together.

import croplandRaw from "@/content/articles/agriculture-bear-market/cropland-by-region.json";
import yieldsRaw from "@/content/articles/agriculture-bear-market/crop-yields.json";
import cornRaw from "@/content/articles/agriculture-bear-market/corn-farm-economics.json";
import concentrationRaw from "@/content/articles/agriculture-bear-market/seed-chem-concentration.json";
import inputCostsRaw from "@/content/articles/agriculture-bear-market/farm-input-costs.json";
import commodityPricesRaw from "@/content/articles/agriculture-bear-market/real-commodity-prices.json";
import inflationRaw from "@/content/articles/agriculture-bear-market/ag-inflation-outlook.json";

// --- common ---------------------------------------------------------------

export type Provenance = {
  title: string;
  source: string;
  sourceUrl?: string;
  retrievedAt: string | null;
  notes: string;
};

export type YearValue = { year: number; value: number };

// --- cropland by region ---------------------------------------------------

export type CroplandRow = { year: number; byRegion: Record<string, number> };
export type CroplandByRegionData = Provenance & {
  unit: string;
  regions: string[];
  series: CroplandRow[];
};

// --- crop yields ----------------------------------------------------------

export type CropYieldSeries = { crop: string; unit?: string; points: YearValue[] };
export type CropYieldsData = Provenance & {
  unit: string;
  series: CropYieldSeries[];
};

// --- corn farm economics --------------------------------------------------

export type CostLine = { label: string; usdPerAcre: number };
export type CapRateRow = { label: string; pct: number; note?: string };
export type CornFarmEconomicsData = Provenance & {
  cornPriceUsdPerBu: number | null;
  perAcre: {
    revenueUsd: number | null;
    costLines: CostLine[];
    ownerMarginPct: number | null;
    renterMarginPct: number | null;
  };
  capRates: CapRateRow[];
};

// --- seed/chemical concentration -----------------------------------------

export type FirmShare = { firm: string; sharePct: number };
export type ConcentrationPoint = { year: number; top3SharePct: number; note?: string };
export type SeedChemConcentrationData = Provenance & {
  topFirms: FirmShare[];
  concentrationSeries: ConcentrationPoint[];
  globalFarmCountMillions: number | null;
};

// --- farm input costs -----------------------------------------------------

export type InputCostSeries = { name: string; fredId?: string; points: YearValue[] };
export type CagrPeriod = {
  series: string;
  label: string;
  fromYear: number;
  toYear: number;
  cagr: number;
};
export type FarmInputCostsData = Provenance & {
  unit: string;
  baseYear: number | null;
  series: InputCostSeries[];
  cagrPeriods: CagrPeriod[];
};

// --- real commodity prices ------------------------------------------------

export type PricePoint = { date: string; value: number };
export type CommoditySeries = {
  commodity: string;
  unit: string;
  points: PricePoint[];
  meanReversionTarget?: { value: number; rationale: string } | null;
};
export type RealCommodityPricesData = Provenance & {
  deflator: string;
  baseYear: number | null;
  series: CommoditySeries[];
};

// --- agricultural inflation outlook ---------------------------------------

export type InflationProjection = {
  fromYear: number | null;
  toYear: number | null;
  lowPct: number | null;
  midPct: number | null;
  highPct: number | null;
};
export type AgInflationOutlookData = Provenance & {
  unit: string;
  history: YearValue[];
  projection: InflationProjection;
};

// --- accessors ------------------------------------------------------------

export function getCroplandByRegion(): CroplandByRegionData {
  return croplandRaw as CroplandByRegionData;
}
export function getCropYields(): CropYieldsData {
  return yieldsRaw as CropYieldsData;
}
export function getCornFarmEconomics(): CornFarmEconomicsData {
  return cornRaw as CornFarmEconomicsData;
}
export function getSeedChemConcentration(): SeedChemConcentrationData {
  return concentrationRaw as SeedChemConcentrationData;
}
export function getFarmInputCosts(): FarmInputCostsData {
  return inputCostsRaw as FarmInputCostsData;
}
export function getRealCommodityPrices(): RealCommodityPricesData {
  return commodityPricesRaw as RealCommodityPricesData;
}
export function getAgInflationOutlook(): AgInflationOutlookData {
  return inflationRaw as AgInflationOutlookData;
}
