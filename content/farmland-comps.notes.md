# Farmland comps — deferred names and known nuances

This file tracks issuers that belong on the Public Farmland comps table
but haven't been seeded yet, plus per-row data-quality caveats. Update
when you sit down with a filing and want to either add a deferred name
or refine a row that's currently approximate.

The schema and FX layer are ready for everything below; only the JSON
inputs are missing.

## Deferred adds (pipe these in order of conviction)

### Argentine / hyperinflation-exposed
- **Cresud (CRESY)** — Argentine row-crop / pastoral / forestry land
  plus IRSA real-estate stake. Reports in ARS under IFRS hyperinflation
  accounting (IAS 29). Trades as ADR on Nasdaq in USD. Two viable
  approaches: (a) use the SEC 20-F's USD-translated figures (cleanest;
  preferred); (b) add ARS to the currency enum and use the official
  Banco Central rate at year-end. The parallel-rate gap to "blue
  dollar" makes (b) noisy. Repeatedly deferred — the FY2025 ARS-only
  press releases I pulled showed implausible USD-equivalent EPS that
  almost certainly reflects hyperinflation restatement, not real-world
  earnings. Worth doing properly off the SEC 20-F next pass.

### Smaller LSE-listed tropical plantations
- **Dekel Agri-Vision (DKL.L)** — Côte d'Ivoire palm + cashew. Reports
  in EUR, lists on LSE in GBp. Tiny cap; FY24 EBITDA €3.9M. Adding
  takes priceCurrency: GBP, currency: EUR.

### Singapore-listed palm oil — would need SGD currency support
- **First Resources (EB5.SI)** — Indonesian palm oil, ~210K hectares
- **Bumitama Agri (BAL.SI)** — Indonesian palm oil
- **Golden Agri-Resources (E5H.SI)** — diversified Indonesian palm

### Other Malaysian palm oil — already have MYR support
- **IOI Corporation (IOI.KL)** — Malaysian palm oil major
- **Sime Darby Plantation (SDPL.KL)** — world's largest palm planter
- **Genting Plantations (GENP.KL)** — Malaysian palm + property hybrid

### Africa / tea
- **Kakuzi (KAKZ.NR)** — Kenyan diversified ag (avocado, macadamia,
  tea, livestock). Williamson Tea is in; Kakuzi would round out.
  KES currency already supported.

## Per-row caveats on already-seeded data

### LAND (Gladstone Land)
- `annualNoiMM` is **estimated** at $63M (LAND doesn't disclose NOI as a
  line item). Approximated from Operating Income + D&A + estimated G&A.
- `debtMM` of $535.9M includes the Series D Term Preferred ($60.6M)
  classified as "total indebtedness" by LAND. Excludes Series A/B/C/E
  preferreds (~$200M of mezzanine equity). Including them would lift
  EV by ~$200M.
- `navPerShare` is book value per share, not a third-party-appraised NAV.

### FPI (Farmland Partners)
- `debtMM` of $231.4M = $160.8M senior debt + $70.6M Series A pref RNCI
  (kept apples-to-apples with LAND's senior-claims treatment).
- `annualDividend` 0.36 is the forward run-rate after the 50% bump to
  $0.09 quarterly. Trailing 2025 declared was $0.64 incl. a $0.20
  special.

### AGRO (Adecoagro)
- `bookLandMM` = total Net PP&E ($3,399M), which **includes** sugar /
  ethanol mills + dairy operations on top of farmland. EV/Acre is
  therefore overstated until the farmland-only carve-out is dropped in.
- `acresK` 624 is a rough hectare→acre conversion of ~250K hectares
  across Argentina / Uruguay / Brazil.

### SLCE3 (SLC Agrícola)
- `debtMM` BRL 11.15B is the GAAP balance-sheet figure including leases
  and trade financing. SLC's own "adjusted net debt" is BRL 5.2B.
  Pick the convention you want.
- `bookLandMM` BRL 4.5B is a rough estimate; SLC mixes farmland and
  biological assets on the balance sheet.
- `annualNoiMM` uses adjusted EBITDA as a proxy — row-crop operators
  don't have a traditional NOI concept.

### AGRO3 (BrasilAgro)
- `marketLandMM` BRL 3.5B comes from the Deloitte third-party appraisal
  in their FY24/25 annual report; `bookLandMM` BRL 3.1B is the
  company's internal valuation.

### RFF.AX (Rural Funds Group)
- `acresK` 247 is rough — RFF reports planted/developed hectares
  (~26K) but the bulk of land is grazing on cattle stations. The 247
  figure assumes ~100K hectares of total area, which still likely
  understates actual pastoral area.
- `bookLandMM` and `marketLandMM` are both AUD 1,587M (investment
  property at fair value). Australian REITs use the IFRS fair-value
  model so book ≈ market by definition.

### AAC.AX (Australian Agricultural Co)
- `annualEbitdaMM` -AUD 221.53M is **statutory** EBITDA, which captures
  AAC's FY25 biological-asset revaluation losses. AAC publishes a
  separate "operating EBITDA" that is typically positive AUD 30–60M;
  worth swapping in once that figure is read from the FY25 annual
  report.
- `annualNoiMM` 30 is a placeholder — AAC owns and operates rather than
  leases, so the NOI concept doesn't translate.

### DBF.AX (Duxton Broadacre Farms)
- `acresK` 74 = ~30K hectares **owned**. The company's website cites
  "managing over 170,000 hectares" — that figure is largely managed
  on behalf of other Duxton funds, not owned.
- `annualNoiMM` 5 is a rough placeholder.

### ALAGR.PA (AgroGeneration)
- `sharesOutMM` 100 is **estimated**. AgroGeneration has gone through
  multiple capital actions and the precise diluted count requires
  reading their FY24 / FY25 reports.
- `bookLandMM` 3 is a deliberately conservative placeholder —
  AgroGeneration **leases** the bulk of its 28.5K cultivated hectares
  in Ukraine; very little land is owned outright.

### CAM.L (Camellia)
- All figures are **rough estimates** — Camellia consolidates
  agriculture with engineering and financial-services subsidiaries;
  the agriculture-only carve-out is what the comp wants but isn't
  cleanly broken out in the press releases.
- `epsTTM` 0.01 is a near-zero placeholder for the 2024 break-even
  result.

### AST.WA (Astarta Holding)
- Filing inputs are in EUR (Astarta's reporting currency). Yahoo
  returns the AST.WA price in PLN; the data layer converts via the
  `priceCurrency: "PLN"` override.
- Cash, debt, and net PP&E are converted from the UAH balance-sheet
  figures shown by aggregators to EUR at ~45 UAH/EUR.
- `bookLandMM` 200 is a placeholder — Astarta's PP&E (~EUR 537M)
  includes sugar refineries, the oil extraction plant, elevators and
  the biogas complex; farmland is a small fraction.

### MPE.L (MP Evans)
- Filing inputs are in USD (MP Evans' reporting currency). Yahoo
  returns the MPE.L price in GBp; the fetcher normalizes to GBP and
  the data layer converts via the `priceCurrency: "GBP"` override.
- `sharesOutMM` 52, `cashMM` 50, `debtMM` 30, `epsTTM` 1.54, and
  `bookLandMM` 300 are estimates pending a read of the FY24 annual
  report.
- `annualEbitdaMM` 100 is approximated from the disclosed gross
  profit ($116.6M) minus assumed opex; the company itself doesn't
  publish a clean EBITDA.

### SHV.AX (Select Harvests)
- `annualDividend` 0.05 is a rough estimate based on prior-year
  payouts; a final FY25 distribution may differ.
- `annualNoiMM` 75 is approximated as EBITDA minus G&A.

### RE.L (REA Holdings)
- USD reporting / GBP listing; uses the dual-currency layer.
- `acresK` 92.6 = ~37.5K hectares planted (half of REA's ~75K
  hectare allocation per their 2024 report).
- `annualDividend` set to 0; REA hasn't paid common dividends
  recently. Verify when their FY24 / FY25 annual report is read.
- `annualNoiMM` 50 is a rough proxy.

### AEP.L (Anglo-Eastern Plantations)
- USD reporting / GBP listing; uses the dual-currency layer.
- `acresK` 296.5 = ~120K hectares total, but AEP's actual planted
  area is closer to 60-70K hectares — the 120K figure includes
  unplanted concessions. Refine to planted-only for cleaner
  EV/Acre comparison.
- `bookLandMM` 271.17 is total Net PP&E; agriculture-only
  carve-out unknown.
- `annualNoiMM` 90 is approximated as EBITDA minus G&A.

### 2089.KL (United Plantations)
- All financial inputs are **estimates** — stockanalysis.com 404'd
  on UTDP and the malaymail.com fetch hit a 503. Net profit FY24
  MYR 719.4M is confirmed from the company's own February 2026
  results announcement; everything else (revenue, EBITDA, cash,
  debt, shares) is order-of-magnitude estimation pending an actual
  annual report read.
- `acresK` 125.7 = 50,854 hectares (46,227 oil palm + 4,627
  coconut), confirmed.
- UP is famously net-cash and conservatively financed; the
  cashMM:debtMM ratio of 1500:200 reflects that pattern but the
  actual figures could be materially different.

### KLK.KL (Kuala Lumpur Kepong)
- `acresK` 729.5 = 295K hectares (97% oil palm) per their 2024
  report.
- FY24 ends Sep 30, 2024 — `filingDate` is approximate.
- `annualNoiMM` 2742 uses EBITDA as an NOI proxy (KLK doesn't
  publish a NOI line item).
- `bookLandMM` 14713 is total Net PP&E; includes processing
  facilities (mills, refineries, oleochemical plants), not just
  plantation land. EV/Acre is therefore overstated relative to
  pure-play planters.

### 6010.SR (NADEC)
- `acresK` 124 = ~50K hectares **estimated** across NADEC's four
  Saudi projects (Wadi Al-Dawasir, Hail, Haradh, Al-Jouf). Their
  annual report describes "thousands of acres" but doesn't give a
  consolidated total in the public summaries — refine from the
  full Arabic-language annual report.
- `annualDividend` 0.50 is a rough placeholder.
- `bookLandMM` 2258 is Net PP&E.

### 2280.SR (Almarai)
- Almarai is a **dairy/poultry/bakery group** with Fondomonte
  (~14K hectares of farmland in Argentina + Saudi forage farms)
  embedded inside. Treating this as "farmland" overstates pure-play
  exposure by 5-10x. Worth flagging on the page itself or carving
  out Fondomonte separately if anyone publishes a segment.
- `acresK` 124 is an extreme estimate — Fondomonte's ~14K Argentine
  hectares plus Saudi forage farms = roughly 50K hectares total.
  124K acres is generous; refine when better disclosure available.
- `bookLandMM` 25093 is total group Net PP&E (dairy plants etc.),
  not farmland-only — EV/Acre is wildly overstated.

### WTK.NR (Williamson Tea Kenya)
- Yahoo's coverage of Nairobi tickers is spotty; live price may
  not resolve, in which case the row will display dashes for
  market cap, EV, and live-price multiples.
- All financial inputs are **rough estimates** from press
  coverage. Revenue KSh 4.2B and net profit KSh 527M are
  confirmed; everything else (shares out, balance sheet, hectares)
  is approximated pending the FY2024 annual report.
- `acresK` 17.3 = ~7K hectares estimate of tea estates.
- `annualDividend` 20 reflects only the disclosed interim
  KSh 10/share dividend; the final dividend may bring annual
  total higher.
