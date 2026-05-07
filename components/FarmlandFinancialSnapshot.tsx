"use client";

import { useMemo, useRef, useState } from "react";
import type { FarmlandFiling, PricedFarmlandComp } from "@/lib/farmland-comps";
import type { Financials, FinancialsPeriod } from "@/lib/farmland-financials";
import type { PriceHistory } from "@/lib/farmland-history";

type ChartId =
  | "price"
  | "income"
  | "propertyValue"
  | "navPerShare"
  | "acreage"
  | "capRate";

const CHART_DEFS: { id: ChartId; label: string; description: string }[] = [
  {
    id: "price",
    label: "Share price",
    description: "Daily local-currency close.",
  },
  {
    id: "income",
    label: "Income",
    description:
      "Net revenue stacked above zero, opex stacked below, gross-revenue + EBITDA lines, EBITDA margin on right axis.",
  },
  {
    id: "propertyValue",
    label: "Property value",
    description:
      "Independent appraisal / fair value of the property portfolio.",
  },
  {
    id: "navPerShare",
    label: "NAV / share",
    description:
      "FMV NAV per share with daily stock price overlay and daily premium/discount on right axis.",
  },
  {
    id: "acreage",
    label: "Acreage",
    description:
      "Total operated/managed acres (left) and market-implied EV per acre (right, daily).",
  },
  {
    id: "capRate",
    label: "Cap-Rate",
    description:
      "Market cap rate (EBITDA ÷ EV, daily) vs NAV cap rate (EBITDA ÷ property FMV, step).",
  },
];

const W = 760;
const H = 320;
const PAD = { top: 28, right: 64, bottom: 36, left: 64 };

const C_PRIMARY = "var(--accent)";
const C_OVERLAY = "var(--fg-soft)";
const C_OVERLAY2 = "var(--positive)";
const C_SECONDARY_POSITIVE = "var(--positive)";
const C_SECONDARY_NEGATIVE = "var(--negative)";

// Segment fill palette for stacked revenue bars (cycles if more than 6 segments)
const SEGMENT_PALETTE = [
  "var(--accent)",
  "var(--positive)",
  "var(--fg-soft)",
  "var(--muted)",
  "var(--rule)",
];

// Distinct palette for expense segments (rendered below zero) so users can
// tell revenue contribution apart from cost structure at a glance.
const EXPENSE_PALETTE = [
  "var(--negative)",
  "#b86a6a",
  "#7d4949",
  "#5a3535",
];

function segmentColor(i: number): string {
  return SEGMENT_PALETTE[i % SEGMENT_PALETTE.length];
}

function expenseColor(i: number): string {
  return EXPENSE_PALETTE[i % EXPENSE_PALETTE.length];
}

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
  // Default to most-granular cadence available — quarterly when the
  // ticker reports any Q (or H) periods; else annual.
  const hasSubAnnual = !!financials?.periods.some(
    (p) =>
      (p.periodType === "Q" || p.periodType === "H") &&
      typeof p.revenueMM === "number",
  );
  const [incomeCadence, setIncomeCadence] = useState<IncomeCadence>(
    hasSubAnnual ? "Q" : "FY",
  );

  const series = useMemo(
    () => buildAllSeries(filing, priced, history, financials, incomeCadence),
    [filing, priced, history, financials, incomeCadence],
  );

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
      active && active.points.length > 0 ? buildView(active) : null,
    [active],
  );

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!view) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    // For multi-series charts, hover snaps to the densest series (overlay or
    // secondary if present, else primary). This matches what users see
    // visually since dense lines have many more points.
    const targetPoints =
      view.overlayPoints ?? view.secondaryPoints ?? view.points;
    const idx = nearestIndex(x, targetPoints);
    setHoverIdx(idx);
  }
  function onLeave() {
    setHoverIdx(null);
  }

  // Resolve hover values across primary + overlay + secondary
  const targetPoints = view
    ? view.overlayPoints ?? view.secondaryPoints ?? view.points
    : null;
  const hoveredPoint =
    hoverIdx !== null && targetPoints ? targetPoints[hoverIdx] : null;

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

  // Most-recent values for header (right-most point of each series)
  const lastPrimary = view
    ? view.points[view.points.length - 1]
    : null;
  const lastOverlay = view?.overlayPoints
    ? view.overlayPoints[view.overlayPoints.length - 1]
    : null;
  const lastSecondaryRaw =
    view?.secondaryRawValues && view.secondaryRawValues.length > 0
      ? view.secondaryRawValues[view.secondaryRawValues.length - 1]
      : null;

  // Match hovered date to find each series' value at that date
  const hoverDate = hoveredPoint?.dateMs ?? null;
  const primaryAtHover = hoverDate
    ? findValueAtOrBefore(view!.points, hoverDate)
    : null;
  const overlayAtHover =
    hoverDate && view?.overlayPoints
      ? findValueAtOrBefore(view.overlayPoints, hoverDate)
      : null;
  const secondaryAtHover =
    hoverDate && view?.secondaryPoints && view?.secondaryRawValues
      ? findRawAtOrBefore(
          view.secondaryPoints,
          view.secondaryRawValues,
          hoverDate,
        )
      : null;

  return (
    <div className="space-y-12">
      <section className="mt-8">
        <SectionHeader
          title="Financial snapshot"
          subtitle={
            financials
              ? `${financials.periods.length} reported periods · ${
                  history
                    ? `${history.points.length} daily price points`
                    : "no price history"
                }`
              : history
              ? `${history.points.length} daily price points · no manual fundamentals yet`
              : ""
          }
        />

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-b border-rule pb-3">
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
                  onClick={() => {
                    setActiveId(c.id);
                    setHoverIdx(null);
                  }}
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
          {activeId === "income" && hasSubAnnual && (
            <div
              role="group"
              aria-label="Income cadence"
              className="flex gap-1"
            >
              {(["Q", "FY"] as IncomeCadence[]).map((c) => {
                const on = incomeCadence === c;
                return (
                  <button
                    key={c}
                    onClick={() => {
                      setIncomeCadence(c);
                      setHoverIdx(null);
                    }}
                    aria-pressed={on}
                    className={`rounded-sm border px-2.5 py-1 text-xs transition-colors ${
                      on
                        ? "border-accent bg-accent !text-bg"
                        : "border-rule !text-fg hover:border-accent hover:!text-accent"
                    }`}
                  >
                    {c === "Q" ? "Quarterly" : "Annual"}
                  </button>
                );
              })}
            </div>
          )}
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
                  {hoveredPoint
                    ? formatY(
                        primaryAtHover ?? hoveredPoint.value,
                        active.unit,
                      )
                    : lastPrimary
                    ? formatY(lastPrimary.value, active.unit)
                    : "—"}
                </div>
                <div className="text-xs text-muted">
                  {hoveredPoint
                    ? formatDate(hoveredPoint.dateMs)
                    : `${formatDate(view.points[0].dateMs)} → ${formatDate(
                        view.points[view.points.length - 1].dateMs,
                      )}`}{" "}
                  · {active.description}
                </div>
              </div>
              {active.secondary && lastSecondaryRaw !== null && (
                <div className="text-right text-xs">
                  <div className="text-muted">{active.secondary.label}</div>
                  <div
                    className={`text-sm font-medium tabular-nums ${
                      lastSecondaryRaw >= 0
                        ? "text-[var(--positive)]"
                        : "text-[var(--negative)]"
                    }`}
                  >
                    {formatY(lastSecondaryRaw, active.secondary.unit)}
                  </div>
                </div>
              )}
            </div>

            {(active.overlay ||
              active.overlay2 ||
              active.secondary ||
              active.segments) && <Legend active={active} />}

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
                  textAnchor={t.anchor}
                  fontSize="10"
                  fill="var(--muted)"
                >
                  {t.label}
                </text>
              ))}

              {/* Zero reference line for secondary axis */}
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

              {/* Primary series rendering */}
              {active.kind === "line" || active.kind === "step" ? (
                <>
                  <path d={view.area} fill={C_PRIMARY} fillOpacity="0.08" />
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
                    Math.min(
                      32,
                      ((W - PAD.left - PAD.right) / view.points.length) * 0.7,
                    ),
                  );
                  // Stacked segments (revenue above zero, expenses below).
                  // Years that have segment columns defined globally but
                  // no per-year contributions (older issuers' early years)
                  // still need a primary bar — fall through to plain
                  // when this year's stack would render nothing.
                  const revStackForYear = view.segmentStacks?.[i] ?? [];
                  const expStackForYear = view.expenseStacks?.[i] ?? [];
                  const hasRevSegs = revStackForYear.some((s) => s.value > 0);
                  const hasExpSegs = expStackForYear.some((s) => s.value > 0);
                  if (hasRevSegs || hasExpSegs) {
                    const yZero =
                      view.yZero !== null ? view.yZero : H - PAD.bottom;
                    const plainTop = Math.min(p.y, yZero);
                    const plainHeight = Math.abs(p.y - yZero);
                    return (
                      <g key={i}>
                        {/* When there are NO revenue segments but there
                            ARE expense segments (e.g. LAND, where opex is
                            split but revenue isn't), still draw the
                            primary revenue bar above zero — otherwise the
                            chart would show only the negative-direction
                            expense stack and the user can't see revenue. */}
                        {!hasRevSegs && hasExpSegs && (
                          <rect
                            x={p.x - barW / 2}
                            y={plainTop}
                            width={barW}
                            height={plainHeight}
                            fill={C_PRIMARY}
                            fillOpacity={0.7}
                          />
                        )}
                        {hasRevSegs &&
                          revStackForYear.map((seg, si) => {
                            if (seg.value <= 0) return null;
                            const top = Math.min(seg.y0, seg.y1);
                            const height = Math.abs(seg.y0 - seg.y1);
                            return (
                              <rect
                                key={`r-${si}`}
                                x={p.x - barW / 2}
                                y={top}
                                width={barW}
                                height={height}
                                fill={segmentColor(si)}
                                fillOpacity={0.85}
                              />
                            );
                          })}
                        {hasExpSegs &&
                          expStackForYear.map((seg, si) => {
                            if (seg.value <= 0) return null;
                            const top = Math.min(seg.y0, seg.y1);
                            const height = Math.abs(seg.y0 - seg.y1);
                            return (
                              <rect
                                key={`e-${si}`}
                                x={p.x - barW / 2}
                                y={top}
                                width={barW}
                                height={height}
                                fill={expenseColor(si)}
                                fillOpacity={0.85}
                              />
                            );
                          })}
                      </g>
                    );
                  }
                  // Plain bar
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
                      fillOpacity={0.7}
                    />
                  );
                })
              )}

              {/* Sparse markers for primary series — only when reasonably sparse */}
              {(active.kind === "line" || active.kind === "step") &&
                view.points.length <= 50 &&
                view.points.map((p, i) => (
                  <circle
                    key={`p-${i}`}
                    cx={p.x}
                    cy={p.y}
                    r={2.5}
                    fill="var(--bg)"
                    stroke={C_PRIMARY}
                    strokeWidth="1.5"
                  />
                ))}

              {/* Overlay series */}
              {view.overlayPath && (
                <path
                  d={view.overlayPath}
                  fill="none"
                  stroke={C_OVERLAY}
                  strokeWidth="1.5"
                  strokeOpacity="0.85"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              )}

              {/* Overlay 2 series (e.g. EBITDA on Income chart) */}
              {view.overlay2Path && (
                <path
                  d={view.overlay2Path}
                  fill="none"
                  stroke={C_OVERLAY2}
                  strokeWidth="1.75"
                  strokeOpacity="0.9"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              )}

              {/* Secondary series */}
              {view.secondaryPath && (
                <path
                  d={view.secondaryPath}
                  fill="none"
                  stroke={C_SECONDARY_NEGATIVE}
                  strokeWidth="1.5"
                  strokeOpacity="0.85"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              )}

              {/* Hover crosshair + dots */}
              {hoveredPoint && (
                <g>
                  <line
                    x1={hoveredPoint.x}
                    x2={hoveredPoint.x}
                    y1={PAD.top}
                    y2={H - PAD.bottom}
                    stroke="var(--accent)"
                    strokeOpacity="0.35"
                    strokeDasharray="3 3"
                  />
                  {primaryAtHover !== null && view.points.length > 0 && (
                    <PrimaryHoverDot
                      view={view}
                      hoverDate={hoveredPoint.dateMs}
                    />
                  )}
                  {view.overlayPoints &&
                    hoverIdx !== null &&
                    view.overlayPoints[hoverIdx] && (
                      <circle
                        cx={view.overlayPoints[hoverIdx].x}
                        cy={view.overlayPoints[hoverIdx].y}
                        r={3.5}
                        fill="var(--bg)"
                        stroke={C_OVERLAY}
                        strokeWidth="1.5"
                      />
                    )}
                  {view.secondaryPoints &&
                    view.secondaryRawValues &&
                    hoverIdx !== null &&
                    view.secondaryPoints[hoverIdx] && (
                      <circle
                        cx={view.secondaryPoints[hoverIdx].x}
                        cy={view.secondaryPoints[hoverIdx].y}
                        r={3.5}
                        fill={
                          view.secondaryRawValues[hoverIdx] >= 0
                            ? C_SECONDARY_POSITIVE
                            : C_SECONDARY_NEGATIVE
                        }
                        stroke="var(--bg)"
                        strokeWidth="1"
                      />
                    )}
                </g>
              )}
            </svg>

            {/* Hover detail strip */}
            {hoveredPoint && (active.overlay || active.secondary) && (
              <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs tabular-nums">
                <span>
                  <span className="text-muted">{active.label}:</span>{" "}
                  <span className="font-medium" style={{ color: C_PRIMARY }}>
                    {primaryAtHover !== null
                      ? formatY(primaryAtHover, active.unit)
                      : "—"}
                  </span>
                </span>
                {active.overlay && (
                  <span>
                    <span className="text-muted">{active.overlay.label}:</span>{" "}
                    <span className="font-medium" style={{ color: C_OVERLAY }}>
                      {overlayAtHover !== null
                        ? formatY(overlayAtHover, active.unit)
                        : "—"}
                    </span>
                  </span>
                )}
                {active.secondary && (
                  <span>
                    <span className="text-muted">
                      {active.secondary.label}:
                    </span>{" "}
                    <span
                      className="font-medium"
                      style={{
                        color:
                          (secondaryAtHover ?? 0) >= 0
                            ? "var(--positive)"
                            : "var(--negative)",
                      }}
                    >
                      {secondaryAtHover !== null
                        ? formatY(secondaryAtHover, active.secondary.unit)
                        : "—"}
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
              — manually compiled at the most-granular timeframe each issuer
              discloses (typically quarterly). Stock price overlay and
              premium/discount on the NAV/share chart use daily Yahoo close;
              premium/discount steps each time NAV is re-reported.
            </>
          ) : (
            <>
              Charts use daily Yahoo close. Adding manual quarterly data in{" "}
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

function PrimaryHoverDot({
  view,
  hoverDate,
}: {
  view: View;
  hoverDate: number;
}) {
  // Find primary point at-or-before hoverDate. Render a dot interpolated
  // along the (step or line) path at hoverDate's x position.
  const x =
    PAD.left +
    ((hoverDate - view.dateMin) / Math.max(1, view.dateMax - view.dateMin)) *
      (W - PAD.left - PAD.right);
  let primaryY: number | null = null;
  for (let i = view.points.length - 1; i >= 0; i--) {
    if (view.points[i].dateMs <= hoverDate) {
      primaryY = view.points[i].y;
      break;
    }
  }
  if (primaryY === null) primaryY = view.points[0].y;
  return (
    <circle
      cx={x}
      cy={primaryY}
      r={4}
      fill={C_PRIMARY}
      stroke="var(--bg)"
      strokeWidth="1.5"
    />
  );
}

function Legend({ active }: { active: Series }) {
  // For bar charts with segments, show segment swatches instead of the
  // generic "primary" swatch.
  const showSegments =
    active.kind === "bar" && active.segments && active.segments.names.length > 0;
  const showExpenses =
    active.kind === "bar" &&
    active.segments?.expenseNames &&
    active.segments.expenseNames.length > 0;
  return (
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
      {showSegments
        ? active.segments!.names.map((name, i) => (
            <Swatch key={`r-${name}`} color={segmentColor(i)} label={name} />
          ))
        : !showExpenses && <Swatch color={C_PRIMARY} label={active.label} />}
      {showExpenses &&
        active.segments!.expenseNames!.map((name, i) => (
          <Swatch
            key={`e-${name}`}
            color={expenseColor(i)}
            label={`${name} (expense)`}
          />
        ))}
      {active.overlay && (
        <Swatch color={C_OVERLAY} label={active.overlay.label} />
      )}
      {active.overlay2 && (
        <Swatch color={C_OVERLAY2} label={active.overlay2.label} />
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

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg width={20} height={6} aria-hidden>
        <line x1={0} x2={20} y1={3} y2={3} stroke={color} strokeWidth="2" />
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

type SeriesKind = "line" | "bar" | "step";

type DatedPoint = { date: string; value: number };

type Series = {
  label: string;
  description: string;
  unit: Unit;
  kind: SeriesKind;
  points: DatedPoint[];
  overlay?: { label: string; points: DatedPoint[] };
  // Optional second overlay (line) on the same primary axis. Used for the
  // Income chart to show gross-vs-net revenue context above the segment
  // stacks.
  overlay2?: { label: string; points: DatedPoint[] };
  secondary?: { label: string; unit: Unit; points: DatedPoint[] };
  // Segment stacking: when present and kind === 'bar', each bar is split
  // into colored segments. Segments[i] provides the value contribution
  // per segment for points[i]. Segment names should be stable across
  // points (missing segments treated as 0). Optional expense* fields stack
  // downward below zero in the same bar.
  segments?: {
    names: string[];
    perPoint: Record<string, number>[];
    expenseNames?: string[];
    expensePerPoint?: Record<string, number>[];
  };
};

function buildAllSeries(
  filing: FarmlandFiling,
  priced: PricedFarmlandComp | undefined,
  history: PriceHistory | null,
  financials: Financials | null,
  incomeCadence: IncomeCadence,
): Record<ChartId, Series | null> {
  const result: Record<ChartId, Series | null> = {
    price: null,
    income: null,
    propertyValue: null,
    navPerShare: null,
    acreage: null,
    capRate: null,
  };

  // Pre-build aux series we'll need: daily market cap, daily EV (using
  // most-recent disclosed shares + net debt at-or-before each date if
  // financials provide them; otherwise current values).
  let dailyMarketCap: DatedPoint[] = [];
  let dailyEv: DatedPoint[] = [];
  if (history && history.points.length > 0) {
    const pricePoints: DatedPoint[] = history.points.map((p) => ({
      date: p.date,
      value: p.close,
    }));
    result.price = {
      label: "Share price",
      description: "Daily local-currency close.",
      unit: { kind: "currency", ccy: history.currency },
      kind: "line",
      points: pricePoints,
    };

    // Build daily MC + EV using historical shares + netDebt where available
    const sharesSeries = financials
      ? collectDated(financials, "sharesOutMM")
      : [];
    const netDebtSeries = financials
      ? collectDated(financials, "netDebtMM")
      : [];

    const currentShares = filing.sharesOutMM;
    const currentNetDebt = filing.debtMM - filing.cashMM;

    dailyMarketCap = pricePoints.map((p) => {
      const sh =
        findValueAtOrBeforeDated(sharesSeries, p.date) ?? currentShares;
      return { date: p.date, value: p.value * sh };
    });
    dailyEv = pricePoints.map((p) => {
      const mc = dailyMarketCap.find((x) => x.date === p.date)?.value ?? 0;
      const nd =
        findValueAtOrBeforeDated(netDebtSeries, p.date) ?? currentNetDebt;
      return { date: p.date, value: mc + nd };
    });
  }

  // --- Reported financials ---
  if (financials && financials.periods.length > 0) {
    const ccy = financials.currency;

    // ---- Income chart: combine net revenue (segment-stacked bars) +
    // gross revenue overlay + EBITDA overlay ----
    result.income = buildIncomeSeries(financials, ccy, incomeCadence);
    const propertySeries =
      pickSeries(financials, "propertyFmvMM", {
        label: "Property value",
        description: `Independent appraisal / fair value, ${ccy} M`,
        unit: { kind: "millions", ccy },
        kind: "step",
      }) ??
      pickSeries(financials, "propertyBookMM", {
        label: "Property book",
        description: `Property book value, ${ccy} M`,
        unit: { kind: "millions", ccy },
        kind: "step",
      });
    result.propertyValue = propertySeries;

    // NAV/share + price overlay + premium/discount secondary.
    // Per-period fall-through: prefer FMV NAV → NAV → book value per
    // share so that issuers like LAND (which only started disclosing
    // estimated NAV in 2021) still get a continuous series back to IPO
    // via earlier-year book value. Label uses the BEST disclosure
    // available so users understand what's plotted.
    type NavSourceKey =
      | "fmvNavPerShare"
      | "navPerShare"
      | "bookValuePerShare";
    const hasFmvNav = financials.periods.some(
      (p) => typeof p.fmvNavPerShare === "number",
    );
    const hasNav = financials.periods.some(
      (p) => typeof p.navPerShare === "number",
    );
    const hasBvps = financials.periods.some(
      (p) => typeof p.bookValuePerShare === "number",
    );
    const navKey: NavSourceKey | null = hasFmvNav
      ? "fmvNavPerShare"
      : hasNav
      ? "navPerShare"
      : hasBvps
      ? "bookValuePerShare"
      : null;

    if (navKey) {
      const navLabel = hasFmvNav
        ? "FMV NAV / share"
        : hasNav
        ? "NAV / share"
        : "Book value / share";
      const pickPerPeriod = (p: FinancialsPeriod): number | undefined => {
        if (typeof p.fmvNavPerShare === "number") return p.fmvNavPerShare;
        if (typeof p.navPerShare === "number") return p.navPerShare;
        if (typeof p.bookValuePerShare === "number")
          return p.bookValuePerShare;
        return undefined;
      };
      const points: DatedPoint[] = [];
      const seenDates = new Set<string>();
      for (const p of financials.periods) {
        const v = pickPerPeriod(p);
        if (v === undefined) continue;
        if (seenDates.has(p.endDate)) continue; // dedupe Q vs FY same-date
        seenDates.add(p.endDate);
        points.push({ date: p.endDate, value: v });
      }
      points.sort((a, b) => a.date.localeCompare(b.date));
      const navSeries: Series | null = points.length > 0
        ? {
            label: navLabel,
            description: `${navLabel}, ${ccy} (best-available per period)`,
            unit: { kind: "currency", ccy },
            kind: "step",
            points,
          }
        : null;

      // Daily price overlay + daily premium/discount secondary axis
      if (navSeries && history && history.points.length > 0) {
        // Sort NAV reporting dates
        const navByDate = navSeries.points
          .slice()
          .sort((a, b) => a.date.localeCompare(b.date));

        const overlayPoints: DatedPoint[] = history.points.map((p) => ({
          date: p.date,
          value: p.close,
        }));

        // For each daily price, find the most recent NAV at-or-before that
        // date and compute premium/discount = (price − NAV) / NAV × 100.
        // Skip days before the first NAV report.
        const secondaryPoints: DatedPoint[] = [];
        for (const p of history.points) {
          const navAtDate = findValueAtOrBeforeDated(navByDate, p.date);
          if (navAtDate === null || navAtDate === 0) continue;
          secondaryPoints.push({
            date: p.date,
            value: ((p.close - navAtDate) / navAtDate) * 100,
          });
        }

        if (overlayPoints.length > 0) {
          navSeries.overlay = { label: "Stock price", points: overlayPoints };
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

    const acresSeries = pickSeries(financials, "totalAcresK", {
      label: "Acreage (K)",
      description: "Total operated / managed area, thousands of acres",
      unit: { kind: "thousands" },
      kind: "step",
    });
    if (acresSeries) {
      // Secondary axis: market-implied EV per acre, daily
      if (dailyEv.length > 0) {
        const evPerAcrePoints: DatedPoint[] = [];
        for (const p of dailyEv) {
          const acresKAtDate =
            findValueAtOrBeforeDated(
              acresSeries.points.map((x) => ({ date: x.date, value: x.value })),
              p.date,
            ) ?? filing.acresK;
          if (acresKAtDate > 0) {
            // EV (in $M) ÷ acres (in K) = $ per K-acre... convert to $/acre
            // EV/M × 1,000,000 = $; ÷ (acresK × 1,000) = $/acre
            const dollarsPerAcre =
              (p.value * 1_000_000) / (acresKAtDate * 1_000);
            evPerAcrePoints.push({ date: p.date, value: dollarsPerAcre });
          }
        }
        if (evPerAcrePoints.length > 0) {
          acresSeries.secondary = {
            label: "Market price / acre (EV ÷ acres)",
            unit: { kind: "currency", ccy },
            points: evPerAcrePoints,
          };
        }
      }
    }
    result.acreage = acresSeries;

    // ---- Cap-Rate chart ----
    // Market cap rate (daily) = EBITDA at date ÷ EV at date
    // NAV cap rate (step) = EBITDA at date ÷ property FMV at date
    // EBITDA series: prefer LTM/FY; fall back to annualized last quarter.
    const ebitdaForCap = collectAnnualizedEbitda(financials);
    const fmvSeries = collectDated(financials, "propertyFmvMM");
    if (
      dailyEv.length > 0 &&
      ebitdaForCap.length > 0 &&
      (fmvSeries.length > 0 || true)
    ) {
      const marketCapRate: DatedPoint[] = [];
      const navCapRate: DatedPoint[] = [];

      for (const p of dailyEv) {
        const e = findValueAtOrBeforeDated(ebitdaForCap, p.date);
        if (e === null || e <= 0) continue;
        if (p.value > 0) {
          marketCapRate.push({
            date: p.date,
            value: (e / p.value) * 100,
          });
        }
      }

      // NAV cap rate: at each FMV reporting date, compute EBITDA/FMV
      for (const f of fmvSeries) {
        const e = findValueAtOrBeforeDated(ebitdaForCap, f.date);
        if (e === null || e <= 0 || f.value <= 0) continue;
        navCapRate.push({
          date: f.date,
          value: (e / f.value) * 100,
        });
      }

      if (marketCapRate.length > 0) {
        const capSeries: Series = {
          label: "Market cap rate",
          description: `EBITDA ÷ EV (daily). Latest EBITDA: ${ccy} ${formatNum(ebitdaForCap[ebitdaForCap.length - 1].value)}M`,
          unit: { kind: "percent" },
          kind: "line",
          points: marketCapRate,
        };
        if (navCapRate.length > 0) {
          capSeries.overlay = {
            label: "NAV cap rate (EBITDA ÷ property FMV)",
            points: navCapRate,
          };
        }
        result.capRate = capSeries;
      }
    }
  }

  return result;
}

// Collect dated values for a numeric key from financials (raw, no period
// filtering — useful for shares, net debt, property FMV which are reported
// at multiple period types and we want all of them for the at-or-before
// lookup).
function collectDated(
  financials: Financials,
  key: keyof FinancialsPeriod,
): DatedPoint[] {
  const out: DatedPoint[] = [];
  for (const p of financials.periods) {
    const v = p[key];
    if (typeof v !== "number") continue;
    out.push({ date: p.endDate, value: v });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

// Collect annualized EBITDA for cap-rate computations. Prefers FY/LTM
// values directly; for quarterly periods, sums the trailing 4 quarters
// to construct an LTM EBITDA at each quarterly reporting date.
function collectAnnualizedEbitda(financials: Financials): DatedPoint[] {
  const fyOrLtm: DatedPoint[] = [];
  const quarterly: { date: string; value: number }[] = [];
  for (const p of financials.periods) {
    if (typeof p.ebitdaMM !== "number") continue;
    if (p.periodType === "FY" || p.periodType === "LTM") {
      fyOrLtm.push({ date: p.endDate, value: p.ebitdaMM });
    } else if (p.periodType === "Q") {
      quarterly.push({ date: p.endDate, value: p.ebitdaMM });
    }
  }
  // Sort
  fyOrLtm.sort((a, b) => a.date.localeCompare(b.date));
  quarterly.sort((a, b) => a.date.localeCompare(b.date));

  // Build LTM at each quarterly date by summing trailing 4 quarters
  const ltmFromQ: DatedPoint[] = [];
  for (let i = 3; i < quarterly.length; i++) {
    const sum =
      quarterly[i].value +
      quarterly[i - 1].value +
      quarterly[i - 2].value +
      quarterly[i - 3].value;
    ltmFromQ.push({ date: quarterly[i].date, value: sum });
  }

  // Combine FY/LTM and constructed LTM, keeping the most recent at each date
  const merged = [...fyOrLtm, ...ltmFromQ];
  merged.sort((a, b) => a.date.localeCompare(b.date));
  return merged;
}

export type IncomeCadence = "Q" | "FY";

// Build the Income chart series in the requested cadence (Q = strict
// quarterly only; FY = annual, with quarters/halves aggregated up where
// no FY row exists for a given year). The toggle in the UI swaps
// between the two so users can pick "as granular as possible" or "as
// far back as possible." Older issuers tend to have decades of FY-only
// archives but only a handful of Q years; LAND3 has both Q and FY for
// every year of its short post-IPO life.
function buildIncomeSeries(
  financials: Financials,
  ccy: string,
  cadence: IncomeCadence,
): Series | null {
  type Aggregated = {
    endDate: string;
    revenueMM: number;
    grossRevenueMM?: number;
    ebitdaMM?: number;
    revenueBySegmentMM?: Record<string, number>;
    expensesBySegmentMM?: Record<string, number>;
  };

  let aggregated: Aggregated[] = [];

  if (cadence === "Q") {
    // Strict quarterly when Q rows exist. Otherwise (semi-annual
    // issuers like AU/UK plc.s), fall back to half-yearly: emit H1
    // directly and synthesize H2 = FY − H1 for years where both the
    // interim H1 and the full FY were reported. Years with FY-only
    // (no interim) are skipped here — Annual mode covers them.
    const qRows = financials.periods.filter(
      (p) => p.periodType === "Q" && typeof p.revenueMM === "number",
    );
    if (qRows.length > 0) {
      aggregated = qRows
        .map((p) => ({
          endDate: p.endDate,
          revenueMM: p.revenueMM as number,
          grossRevenueMM: p.grossRevenueMM,
          ebitdaMM: p.ebitdaMM,
          revenueBySegmentMM: p.revenueBySegmentMM,
          expensesBySegmentMM: p.expensesBySegmentMM,
        }))
        .sort((a, b) => a.endDate.localeCompare(b.endDate));
    } else {
      const hByYear = new Map<number, FinancialsPeriod>();
      const fyByYear = new Map<number, FinancialsPeriod>();
      for (const p of financials.periods) {
        if (typeof p.revenueMM !== "number") continue;
        const y = new Date(p.endDate).getFullYear();
        if (p.periodType === "H") hByYear.set(y, p);
        else if (p.periodType === "FY") fyByYear.set(y, p);
      }
      const subtractNum = (
        fy: FinancialsPeriod,
        h1: FinancialsPeriod,
        key: "revenueMM" | "grossRevenueMM" | "ebitdaMM",
      ): number | undefined =>
        typeof fy[key] === "number" && typeof h1[key] === "number"
          ? (fy[key] as number) - (h1[key] as number)
          : undefined;
      const subtractSeg = (
        fy: FinancialsPeriod,
        h1: FinancialsPeriod,
        key: "revenueBySegmentMM" | "expensesBySegmentMM",
      ): Record<string, number> | undefined => {
        if (!fy[key] || !h1[key]) return undefined;
        const out: Record<string, number> = {};
        const keys = new Set([
          ...Object.keys(fy[key]!),
          ...Object.keys(h1[key]!),
        ]);
        for (const k of keys) {
          out[k] = (fy[key]![k] ?? 0) - (h1[key]![k] ?? 0);
        }
        return out;
      };
      const sortedYears = Array.from(
        new Set([...hByYear.keys(), ...fyByYear.keys()]),
      ).sort((a, b) => a - b);
      for (const y of sortedYears) {
        const h1 = hByYear.get(y);
        const fy = fyByYear.get(y);
        if (!h1) continue; // FY-only year — Annual toggle covers it
        aggregated.push({
          endDate: h1.endDate,
          revenueMM: h1.revenueMM as number,
          grossRevenueMM: h1.grossRevenueMM,
          ebitdaMM: h1.ebitdaMM,
          revenueBySegmentMM: h1.revenueBySegmentMM,
          expensesBySegmentMM: h1.expensesBySegmentMM,
        });
        if (fy) {
          const h2Rev = subtractNum(fy, h1, "revenueMM");
          if (typeof h2Rev === "number") {
            aggregated.push({
              endDate: fy.endDate,
              revenueMM: h2Rev,
              grossRevenueMM: subtractNum(fy, h1, "grossRevenueMM"),
              ebitdaMM: subtractNum(fy, h1, "ebitdaMM"),
              revenueBySegmentMM: subtractSeg(fy, h1, "revenueBySegmentMM"),
              expensesBySegmentMM: subtractSeg(fy, h1, "expensesBySegmentMM"),
            });
          }
        }
      }
      aggregated.sort((a, b) => a.endDate.localeCompare(b.endDate));
    }
  } else {
    // Annual: prefer FY rows, synthesize from 4 Q (or 2 H) where missing.
    const byYear = new Map<number, FinancialsPeriod[]>();
    for (const p of financials.periods) {
      if (typeof p.revenueMM !== "number") continue;
      const y = new Date(p.endDate).getFullYear();
      if (!byYear.has(y)) byYear.set(y, []);
      byYear.get(y)!.push(p);
    }

    const sumNum = (
      parts: FinancialsPeriod[],
      key: "revenueMM" | "grossRevenueMM" | "ebitdaMM",
    ): number | undefined => {
      if (!parts.every((p) => typeof p[key] === "number")) return undefined;
      return parts.reduce((s, p) => s + (p[key] as number), 0);
    };
    const sumSeg = (
      parts: FinancialsPeriod[],
      key: "revenueBySegmentMM" | "expensesBySegmentMM",
    ): Record<string, number> | undefined => {
      if (!parts.every((p) => p[key])) return undefined;
      const acc: Record<string, number> = {};
      for (const p of parts) {
        for (const [k, v] of Object.entries(p[key]!)) {
          acc[k] = (acc[k] ?? 0) + v;
        }
      }
      return acc;
    };

    for (const [, periods] of byYear) {
      const fy = periods.find(
        (p) => p.periodType === "FY" && typeof p.revenueMM === "number",
      );
      if (fy) {
        aggregated.push({
          endDate: fy.endDate,
          revenueMM: fy.revenueMM as number,
          grossRevenueMM: fy.grossRevenueMM,
          ebitdaMM: fy.ebitdaMM,
          revenueBySegmentMM: fy.revenueBySegmentMM,
          expensesBySegmentMM: fy.expensesBySegmentMM,
        });
        continue;
      }
      const qs = periods
        .filter((p) => p.periodType === "Q")
        .sort((a, b) => a.endDate.localeCompare(b.endDate));
      const hs = periods
        .filter((p) => p.periodType === "H")
        .sort((a, b) => a.endDate.localeCompare(b.endDate));
      let parts: FinancialsPeriod[] | null = null;
      if (qs.length === 4) parts = qs;
      else if (hs.length === 2) parts = hs;
      if (!parts) continue;
      const rev = sumNum(parts, "revenueMM");
      if (rev === undefined) continue;
      aggregated.push({
        endDate: parts[parts.length - 1].endDate,
        revenueMM: rev,
        grossRevenueMM: sumNum(parts, "grossRevenueMM"),
        ebitdaMM: sumNum(parts, "ebitdaMM"),
        revenueBySegmentMM: sumSeg(parts, "revenueBySegmentMM"),
        expensesBySegmentMM: sumSeg(parts, "expensesBySegmentMM"),
      });
    }
    aggregated.sort((a, b) => a.endDate.localeCompare(b.endDate));
  }

  if (aggregated.length === 0) return null;

  const points: DatedPoint[] = aggregated.map((a) => ({
    date: a.endDate,
    value: a.revenueMM,
  }));

  // Segment stack: union of revenue-segment names across years.
  const segmentNames = new Set<string>();
  for (const a of aggregated) {
    if (a.revenueBySegmentMM) {
      for (const k of Object.keys(a.revenueBySegmentMM)) segmentNames.add(k);
    }
  }
  let segments: Series["segments"] | undefined;
  if (segmentNames.size > 0) {
    const namesArr = Array.from(segmentNames);
    const perPoint = aggregated.map((a) => {
      const out: Record<string, number> = {};
      for (const n of namesArr) out[n] = a.revenueBySegmentMM?.[n] ?? 0;
      return out;
    });
    segments = { names: namesArr, perPoint };
  }

  // Expense segments (stacked below zero).
  const expenseNamesSet = new Set<string>();
  for (const a of aggregated) {
    if (a.expensesBySegmentMM) {
      for (const k of Object.keys(a.expensesBySegmentMM))
        expenseNamesSet.add(k);
    }
  }
  if (expenseNamesSet.size > 0) {
    const expenseNames = Array.from(expenseNamesSet);
    const expensePerPoint = aggregated.map((a) => {
      const out: Record<string, number> = {};
      for (const n of expenseNames) out[n] = a.expensesBySegmentMM?.[n] ?? 0;
      return out;
    });
    if (segments) {
      segments.expenseNames = expenseNames;
      segments.expensePerPoint = expensePerPoint;
    } else {
      segments = {
        names: [],
        perPoint: aggregated.map(() => ({})),
        expenseNames,
        expensePerPoint,
      };
    }
  }

  const series: Series = {
    label: "Net revenue",
    description: `Reported net revenue (${
      cadence === "Q" ? "quarterly" : "annual"
    }, segment-stacked), ${ccy} M`,
    unit: { kind: "millions", ccy },
    kind: "bar",
    points,
    segments,
  };

  // Gross revenue overlay
  const grossPoints: DatedPoint[] = [];
  for (const a of aggregated) {
    if (typeof a.grossRevenueMM === "number") {
      grossPoints.push({ date: a.endDate, value: a.grossRevenueMM });
    }
  }
  if (grossPoints.length > 0) {
    series.overlay = { label: "Gross revenue", points: grossPoints };
  }

  // EBITDA overlay
  const ebitdaPoints: DatedPoint[] = [];
  for (const a of aggregated) {
    if (typeof a.ebitdaMM === "number") {
      ebitdaPoints.push({ date: a.endDate, value: a.ebitdaMM });
    }
  }
  if (ebitdaPoints.length > 0) {
    series.overlay2 = { label: "EBITDA", points: ebitdaPoints };
  }

  // EBITDA margin (right axis) — annual.
  const marginPoints: DatedPoint[] = [];
  for (const a of aggregated) {
    if (typeof a.ebitdaMM === "number" && a.revenueMM > 0) {
      marginPoints.push({
        date: a.endDate,
        value: (a.ebitdaMM / a.revenueMM) * 100,
      });
    }
  }
  if (marginPoints.length > 0) {
    series.secondary = {
      label: "EBITDA margin",
      unit: { kind: "percent" },
      points: marginPoints,
    };
  }

  return series;
}

function pickSeries(
  financials: Financials,
  key: keyof FinancialsPeriod,
  meta: Omit<Series, "points">,
): Series | null {
  // For metrics that are reported at multiple period types (Q + FY + LTM),
  // prefer the most-granular (Q) within a fiscal year. We do this by:
  //  1. Collecting all (date, periodType, value) entries
  //  2. If we have any quarterly entries, drop the FY/LTM entries that
  //     overlap with quarterly coverage of the same fiscal year.
  type Entry = {
    date: string;
    periodType: FinancialsPeriod["periodType"];
    value: number;
  };
  const entries: Entry[] = [];
  for (const p of financials.periods) {
    const v = p[key];
    if (typeof v !== "number") continue;
    entries.push({ date: p.endDate, periodType: p.periodType, value: v });
  }
  if (entries.length === 0) return null;

  // Group quarterly years
  const quarterlyYears = new Set<number>();
  for (const e of entries) {
    if (e.periodType === "Q") {
      quarterlyYears.add(new Date(e.date).getFullYear());
    }
  }
  const filtered = entries.filter((e) => {
    if (e.periodType === "Q") return true;
    // Drop FY/LTM/H if quarterly data exists for that calendar year
    const y = new Date(e.date).getFullYear();
    if (quarterlyYears.has(y)) return false;
    return true;
  });

  filtered.sort((a, b) => a.date.localeCompare(b.date));
  return {
    ...meta,
    points: filtered.map(({ date, value }) => ({ date, value })),
  };
}

function findValueAtOrBeforeDated(
  series: DatedPoint[],
  targetDate: string,
): number | null {
  let best: DatedPoint | null = null;
  for (const p of series) {
    if (p.date <= targetDate) {
      if (best === null || p.date > best.date) best = p;
    }
  }
  return best?.value ?? null;
}

function findValueAtOrBefore(
  view: { dateMs: number; value: number }[],
  targetMs: number,
): number | null {
  let best: { dateMs: number; value: number } | null = null;
  for (const p of view) {
    if (p.dateMs <= targetMs) {
      if (best === null || p.dateMs > best.dateMs) best = p;
    }
  }
  return best?.value ?? null;
}

function findRawAtOrBefore(
  view: { dateMs: number }[],
  raw: number[],
  targetMs: number,
): number | null {
  let bestIdx = -1;
  for (let i = 0; i < view.length; i++) {
    if (view[i].dateMs <= targetMs) {
      if (bestIdx === -1 || view[i].dateMs > view[bestIdx].dateMs) bestIdx = i;
    }
  }
  return bestIdx >= 0 ? raw[bestIdx] : null;
}

// ---- View builder -------------------------------------------------------

type ViewPoint = {
  date: string;
  dateMs: number;
  value: number;
  x: number;
  y: number;
};

type View = {
  points: ViewPoint[];
  path: string;
  area: string;
  yTicks: { value: number; y: number }[];
  yZero: number | null;
  xTicks: { x: number; label: string; anchor: "start" | "middle" | "end" }[];
  dateMin: number;
  dateMax: number;
  overlayPoints: ViewPoint[] | null;
  overlayPath: string | null;
  overlay2Points: ViewPoint[] | null;
  overlay2Path: string | null;
  secondaryPoints: ViewPoint[] | null;
  secondaryRawValues: number[] | null;
  secondaryPath: string | null;
  secondaryYTicks: { value: number; y: number }[] | null;
  secondaryYZero: number | null;
  // Segment stack data: parallel to view.points; for each point a
  // sequence of stacked segment heights (in y-space, top-to-bottom).
  segmentStacks: { name: string; y0: number; y1: number; value: number }[][] | null;
  segmentNames: string[] | null;
  // Expense stacks: rendered below zero, value stored as positive but
  // y0/y1 reflect the negative direction.
  expenseStacks: { name: string; y0: number; y1: number; value: number }[][] | null;
  expenseNames: string[] | null;
};

function buildView(active: Series): View {
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  // Resolve full date range across all series in this chart
  const allDates: number[] = [];
  for (const p of active.points) allDates.push(toMs(p.date));
  if (active.overlay) for (const p of active.overlay.points) allDates.push(toMs(p.date));
  if (active.overlay2) for (const p of active.overlay2.points) allDates.push(toMs(p.date));
  if (active.secondary) for (const p of active.secondary.points) allDates.push(toMs(p.date));
  if (allDates.length === 0) {
    return emptyView();
  }
  const dateMin = Math.min(...allDates);
  const dateMax = Math.max(...allDates);
  const dateSpan = Math.max(1, dateMax - dateMin);

  const xOf = (dateMs: number) =>
    PAD.left + ((dateMs - dateMin) / dateSpan) * innerW;

  // Primary y scale — combine primary + overlay + overlay2 (same axis)
  const primaryRaw = active.points.map((p) => p.value);
  const overlayRaw = active.overlay?.points.map((p) => p.value) ?? [];
  const overlay2Raw = active.overlay2?.points.map((p) => p.value) ?? [];
  const allPrimary = [...primaryRaw, ...overlayRaw, ...overlay2Raw];
  // Account for expense totals stacked below zero.
  if (active.kind === "bar" && active.segments?.expensePerPoint) {
    for (const segMap of active.segments.expensePerPoint) {
      let sum = 0;
      for (const v of Object.values(segMap)) sum += v;
      if (sum > 0) allPrimary.push(-sum);
    }
  }
  const minRaw = Math.min(...allPrimary);
  const maxRaw = Math.max(...allPrimary);
  const isBar = active.kind === "bar";
  const yMinTarget = isBar ? Math.min(0, minRaw) : minRaw;
  const yMaxTarget = isBar ? Math.max(0, maxRaw) : maxRaw;
  const pad =
    (yMaxTarget - yMinTarget) * 0.1 || Math.abs(yMaxTarget) * 0.05 || 1;
  const yMin = niceFloor(yMinTarget - (isBar ? 0 : pad));
  const yMax = niceCeil(yMaxTarget + pad);

  const yOf = (v: number) =>
    yMax === yMin
      ? PAD.top + innerH / 2
      : PAD.top + (1 - (v - yMin) / (yMax - yMin)) * innerH;

  const points: ViewPoint[] = active.points
    .map((p) => ({
      date: p.date,
      dateMs: toMs(p.date),
      value: p.value,
      x: 0,
      y: 0,
    }))
    .sort((a, b) => a.dateMs - b.dateMs)
    .map((p) => ({ ...p, x: xOf(p.dateMs), y: yOf(p.value) }));

  // Build path: line, step, or bar
  let path = "";
  let area = "";
  if (active.kind === "step") {
    // Step path: hold value until next point
    path = points
      .map((p, i) => {
        if (i === 0) return `M${p.x.toFixed(1)},${p.y.toFixed(1)}`;
        const prev = points[i - 1];
        return `H${p.x.toFixed(1)} V${p.y.toFixed(1)}`;
      })
      .join(" ");
    // Extend last step to right edge
    const last = points[points.length - 1];
    if (last) {
      const rightX = W - PAD.right;
      path += ` H${rightX.toFixed(1)}`;
      // Area: close at bottom
      area =
        `M${points[0].x.toFixed(1)},${(H - PAD.bottom).toFixed(1)} ` +
        `L${points[0].x.toFixed(1)},${points[0].y.toFixed(1)} ` +
        points
          .slice(1)
          .map((p, i) => {
            const _prev = points[i];
            return `H${p.x.toFixed(1)} V${p.y.toFixed(1)}`;
          })
          .join(" ") +
        ` H${rightX.toFixed(1)} V${(H - PAD.bottom).toFixed(1)} Z`;
    }
  } else if (active.kind === "line") {
    path = points
      .map(
        (p, i) =>
          `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`,
      )
      .join(" ");
    if (points.length > 0) {
      area =
        `M${points[0].x.toFixed(1)},${(H - PAD.bottom).toFixed(1)} ` +
        points.map((p) => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") +
        ` L${points[points.length - 1].x.toFixed(1)},${(H - PAD.bottom).toFixed(1)} Z`;
    }
  }

  // Segment stacks (only for bar charts with segments data)
  let segmentStacks: View["segmentStacks"] = null;
  let segmentNames: string[] | null = null;
  let expenseStacks: View["expenseStacks"] = null;
  let expenseNames: string[] | null = null;
  if (active.kind === "bar" && active.segments) {
    segmentNames = active.segments.names;
    segmentStacks = points.map((pt, i) => {
      const segValues = active.segments!.perPoint[i] ?? {};
      const stack: { name: string; y0: number; y1: number; value: number }[] = [];
      let cumulative = 0;
      for (const name of active.segments!.names) {
        const v = segValues[name] ?? 0;
        stack.push({
          name,
          y0: yOf(cumulative),
          y1: yOf(cumulative + v),
          value: v,
        });
        cumulative += v;
      }
      return stack;
    });

    // Expense stacks: cumulative subtraction starting at 0, y descends.
    if (active.segments.expenseNames && active.segments.expensePerPoint) {
      expenseNames = active.segments.expenseNames;
      const expNames = expenseNames;
      const expPerPoint = active.segments.expensePerPoint;
      expenseStacks = points.map((_pt, i) => {
        const segValues = expPerPoint[i] ?? {};
        const stack: { name: string; y0: number; y1: number; value: number }[] = [];
        let cumulative = 0;
        for (const name of expNames) {
          const v = segValues[name] ?? 0;
          stack.push({
            name,
            y0: yOf(cumulative),
            y1: yOf(cumulative - v),
            value: v,
          });
          cumulative -= v;
        }
        return stack;
      });
    }
  }

  // Overlay (line, same y scale)
  let overlayPoints: ViewPoint[] | null = null;
  let overlayPath: string | null = null;
  if (active.overlay) {
    overlayPoints = active.overlay.points
      .map((p) => ({
        date: p.date,
        dateMs: toMs(p.date),
        value: p.value,
        x: 0,
        y: 0,
      }))
      .sort((a, b) => a.dateMs - b.dateMs)
      .map((p) => ({ ...p, x: xOf(p.dateMs), y: yOf(p.value) }));
    overlayPath = overlayPoints
      .map(
        (p, i) =>
          `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`,
      )
      .join(" ");
  }

  // Overlay 2 (second line on same primary axis)
  let overlay2Points: ViewPoint[] | null = null;
  let overlay2Path: string | null = null;
  if (active.overlay2) {
    overlay2Points = active.overlay2.points
      .map((p) => ({
        date: p.date,
        dateMs: toMs(p.date),
        value: p.value,
        x: 0,
        y: 0,
      }))
      .sort((a, b) => a.dateMs - b.dateMs)
      .map((p) => ({ ...p, x: xOf(p.dateMs), y: yOf(p.value) }));
    overlay2Path = overlay2Points
      .map(
        (p, i) =>
          `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`,
      )
      .join(" ");
  }

  // Secondary axis (right side)
  let secondaryPoints: ViewPoint[] | null = null;
  let secondaryRawValues: number[] | null = null;
  let secondaryPath: string | null = null;
  let secondaryYTicks: { value: number; y: number }[] | null = null;
  let secondaryYZero: number | null = null;
  if (active.secondary && active.secondary.points.length > 0) {
    const sortedSec = active.secondary.points
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date));
    secondaryRawValues = sortedSec.map((p) => p.value);
    const sMin = Math.min(...secondaryRawValues);
    const sMax = Math.max(...secondaryRawValues);
    const sMinTarget = Math.min(0, sMin);
    const sMaxTarget = Math.max(0, sMax);
    const sPad =
      (sMaxTarget - sMinTarget) * 0.15 || Math.abs(sMaxTarget) * 0.1 || 5;
    const s2Min = niceFloor(sMinTarget - sPad);
    const s2Max = niceCeil(sMaxTarget + sPad);

    const sYof = (v: number) =>
      s2Max === s2Min
        ? PAD.top + innerH / 2
        : PAD.top + (1 - (v - s2Min) / (s2Max - s2Min)) * innerH;

    secondaryPoints = sortedSec.map((p) => ({
      date: p.date,
      dateMs: toMs(p.date),
      value: p.value,
      x: xOf(toMs(p.date)),
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
  const yZero = isBar && 0 >= yMin && 0 <= yMax ? yOf(0) : null;

  // X ticks: pick year boundaries within the date range; ensure no overlap
  const xTicks = buildDateXTicks(dateMin, dateMax, xOf);

  return {
    points,
    path,
    area,
    yTicks,
    yZero,
    xTicks,
    dateMin,
    dateMax,
    overlayPoints,
    overlayPath,
    overlay2Points,
    overlay2Path,
    secondaryPoints,
    secondaryRawValues,
    secondaryPath,
    secondaryYTicks,
    secondaryYZero,
    segmentStacks,
    segmentNames,
    expenseStacks,
    expenseNames,
  };
}

function emptyView(): View {
  return {
    points: [],
    path: "",
    area: "",
    yTicks: [],
    yZero: null,
    xTicks: [],
    dateMin: 0,
    dateMax: 0,
    overlayPoints: null,
    overlayPath: null,
    overlay2Points: null,
    overlay2Path: null,
    secondaryPoints: null,
    secondaryRawValues: null,
    secondaryPath: null,
    secondaryYTicks: null,
    secondaryYZero: null,
    segmentStacks: null,
    segmentNames: null,
    expenseStacks: null,
    expenseNames: null,
  };
}

function buildDateXTicks(
  dateMin: number,
  dateMax: number,
  xOf: (ms: number) => number,
): { x: number; label: string; anchor: "start" | "middle" | "end" }[] {
  const innerW = W - PAD.left - PAD.right;
  const span = dateMax - dateMin;
  const yearMs = 365.25 * 24 * 60 * 60 * 1000;
  const monthMs = yearMs / 12;

  const ticks: { ms: number; label: string }[] = [];

  if (span > 4 * yearMs) {
    // Year boundaries
    const start = new Date(dateMin);
    const end = new Date(dateMax);
    const startYear = start.getFullYear();
    const endYear = end.getFullYear();
    for (let y = startYear; y <= endYear; y++) {
      const ms = new Date(y, 0, 1).getTime();
      if (ms >= dateMin && ms <= dateMax) {
        ticks.push({ ms, label: String(y) });
      }
    }
  } else if (span > yearMs) {
    // Quarter boundaries (Mar, Jun, Sep, Dec)
    const start = new Date(dateMin);
    const end = new Date(dateMax);
    const startYear = start.getFullYear();
    const endYear = end.getFullYear();
    for (let y = startYear; y <= endYear; y++) {
      for (let q = 0; q < 4; q++) {
        const ms = new Date(y, q * 3, 1).getTime();
        if (ms >= dateMin && ms <= dateMax) {
          const label = q === 0 ? `${y}` : `Q${q + 1} ${String(y).slice(2)}`;
          ticks.push({ ms, label });
        }
      }
    }
  } else if (span > 3 * monthMs) {
    // Month boundaries
    const start = new Date(dateMin);
    const end = new Date(dateMax);
    let y = start.getFullYear();
    let m = start.getMonth();
    while (true) {
      const ms = new Date(y, m, 1).getTime();
      if (ms > dateMax) break;
      if (ms >= dateMin) {
        const d = new Date(ms);
        const label = d.toLocaleDateString("en-US", {
          month: "short",
          year: "2-digit",
        });
        ticks.push({ ms, label });
      }
      m += 1;
      if (m > 11) {
        m = 0;
        y += 1;
      }
      if (y > end.getFullYear() + 1) break;
    }
  } else {
    // Short range: just min and max
    ticks.push({ ms: dateMin, label: formatDate(dateMin) });
    ticks.push({ ms: dateMax, label: formatDate(dateMax) });
  }

  // Convert to x positions; thin out so adjacent labels don't overlap.
  // Estimate label pixel width; in viewBox units, ~6px per char @ 10px font.
  const pixelsPerChar = 6;
  const minPxBetween = 36;

  const sized = ticks.map((t) => ({
    x: xOf(t.ms),
    label: t.label,
    width: t.label.length * pixelsPerChar,
  }));

  // Greedy: keep first, then keep next if its left edge clears prior right edge
  const kept: typeof sized = [];
  for (const t of sized) {
    if (kept.length === 0) {
      kept.push(t);
      continue;
    }
    const prev = kept[kept.length - 1];
    const dist = t.x - prev.x;
    if (dist >= minPxBetween) kept.push(t);
  }

  // Always force the last raw tick if not already kept (or replace last
  // kept if too close).
  const lastRaw = sized[sized.length - 1];
  if (lastRaw && kept[kept.length - 1] !== lastRaw) {
    const lastKept = kept[kept.length - 1];
    if (lastRaw.x - lastKept.x < minPxBetween) {
      // Replace last kept with lastRaw to ensure right-edge label is visible
      kept[kept.length - 1] = lastRaw;
    } else {
      kept.push(lastRaw);
    }
  }

  // Anchor labels: middle for interior, end for right-most (so they don't
  // bleed past the right edge), start for left-most.
  const rightEdge = W - PAD.right;
  const leftEdge = PAD.left;
  return kept.map((t, i) => {
    let anchor: "start" | "middle" | "end" = "middle";
    if (i === kept.length - 1 && t.x + t.width / 2 > rightEdge - 4) {
      anchor = "end";
    } else if (i === 0 && t.x - t.width / 2 < leftEdge + 4) {
      anchor = "start";
    }
    return { x: t.x, label: t.label, anchor };
  });
}

function nearestIndex(x: number, points: { x: number }[]) {
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

function toMs(iso: string): number {
  return new Date(iso).getTime();
}

function formatDate(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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
    return `${unit.ccy} ${Math.abs(v) < 1 ? v.toFixed(3) : v.toFixed(2)}`;
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
