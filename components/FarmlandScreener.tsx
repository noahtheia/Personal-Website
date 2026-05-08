"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { PricedFarmlandComp } from "@/lib/farmland-comps";

type ScreenerKey =
  | "marketCapMM"
  | "evMM"
  | "annualRevenueMM"
  | "annualEbitdaMM"
  | "annualNetIncomeMM"
  | "annualFcfMM"
  | "ebitdaMargin"
  | "netIncomeMargin"
  | "roe"
  | "roic"
  | "evEbitda"
  | "priceSales"
  | "priceEarnings"
  | "pNav"
  | "evCapRate"
  | "divYield"
  | "fcfYield"
  | "acresK";

type FieldDef = {
  key: ScreenerKey;
  label: string;
  unit: "money" | "pct" | "mult" | "int";
};

const FIELDS: FieldDef[] = [
  { key: "marketCapMM", label: "Market Cap ($M)", unit: "money" },
  { key: "evMM", label: "Enterprise Value ($M)", unit: "money" },
  { key: "annualRevenueMM", label: "Revenue ($M)", unit: "money" },
  { key: "annualEbitdaMM", label: "EBITDA ($M)", unit: "money" },
  { key: "annualNetIncomeMM", label: "Net Income ($M)", unit: "money" },
  { key: "annualFcfMM", label: "FCF ($M)", unit: "money" },
  { key: "acresK", label: "Acres (K)", unit: "int" },
  { key: "ebitdaMargin", label: "EBITDA Margin (%)", unit: "pct" },
  { key: "netIncomeMargin", label: "NI Margin (%)", unit: "pct" },
  { key: "roe", label: "ROE (%)", unit: "pct" },
  { key: "roic", label: "ROIC (%)", unit: "pct" },
  { key: "divYield", label: "Dividend Yield (%)", unit: "pct" },
  { key: "fcfYield", label: "FCF Yield (%)", unit: "pct" },
  { key: "evCapRate", label: "Cap Rate (%)", unit: "pct" },
  { key: "evEbitda", label: "EV / EBITDA (×)", unit: "mult" },
  { key: "priceSales", label: "P / S (×)", unit: "mult" },
  { key: "priceEarnings", label: "P / E (×)", unit: "mult" },
  { key: "pNav", label: "P / NAV (×)", unit: "mult" },
];

type Op = ">" | ">=" | "<" | "<=" | "=";

type Rule = {
  id: string;
  key: ScreenerKey;
  op: Op;
  value: string; // raw input text
};

function evaluate(rule: Rule, val: number | null): boolean {
  if (val === null || !Number.isFinite(val)) return false;
  const v = parseFloat(rule.value);
  if (!Number.isFinite(v)) return true; // empty rule = pass-through
  switch (rule.op) {
    case ">":
      return val > v;
    case ">=":
      return val >= v;
    case "<":
      return val < v;
    case "<=":
      return val <= v;
    case "=":
      return Math.abs(val - v) < 1e-6;
  }
}

const DEFAULT_RULES: Rule[] = [
  { id: "1", key: "evEbitda", op: "<=", value: "10" },
  { id: "2", key: "roic", op: ">=", value: "10" },
];

export function FarmlandScreener({ rows }: { rows: PricedFarmlandComp[] }) {
  const [rules, setRules] = useState<Rule[]>(DEFAULT_RULES);
  const [sectorFilter, setSectorFilter] = useState<string>("");

  const sectors = useMemo(
    () => Array.from(new Set(rows.map((r) => r.sector))).sort(),
    [rows],
  );

  const matches = useMemo(() => {
    return rows.filter((r) => {
      if (sectorFilter && r.sector !== sectorFilter) return false;
      for (const rule of rules) {
        if (!rule.value.trim()) continue; // skip empty rules
        const v = r[rule.key] as number | null;
        if (!evaluate(rule, v)) return false;
      }
      return true;
    });
  }, [rows, rules, sectorFilter]);

  function addRule() {
    setRules((cur) => [
      ...cur,
      {
        id: String(Date.now()),
        key: "evEbitda",
        op: "<=",
        value: "",
      },
    ]);
  }
  function removeRule(id: string) {
    setRules((cur) => cur.filter((r) => r.id !== id));
  }
  function updateRule(id: string, patch: Partial<Rule>) {
    setRules((cur) => cur.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  return (
    <div className="space-y-6">
      <div className="rounded-sm border border-rule bg-surface p-4">
        <div className="flex items-baseline justify-between">
          <h3 className="font-display text-sm font-semibold uppercase tracking-wider">
            Conditions
          </h3>
          <button
            type="button"
            onClick={addRule}
            className="rounded-sm border border-rule bg-bg px-2.5 py-1 text-xs hover:border-accent hover:!text-accent"
          >
            + Add condition
          </button>
        </div>
        <p className="mt-1 text-[11px] text-muted">
          All conditions ANDed. Tickers missing a value for any condition are
          excluded.
        </p>
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-[11px] uppercase tracking-wider text-muted w-20">
              Sector
            </label>
            <select
              value={sectorFilter}
              onChange={(e) => setSectorFilter(e.target.value)}
              className="rounded-sm border border-rule bg-bg px-2 py-1 text-xs"
            >
              <option value="">Any</option>
              {sectors.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          {rules.map((rule) => {
            const field = FIELDS.find((f) => f.key === rule.key);
            return (
              <div
                key={rule.id}
                className="flex flex-wrap items-center gap-2"
              >
                <span className="text-[11px] uppercase tracking-wider text-muted w-20">
                  {rule === rules[0] ? "Where" : "And"}
                </span>
                <select
                  value={rule.key}
                  onChange={(e) =>
                    updateRule(rule.id, { key: e.target.value as ScreenerKey })
                  }
                  className="rounded-sm border border-rule bg-bg px-2 py-1 text-xs"
                >
                  {FIELDS.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))}
                </select>
                <select
                  value={rule.op}
                  onChange={(e) =>
                    updateRule(rule.id, { op: e.target.value as Op })
                  }
                  className="rounded-sm border border-rule bg-bg px-2 py-1 text-xs"
                >
                  <option value=">">&gt;</option>
                  <option value=">=">&ge;</option>
                  <option value="<">&lt;</option>
                  <option value="<=">&le;</option>
                  <option value="=">=</option>
                </select>
                <input
                  type="number"
                  step="any"
                  value={rule.value}
                  onChange={(e) =>
                    updateRule(rule.id, { value: e.target.value })
                  }
                  placeholder={field?.unit === "pct" ? "e.g. 12" : "0"}
                  className="rounded-sm border border-rule bg-bg px-2 py-1 text-xs w-28"
                />
                <button
                  type="button"
                  onClick={() => removeRule(rule.id)}
                  aria-label="Remove condition"
                  className="!text-muted hover:!text-[var(--negative)] text-sm"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[11px] uppercase tracking-wider text-muted">
          {matches.length} of {rows.length} tickers match
        </p>
        {matches.length === 0 ? (
          <div className="rounded-sm border border-rule bg-surface p-6 text-center text-sm text-muted">
            No tickers match. Loosen a condition or remove one.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-sm border border-rule bg-surface">
            <table className="w-full border-collapse font-sans text-xs tabular-nums">
              <thead>
                <tr className="border-b border-rule-strong">
                  <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wider text-muted">
                    Ticker
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wider text-muted">
                    Company
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wider text-muted">
                    Sector
                  </th>
                  <th className="px-3 py-2 text-right text-[11px] uppercase tracking-wider text-muted">
                    Mkt Cap ($M)
                  </th>
                  {rules
                    .filter((r) => r.value.trim())
                    .map((r) => {
                      const f = FIELDS.find((x) => x.key === r.key);
                      return (
                        <th
                          key={r.id}
                          className="px-3 py-2 text-right text-[11px] uppercase tracking-wider text-muted"
                        >
                          {f?.label}
                        </th>
                      );
                    })}
                </tr>
              </thead>
              <tbody>
                {matches.map((r) => (
                  <tr key={r.ticker} className="border-b border-rule">
                    <td className="px-3 py-2">
                      <Link
                        href={`/analytics/public-farmland/${encodeURIComponent(r.ticker)}`}
                        className="font-semibold !text-fg no-underline hover:!text-accent"
                      >
                        {r.ticker}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{r.name}</td>
                    <td className="px-3 py-2 text-muted">{r.sector}</td>
                    <td className="px-3 py-2 text-right text-muted">
                      {r.marketCapMM != null
                        ? `$${Math.round(r.marketCapMM).toLocaleString("en-US")}`
                        : "—"}
                    </td>
                    {rules
                      .filter((rule) => rule.value.trim())
                      .map((rule) => {
                        const v = r[rule.key] as number | null;
                        const f = FIELDS.find((x) => x.key === rule.key);
                        return (
                          <td
                            key={rule.id}
                            className="px-3 py-2 text-right"
                          >
                            {formatVal(v, f?.unit ?? "money")}
                          </td>
                        );
                      })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function formatVal(v: number | null, unit: FieldDef["unit"]): string {
  if (v === null || !Number.isFinite(v)) return "—";
  if (unit === "money") return `$${Math.round(v).toLocaleString("en-US")}`;
  if (unit === "pct") {
    if (v < 0) return `(${Math.abs(v).toFixed(1)}%)`;
    return `${v.toFixed(1)}%`;
  }
  if (unit === "mult") return `${v.toFixed(2)}×`;
  return Math.round(v).toLocaleString("en-US");
}
