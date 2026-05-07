"use client";

import { useMemo, useRef, useState } from "react";
import type { FarmlandFiling, PricedFarmlandComp } from "@/lib/farmland-comps";
import type { Financials, FinancialsPeriod } from "@/lib/farmland-financials";
import type { PriceHistory } from "@/lib/farmland-history";

type ChartId =
  | "price"
  | "revenue"
  | "ebitda"
  | "propertyValue"
  | "navPerShare"
  | "totalAcres"
  | "marketCap"
  | "ev";

const CHART_DEFS: { id: ChartId; label: string; description: string }[] = [
  {
    id: "price",
    label: "Share price",
    description: "Live local-currency close, monthly over 5 years.",
  },
  {
    id: "revenue",
    label: "Revenue",
    description: "Reported revenue per period.",
  },
  {
    id: "ebitda",
    label: "EBITDA",
    description: "Reported / adjusted EBITDA per period.",
  },
  {
    id: "propertyValue",
    label: "Property value",
    description:
      "Independent appraisal / fair value of the property portfolio per period.",
  },
  {
    id: "navPerShare",
    label: "NAV / share",
    description: "Reported NAV or BV per share per period.",
  },
  {
    id: "totalAcres",
    label: "Total acres",
    description:
      "Total operated / managed area per period (in thousands of acres).",
  },
  {
    id: "marketCap",
    label: "Market cap",
    description:
      "Implied market cap = price × shares outstanding (current; varies with price only).",
  },
  {
    id: "ev",
    label: "Enterprise value",
    description:
      "Implied EV = market cap + current net debt (varies with price only).",
  },
];

const W = 760;
const H = 320;
const PAD = { top: 28, right: 24, bottom: 36, left: 64 };

export function FarmlandFinancialSnapshot({
  filing,
  priced,
  history,
  financials,
}: {
  filing: FarmlandFiling;
  priced: PricedFarmlandComp | undefined;
  history: PriceHistory | null;
  financials: Financials | null;
}) {
  const series = useMemo(
    () => buildAllSeries(filing, priced, history, financials),
    [filing, priced, history, financials],
  );

  // Default to first chart that has data
  const firstWithData =
    (Object.keys(series) as ChartId[]).find(
      (id) => series[id] && series[id]!.points.length > 0,
    ) ?? "price";
  const [activeId, setActiveId] = useState<ChartId>(firstWithData);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const active = series[activeId];
  const view = useMemo(
    () =>
      active && active.points.length > 0
        ? buildView(active.points, active.kind)
        : null,
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

  const hovered = hoverIdx !== null && view ? view.points[hoverIdx] : null;
  const last = view ? view.points[view.points.length - 1] : null;
  const first = view ? view.points[0] : null;
  const totalChange =
    last && first && first.value !== 0
      ? ((last.value - first.value) / Math.abs(first.value)) * 100
      : null;

  const dataAvailability = (
    Object.entries(series) as [ChartId, Series | null][]
  )
    .filter(([_, s]) => s && s.points.length > 0)
    .map(([id]) => id);

  if (dataAvailability.length === 0) {
    return (
      <section className="mt-8 rounded-sm border border-rule bg-surface p-6">
        <h2 className="font-display text-lg font-semibold">
          Financial snapshot pending
        </h2>
        <p className="mt-2 text-sm text-fg-soft">
          Historical price data and quarterly fundamentals haven&apos;t been
          compiled for {filing.ticker} yet. Adding{" "}
          <code className="rounded bg-bg px-1 py-0.5 text-[12px]">
            content/farmland-financials/{filing.ticker}.json
          </code>{" "}
          will populate this tab automatically.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-12">
      <section className="mt-8">
        <SectionHeader
          title="Financial snapshot"
          subtitle={
            financials
              ? `${financials.periods.length} reported periods · price history ${
                  history ? `${history.points.length} months` : "n/a"
                }`
              : history
              ? `Price history ${history.points.length} months · no manual fundamentals yet`
              : ""
          }
        />

        <div className="mt-4 flex flex-wrap items-center gap-2 border-b border-rule pb-3">
          <div role="tablist" aria-label="Chart" className="flex flex-wrap gap-1">
            {CHART_DEFS.map((c) => {
              const s = series[c.id];
              const hasData = s && s.points.length > 0;
              if (!hasData) return null;
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
                  <div className="text-muted">Total change</div>
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

              {active.kind === "line" ? (
                <>
                  <path d={view.area} fill="var(--accent)" fillOpacity="0.08" />
                  <path
                    d={view.path}
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth="2"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                </>
              ) : (
                view.points.map((p, i) => {
                  const barW = Math.max(
                    4,
                    ((W - PAD.left - PAD.right) / view.points.length) * 0.7,
                  );
                  const yZero =
                    view.yZero !== null ? view.yZero : H - PAD.bottom;
                  const top = Math.min(p.y, yZero);
                  const height = Math.abs(p.y - yZero);
                  return (
                    <rect
                      key={i}
                      x={p.x - barW / 2}
                      y={top}
                      width={barW}
                      height={height}
                      fill="var(--accent)"
                      fillOpacity={hoverIdx === i ? 1 : 0.7}
                    />
                  );
                })
              )}

              {active.kind === "line" &&
                view.points.map((p, i) => (
                  <circle
                    key={i}
                    cx={p.x}
                    cy={p.y}
                    r={hoverIdx === i ? 4 : 2.5}
                    fill={hoverIdx === i ? "var(--accent)" : "var(--bg)"}
                    stroke="var(--accent)"
                    strokeWidth="1.5"
                  />
                ))}

              {hoverIdx !== null && view.points[hoverIdx] && (
                <line
                  x1={view.points[hoverIdx].x}
                  x2={view.points[hoverIdx].x}
                  y1={PAD.top}
                  y2={H - PAD.bottom}
                  stroke="var(--accent)"
                  strokeOpacity="0.35"
                  strokeDasharray="3 3"
                />
              )}
            </svg>
          </>
        )}

        <p className="mt-3 text-xs text-muted">
          {financials ? (
            <>
              Reported metrics (revenue, EBITDA, property value, NAV/share,
              total acres) come from{" "}
              <code className="rounded bg-bg px-1 py-0.5 text-[11px]">
                content/farmland-financials/{filing.ticker}.json
              </code>{" "}
              — manually compiled from each issuer&apos;s annual reports and
              independent valuations. Each period is timestamped to its fiscal
              end-date with period type (Q / FY / H / LTM). Market cap and EV
              charts hold shares + net debt constant at current values.
            </>
          ) : (
            <>
              Market cap, EV charts hold shares and net debt constant at
              current values — they show how cheap the stock has been
              historically vs today&apos;s fundamentals, not actual historical
              fundamentals. Adding manual quarterly data in{" "}
              <code className="rounded bg-bg px-1 py-0.5 text-[11px]">
                content/farmland-financials/{filing.ticker}.json
              </code>{" "}
              will unlock revenue / EBITDA / property value time-series.
            </>
          )}
        </p>
      </section>
    </div>
  );
}

// ---- Series construction ------------------------------------------------

type Unit =
  | { kind: "currency"; ccy: string }
  | { kind: "millions"; ccy: string }
  | { kind: "thousands" }
  | { kind: "multiplier" };

type SeriesKind = "line" | "bar";

type Series = {
  label: string;
  description: string;
  unit: Unit;
  kind: SeriesKind;
  points: { label: string; value: number }[];
};

function buildAllSeries(
  filing: FarmlandFiling,
  priced: PricedFarmlandComp | undefined,
  history: PriceHistory | null,
  financials: Financials | null,
): Record<ChartId, Series | null> {
  const result: Record<ChartId, Series | null> = {
    price: null,
    revenue: null,
    ebitda: null,
    propertyValue: null,
    navPerShare: null,
    totalAcres: null,
    marketCap: null,
    ev: null,
  };

  // --- Price-derived (uses Yahoo history) ---
  if (history && history.points.length > 0) {
    const labelFor = (iso: string) => {
      const d = new Date(iso);
      return d.toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
      });
    };

    result.price = {
      label: "Share price",
      description: "Live local-currency close, monthly.",
      unit: { kind: "currency", ccy: history.currency },
      kind: "line",
      points: history.points.map((p) => ({
        label: labelFor(p.date),
        value: p.close,
      })),
    };

    const netDebt = filing.debtMM - filing.cashMM;
    const marketCapPoints = history.points.map((p) => ({
      label: labelFor(p.date),
      value: p.close * filing.sharesOutMM,
    }));
    result.marketCap = {
      label: "Market cap",
      description: `${filing.currency} M (price × current shares ${filing.sharesOutMM.toFixed(1)}M)`,
      unit: { kind: "millions", ccy: filing.currency },
      kind: "line",
      points: marketCapPoints,
    };
    result.ev = {
      label: "Enterprise value",
      description: `${filing.currency} M (market cap + current net debt ${formatNum(netDebt)}M)`,
      unit: { kind: "millions", ccy: filing.currency },
      kind: "line",
      points: marketCapPoints.map((p) => ({
        label: p.label,
        value: p.value + netDebt,
      })),
    };
  }

  // --- Reported financials (uses manually-compiled history) ---
  if (financials && financials.periods.length > 0) {
    const ccy = financials.currency;
    result.revenue = pickSeries(financials, "revenueMM", {
      label: "Revenue",
      description: `Reported revenue, ${ccy} M`,
      unit: { kind: "millions", ccy },
      kind: "bar",
    });
    result.ebitda = pickSeries(financials, "ebitdaMM", {
      label: "EBITDA",
      description: `Reported / adjusted EBITDA, ${ccy} M`,
      unit: { kind: "millions", ccy },
      kind: "bar",
    });
    // Property value: prefer FMV, fall back to book
    const propertySeries =
      pickSeries(financials, "propertyFmvMM", {
        label: "Property value",
        description: `Independent appraisal / fair value, ${ccy} M`,
        unit: { kind: "millions", ccy },
        kind: "line",
      }) ??
      pickSeries(financials, "propertyBookMM", {
        label: "Property book",
        description: `Property book value, ${ccy} M`,
        unit: { kind: "millions", ccy },
        kind: "line",
      });
    result.propertyValue = propertySeries;

    // NAV per share: prefer fmvNavPerShare, fall back to navPerShare or
    // bookValuePerShare
    const navSeries =
      pickSeries(financials, "fmvNavPerShare", {
        label: "FMV NAV / share",
        description: `FMV-based NAV per share, ${ccy}`,
        unit: { kind: "currency", ccy },
        kind: "line",
      }) ??
      pickSeries(financials, "navPerShare", {
        label: "NAV / share",
        description: `Reported NAV per share, ${ccy}`,
        unit: { kind: "currency", ccy },
        kind: "line",
      }) ??
      pickSeries(financials, "bookValuePerShare", {
        label: "Book value / share",
        description: `Book value per share, ${ccy}`,
        unit: { kind: "currency", ccy },
        kind: "line",
      });
    result.navPerShare = navSeries;

    result.totalAcres = pickSeries(financials, "totalAcresK", {
      label: "Total acres (K)",
      description: "Total operated / managed area, thousands of acres",
      unit: { kind: "thousands" },
      kind: "line",
    });
  }

  return result;
}

function pickSeries(
  financials: Financials,
  key: keyof FinancialsPeriod,
  meta: Omit<Series, "points">,
): Series | null {
  const points: { label: string; value: number; sortKey: string }[] = [];
  for (const p of financials.periods) {
    const v = p[key];
    if (typeof v !== "number") continue;
    points.push({
      label: formatPeriodLabel(p),
      value: v,
      sortKey: p.endDate,
    });
  }
  if (points.length === 0) return null;
  points.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  return {
    ...meta,
    points: points.map(({ label, value }) => ({ label, value })),
  };
}

function formatPeriodLabel(p: FinancialsPeriod): string {
  const d = new Date(p.endDate);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  if (p.periodType === "FY") return `FY${year.toString().slice(2)}`;
  if (p.periodType === "Q") {
    const q = Math.ceil(month / 3);
    return `Q${q} ${year.toString().slice(2)}`;
  }
  if (p.periodType === "H") {
    const h = month <= 6 ? "1H" : "2H";
    return `${h} ${year.toString().slice(2)}`;
  }
  // LTM = trailing 12 months — show end-month + year
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

// ---- View builder -------------------------------------------------------

type ViewPoint = { label: string; value: number; x: number; y: number };

function buildView(points: { label: string; value: number }[], kind: SeriesKind) {
  const values = points.map((p) => p.value);
  const minRaw = Math.min(...values);
  const maxRaw = Math.max(...values);
  // For bar charts, anchor lower bound at 0 (or below if values negative)
  const yMinTarget = kind === "bar" ? Math.min(0, minRaw) : minRaw;
  const yMaxTarget = kind === "bar" ? Math.max(0, maxRaw) : maxRaw;
  const pad =
    (yMaxTarget - yMinTarget) * 0.1 || Math.abs(yMaxTarget) * 0.05 || 1;
  const yMin = niceFloor(yMinTarget - (kind === "bar" ? 0 : pad));
  const yMax = niceCeil(yMaxTarget + pad);

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const stepX = innerW / Math.max(points.length - 1, 1);

  const out: ViewPoint[] = points.map((p, i) => {
    // For single-point series, center; otherwise space evenly
    const x =
      points.length === 1 ? PAD.left + innerW / 2 : PAD.left + i * stepX;
    return {
      label: p.label,
      value: p.value,
      x,
      y:
        yMax === yMin
          ? PAD.top + innerH / 2
          : PAD.top + (1 - (p.value - yMin) / (yMax - yMin)) * innerH,
    };
  });

  const path = out
    .map(
      (p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`,
    )
    .join(" ");
  const area =
    points.length === 0
      ? ""
      : `M${out[0].x.toFixed(1)},${(H - PAD.bottom).toFixed(1)} ` +
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

  // Y zero line for bar charts
  const yZero =
    kind === "bar" && 0 >= yMin && 0 <= yMax
      ? PAD.top + (1 - (0 - yMin) / (yMax - yMin)) * innerH
      : null;

  // X ticks
  const xTickCount = Math.min(8, out.length);
  const stride = Math.ceil(out.length / xTickCount);
  const xTicks: { label: string; x: number }[] = [];
  for (let i = 0; i < out.length; i += stride) {
    xTicks.push({ label: out[i].label, x: out[i].x });
  }
  if (out.length > 0) {
    const last = out[out.length - 1];
    if (xTicks.length === 0 || xTicks[xTicks.length - 1].label !== last.label) {
      xTicks.push({ label: last.label, x: last.x });
    }
  }

  return { points: out, path, area, yTicks, xTicks, yZero };
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
  if (unit.kind === "thousands") {
    return `${formatNum(v)}K acres`;
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
  if (unit.kind === "thousands") {
    return Math.round(v).toLocaleString("en-US");
  }
  return `${v.toFixed(1)}×`;
}

function formatNum(v: number) {
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}B`;
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
