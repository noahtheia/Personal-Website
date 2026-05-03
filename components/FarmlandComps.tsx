"use client";

import { useMemo, useState } from "react";
import type { FarmlandComp } from "@/lib/farmland";

type SortKey =
  | "ticker"
  | "price"
  | "marketCap"
  | "acres"
  | "navPerShare"
  | "premium"
  | "capRate"
  | "divYield";

type Column = {
  key: SortKey;
  label: string;
  align: "left" | "right";
  hint?: string;
};

const COLUMNS: Column[] = [
  { key: "ticker", label: "Ticker", align: "left" },
  { key: "price", label: "Price", align: "right", hint: "$/share" },
  { key: "marketCap", label: "Mkt cap", align: "right", hint: "$M" },
  { key: "acres", label: "Acres", align: "right", hint: "thousands" },
  { key: "navPerShare", label: "NAV/sh", align: "right", hint: "$" },
  { key: "premium", label: "P / NAV", align: "right", hint: "price ÷ NAV" },
  { key: "capRate", label: "Cap rate", align: "right", hint: "implied" },
  { key: "divYield", label: "Yield", align: "right", hint: "fwd div" },
];

export function FarmlandComps({ comps }: { comps: FarmlandComp[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("marketCap");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const rows = useMemo(() => {
    const enriched = comps.map((c) => ({
      ...c,
      premium: c.price / c.navPerShare,
    }));
    const sorted = [...enriched].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "string" && typeof bv === "string") {
        return dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return dir === "asc"
        ? (av as number) - (bv as number)
        : (bv as number) - (av as number);
    });
    return sorted;
  }, [comps, sortKey, dir]);

  function onHeaderClick(k: SortKey) {
    if (k === sortKey) {
      setDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(k);
      setDir(k === "ticker" ? "asc" : "desc");
    }
  }

  return (
    <div className="mt-6 overflow-x-auto">
      <table className="w-full border-collapse font-sans text-sm tabular-nums">
        <thead>
          <tr className="border-b border-rule-strong text-left">
            {COLUMNS.map((c) => {
              const active = c.key === sortKey;
              return (
                <th
                  key={c.key}
                  scope="col"
                  className={`whitespace-nowrap pb-3 pr-4 align-bottom font-medium ${
                    c.align === "right" ? "text-right" : "text-left"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onHeaderClick(c.key)}
                    className={`inline-flex items-baseline gap-1 transition-colors hover:!text-accent ${
                      active ? "!text-accent" : "!text-fg"
                    }`}
                    aria-sort={
                      active ? (dir === "asc" ? "ascending" : "descending") : "none"
                    }
                  >
                    <span>{c.label}</span>
                    <span
                      aria-hidden="true"
                      className={`text-[10px] ${active ? "opacity-100" : "opacity-30"}`}
                    >
                      {active ? (dir === "asc" ? "▲" : "▼") : "▾"}
                    </span>
                  </button>
                  {c.hint && (
                    <div className="mt-0.5 text-[10px] font-normal uppercase tracking-wider text-muted">
                      {c.hint}
                    </div>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.ticker} className="border-b border-rule">
              <td className="py-4 pr-4">
                <div className="font-semibold text-fg">{r.ticker}</div>
                <div className="text-xs text-muted">
                  {r.name} · {r.primaryCrops}
                </div>
              </td>
              <td className="py-4 pr-4 text-right">{fmtMoney(r.price)}</td>
              <td className="py-4 pr-4 text-right">{fmtInt(r.marketCap)}</td>
              <td className="py-4 pr-4 text-right">{fmtInt(r.acres)}</td>
              <td className="py-4 pr-4 text-right">{fmtMoney(r.navPerShare)}</td>
              <td
                className={`py-4 pr-4 text-right ${
                  r.premium >= 1
                    ? "text-[var(--positive)]"
                    : "text-[var(--negative)]"
                }`}
              >
                {r.premium.toFixed(2)}×
              </td>
              <td className="py-4 pr-4 text-right">{fmtPct(r.capRate)}</td>
              <td className="py-4 pr-4 text-right">{fmtPct(r.divYield)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-muted">
        Click any column header to sort. P/NAV under 1.0× implies the market
        is pricing the portfolio below management&apos;s last disclosed NAV.
      </p>
    </div>
  );
}

function fmtMoney(n: number) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

function fmtInt(n: number) {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function fmtPct(n: number) {
  return `${n.toFixed(1)}%`;
}
