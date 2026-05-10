#!/usr/bin/env node
// Build content/articles/agriculture-bear-market/cropland-by-region.json from
// Our World in Data's "Land use over the long-term" dataset (HYDE 3.3 for the
// historical period, FAO for 1961+). Cropland by continent, 1700-onward,
// converted from hectares to million acres.
//
// Usage:  node scripts/build-cropland-dataset.mjs
// Re-run to refresh when OWID updates the underlying HYDE/FAO data.

import fs from "node:fs";
import path from "node:path";

const SRC_URL =
  "https://ourworldindata.org/grapher/land-use-over-the-long-term.csv?csvType=full";
const OUT = path.join(
  process.cwd(),
  "content",
  "articles",
  "agriculture-bear-market",
  "cropland-by-region.json",
);
const HA_TO_ACRES = 2.4710538147;
const START_YEAR = 1700;
const REGIONS = ["Africa", "Asia", "Europe", "North America", "South America", "Oceania"];

function parseCsv(text) {
  // Simple CSV: no embedded commas/quotes in this OWID export (entity names are
  // plain). Split on newlines, then commas.
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].split(",");
  const croplandIdx = header.findIndex((h) => /cropland/i.test(h));
  if (croplandIdx === -1) throw new Error("No Cropland column found in header: " + header.join("|"));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",");
    rows.push({
      entity: cells[0],
      year: Number(cells[2]),
      croplandHa: cells[croplandIdx] === "" ? null : Number(cells[croplandIdx]),
    });
  }
  return rows;
}

const res = await fetch(SRC_URL, { headers: { "User-Agent": "tradernoah-build-script" } });
if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
const rows = parseCsv(await res.text());

// year -> { region -> million acres }
const byYear = new Map();
for (const r of rows) {
  if (!REGIONS.includes(r.entity)) continue;
  if (!Number.isFinite(r.year) || r.year < START_YEAR) continue;
  if (r.croplandHa == null || !Number.isFinite(r.croplandHa)) continue;
  if (!byYear.has(r.year)) byYear.set(r.year, {});
  byYear.get(r.year)[r.entity] = Math.round((r.croplandHa * HA_TO_ACRES) / 1e6 * 10) / 10;
}

const series = Array.from(byYear.entries())
  .filter(([, byRegion]) => REGIONS.every((reg) => typeof byRegion[reg] === "number"))
  .sort(([a], [b]) => a - b)
  .map(([year, byRegion]) => ({ year, byRegion }));

if (series.length < 2) throw new Error("Built series has <2 complete years — aborting.");

const firstYear = series[0].year;
const lastYear = series[series.length - 1].year;
const out = {
  title: `Global cropland by region, ${firstYear}–${lastYear}`,
  unit: "million acres",
  source:
    "Our World in Data, \"Land use over the long-term\" (cropland) — based on HYDE 3.3 (PBL Netherlands Environmental Assessment Agency) for the historical period and FAO for 1961 onward. Continental aggregates; converted from hectares (1 ha = 2.4710538147 acres).",
  sourceUrl: "https://ourworldindata.org/grapher/land-use-over-the-long-term",
  retrievedAt: new Date().toISOString().slice(0, 10),
  notes: `Cropland (arable + permanent crops) by continent. Coverage: decadal benchmark years ${firstYear}–1950 (HYDE), then annual ${1951 <= lastYear ? "1951" : firstYear}–${lastYear} (HYDE/FAO). The six continents sum to the world total. Per-decade CAGRs of the world total are derived in-app (lib/chart-helpers#perDecadeCagr). NB: in million acres the world total is ~${series[0].year === 1700 ? Math.round(REGIONS.reduce((s, r) => s + series[0].byRegion[r], 0)) : "?"} in ${firstYear} and ~${Math.round(REGIONS.reduce((s, r) => s + series[series.length - 1].byRegion[r], 0))} in ${lastYear} (~3.0 bn acres by 1950, ~4.0 bn today) — cropland only, excluding pasture/grazing.`,
  regions: REGIONS,
  series,
};

fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
const total = (s) => REGIONS.reduce((a, r) => a + s.byRegion[r], 0);
console.log(`Wrote ${OUT}`);
console.log(`  ${series.length} years, ${firstYear}–${lastYear}`);
console.log(`  world total: ${firstYear}=${total(series[0]).toFixed(0)} Macres · 1950=${total(series.find((s) => s.year === 1950) ?? series[0]).toFixed(0)} · ${lastYear}=${total(series[series.length - 1]).toFixed(0)}`);
