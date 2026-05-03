"use client";

import { useMemo, useState } from "react";
import type { PricedFarmlandComp } from "@/lib/farmland-comps";

type SortKey =
  | "ticker"
  | "price"
  | "marketCapMM"
  | "evMM"
  | "acresK"
  | "evPerAcre"
  | "navPerShare"
  | "pNav"
  | "evCapRate"
  | "divYield";

type Column = {
  key: SortKey;
  label: string;
  align: "left" | "right";
  hint?: string;
};

const COLUMNS: Column[] = [
  { key: "ticker", label: "Ticker", align: "left" },
  { key: "price", label: "Price", align: "right", hint: "live $" },
  { key: "marketCapMM", label: "Mkt cap", align: "right", hint: "$M" },
  { key: "evMM", label: "EV", align: "right", hint: "$M" },
  { key: "acresK", label: "Acres", align: "right", hint: "thousands" },
  { key: "evPerAcre", label: "EV / acre", align: "right", hint: "$" },
  { key: "navPerShare", label: "NAV/sh", align: "right", hint: "filed $" },
  { key: "pNav", label: "P / NAV", align: "right", hint: "price ÷ NAV" },
  { key: "evCapRate", label: "Cap rate", align: "right", hint: "NOI ÷ EV" },
  { key: "divYield", label: "Yield", align: "right", hint: "div ÷ price" },
];

export function FarmlandComps({ rows }: { rows: PricedFarmlandComp[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("marketCapMM");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "string" && typeof bv === "string") {
        return dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      const an = av as number | null;
      const bn = bv as number | null;
      // Push nulls to the end regardless of direction.
      if (an === null && bn === null) return 0;
      if (an === null) return 1;
      if (bn === null) return -1;
      return dir === "asc" ? an - bn : bn - an;
    });
    return copy;
  }, [rows, sortKey, dir]);

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
      <table className="w-full min-w-[760px] border-collapse font-sans text-sm tabular-nums">
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
          {sorted.map((r) => (
            <tr key={r.ticker} className="border-b border-rule">
              <td className="py-4 pr-4">
                <div className="font-semibold text-fg">{r.ticker}</div>
                <div className="text-xs text-muted">
                  {r.name} · {r.primaryCrops}
                </div>
                <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted">
                  Filing {formatFilingDate(r.filingDate)}
                </div>
              </td>
              <td className="py-4 pr-4 text-right">{fmtMoney(r.price)}</td>
              <td className="py-4 pr-4 text-right">{fmtInt(r.marketCapMM)}</td>
              <td className="py-4 pr-4 text-right">{fmtInt(r.evMM)}</td>
              <td className="py-4 pr-4 text-right">{fmtInt(r.acresK)}</td>
              <td className="py-4 pr-4 text-right">
                {r.evPerAcre !== null
                  ? `$${fmtInt(r.evPerAcre)}`
                  : EM}
              </td>
              <td className="py-4 pr-4 text-right">{fmtMoney(r.navPerShare)}</td>
              <td
                className={`py-4 pr-4 text-right ${
                  r.pNav === null
                    ? "text-muted"
                    : r.pNav >= 1
                    ? "text-[var(--positive)]"
                    : "text-[var(--negative)]"
                }`}
              >
                {r.pNav !== null ? `${r.pNav.toFixed(2)}×` : EM}
              </td>
              <td className="py-4 pr-4 text-right">{fmtPct(r.evCapRate)}</td>
              <td className="py-4 pr-4 text-right">{fmtPct(r.divYield)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-muted">
        Click any column header to sort. Filing inputs (shares, debt, cash,
        acres, NAV, NOI, dividend) come from each issuer&apos;s most recent
        10-K; price is live and feeds market cap, EV, and every multiple in
        the row.
      </p>
    </div>
  );
}

const EM = "—";

function fmtMoney(n: number | null) {
  if (n === null) return EM;
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

function fmtInt(n: number | null) {
  if (n === null) return EM;
  return Math.round(n).toLocaleString("en-US");
}

function fmtPct(n: number | null) {
  if (n === null) return EM;
  return `${n.toFixed(1)}%`;
}

function formatFilingDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}
