import { z } from "zod";
import fs from "node:fs";

const CurrencySchema = z.enum(["USD","BRL","AUD","EUR","GBP","PLN","MYR","SAR","KES","IDR","SGD","NZD","THB","NOK","DKK","HKD","CNY","INR","VND","ZAR","PHP","ARS","MXN","EGP","CHF","NGN"]);
const SectorSchema = z.enum(["Farmland Owner / REIT","Integrated Farm Operator","Plantation Operator","Pastoral / Livestock","Diversified Agribusiness","Protein Producer","Dairy / Egg Producer","Aquaculture / Seafood","Agribusiness / Trader","Crop Inputs / Fertilizer","Rural Services"]);
const GeographySchema = z.enum(["US","Canada","Mexico","Brazil","Argentina","UK","EU","Norway","Switzerland","Ukraine","Australia","New Zealand","Malaysia","Indonesia","Singapore","Thailand","Vietnam","Philippines","China","Hong Kong","India","Saudi Arabia","Egypt","Kenya","South Africa","Nigeria"]);

const FilingSchema = z.object({
  ticker: z.string(),
  name: z.string(),
  currency: CurrencySchema.default("USD"),
  priceCurrency: CurrencySchema.optional(),
  sector: SectorSchema,
  geography: GeographySchema,
  primaryCrops: z.string(),
  filingDate: z.string(),
  filingUrl: z.string().url().optional(),
  sharesOutMM: z.number().positive(),
  debtMM: z.number().nonnegative(),
  cashMM: z.number().nonnegative(),
  acresK: z.number().nonnegative().optional(),
  navPerShare: z.number().positive().optional(),
  annualDividend: z.number().nonnegative(),
  annualNoiMM: z.number().nonnegative(),
  annualRevenueMM: z.number().nonnegative(),
  annualEbitdaMM: z.number(),
  epsTTM: z.number(),
  bookLandMM: z.number().nonnegative().optional(),
  marketLandMM: z.number().positive().optional(),
});

const raw = JSON.parse(fs.readFileSync("content/farmland-comps.json", "utf8"));
try {
  const all = z.array(FilingSchema).parse(raw);
  console.log("Total filings:", all.length);
  const newOnes = all.filter((f) => ["SOJA3.SA","AGXY3.SA","TTEN3.SA","VITT3.SA"].includes(f.ticker));
  console.log("New tickers found:", newOnes.length);
  newOnes.forEach((f) => console.log(f.ticker, "|", f.name, "|", f.sector, "|", f.geography, "| rev=", f.annualRevenueMM, "ebitda=", f.annualEbitdaMM));
} catch (e: any) {
  console.error("VALIDATION FAILED");
  if (e.issues) console.error(JSON.stringify(e.issues, null, 2));
  else console.error(e);
  process.exit(1);
}
