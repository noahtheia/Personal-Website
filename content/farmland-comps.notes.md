# Farmland comps — deferred names and known nuances

This file tracks issuers that belong on the Public Farmland comps table
but haven't been seeded yet, plus per-row data-quality caveats. Update
when you sit down with a filing and want to either add a deferred name
or refine a row that's currently approximate.

The schema and FX layer are ready for everything below; only the JSON
inputs are missing.

## Deferred adds (pipe these in order of conviction)

### LSE-listed palm oil and tropical plantations
- **REA Holdings (RE.L)** — Indonesian palm oil, ~75K hectares allocation
  with about half planted. Reports in USD, lists on LSE in GBp. Same
  dual-currency setup as MP Evans (currency: USD, priceCurrency: GBP).
- **Anglo-Eastern Plantations (AEP.L)** — Indonesian / Malaysian palm
  oil, ~120K hectares. Reports in USD, lists on LSE in GBp.
- **Dekel Agri-Vision (DKL.L)** — Côte d'Ivoire palm + cashew. Reports
  in EUR, lists on LSE in GBp. Tiny cap; FY24 EBITDA €3.9M.

### Argentine / hyperinflation-exposed
- **Cresud (CRESY)** — Argentine row-crop / pastoral / forestry land
  plus IRSA real-estate stake. Reports in ARS under IFRS hyperinflation
  accounting (IAS 29). Trades as ADR on Nasdaq in USD. Two viable
  approaches: (a) use the SEC 20-F's USD-translated figures (cleanest);
  (b) add ARS to the currency enum and use the official Banco Central
  rate at year-end. The parallel-rate gap to "blue dollar" makes (b)
  noisy.

### Asian palm oil giants — would need MYR / SGD currency support
- **Kuala Lumpur Kepong (KLK.KL)** — ~280K hectares planted, MYR
- **IOI Corporation (IOI.KL)** — Malaysian palm oil major, MYR
- **Sime Darby Plantation (SDPL.KL)** — world's largest palm planter, MYR
- **Genting Plantations (GENP.KL)** — Malaysian palm + property, MYR
- **United Plantations (UTDP.KL)** — Malaysian, well-regarded operator, MYR
- **First Resources (EB5.SI)** — Indonesian palm oil, SGD
- **Bumitama Agri (BAL.SI)** — Indonesian palm oil, SGD
- **Golden Agri-Resources (E5H.SI)** — diversified Indonesian palm, SGD

### Africa / tea
- **Williamson Tea Kenya (WTK.NR)** — Kenyan tea, KES
- **Kakuzi (KAKZ.NR)** — Kenyan diversified ag, KES

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
