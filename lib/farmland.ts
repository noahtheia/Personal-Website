// Public farmland reference data for the Analytics → Public Farmland tab.
// Series figures are rounded values from the USDA NASS Land Values and
// Cash Rents annual summaries; comps are representative snapshots of the
// two US-listed pure-play farmland REITs and should not be treated as
// live market data.

export type FarmlandSeries = {
  id: string;
  label: string;
  unit: string;
  description: string;
  data: { year: number; value: number }[];
};

export const FARMLAND_SERIES: FarmlandSeries[] = [
  {
    id: "farm-real-estate",
    label: "US farm real estate",
    unit: "$/acre",
    description:
      "USDA NASS national average value of farmland and buildings.",
    data: [
      { year: 2014, value: 2950 },
      { year: 2015, value: 3020 },
      { year: 2016, value: 3010 },
      { year: 2017, value: 3080 },
      { year: 2018, value: 3140 },
      { year: 2019, value: 3160 },
      { year: 2020, value: 3160 },
      { year: 2021, value: 3380 },
      { year: 2022, value: 3800 },
      { year: 2023, value: 4080 },
      { year: 2024, value: 4170 },
    ],
  },
  {
    id: "cropland",
    label: "US cropland",
    unit: "$/acre",
    description:
      "USDA NASS national average cropland value, excluding pasture.",
    data: [
      { year: 2014, value: 4100 },
      { year: 2015, value: 4130 },
      { year: 2016, value: 4090 },
      { year: 2017, value: 4090 },
      { year: 2018, value: 4130 },
      { year: 2019, value: 4100 },
      { year: 2020, value: 4100 },
      { year: 2021, value: 4420 },
      { year: 2022, value: 5050 },
      { year: 2023, value: 5460 },
      { year: 2024, value: 5570 },
    ],
  },
  {
    id: "pasture",
    label: "US pasture",
    unit: "$/acre",
    description: "USDA NASS national average pasture value.",
    data: [
      { year: 2014, value: 1275 },
      { year: 2015, value: 1330 },
      { year: 2016, value: 1330 },
      { year: 2017, value: 1360 },
      { year: 2018, value: 1390 },
      { year: 2019, value: 1400 },
      { year: 2020, value: 1400 },
      { year: 2021, value: 1480 },
      { year: 2022, value: 1650 },
      { year: 2023, value: 1760 },
      { year: 2024, value: 1830 },
    ],
  },
  {
    id: "cash-rent",
    label: "US cropland cash rent",
    unit: "$/acre",
    description:
      "USDA NASS national average cash rent paid for cropland.",
    data: [
      { year: 2014, value: 144 },
      { year: 2015, value: 144 },
      { year: 2016, value: 136 },
      { year: 2017, value: 136 },
      { year: 2018, value: 138 },
      { year: 2019, value: 140 },
      { year: 2020, value: 139 },
      { year: 2021, value: 141 },
      { year: 2022, value: 148 },
      { year: 2023, value: 155 },
      { year: 2024, value: 159 },
    ],
  },
];

export type FarmlandComp = {
  ticker: string;
  name: string;
  price: number;          // recent share price ($)
  marketCap: number;      // $M equity market cap
  acres: number;          // owned acres (thousands)
  navPerShare: number;    // most recent disclosed NAV ($/share)
  capRate: number;        // implied portfolio cap rate (%)
  divYield: number;       // forward dividend yield (%)
  primaryCrops: string;
};

// Snapshot figures — sourced from each issuer's most recent 10-K / supplements
// and rounded. Treat as a teaching example, not a live quote.
export const FARMLAND_COMPS: FarmlandComp[] = [
  {
    ticker: "LAND",
    name: "Gladstone Land",
    price: 10.85,
    marketCap: 390,
    acres: 112,
    navPerShare: 14.2,
    capRate: 3.4,
    divYield: 5.1,
    primaryCrops: "Permanent / specialty",
  },
  {
    ticker: "FPI",
    name: "Farmland Partners",
    price: 11.40,
    marketCap: 555,
    acres: 132,
    navPerShare: 14.0,
    capRate: 4.6,
    divYield: 2.1,
    primaryCrops: "Row crops",
  },
];
