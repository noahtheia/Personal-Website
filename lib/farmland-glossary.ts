// Universe-of-discourse glossary for sector-block KPI labels. Used by
// SectorKpiBlock and the comps-table sector summary row to surface
// tooltips for the abbreviation-heavy ag sector.

export const KPI_GLOSSARY: Record<string, string> = {
  // REIT
  WALT: "Weighted-average lease term (years remaining across the portfolio)",
  Occupancy: "Share of leasable acres / sqft under active lease",
  "Top-10 tenants": "Share of total rent contributed by the ten largest tenants",
  AFFO: "Adjusted Funds From Operations — REIT distributable cash after maintenance capex",
  "AFFO / share": "Adjusted Funds From Operations per share",
  FFO: "Funds From Operations — REIT operating cash earnings (NAREIT-standard)",
  "FFO / share": "Funds From Operations per share",
  "Pref coverage": "Adjusted FFO / preferred dividend obligations",
  "Water rights": "Carrying value of water entitlements held outside the land balance",

  // Plantation (palm)
  "FFB yield": "Fresh fruit bunch yield — tonnes of palm bunches harvested per mature hectare per year",
  OER: "Oil Extraction Rate — % of CPO recovered from milled FFB",
  KER: "Kernel Extraction Rate — % of palm kernel recovered from milled FFB",
  "CPO ASP": "Average selling price for crude palm oil",
  "CPO cost": "All-in mill-gate cost of producing one tonne of crude palm oil",
  RSPO: "Roundtable on Sustainable Palm Oil — % of production carrying RSPO certification",
  "RSPO certified": "% of operations carrying Roundtable on Sustainable Palm Oil certification",
  "Methane capture": "Share of mills with methane biogas-capture installations",
  Replanting: "Hectares replanted in the last 12 months (drives forward FFB curve)",
  NDPE: "No Deforestation, No Peat, No Exploitation — share of supply chain compliant",
  "Nucleus vs plasma": "% nucleus (core estate) vs plasma (smallholder scheme) under Indonesian regulation",

  // Tea
  "Made-tea": "Finished black tea produced (post-processing)",
  "Green-leaf yield": "Kilograms of green leaf harvested per hectare per year",
  "Auction vs direct": "Share of made-tea sold at Mombasa/Colombo auctions vs direct private sale",
  "Bought leaf": "Share of green leaf bought from third-party smallholders vs grown on own estate",

  // Aquaculture
  Harvest: "Annual harvest volume (gutted-weight equivalent thousand tonnes)",
  "Harvest volume": "Annual harvest volume (gutted-weight equivalent thousand tonnes)",
  "EBIT/kg": "Operating EBIT per kilogram of harvest — sector-standard unit-margin KPI",
  "EBIT / kg": "Operating EBIT per kilogram of harvest — sector-standard unit-margin KPI",
  "Cost/kg": "Full economic cost of farming per kilogram (feed + processing + mortality + overhead)",
  "Cost / kg": "Full economic cost of farming per kilogram (feed + processing + mortality + overhead)",
  MAB: "Maximum Allowed Biomass — regulatory cap on standing biomass at sea (Norwegian licence convention)",
  "MAB licence": "Maximum Allowed Biomass licence — regulatory ceiling on standing biomass at sea",
  "Biomass at sea": "Live-weight standing biomass on the balance-sheet date (IAS 41 fair value)",
  "Smolt released": "Millions of fish put-to-sea this period — leading indicator of harvest two years out",

  // Crop Inputs
  "R&D / sales": "Research & development spend as a percentage of revenue",
  "Capacity utilization": "% of nameplate capacity utilized over the period",
  Utilization: "% of nameplate capacity utilized over the period",
  "Gas cost": "Average natural-gas feedstock cost per MMBtu (key cost lever for nitrogen producers)",
  "Mine life": "Weighted-average remaining mine life across proven + probable reserves",
  "Retail mix": "Share of revenue from retail / consumer channels vs wholesale",

  // Egg
  "Laying flock": "Average laying-hen flock size during the period",
  "Dozens sold": "Annual dozens of eggs sold",
  "ASP / dozen": "Net average selling price per dozen, blended across conventional + specialty",
  "Feed / dozen": "Feed cost per dozen produced — single biggest COGS lever for egg producers",
  "Specialty mix": "Share of dozens sold that are specialty (cage-free / organic / pasture-raised)",
  "Farms in network": "Owned + contracted family-farm count in the supply network",

  // Dairy
  "Milk intake": "Million litres of raw milk processed / collected this period",
  "Milk solids": "Million kilograms of milk solids (NZ/AU industry convention)",
  "Farmgate price": "Payout / raw-milk reference price paid to dairy suppliers",
  "Cow herd": "Thousands of cows in the milking herd, owned + key suppliers",
  "IF revenue": "Infant-formula share of total revenue",
  "IF rev": "Infant-formula share of total revenue",
  "Branded revenue": "Branded / consumer share of revenue (vs ingredient / commodity bulk)",
  "Branded rev": "Branded / consumer share of revenue (vs ingredient / commodity bulk)",
  "Cold-chain points": "Refrigerated distribution / point-of-sale endpoints in the network",

  // Protein
  Plants: "Number of processing plants / facilities operated",
  Capacity: "Combined head + lbs weekly slaughter or processing capacity",
  "Plant closures LTM": "Plant closures or idlings in the last 12 months",
  "Plant closures": "Plant closures or idlings in the last 12 months",

  // Integrated Farm
  "Planted area": "Total planted / operational hectares in the reporting period",
  Acres: "Total controlled acres (thousands)",

  // Trader
  RMI: "Readily Marketable Inventories — hedged commodity inventory treated as quasi-cash (ADM/Bunge convention)",
  Throughput: "Annual physical throughput volume (million tonnes processed / traded)",
  Ethanol: "Annual ethanol production (millions of gallons)",
  "Crush capture": "Realized board-crush margin capture vs theoretical CME spread",

  "Specialty rev": "Share of revenue from specialty / value-added ingredients vs commodity output",
  "Specialty revenue": "Share of revenue from specialty / value-added ingredients vs commodity output",

  // Cross-universe
  Preferred: "Preferred equity outstanding (senior to common, included in EV)",
  "Buyback auth left": "Remaining share-repurchase authorization not yet executed",
  "Capex guidance": "Forward-year capex guidance range disclosed in MD&A",
  "Litigation accrual": "Booked legal / contingency accrual (ADM SEC, TSN antitrust, etc.)",
  "Equity-method inv.": "Carrying value of equity-method investments (Wilmar-style stakes outside consolidated BS)",
  "Non-ag rev": "Share of revenue from non-agriculture lines (Primark for ABF, Vector for RCL, etc.)",
  "Non-ag revenue": "Share of revenue from non-agriculture lines (Primark for ABF, Vector for RCL, etc.)",
};

// Lookup helper — returns the glossary text or undefined if not in
// the dictionary. Uppercased / case-tolerant lookups happen at call site.
export function tipFor(label: string): string | undefined {
  return KPI_GLOSSARY[label] ?? KPI_GLOSSARY[label.replace(/\s+/g, " ").trim()];
}
