#!/usr/bin/env node
// Build content/articles/agriculture-bear-market/crop-yields.json from Our World
// in Data's "Key crop yields" dataset (FAOSTAT). World-level yields, tonnes per
// hectare, 1961-onward, for the staple crops the article discusses.
//
// Usage:  node scripts/build-crop-yields-dataset.mjs
// Re-run to refresh when OWID/FAOSTAT update.

import fs from "node:fs";
import path from "node:path";

const SRC_URL = "https://ourworldindata.org/grapher/key-crop-yields.csv?csvType=full";
const OUT = path.join(
  process.cwd(),
  "content",
  "articles",
  "agriculture-bear-market",
  "crop-yields.json",
);
// FAOSTAT column name -> display label, in the order to show.
const CROPS = [
  ["Maize", "Corn (maize)"],
  ["Wheat", "Wheat"],
  ["Rice", "Rice"],
  ["Soybeans", "Soybeans"],
];

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].split(",");
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",");
    const obj = { entity: cells[0], year: Number(cells[2]) };
    for (let c = 3; c < header.length; c++) {
      obj[header[c]] = cells[c] === "" ? null : Number(cells[c]);
    }
    rows.push(obj);
  }
  return { header, rows };
}

const res = await fetch(SRC_URL, { headers: { "User-Agent": "tradernoah-build-script" } });
if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
const { header, rows } = parseCsv(await res.text());
for (const [col] of CROPS) {
  if (!header.includes(col)) throw new Error(`Column "${col}" not in CSV header: ${header.join("|")}`);
}

const worldRows = rows
  .filter((r) => r.entity === "World" && Number.isFinite(r.year))
  .sort((a, b) => a.year - b.year);

const series = CROPS.map(([col, label]) => ({
  crop: label,
  unit: "t/ha",
  points: worldRows
    .filter((r) => typeof r[col] === "number" && Number.isFinite(r[col]))
    .map((r) => ({ year: r.year, value: Math.round(r[col] * 1000) / 1000 })),
})).filter((s) => s.points.length >= 2);

if (series.length === 0) throw new Error("No crop series with >=2 points — aborting.");

const firstYear = Math.min(...series.flatMap((s) => s.points.map((p) => p.year)));
const lastYear = Math.max(...series.flatMap((s) => s.points.map((p) => p.year)));

const out = {
  title: `Global crop yields, ${firstYear}–${lastYear}`,
  unit: "tonnes per hectare",
  source:
    "Our World in Data, \"Key crop yields\" — from the UN FAO (FAOSTAT, Production/Yield). World-level yields.",
  sourceUrl: "https://ourworldindata.org/grapher/key-crop-yields",
  retrievedAt: new Date().toISOString().slice(0, 10),
  notes: `Average global yield (t/ha) for staple crops. FAOSTAT coverage begins in 1961, so this series is shorter than the cropland chart (no comparable pre-1961 global yield statistics exist). Headline figures shown in-app: full-period CAGR and trailing-decade CAGR per crop — the trailing-decade rates have decelerated toward ~1%/yr, which is the point.`,
  series,
};

fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
const cagr = (a, b, n) => Math.pow(b / a, 1 / n) - 1;
console.log(`Wrote ${OUT}`);
console.log(`  ${series.length} crops, ${firstYear}–${lastYear}`);
for (const s of series) {
  const a = s.points[0], b = s.points[s.points.length - 1];
  const d10 = [...s.points].reverse().find((p) => p.year <= b.year - 10) ?? a;
  console.log(
    `  ${s.crop.padEnd(14)} ${a.value.toFixed(2)}→${b.value.toFixed(2)} t/ha · full CAGR ${(cagr(a.value, b.value, b.year - a.year) * 100).toFixed(2)}% · last-10y ${(cagr(d10.value, b.value, b.year - d10.year) * 100).toFixed(2)}%`,
  );
}
