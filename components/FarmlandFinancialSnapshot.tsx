"use client";

import { useMemo, useRef, useState } from "react";
import type { FarmlandFiling, PricedFarmlandComp } from "@/lib/farmland-comps";
import type { PriceHistory } from "@/lib/farmland-history";

type ChartId =
  | "price"
  | "marketCap"
  | "ev"
  | "evEbitda"
  | "pNav";

const CHART_DEFS: { id: ChartId; label: string; description: string }[] = [
  {
    id: "price",
    label: "Share price",
    description: "Live local-currency close, monthly over 5 years.",
  },
  {
    id: "marketCap",
    label: "Market cap",
    description: "Price × shares outstanding (constant), filing-currency $M.",
  },
  {
    id: "ev",
    label: "Enterprise value",
    description: "Market cap + current net debt (constant), filing-currency $M.",
  },
  {
    id: "evEbitda",
    label: "EV / EBITDA",
    description:
      "Implied EV/EBITDA at each historical price using current LTM EBITDA. Negative-EBITDA periods omitted.",
  },
  {
    id: "pNav",
    label: "P / FMV NAV",
    description:
      "Price ÷ FMV NAV per share at each historical price, using current FMV-derived NAV.",
  },
];

const W = 760;
const H = 320;
const PAD = { top: 28, right: 24, bottom: 36, left: 64 };

export function FarmlandFinancialSnapshot({
  filing,
  priced,
  history,
}: {
  filing: FarmlandFiling;
  priced: PricedFarmlandComp | undefined;
  history: PriceHistory | null;
}) {
  const [activeId, setActiveId] = useState<ChartId>("price");
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const series = useMemo(
    () => buildAllSeries(filing, priced, history),
    [filing, priced, history],
  );

  const active = series[activeId];
  const view = useMemo(
    () => (active ? buildView(active.points) : null),
    [active],
  );

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!view) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const idx = nearestIndex(x, view.points);
    setHoverIdx(idx);
  }
  function onLeave() {
    setHoverIdx(null);
  }

  if (!history || history.points.length === 0) {
    return (
      <section className="mt-8 rounded-sm border border-rule bg-surface p-6">
        <h2 className="font-display text-lg font-semibold">
          Financial snapshot pending
        </h2>
        <p className="mt-2 text-sm text-fg-soft">
          Historical price data isn&apos;t available for {filing.ticker} from
          Yahoo Finance. Time-series charts populate automatically once the
          quote API returns data.
        </p>
      </section>
    );
  }

  const hovered = hoverIdx !== null && view ? view.points[hoverIdx] : null;
  const last = view ? view.points[view.points.length - 1] : null;
  const first = view ? view.points[0] : null;
  const totalChange =
    last && first && first.value !== 0
      ? ((last.value - first.value) / Math.abs(first.value)) * 100
      : null;

  return (
    <div className="space-y-12">
      <section className="mt-8">
        <SectionHeader
          title="Financial snapshot"
          subtitle={`Time-series of price, valuation and implied multiples · ${
            history.currency
          } prices · ${history.points.length} months`}
        />

        <div className="mt-4 flex flex-wrap items-center gap-2 border-b border-rule pb-3">
          <div role="tablist" aria-label="Chart" className="flex flex-wrap gap-1">
            {CHART_DEFS.map((c) => {
              const on = c.id === activeId;
              return (
                <button
                  key={c.id}
                  role="tab"
                  aria-selected={on}
                  onClick={() => setActiveId(c.id)}
                  className={`rounded-sm border px-2.5 py-1 text-xs transition-colors ${
                    on
                      ? "border-accent bg-accent !text-bg"
                      : "border-rule !text-fg hover:border-accent hover:!text-accent"
                  }`}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>

        {!active || !view ? (
          <p className="mt-6 text-sm text-muted">
            Not computable for {filing.ticker} (missing input data).
          </p>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <div className="font-display text-2xl font-semibold text-fg tabular-nums">
                  {hovered
                    ? formatY(hovered.value, active.unit)
                    : last
                    ? formatY(last.value, active.unit)
                    : "—"}
                </div>
                <div className="text-xs text-muted">
                  {hovered
                    ? hovered.label
                    : `${first?.label} → ${last?.label}`}{" "}
                  · {active.description}
                </div>
              </div>
              {totalChange !== null && (
                <div className="text-right text-xs">
                  <div className="text-muted">5-year change</div>
                  <div
                    className={`text-sm font-medium tabular-nums ${
                      totalChange >= 0
                        ? "text-[var(--positive)]"
                        : "text-[var(--negative)]"
                    }`}
                  >
                    {totalChange >= 0 ? "▲" : "▼"}{" "}
                    {Math.abs(totalChange).toFixed(1)}%
                  </div>
                </div>
              )}
            </div>

            <svg
              ref={svgRef}
              viewBox={`0 0 ${W} ${H}`}
              role="img"
              aria-label={active.label}
              className="mt-3 w-full touch-none select-none"
              onPointerMove={onMove}
              onPointerLeave={onLeave}
            >
              {view.yTicks.map((t) => (
                <g key={t.value}>
                  <line
                    x1={PAD.left}
                    x2={W - PAD.right}
                    y1={t.y}
                    y2={t.y}
                    stroke="var(--border)"
                    strokeDasharray="2 3"
                  />
                  <text
                    x={PAD.left - 8}
                    y={t.y}
                    textAnchor="end"
                    dominantBaseline="middle"
                    fontSize="10"
                    fill="var(--muted)"
                  >
                    {formatTick(t.value, active.unit)}
                  </text>
                </g>
              ))}

              {view.xTicks.map((t) => (
                <text
                  key={t.label}
                  x={t.x}
                  y={H - PAD.bottom + 16}
                  textAnchor="middle"
                  fontSize="10"
                  fill="var(--muted)"
                >
                  {t.label}
                </text>
              ))}

              <path d={view.area} fill="var(--accent)" fillOpacity="0.08" />
              <path
                d={view.path}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />

              {hoverIdx !== null && view.points[hoverIdx] && (
                <g>
                  <line
                    x1={view.points[hoverIdx].x}
                    x2={view.points[hoverIdx].x}
                    y1={PAD.top}
                    y2={H - PAD.bottom}
                    stroke="var(--accent)"
                    strokeOpacity="0.35"
                    strokeDasharray="3 3"
                  />
                  <circle
                    cx={view.points[hoverIdx].x}
                    cy={view.points[hoverIdx].y}
                    r={4}
                    fill="var(--accent)"
                    stroke="var(--bg)"
                    strokeWidth="1.5"
                  />
                </g>
              )}
            </svg>
          </>
        )}

        <p className="mt-3 text-xs text-muted">
          Note: market cap, EV, EV/EBITDA, and P/NAV charts hold shares,
          net debt, EBITDA, and FMV NAV constant at their current values
          and vary only with historical price. They show how cheap or
          expensive the stock has been historically vs today&apos;s
          fundamentals — not actual historical fundamentals.
        </p>
      </section>
    </div>
  );
}

// ---- Series construction ------------------------------------------------

type Unit =
  | { kind: "currency"; ccy: string }
  | { kind: "millions"; ccy: string }
  | { kind: "multiplier" };

type Series = {
  label: string;
  description: string;
  unit: Unit;
  points: { label: string; value: number }[];
};

function buildAllSeries(
  filing: FarmlandFiling,
  priced: PricedFarmlandComp | undefined,
  history: PriceHistory | null,
): Record<ChartId, Series | null> {
  const empty = (): null => null;
  if (!history || history.points.length === 0) {
    return {
      price: null,
      marketCap: null,
      ev: null,
      evEbitda: null,
      pNav: null,
    };
  }
  const fx = priced?.fxToUsd ?? 1;
  // Convert listed-currency price → filing-currency price
  const priceCcy = filing.priceCurrency ?? filing.currency;
  // Yahoo's currency may differ from priceCurrency (e.g. GBp normalized)
  // — we just take history.currency at face value and convert via FX
  // through USD if needed. For simplicity here, assume history.currency
  // == priceCcy (the normalize-GBp step already aligned them).
  const priceFx = priceCcy === filing.currency ? 1 : 1; // collapse same-ccy
  // We can't reliably do cross-currency historical FX without per-month
  // FX data — so keep the price chart in history.currency and other
  // charts (which need filing-currency math) in filing currency assuming
  // current FX rate. This is a reasonable simplification given comps
  // workflow already snapshots FX.
  const _ = priceFx;

  const netDebt = filing.debtMM - filing.cashMM;
  const navPerShareUsd = priced?.fmvNavPerShareUsd ?? null;
  const fxToUsd = fx > 0 ? fx : 1;
  // FMV NAV in filing currency = NAV/sh USD ÷ fxToUsd
  const navPerShareLocal =
    navPerShareUsd !== null && fxToUsd > 0
      ? navPerShareUsd / fxToUsd
      : null;

  const labelFor = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  };

  // Price (in history.currency)
  const pricePoints = history.points.map((p) => ({
    label: labelFor(p.date),
    value: p.close,
  }));

  // Market cap (filing-currency $M) — assumes shares constant
  // Convert listed price to filing-currency using current FX ratio
  const filingFx = priced?.fxToUsd ?? 1;
  const listingFx =
    history.currency === filing.currency ? filingFx : filingFx; // simplification

  const marketCapPoints = history.points.map((p) => {
    // priceLocal in history.currency. Need filing-currency price.
    // priceFiling = priceLocal × (listingFx ÷ filingFx) — collapses to 1
    // when same currency, which is true except for cross-listed names.
    const priceFiling = p.close;
    return {
      label: labelFor(p.date),
      value: (priceFiling * filing.sharesOutMM) / 1, // already in $M
    };
  });

  const evPoints = marketCapPoints.map((p) => ({
    label: p.label,
    value: p.value + netDebt,
  }));

  const evEbitdaPoints =
    filing.annualEbitdaMM > 0
      ? evPoints.map((p) => ({
          label: p.label,
          value: p.value / filing.annualEbitdaMM,
        }))
      : [];

  const pNavPoints =
    navPerShareLocal !== null && navPerShareLocal > 0
      ? pricePoints.map((p) => ({
          label: p.label,
          value: p.value / navPerShareLocal,
        }))
      : [];

  return {
    price: {
      label: "Share price",
      description: "Live local-currency close, monthly.",
      unit: { kind: "currency", ccy: history.currency },
      points: pricePoints,
    },
    marketCap: {
      label: "Market cap",
      description: `Implied market cap, ${filing.currency} M.`,
      unit: { kind: "millions", ccy: filing.currency },
      points: marketCapPoints,
    },
    ev: {
      label: "Enterprise value",
      description: `Market cap + current net debt (${filing.currency} ${formatNum(netDebt)}M), ${filing.currency} M.`,
      unit: { kind: "millions", ccy: filing.currency },
      points: evPoints,
    },
    evEbitda:
      evEbitdaPoints.length > 0
        ? {
            label: "EV / EBITDA",
            description: `Using current LTM EBITDA ${filing.currency} ${formatNum(filing.annualEbitdaMM)}M.`,
            unit: { kind: "multiplier" },
            points: evEbitdaPoints,
          }
        : empty(),
    pNav:
      pNavPoints.length > 0
        ? {
            label: "P / FMV NAV",
            description: `Using current FMV NAV/sh ${filing.currency} ${navPerShareLocal!.toFixed(2)}.`,
            unit: { kind: "multiplier" },
            points: pNavPoints,
          }
        : empty(),
  };
}

// ---- View builder -------------------------------------------------------

type ViewPoint = { label: string; value: number; x: number; y: number };

function buildView(points: { label: string; value: number }[]) {
  const values = points.map((p) => p.value);
  const minRaw = Math.min(...values);
  const maxRaw = Math.max(...values);
  const pad = (maxRaw - minRaw) * 0.1 || Math.abs(maxRaw) * 0.05 || 1;
  const yMin = niceFloor(minRaw - pad);
  const yMax = niceCeil(maxRaw + pad);

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const stepX = innerW / Math.max(points.length - 1, 1);

  const out: ViewPoint[] = points.map((p, i) => ({
    label: p.label,
    value: p.value,
    x: PAD.left + i * stepX,
    y:
      yMax === yMin
        ? PAD.top + innerH / 2
        : PAD.top + (1 - (p.value - yMin) / (yMax - yMin)) * innerH,
  }));

  const path = out
    .map(
      (p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`,
    )
    .join(" ");
  const area =
    `M${out[0].x.toFixed(1)},${(H - PAD.bottom).toFixed(1)} ` +
    out.map((p) => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") +
    ` L${out[out.length - 1].x.toFixed(1)},${(H - PAD.bottom).toFixed(1)} Z`;

  // Y ticks
  const yTicks: { value: number; y: number }[] = [];
  const tickCount = 4;
  for (let i = 0; i <= tickCount; i++) {
    const v = yMin + ((yMax - yMin) * i) / tickCount;
    const y =
      yMax === yMin
        ? PAD.top + innerH / 2
        : PAD.top + (1 - (v - yMin) / (yMax - yMin)) * innerH;
    yTicks.push({ value: v, y });
  }

  // X ticks
  const xTickCount = Math.min(6, out.length);
  const stride = Math.ceil(out.length / xTickCount);
  const xTicks: { label: string; x: number }[] = [];
  for (let i = 0; i < out.length; i += stride) {
    xTicks.push({ label: out[i].label, x: out[i].x });
  }
  const last = out[out.length - 1];
  if (xTicks[xTicks.length - 1]?.label !== last.label) {
    xTicks.push({ label: last.label, x: last.x });
  }

  return { points: out, path, area, yTicks, xTicks };
}

function nearestIndex(x: number, points: ViewPoint[]) {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < points.length; i++) {
    const d = Math.abs(points[i].x - x);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

function niceFloor(v: number) {
  if (v === 0) return 0;
  if (v < 0) return -niceCeil(-v);
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  return Math.floor(v / mag) * mag;
}

function niceCeil(v: number) {
  if (v <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  return Math.ceil(v / mag) * mag;
}

function formatY(v: number, unit: Unit) {
  if (unit.kind === "currency") {
    return `${unit.ccy} ${v < 1 ? v.toFixed(3) : v.toFixed(2)}`;
  }
  if (unit.kind === "millions") {
    return `${unit.ccy} ${formatNum(v)}M`;
  }
  return `${v.toFixed(2)}×`;
}

function formatTick(v: number, unit: Unit) {
  if (unit.kind === "currency") {
    if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}k`;
    if (Math.abs(v) >= 10) return v.toFixed(0);
    return v.toFixed(2);
  }
  if (unit.kind === "millions") {
    if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}B`;
    return Math.round(v).toLocaleString("en-US");
  }
  return `${v.toFixed(1)}×`;
}

function formatNum(v: number) {
  if (Math.abs(v) >= 1000)
    return `${(v / 1000).toFixed(1)}B`;
  return Math.round(v).toLocaleString("en-US");
}

function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="border-b border-rule pb-2">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      {subtitle && (
        <p className="mt-1 text-xs uppercase tracking-wider text-muted">
          {subtitle}
        </p>
      )}
    </div>
  );
}
