// Display metadata for the MDX chart palette in /admin. Plain data — no React
// imports — so it's safe to import from client components without pulling the
// chart components into their bundle. Keep in sync with mdx/components.tsx.

export type MdxComponentMeta = {
  name: string;
  label: string;
  blurb: string;
  insert: string;
  group?: string;
};

export const mdxComponentMeta: MdxComponentMeta[] = [
  {
    name: "CroplandByRegion",
    label: "Cropland by region",
    blurb: "Global cropland 1700–2023 by continent + per-decade CAGR strip.",
    insert: "<CroplandByRegion />",
    group: "Agriculture",
  },
  {
    name: "CropYields",
    label: "Crop yields",
    blurb: "Global yields for corn/wheat/rice/soy, 1961+, with CAGR table.",
    insert: "<CropYields />",
    group: "Agriculture",
  },
  {
    name: "CornFarmEconomics",
    label: "Corn farm economics",
    blurb: "Representative Midwest corn farm P&L + cap-rate strip.",
    insert: "<CornFarmEconomics />",
    group: "Agriculture",
  },
  {
    name: "SeedChemConcentration",
    label: "Seed/chem concentration",
    blurb: "Top-firm share of commercial seed sales vs. farm fragmentation.",
    insert: "<SeedChemConcentration />",
    group: "Agriculture",
  },
  {
    name: "FarmInputCosts",
    label: "Farm input prices",
    blurb: "Fertilizer / diesel / ag-chem PPI indices, 2019=100, + CAGR table.",
    insert: "<FarmInputCosts />",
    group: "Agriculture",
  },
  {
    name: "RealCommodityPrices",
    label: "Real commodity prices",
    blurb: "Multi-line real prices (sugar/soy/wheat/cotton) with target lines.",
    insert: "<RealCommodityPrices />",
    group: "Agriculture",
  },
  {
    name: "AgInflationOutlook",
    label: "Ag inflation outlook",
    blurb: "Historical YoY ag inflation + projected cone.",
    insert: "<AgInflationOutlook />",
    group: "Agriculture",
  },
  {
    name: "NotProse",
    label: "Not-prose wrapper",
    blurb: "Wrap hand-written tables/figures to escape the prose styles.",
    insert: "<NotProse>\n  \n</NotProse>",
    group: "Utility",
  },
];
