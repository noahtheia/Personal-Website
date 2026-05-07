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
    description:
      "FMV NAV per share with stock price overlay and premium/discount on right axis.",
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
const PAD = { top: 28, right: 64, bottom: 36, left: 64 };

// Color tokens
const C_PRIMARY = "var(--accent)";
const C_OVERLAY = "var(--fg-soft)";
const C_SECONDARY_POSITIVE = "var(--positive)";
const C_SECONDARY_NEGATIVE = "var(--negative)";

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
        ? buildView(active)
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

            {active.overlay || active.secondary ? (
              <Legend active={active} />
            ) : null}

            <svg
              ref={svgRef}
              viewBox={`0 0 ${W} ${H}`}
              role="img"
              aria-label={active.label}
              className="mt-3 w-full touch-none select-none"
              onPointerMove={onMove}
              onPointerLeave={onLeave}
            >
              {/* Y-axis (primary, left) */}
              {view.yTicks.map((t, i) => (
                <g key={`y-${i}`}>
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

              {/* Y-axis (secondary, right) */}
              {view.secondaryYTicks &&
                view.secondaryYTicks.map((t, i) => (
                  <text
                    key={`y2-${i}`}
                    x={W - PAD.right + 8}
                    y={t.y}
                    textAnchor="start"
                    dominantBaseline="middle"
                    fontSize="10"
                    fill="var(--muted)"
                  >
                    {formatTick(t.value, active.secondary!.unit)}
                  </text>
                ))}

              {/* X labels */}
              {view.xTicks.map((t, i) => (
                <text
                  key={`x-${i}`}
                  x={t.x}
                  y={H - PAD.bottom + 16}
                  textAnchor="middle"
                  fontSize="10"
                  fill="var(--muted)"
                >
                  {t.label}
                </text>
              ))}

              {/* Zero reference line for secondary axis (e.g. premium/discount = 0) */}
              {view.secondaryYZero !== null && (
                <line
                  x1={PAD.left}
                  x2={W - PAD.right}
                  y1={view.secondaryYZero}
                  y2={view.secondaryYZero}
                  stroke="var(--muted)"
                  strokeDasharray="4 4"
                  strokeOpacity="0.5"
                />
              )}

              {/* Primary series rendering (line or bar) */}
              {active.kind === "line" ? (
                <>
                  <path
                    d={view.area}
                    fill={C_PRIMARY}
                    fillOpacity="0.08"
                  />
                  <path
                    d={view.path}
                    fill="none"
                    stroke={C_PRIMARY}
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
                      fill={C_PRIMARY}
                      fillOpacity={hoverIdx === i ? 1 : 0.7}
                    />
                  );
                })
              )}

              {/* Primary series circle markers (for line) */}
              {active.kind === "line" &&
                view.points.map((p, i) => (
                  <circle
                    key={`p-${i}`}
                    cx={p.x}
                    cy={p.y}
                    r={hoverIdx === i ? 4 : 2.5}
                    fill={hoverIdx === i ? C_PRIMARY : "var(--bg)"}
                    stroke={C_PRIMARY}
                    strokeWidth="1.5"
                  />
                ))}

              {/* Overlay series (e.g. stock price overlay on NAV) */}
              {view.overlayPath && (
                <>
                  <path
                    d={view.overlayPath}
                    fill="none"
                    stroke={C_OVERLAY}
                    strokeWidth="1.75"
                    strokeDasharray="4 3"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  {view.overlayPoints!.map((p, i) => (
                    <circle
                      key={`o-${i}`}
                      cx={p.x}
                      cy={p.y}
                      r={hoverIdx === i ? 3.5 : 2}
                      fill="var(--bg)"
                      stroke={C_OVERLAY}
                      strokeWidth="1.5"
                    />
                  ))}
                </>
              )}

              {/* Secondary series (right axis) */}
              {view.secondaryPath && (
                <>
                  <path
                    d={view.secondaryPath}
                    fill="none"
                    stroke={C_SECONDARY_NEGATIVE}
                    strokeWidth="1.75"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  {view.secondaryPoints!.map((p, i) => (
                    <circle
                      key={`s-${i}`}
                      cx={p.x}
                      cy={p.y}
                      r={hoverIdx === i ? 3.5 : 2}
                      fill={
                        view.secondaryRawValues![i] >= 0
                          ? C_SECONDARY_POSITIVE
                          : C_SECONDARY_NEGATIVE
                      }
                      stroke="var(--bg)"
                      strokeWidth="1"
                    />
                  ))}
                </>
              )}

              {/* Hover crosshair */}
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

            {/* Hover tooltip below the chart for multi-series */}
            {hovered && (active.overlay || active.secondary) && (
              <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs tabular-nums">
                <span>
                  <span className="text-muted">{active.label}:</span>{" "}
                  <span className="font-medium" style={{ color: "var(--accent)" }}>
                    {formatY(hovered.value, active.unit)}
                  </span>
                </span>
                {active.overlay && view.overlayPoints?.[hoverIdx!] && (
                  <span>
                    <span className="text-muted">{active.overlay.label}:</span>{" "}
                    <span className="font-medium" style={{ color: "var(--fg-soft)" }}>
                      {formatY(active.overlay.points[hoverIdx!].value, active.unit)}
                    </span>
                  </span>
                )}
                {active.secondary && view.secondaryRawValues?.[hoverIdx!] !== undefined && (
                  <span>
                    <span className="text-muted">{active.secondary.label}:</span>{" "}
                    <span
                      className="font-medium"
                      style={{
                        color:
                          view.secondaryRawValues![hoverIdx!] >= 0
                            ? "var(--positive)"
                            : "var(--negative)",
                      }}
                    >
                      {formatY(
                        view.secondaryRawValues![hoverIdx!],
                        active.secondary.unit,
                      )}
                    </span>
                  </span>
                )}
              </div>
            )}
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
              independent valuations. NAV/share chart overlays the stock price
              at each reporting date and shows premium/discount on the right
              axis (price ÷ NAV − 1).
            </>
          ) : (
            <>
              Market cap, EV charts hold shares and net debt constant at
              current values. Adding manual quarterly data in{" "}
              <code className="rounded bg-bg px-1 py-0.5 text-[11px]">
                content/farmland-financials/{filing.ticker}.json
              </code>{" "}
              will unlock revenue / EBITDA / NAV time-series.
            </>
          )}
        </p>
      </section>
    </div>
  );
}

function Legend({ active }: { active: Series }) {
  return (
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
      <Swatch color={C_PRIMARY} label={active.label} />
      {active.overlay && (
        <Swatch color={C_OVERLAY} label={active.overlay.label} dashed />
      )}
      {active.secondary && (
        <Swatch
          color={C_SECONDARY_NEGATIVE}
          label={`${active.secondary.label} (right axis)`}
        />
      )}
    </div>
  );
}

function Swatch({
  color,
  label,
  dashed,
}: {
  color: string;
  label: string;
  dashed?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg width={20} height={6} aria-hidden>
        <line
          x1={0}
          x2={20}
          y1={3}
          y2={3}
          stroke={color}
          strokeWidth="2"
          strokeDasharray={dashed ? "3 2" : undefined}
        />
      </svg>
      <span className="text-muted">{label}</span>
    </span>
  );
}

// ---- Series construction ------------------------------------------------

type Unit =
  | { kind: "currency"; ccy: string }
  | { kind: "millions"; ccy: string }
  | { kind: "thousands" }
  | { kind: "multiplier" }
  | { kind: "percent" };

type SeriesKind = "line" | "bar";

type Series = {
  label: string;
  description: string;
  unit: Unit;
  kind: SeriesKind;
  points: { label: string; value: number }[];
  // Optional secondary line on the same primary axis (e.g. price overlay
  // on NAV chart). Same units as primary.
  overlay?: {
    label: string;
    points: { label: string; value: number }[];
  };
  // Optional series rendered on a separate right-side y-axis (e.g. % premium/
  // discount line on a NAV chart).
  secondary?: {
    label: string;
    unit: Unit;
    points: { label: string; value: number }[];
  };
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
    const navKey: keyof FinancialsPeriod | null = financials.periods.some(
      (p) => typeof p.fmvNavPerShare === "number",
    )
      ? "fmvNavPerShare"
      : financials.periods.some((p) => typeof p.navPerShare === "number")
      ? "navPerShare"
      : financials.periods.some(
          (p) => typeof p.bookValuePerShare === "number",
        )
      ? "bookValuePerShare"
      : null;

    if (navKey) {
      const navLabel =
        navKey === "fmvNavPerShare"
          ? "FMV NAV / share"
          : navKey === "navPerShare"
          ? "NAV / share"
          : "Book value / share";
      const navSeries = pickSeries(financials, navKey, {
        label: navLabel,
        description: `${navLabel}, ${ccy}`,
        unit: { kind: "currency", ccy },
        kind: "line",
      });

      // Build overlay (stock price at each NAV reporting date) + secondary
      // axis (premium/discount % to NAV) when we have history.
      if (navSeries && history && history.points.length > 0) {
        const overlayPoints: { label: string; value: number }[] = [];
        const secondaryPoints: { label: string; value: number }[] = [];

        for (const p of financials.periods) {
          const v = p[navKey];
          if (typeof v !== "number") continue;
          const px = findClosestPrice(history, p.endDate);
          if (px === null) continue;
          const label = formatPeriodLabel(p);
          overlayPoints.push({ label, value: px });
          // Premium/discount = (price − NAV) / NAV × 100. Negative = discount.
          secondaryPoints.push({
            label,
            value: ((px - v) / v) * 100,
          });
        }

        if (overlayPoints.length > 0) {
          navSeries.overlay = {
            label: "Stock price",
            points: overlayPoints,
          };
        }
        if (secondaryPoints.length > 0) {
          navSeries.secondary = {
            label: "Premium / discount to NAV",
            unit: { kind: "percent" },
            points: secondaryPoints,
          };
        }
      }

      result.navPerShare = navSeries;
    }

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
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function findClosestPrice(
  history: PriceHistory,
  isoDate: string,
): number | null {
  const target = new Date(isoDate).getTime();
  let best: { delta: number; close: number } | null = null;
  for (const p of history.points) {
    const t = new Date(p.date).getTime();
    const delta = Math.abs(t - target);
    if (best === null || delta < best.delta) {
      best = { delta, close: p.close };
    }
  }
  // Reject if closest match is more than 90 days away — avoid stale prices
  // for very-old reporting dates outside the 5y price window.
  if (best === null || best.delta > 90 * 24 * 60 * 60 * 1000) return null;
  return best.close;
}

// ---- View builder -------------------------------------------------------

type ViewPoint = { label: string; value: number; x: number; y: number };

function buildView(active: Series) {
  const points = active.points;
  const kind = active.kind;
  const values = points.map((p) => p.value);

  // Combine primary values with overlay values for shared-axis scaling
  const overlayValues = active.overlay?.points.map((p) => p.value) ?? [];
  const allPrimary = [...values, ...overlayValues];

  const minRaw = Math.min(...allPrimary);
  const maxRaw = Math.max(...allPrimary);
  const yMinTarget = kind === "bar" ? Math.min(0, minRaw) : minRaw;
  const yMaxTarget = kind === "bar" ? Math.max(0, maxRaw) : maxRaw;
  const pad =
    (yMaxTarget - yMinTarget) * 0.1 || Math.abs(yMaxTarget) * 0.05 || 1;
  const yMin = niceFloor(yMinTarget - (kind === "bar" ? 0 : pad));
  const yMax = niceCeil(yMaxTarget + pad);

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const stepX = innerW / Math.max(points.length - 1, 1);

  const yOf = (v: number) =>
    yMax === yMin
      ? PAD.top + innerH / 2
      : PAD.top + (1 - (v - yMin) / (yMax - yMin)) * innerH;

  const out: ViewPoint[] = points.map((p, i) => ({
    label: p.label,
    value: p.value,
    x: points.length === 1 ? PAD.left + innerW / 2 : PAD.left + i * stepX,
    y: yOf(p.value),
  }));

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

  // Overlay rendering (uses same x positions as primary; same y scale)
  let overlayPoints: ViewPoint[] | null = null;
  let overlayPath: string | null = null;
  if (active.overlay && active.overlay.points.length === points.length) {
    overlayPoints = active.overlay.points.map((p, i) => ({
      label: p.label,
      value: p.value,
      x: out[i].x,
      y: yOf(p.value),
    }));
    overlayPath = overlayPoints
      .map(
        (p, i) =>
          `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`,
      )
      .join(" ");
  }

  // Secondary axis (right side) — independent scale
  let secondaryPoints: ViewPoint[] | null = null;
  let secondaryRawValues: number[] | null = null;
  let secondaryPath: string | null = null;
  let secondaryYTicks: { value: number; y: number }[] | null = null;
  let secondaryYZero: number | null = null;
  if (active.secondary && active.secondary.points.length === points.length) {
    secondaryRawValues = active.secondary.points.map((p) => p.value);
    const sMin = Math.min(...secondaryRawValues);
    const sMax = Math.max(...secondaryRawValues);
    // Pad and include 0 for premium/discount charts
    const sMinTarget = Math.min(0, sMin);
    const sMaxTarget = Math.max(0, sMax);
    const sPad = (sMaxTarget - sMinTarget) * 0.15 || Math.abs(sMaxTarget) * 0.1 || 5;
    const s2Min = niceFloor(sMinTarget - sPad);
    const s2Max = niceCeil(sMaxTarget + sPad);

    const sYof = (v: number) =>
      s2Max === s2Min
        ? PAD.top + innerH / 2
        : PAD.top + (1 - (v - s2Min) / (s2Max - s2Min)) * innerH;

    secondaryPoints = active.secondary.points.map((p, i) => ({
      label: p.label,
      value: p.value,
      x: out[i].x,
      y: sYof(p.value),
    }));
    secondaryPath = secondaryPoints
      .map(
        (p, i) =>
          `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`,
      )
      .join(" ");

    secondaryYTicks = [];
    const tickCount = 4;
    for (let i = 0; i <= tickCount; i++) {
      const v = s2Min + ((s2Max - s2Min) * i) / tickCount;
      secondaryYTicks.push({ value: v, y: sYof(v) });
    }
    if (0 >= s2Min && 0 <= s2Max) {
      secondaryYZero = sYof(0);
    }
  }

  // Y ticks
  const yTicks: { value: number; y: number }[] = [];
  const tickCount = 4;
  for (let i = 0; i <= tickCount; i++) {
    const v = yMin + ((yMax - yMin) * i) / tickCount;
    yTicks.push({ value: v, y: yOf(v) });
  }

  const yZero =
    kind === "bar" && 0 >= yMin && 0 <= yMax ? yOf(0) : null;

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

  return {
    points: out,
    path,
    area,
    yTicks,
    xTicks,
    yZero,
    overlayPoints,
    overlayPath,
    secondaryPoints,
    secondaryRawValues,
    secondaryPath,
    secondaryYTicks,
    secondaryYZero,
  };
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
  if (unit.kind === "percent") {
    return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
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
  if (unit.kind === "percent") {
    return `${v >= 0 ? "+" : ""}${v.toFixed(0)}%`;
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
