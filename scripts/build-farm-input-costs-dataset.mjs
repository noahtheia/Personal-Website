#!/usr/bin/env node
// Build content/articles/agriculture-bear-market/farm-input-costs.json from BLS
// Producer Price Index series (via FRED), re-based to 2019 = 100, annual
// averages, 2000-onward. Shows the post-COVID surge in the main variable farm
// inputs (fertilizer, diesel fuel, pesticides/ag chemicals).
//
// Usage:  node scripts/build-farm-input-costs-dataset.mjs
// Re-run to refresh.
//
// NB: this chart is INPUT PRICES (the proximate driver). The article's headline
// "total farm production expenses up ~6.4%/yr since COVID vs ~3-4% historically"
// is the broader USDA ERS expense aggregate (smoother — it also moves with
// quantities and stickier items like cash rent, labor, depreciation). Cite that
// figure from USDA ERS in prose; see SOURCES.md.

import fs from "node:fs";
import path from "node:path";

const OUT = path.join(
  process.cwd(),
  "content",
  "articles",
  "agriculture-bear-market",
  "farm-input-costs.json",
);
const BASE_YEAR = 2019;
const START_YEAR = 2000;
// FRED id -> display name (order = display order)
const SERIES = [
  ["WPU0652", "Fertilizer materials"],
  ["WPU057303", "Diesel fuel (no. 2)"],
  ["WPU0651", "Pesticides & ag chemicals"],
];
const CAGR_PERIODS = [
  ["2000–2019 (pre-COVID)", 2000, 2019],
  ["2019→latest (since COVID)", 2019, null /* filled with last year */],
];

async function fredAnnual(id) {
  let text;
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}`, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; tradernoah-build-script; +https://x.com/TraderNoah)",
          Accept: "text/csv,*/*",
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      text = await res.text();
      break;
    } catch (err) {
      if (attempt >= 5) throw new Error(`FRED fetch failed for ${id}: ${err.message}`);
      await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)));
    }
  }
  const lines = text.trim().split(/\r?\n/);
  if (!/^observation_date,/.test(lines[0])) throw new Error(`Unexpected FRED CSV for ${id}: ${lines[0]}`);
  const sum = new Map();
  const cnt = new Map();
  for (let i = 1; i < lines.length; i++) {
    const [date, v] = lines[i].split(",");
    if (v === "." || v === "" || v == null) continue;
    const year = Number(date.slice(0, 4));
    const val = Number(v);
    if (!Number.isFinite(year) || !Number.isFinite(val)) continue;
    sum.set(year, (sum.get(year) ?? 0) + val);
    cnt.set(year, (cnt.get(year) ?? 0) + 1);
  }
  const out = [];
  for (const [year, s] of sum) {
    if ((cnt.get(year) ?? 0) >= 10) out.push({ year, value: s / cnt.get(year) });
  }
  return out.sort((a, b) => a.year - b.year);
}

const raw = [];
for (const [id, name] of SERIES) raw.push({ id, name, annual: await fredAnnual(id) });

const lastYear = Math.min(...raw.map((r) => r.annual[r.annual.length - 1].year));

const series = raw.map(({ id, name, annual }) => {
  const base = annual.find((p) => p.year === BASE_YEAR);
  if (!base) throw new Error(`${id}: no ${BASE_YEAR} observation to re-base on`);
  return {
    name,
    fredId: id,
    points: annual
      .filter((p) => p.year >= START_YEAR && p.year <= lastYear)
      .map((p) => ({ year: p.year, value: Math.round((p.value / base.value) * 1000) / 10 })),
  };
});

const cagr = (a, b, n) => Math.pow(b / a, 1 / n) - 1;
const valAt = (pts, y) => pts.find((p) => p.year === y)?.value;
const cagrPeriods = [];
for (const s of series) {
  for (const [label, from, toRaw] of CAGR_PERIODS) {
    const to = toRaw ?? lastYear;
    const a = valAt(s.points, from);
    const b = valAt(s.points, to);
    if (a == null || b == null || to <= from) continue;
    cagrPeriods.push({
      series: s.name,
      label: label.replace("→latest", `–${to}`),
      fromYear: from,
      toYear: to,
      cagr: Math.round(cagr(a, b, to - from) * 10000) / 10000,
    });
  }
}

const out = {
  title: `Farm input prices, ${START_YEAR}–${lastYear} (${BASE_YEAR} = 100)`,
  unit: `index, ${BASE_YEAR} = 100`,
  baseYear: BASE_YEAR,
  source:
    "U.S. Bureau of Labor Statistics, Producer Price Index (commodity data: WPU0652 fertilizer materials, WPU057303 no. 2 diesel fuel, WPU0651 pesticides & other agricultural chemicals), via FRED. Monthly index re-based to ${BASE_YEAR} = 100 and averaged to annual.".replace("${BASE_YEAR}", String(BASE_YEAR)),
  sourceUrl: "https://fred.stlouisfed.org/release/tables?rid=46",
  retrievedAt: new Date().toISOString().slice(0, 10),
  notes:
    `Producer prices for the main variable farm inputs, ${BASE_YEAR} = 100, annual averages. The 2021–22 surge: fertilizer roughly doubled, diesel more than doubled, ag chemicals stepped up ~50% and held. This chart is input *prices* — the proximate driver. The article's "total farm production expenses up ~6.4%/yr since COVID vs ~3–4% historically" is the broader USDA ERS expense aggregate (smoother; also moves with quantities and stickier items like cash rent, labor, depreciation) — cite that from USDA ERS in prose. TODO: add the ERS total-production-expenses series as a fourth line if wanted (would need to fetch from ERS directly).`,
  series,
  cagrPeriods,
};

fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
console.log(`Wrote ${OUT}`);
console.log(`  ${series.length} input series, ${START_YEAR}–${lastYear}, base ${BASE_YEAR}=100`);
for (const s of series) {
  const peak = s.points.reduce((m, p) => (p.value > m.value ? p : m), s.points[0]);
  const last = s.points[s.points.length - 1];
  console.log(`  ${s.name.padEnd(28)} ${BASE_YEAR}=100 · peak ${peak.value} (${peak.year}) · ${last.year}=${last.value}`);
}
for (const c of cagrPeriods) console.log(`  CAGR  ${c.series.padEnd(28)} ${c.label}: ${(c.cagr * 100).toFixed(1)}%/yr`);
