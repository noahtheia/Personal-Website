import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getFilings,
  getPricedFarmlandComps,
  type PricedFarmlandComp,
} from "@/lib/farmland-comps";
import { getPropertyDetail } from "@/lib/farmland-properties";
import { getFinancials } from "@/lib/farmland-financials";
import { fetchPriceHistory } from "@/lib/farmland-history";
import { getInsiders } from "@/lib/farmland-insiders";
import { FarmlandDetailTabs } from "@/components/FarmlandDetailTabs";
import { FarmlandPropertyDetail } from "@/components/FarmlandPropertyDetail";
import { FarmlandFinancialSnapshot } from "@/components/FarmlandFinancialSnapshot";
import { FarmlandInsiders } from "@/components/FarmlandInsiders";

export const revalidate = 3600;

export async function generateStaticParams() {
  return getFilings().map((f) => ({ ticker: f.ticker }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;
  const decoded = decodeURIComponent(ticker);
  const filing = getFilings().find((f) => f.ticker === decoded);
  if (!filing) return {};
  return {
    title: `${filing.name} (${filing.ticker}) — land analysis`,
    description: `Property-level land value analysis for ${filing.name}.`,
  };
}

export default async function PublicFarmlandTickerPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;
  const decoded = decodeURIComponent(ticker);

  const filings = getFilings();
  const filing = filings.find((f) => f.ticker === decoded);
  if (!filing) notFound();

  const detail = getPropertyDetail(decoded);
  const financials = getFinancials(decoded);
  const comps = await getPricedFarmlandComps();
  const priced = comps.find((c) => c.ticker === decoded);
  const history = await fetchPriceHistory(decoded);
  const insiders = getInsiders(decoded);

  return (
    <div>
      <Link
        href="/analytics/public-farmland"
        className="text-xs uppercase tracking-wider !text-muted no-underline hover:!text-accent"
      >
        ← All comps
      </Link>

      <header className="mt-3 border-b border-rule pb-4">
        <p className="eyebrow">{filing.currency} reporting</p>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          {filing.name}{" "}
          <span className="text-muted">· {filing.ticker}</span>
        </h1>
        <p className="mt-1 text-sm text-muted">
          {filing.primaryCrops}
          {filing.filingUrl && (
            <>
              {" · "}
              <a
                href={filing.filingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="!text-accent no-underline hover:underline"
              >
                Filing
              </a>
            </>
          )}
        </p>
      </header>

      <SummaryStats filing={filing} priced={priced} />

      <SectorKpiBlock filing={filing} />

      <FarmlandDetailTabs
        fmvAnalysis={
          detail ? (
            <FarmlandPropertyDetail
              filing={filing}
              priced={priced}
              detail={detail}
            />
          ) : (
            <PendingDetail ticker={filing.ticker} />
          )
        }
        insiders={
          insiders && insiders.transactions.length > 0 ? (
            <FarmlandInsiders data={insiders} />
          ) : undefined
        }
        financialSnapshot={
          <FarmlandFinancialSnapshot
            filing={filing}
            priced={priced}
            history={history}
            financials={financials}
          />
        }
      />
    </div>
  );
}

function PendingDetail({ ticker }: { ticker: string }) {
  return (
    <section className="mt-8 rounded-sm border border-rule bg-surface p-6">
      <h2 className="font-display text-lg font-semibold">
        In-depth land analysis pending
      </h2>
      <p className="mt-2 text-sm text-fg-soft">
        Property-by-property land detail and an implied fair-market analysis
        haven&apos;t been compiled for {ticker} yet. The schema and page are
        ready — adding{" "}
        <code className="rounded bg-bg px-1 py-0.5 text-[12px]">
          content/farmland-properties/{ticker}.json
        </code>{" "}
        will populate this page automatically.
      </p>
    </section>
  );
}

function SummaryStats({
  filing,
  priced,
}: {
  filing: ReturnType<typeof getFilings>[number];
  priced: PricedFarmlandComp | undefined;
}) {
  const ccy = filing.currency;
  const acresK = filing.acresK ?? 0;
  const bookPerAcre =
    filing.bookLandMM !== undefined && acresK > 0
      ? (filing.bookLandMM / acresK) * 1000
      : null;
  return (
    <dl className="mt-6 grid grid-cols-2 gap-4 border-b border-rule pb-6 sm:grid-cols-4">
      <Stat
        label="Acres"
        value={acresK > 0 ? `${fmtInt(acresK * 1000)}` : "—"}
      />
      <Stat
        label="Book / acre"
        value={
          bookPerAcre !== null ? `${ccy} ${fmtInt(bookPerAcre)}` : "—"
        }
      />
      <Stat
        label="Market cap (USD)"
        value={priced?.marketCapMM != null ? `$${fmtInt(priced.marketCapMM)}M` : "—"}
      />
      <Stat
        label="EV / acre (USD)"
        value={priced?.evPerAcre != null ? `$${fmtInt(priced.evPerAcre)}` : "—"}
      />
    </dl>
  );
}

// Sector-specific KPI card. Only renders when the filing has the
// matching sector block populated. Bullets out of the gap-audit pilots:
// REIT (LAND), plantation (KLK), protein (TSN), trader (ADM).
function SectorKpiBlock({
  filing,
}: {
  filing: ReturnType<typeof getFilings>[number];
}) {
  const items: { label: string; value: string }[] = [];
  if (filing.reit) {
    const r = filing.reit;
    if (r.walt != null) items.push({ label: "WALT (yrs)", value: r.walt.toFixed(1) });
    if (r.occupancyPct != null)
      items.push({ label: "Occupancy", value: `${r.occupancyPct.toFixed(1)}%` });
    if (r.top10TenantPctOfRent != null)
      items.push({ label: "Top-10 tenants", value: `${r.top10TenantPctOfRent.toFixed(0)}% of rent` });
    if (r.affoPerShare != null)
      items.push({ label: "AFFO / share", value: `${filing.currency} ${r.affoPerShare.toFixed(2)}` });
    if (r.ffoPerShare != null)
      items.push({ label: "FFO / share", value: `${filing.currency} ${r.ffoPerShare.toFixed(2)}` });
    if (r.preferredCoverage != null)
      items.push({ label: "Pref coverage", value: `${r.preferredCoverage.toFixed(1)}×` });
    if (r.rentIndexationType != null)
      items.push({ label: "Rent indexation", value: r.rentIndexationType });
    if (r.waterRightsValueMM != null)
      items.push({
        label: "Water rights",
        value: `${filing.currency} ${fmtInt(r.waterRightsValueMM)}M`,
      });
  }
  if (filing.plantation) {
    const p = filing.plantation;
    if (p.ffbYieldTPerHa != null)
      items.push({ label: "FFB yield", value: `${p.ffbYieldTPerHa.toFixed(1)} t/ha` });
    if (p.oerPct != null) items.push({ label: "OER", value: `${p.oerPct.toFixed(1)}%` });
    if (p.kerPct != null) items.push({ label: "KER", value: `${p.kerPct.toFixed(1)}%` });
    if (p.cpoAspPerMt != null)
      items.push({ label: "CPO ASP", value: `${filing.currency} ${fmtInt(p.cpoAspPerMt)}/t` });
    if (p.cpoCostPerMt != null)
      items.push({ label: "CPO cost", value: `${filing.currency} ${fmtInt(p.cpoCostPerMt)}/t` });
    if (p.rspoPct != null)
      items.push({ label: "RSPO certified", value: `${p.rspoPct.toFixed(1)}%` });
    if (p.methaneCapturePctMills != null)
      items.push({ label: "Methane capture", value: `${p.methaneCapturePctMills.toFixed(1)}% of mills` });
    if (p.replantingHaLtm != null)
      items.push({ label: "Replanting LTM", value: `${fmtInt(p.replantingHaLtm)} ha` });
    if (p.rubberRevenueSharePct != null)
      items.push({ label: "Rubber rev %", value: `${p.rubberRevenueSharePct.toFixed(0)}%` });
    if (p.rubberAspPerKg != null)
      items.push({ label: "Rubber ASP", value: `${filing.currency} ${p.rubberAspPerKg.toFixed(2)}/kg` });
    if (p.sugarRevenueSharePct != null)
      items.push({ label: "Sugar rev %", value: `${p.sugarRevenueSharePct.toFixed(0)}%` });
    if (p.sugarProducedMt != null)
      items.push({ label: "Sugar produced", value: `${fmtInt(p.sugarProducedMt)} MT` });
    if (p.nucleusVsPlasmaPct != null)
      items.push({ label: "Nucleus / plasma", value: `${p.nucleusVsPlasmaPct.toFixed(0)}%` });
    if (p.ndpeCompliancePct != null)
      items.push({ label: "NDPE compliance", value: `${p.ndpeCompliancePct.toFixed(1)}%` });
  }
  if (filing.tea) {
    const t = filing.tea;
    if (t.madeTeaProducedKgMM != null)
      items.push({ label: "Made tea", value: `${t.madeTeaProducedKgMM.toFixed(1)}M kg` });
    if (t.greenLeafYieldKgPerHa != null)
      items.push({ label: "Green-leaf yield", value: `${fmtInt(t.greenLeafYieldKgPerHa)} kg/ha` });
    if (t.madeTeaAspPerKg != null)
      items.push({ label: "Tea ASP", value: `${filing.currency} ${t.madeTeaAspPerKg.toFixed(2)}/kg` });
    if (t.auctionVsDirectPct != null)
      items.push({ label: "Auction share", value: `${t.auctionVsDirectPct.toFixed(0)}%` });
    if (t.boughtLeafSharePct != null)
      items.push({ label: "Bought-leaf share", value: `${t.boughtLeafSharePct.toFixed(0)}%` });
    if (t.teaPlantedHa != null)
      items.push({ label: "Tea planted", value: `${fmtInt(t.teaPlantedHa)} ha` });
  }
  if (filing.integratedFarm) {
    const i = filing.integratedFarm;
    if (i.plantedAreaHa != null)
      items.push({ label: "Planted area", value: `${fmtInt(i.plantedAreaHa)} ha` });
    if (i.ownedAreaHa != null && i.leasedAreaHa != null)
      items.push({
        label: "Owned / leased",
        value: `${fmtInt(i.ownedAreaHa)} / ${fmtInt(i.leasedAreaHa)} ha`,
      });
    if (i.productionVolumeMT != null)
      items.push({
        label: "Production",
        value: `${fmtInt(i.productionVolumeMT)} ${i.productionUnit ?? "MT"}`,
      });
    if (i.realizedPricePerUnit != null)
      items.push({
        label: "Realized price",
        value: `${filing.currency} ${i.realizedPricePerUnit.toFixed(2)}`,
      });
    if (i.waterRightsVolumeML != null)
      items.push({ label: "Water rights", value: `${fmtInt(i.waterRightsVolumeML)} ML` });
    if (i.biologicalAssetsMM != null)
      items.push({
        label: "Bio assets",
        value: `${filing.currency} ${fmtInt(i.biologicalAssetsMM)}M`,
      });
    if (i.sugarEthanol) {
      const s = i.sugarEthanol;
      if (s.crushedCaneMT != null)
        items.push({ label: "Cane crushed", value: `${fmtInt(s.crushedCaneMT / 1e6)}M MT` });
      if (s.atrKgPerMT != null)
        items.push({ label: "ATR", value: `${s.atrKgPerMT.toFixed(0)} kg/MT` });
      if (s.sugarMixPct != null && s.ethanolMixPct != null)
        items.push({
          label: "Sugar / ethanol mix",
          value: `${s.sugarMixPct.toFixed(0)}% / ${s.ethanolMixPct.toFixed(0)}%`,
        });
      if (s.ethanolVolumeM3 != null)
        items.push({ label: "Ethanol", value: `${fmtInt(s.ethanolVolumeM3)} m³` });
    }
    if (i.cattle) {
      const c = i.cattle;
      if (c.headcountClosing != null)
        items.push({ label: "Cattle head", value: `${fmtInt(c.headcountClosing)}` });
      if (c.avgDailyGainKg != null)
        items.push({ label: "Daily gain", value: `${c.avgDailyGainKg.toFixed(2)} kg` });
      if (c.weaningRate != null)
        items.push({ label: "Weaning rate", value: `${c.weaningRate.toFixed(0)}%` });
    }
    if (i.treeCrop) {
      const tc = i.treeCrop;
      if (tc.bearingHa != null)
        items.push({ label: "Bearing trees", value: `${fmtInt(tc.bearingHa)} ha` });
      if (tc.nonBearingHa != null)
        items.push({ label: "Non-bearing", value: `${fmtInt(tc.nonBearingHa)} ha` });
      if (tc.avgTreeAgeYears != null)
        items.push({ label: "Avg tree age", value: `${tc.avgTreeAgeYears.toFixed(0)} yrs` });
    }
  }
  if (filing.protein) {
    const p = filing.protein;
    if (p.plants != null) items.push({ label: "Plants", value: fmtInt(p.plants) });
    if (p.weeklyHeadCapacity != null)
      items.push({ label: "Capacity", value: `${fmtInt(p.weeklyHeadCapacity)}/wk` });
    if (p.capacityUtilizationPct != null)
      items.push({ label: "Utilization", value: `${p.capacityUtilizationPct.toFixed(0)}%` });
    if (p.plantClosuresLtm != null)
      items.push({ label: "Plant closures LTM", value: fmtInt(p.plantClosuresLtm) });
  }
  if (filing.trader) {
    const t = filing.trader;
    if (t.rmiMM != null)
      items.push({ label: "RMI", value: `${filing.currency} ${fmtInt(t.rmiMM)}M` });
    if (t.throughputMtMM != null)
      items.push({ label: "Throughput", value: `${t.throughputMtMM.toFixed(1)} MMT` });
    if (t.ethanolGalsMM != null)
      items.push({ label: "Ethanol", value: `${fmtInt(t.ethanolGalsMM)}M gal` });
    if (t.boardCrushCapturePct != null)
      items.push({ label: "Crush capture", value: `${t.boardCrushCapturePct.toFixed(0)}%` });
  }
  if (filing.aquaculture) {
    const a = filing.aquaculture;
    if (a.harvestVolumeKtGwt != null)
      items.push({ label: "Harvest", value: `${fmtInt(a.harvestVolumeKtGwt)} kt GWT` });
    if (a.ebitPerKgNok != null)
      items.push({ label: "EBIT / kg", value: `NOK ${a.ebitPerKgNok.toFixed(1)}` });
    if (a.mabLicencedTonnes != null)
      items.push({ label: "MAB licence", value: `${fmtInt(a.mabLicencedTonnes / 1000)} kt` });
    if (a.biomassAtSeaKt != null)
      items.push({ label: "Biomass at sea", value: `${fmtInt(a.biomassAtSeaKt)} kt` });
    if (a.smoltReleasedMM != null)
      items.push({ label: "Smolt released", value: `${a.smoltReleasedMM.toFixed(0)}M` });
    if (a.costPerKgNok != null)
      items.push({ label: "Cost / kg", value: `NOK ${a.costPerKgNok.toFixed(1)}` });
  }
  if (filing.cropInputs) {
    const c = filing.cropInputs;
    if (c.realizedPriceByNutrientUSDPerMT) {
      const parts = Object.entries(c.realizedPriceByNutrientUSDPerMT)
        .map(([k, v]) => `${k} $${fmtInt(v)}`)
        .join(" · ");
      items.push({ label: "Realized $/MT", value: parts });
    }
    if (c.productionCapacityKMTPerYear) {
      const parts = Object.entries(c.productionCapacityKMTPerYear)
        .map(([k, v]) => `${k} ${fmtInt(v)}`)
        .join(" · ");
      items.push({ label: "Capacity (KMT/yr)", value: parts });
    }
    if (c.capacityUtilizationPct != null)
      items.push({ label: "Utilization", value: `${c.capacityUtilizationPct.toFixed(0)}%` });
    if (c.gasCostUSDPerMMBtu != null)
      items.push({ label: "Gas cost", value: `$${c.gasCostUSDPerMMBtu.toFixed(2)}/MMBtu` });
    if (c.mineLifeYears != null)
      items.push({ label: "Mine life", value: `${c.mineLifeYears.toFixed(0)} yrs` });
    if (c.rdSpendPctOfRevenue != null)
      items.push({ label: "R&D / sales", value: `${c.rdSpendPctOfRevenue.toFixed(1)}%` });
    if (c.retailRevenuePct != null)
      items.push({ label: "Retail mix", value: `${c.retailRevenuePct.toFixed(0)}%` });
  }
  if (filing.egg) {
    const e = filing.egg;
    if (e.layingHenFlockMM != null)
      items.push({ label: "Laying flock", value: `${e.layingHenFlockMM.toFixed(1)}M hens` });
    if (e.dozensSoldMM != null)
      items.push({ label: "Dozens sold", value: `${fmtInt(e.dozensSoldMM)}M` });
    if (e.avgSellingPricePerDozen != null)
      items.push({
        label: "ASP / dozen",
        value: `${filing.currency} ${e.avgSellingPricePerDozen.toFixed(2)}`,
      });
    if (e.feedCostPerDozen != null)
      items.push({
        label: "Feed / dozen",
        value: `${filing.currency} ${e.feedCostPerDozen.toFixed(2)}`,
      });
    if (e.specialtyEggMixPct != null)
      items.push({ label: "Specialty mix", value: `${e.specialtyEggMixPct.toFixed(0)}%` });
    if (e.contractedFarmCount != null)
      items.push({ label: "Farms in network", value: fmtInt(e.contractedFarmCount) });
  }
  if (filing.dairy) {
    const d = filing.dairy;
    if (d.milkIntakeMlitres != null)
      items.push({ label: "Milk intake", value: `${fmtInt(d.milkIntakeMlitres)} ML` });
    if (d.milkSolidsKgMM != null)
      items.push({ label: "Milk solids", value: `${fmtInt(d.milkSolidsKgMM)}M kgMS` });
    if (d.avgFarmgateMilkPrice != null)
      items.push({
        label: "Farmgate price",
        value: `${filing.currency} ${d.avgFarmgateMilkPrice.toFixed(2)}`,
      });
    if (d.cowHerdK != null)
      items.push({ label: "Cow herd", value: `${fmtInt(d.cowHerdK)}K` });
    if (d.infantFormulaRevenuePct != null)
      items.push({ label: "IF revenue", value: `${d.infantFormulaRevenuePct.toFixed(0)}%` });
    if (d.brandedRevenuePct != null)
      items.push({ label: "Branded revenue", value: `${d.brandedRevenuePct.toFixed(0)}%` });
    if (d.coldChainDistributionPoints != null)
      items.push({
        label: "Cold-chain points",
        value: fmtInt(d.coldChainDistributionPoints),
      });
  }
  // Cross-universe extensions worth surfacing here too.
  if (filing.preferredMM != null)
    items.push({ label: "Preferred", value: `${filing.currency} ${fmtInt(filing.preferredMM)}M` });
  if (filing.repurchaseAuthRemainingMM != null)
    items.push({
      label: "Buyback auth left",
      value: `${filing.currency} ${fmtInt(filing.repurchaseAuthRemainingMM)}M`,
    });
  if (filing.capexGuidanceLowMM != null && filing.capexGuidanceHighMM != null)
    items.push({
      label: "Capex guidance",
      value: `${filing.currency} ${fmtInt(filing.capexGuidanceLowMM)}–${fmtInt(filing.capexGuidanceHighMM)}M`,
    });
  if (filing.litigationAccrualMM != null)
    items.push({
      label: "Litigation accrual",
      value: `${filing.currency} ${fmtInt(filing.litigationAccrualMM)}M`,
    });
  if (filing.equityMethodInvestmentsMM != null)
    items.push({
      label: "Equity-method inv.",
      value: `${filing.currency} ${fmtInt(filing.equityMethodInvestmentsMM)}M`,
    });

  if (items.length === 0) return null;
  return (
    <section className="mt-6 rounded-sm border border-rule bg-surface p-4">
      <p className="text-[10px] uppercase tracking-wider text-muted">
        Sector KPIs
      </p>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 md:grid-cols-4">
        {items.map((it) => (
          <div key={it.label}>
            <dt className="text-[10px] uppercase tracking-wider text-muted">
              {it.label}
            </dt>
            <dd className="mt-0.5 font-display text-base font-semibold tabular-nums">
              {it.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-muted">
        {label}
      </dt>
      <dd className="mt-1 font-display text-xl font-semibold tabular-nums">
        {value}
      </dd>
    </div>
  );
}

function fmtInt(n: number) {
  return Math.round(n).toLocaleString("en-US");
}
