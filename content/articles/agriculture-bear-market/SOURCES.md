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

## ⬜ `cropland-by-region.json` — Global cropland by region, 1700–2026
- **Primary source:** HYDE 3.2 (History Database of the Global Environment), surfaced via Our World in Data — "Land used for agriculture" / cropland by region.
- **What to capture:** annual (or available-step) cropland area, in million acres, broken into ~6 region buckets that sum to a global total.
- **Region taxonomy:** TBD with author — continents, OWID regions, or US/China/India/Brazil/EU/Rest-of-World.
- **Sanity check:** global total ≈ 3.5 billion acres by the 1950s; well under 1 billion pre-industrial-revolution.
- **Derived in-app:** per-decade CAGR of the global total (`lib/chart-helpers#perDecadeCagr`).
- **Notes/assumptions:** record any interpolation between HYDE benchmark years; note recent years (post-~2020 to 2026) may be USDA/FAO estimates or held-flat — flag clearly.

## ⬜ `crop-yields.json` — Global crop yields over time
- **Primary source:** FAOSTAT (Production → Yield); USDA NASS / WASDE for U.S. corn if shown separately.
- **What to capture:** annual yield (t/ha) for corn, wheat, soybeans, rice (final crop set TBD).
- **Sanity check:** post-war yields rise steeply; most-recent-decade CAGR decelerates to roughly <1%.
- **Derived in-app:** full-period CAGR and trailing-decade CAGR per crop.

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
