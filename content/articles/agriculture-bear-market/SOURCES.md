# Data sources — "A Bear Market in Agriculture Is Ending"

Provenance for every dataset behind the charts in this article. The article is
an investment piece (see `/disclosures`); each number on a chart must trace back
to an entry here. As datasets get populated, fill in: exact source + URL, the
specific series/table identifiers, retrieval date, units, any deflator, and any
interpolation or modeling assumptions. Mirror the discipline of
`content/farmland-comps.notes.md`.

Each JSON file also carries an embedded `source` / `retrievedAt` / `notes` so
provenance travels with the data; this file is the long-form version.

Status legend: ⬜ not started · 🟡 partial · ✅ sourced & verified

---

## ✅ `cropland-by-region.json` — Global cropland by region, 1700–2023
- **Source:** Our World in Data, "Land use over the long-term" — the *Cropland* column. OWID compiles it from **HYDE 3.3** (PBL Netherlands Environmental Assessment Agency) for the historical period and **FAO** land-use statistics for 1961 onward.
  - Download: `https://ourworldindata.org/grapher/land-use-over-the-long-term.csv?csvType=full` (CSV columns: `Entity, Code, Year, Built-up Area, Grazing, Cropland`; cropland in hectares).
  - Page: <https://ourworldindata.org/grapher/land-use-over-the-long-term>
- **Build:** `node scripts/build-cropland-dataset.mjs` — fetches the CSV, keeps the six continental aggregates (Africa, Asia, Europe, North America, South America, Oceania), filters to years ≥ 1700, converts hectares → million acres (×2.4710538147, rounded to 0.1 M acres), writes the JSON. Re-run to refresh when OWID updates HYDE/FAO.
- **Region taxonomy:** continents (OWID's continental aggregates). The six sum exactly to the world total at every year. Open to swapping for US/China/India/Brazil/EU/RoW if the author prefers — would mean aggregating the per-country rows instead.
- **Coverage:** decadal benchmark years 1700–1950 (HYDE), then annual 1951–2023 (HYDE→FAO). Latest OWID/HYDE year is 2023 — the chart title reflects the actual span; nothing is extrapolated to 2024–26.
- **Sanity check (as built, million acres):** world total ≈ 812 in 1700, ≈ 2,976 in 1950, ≈ 4,020 in 2023. ⚠️ The article draft says "≈ 3.5 billion acres by the 1950s" — HYDE/OWID *cropland* (arable + permanent crops, excluding pasture) is closer to ≈ 3.0 bn acres in 1950 and ≈ 4.0 bn today; it crosses 3.5 bn around the late-1960s. If "3.5 bn" was meant to include pasture/grazing the figure is much larger (grazing land alone is ≈ 8 bn acres). **Reconcile the prose figure with the chart.**
- **Derived in-app:** per-decade CAGR of the world total (`lib/chart-helpers#perDecadeCagr`), shown as a strip beneath the chart. Decadal segments use the HYDE benchmark years; the 2020s segment is partial (2020→2023).

## ✅ `crop-yields.json` — Global crop yields, 1961–2024
- **Source:** Our World in Data, "Key crop yields" — from the **UN FAO** (FAOSTAT, Production → Yield). World-level average yields, tonnes per hectare.
  - Download: `https://ourworldindata.org/grapher/key-crop-yields.csv?csvType=full` (CSV columns: `Entity, Code, Year, Wheat, Rice, Bananas, Maize, Soybeans, Potatoes, Beans, Peas, Cassava, Cocoa beans, Barley` — yields in t/ha).
  - Page: <https://ourworldindata.org/grapher/key-crop-yields>
- **Build:** `node scripts/build-crop-yields-dataset.mjs` — fetches the CSV, keeps the World rows, extracts Maize ("Corn (maize)"), Wheat, Rice, Soybeans, writes the JSON. Re-runnable.
- **Coverage:** 1961–2024 (FAOSTAT starts in 1961 — there is no comparable pre-1961 *global* yield series, so this chart is shorter than the cropland one; if a long single-country series is wanted, USDA NASS has U.S. maize yields back to 1866, but mixing time scales on one chart is awkward).
- **Crops shown:** the four staples the essay leans on. The component (`<CropYields/>`) accepts a `crops` prop to subset; add more columns to the build script (Barley, etc.) if wanted.
- **What it shows (as built):** full-period CAGR ≈ 1.4–1.9%/yr per crop; trailing-decade CAGR ≈ **0.4% (corn), 0.9% (wheat), 0.5% (rice), 0.6% (soy)** — all under ~1%, which is the article's point ("yields across most crops … on a continuous decline to <1% CAGR"). Full-period and trailing-decade CAGRs are computed in-app (`components/charts/CropYields.tsx`).

## ⬜ `corn-farm-economics.json` — Representative Midwest corn farm
- **Primary source:** USDA ERS Commodity Costs & Returns; University of Illinois farmdoc (e.g., crop budgets / "Revenue and Costs for Corn").
- **What to capture:** assumed corn price (~$4.50/bu), per-acre revenue, the full cost stack, resulting margin for the land-owning operator (~13.3%) vs. the cash renter (negative).
- **Cap-rate strip:** institutional farmland cap rate (~2.13%) — source: NCREIF Farmland Index income return, or the article's own land-value/income calc; compare against e.g. the 10-year Treasury yield. Document exactly which.
- **Notes:** state the crop year, geography (which Midwest budget), and whether figures are nominal.

## ⬜ `seed-chem-concentration.json` — Input-supplier concentration vs. farm fragmentation
- **Primary source:** ETC Group concentration reports; peer-reviewed agribusiness-concentration literature; company filings/press for the 2015–2018 megamergers.
- **What to capture:** top-firm share of global commercial seed sales — headline that the top 3 ≈ 60% — optionally a short time series spanning the Bayer–Monsanto, Dow–DuPont (Corteva), ChemChina–Syngenta, BASF reshuffle. Optionally the parallel crop-chemicals concentration.
- **Counterpoint figure:** ~608 million farms globally — source: FAO / "Which farms feed the world?" literature; cite the year.
- **Notes:** "commercial seed sales" ≠ all seed (excludes farm-saved seed) — state the definition.

## ⬜ `farm-input-costs.json` — Farm production expenses / input costs
- **Primary source:** USDA ERS Farm Income & Wealth Statistics (production expenses); BLS Producer Price Index for farm inputs (fertilizer, fuel, etc.).
- **What to capture:** annual index of total production expenses (or a basket of key inputs), enough to show ~6.4% annual growth since COVID vs. a ~3–4% long-run average.
- **Derived in-app:** CAGR over the chosen sub-periods (pre-COVID baseline vs. 2020→latest).
- **Notes:** pick and document the base year and whether it's a US or global series; note the article also references energy inflation, supply-chain disruption, and AI-datacenter resource demand as drivers (qualitative — not in this dataset unless quantified).

## ⬜ `real-commodity-prices.json` — Real agricultural commodity prices
- **Primary source:** World Bank "Pink Sheet" (Commodity Markets monthly prices); IMF Primary Commodity Price System; FRED mirrors.
- **What to capture:** monthly (or annual) prices for sugar, soybeans, wheat, cotton (corn optional), deflated to real terms — record the deflator (US CPI) and base year.
- **Mean-reversion target:** the thesis is +20–30% off recent lows; store the target per commodity with a one-line rationale. Must render as the author's estimate, visually distinct from the price line.

## ⬜ `ag-inflation-outlook.json` — Agricultural commodity inflation, history & outlook
- **Primary source (history):** FAO Food Price Index; World Bank agricultural price index; BLS food/ag PPI — pick one and state it.
- **Projection:** the author's forward view — agricultural-commodity inflation above ~3%/yr for roughly a decade — as a low/mid/high cone. This is an estimate, labeled as such; document the assumptions behind low/mid/high.

---

### General notes
- Prefer freely-redistributable public datasets (FAO, USDA, World Bank, OWID/HYDE under CC-BY). Note each source's license here when added.
- Keep the committed JSON lean: numeric arrays, sensible precision, no embedded prose beyond the `notes` field — these files ship in the client bundle.
- When a dataset is populated, update its status above and set `retrievedAt` in the JSON.
