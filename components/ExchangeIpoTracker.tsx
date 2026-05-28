"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Sparkline } from "./Sparkline";
import {
  REGION_ORDER,
  type ExchangeIpoRow,
  type ExchangeRegion,
} from "@/lib/exchange-ipos";

type SortKey =
  | "name"
  | "country"
  | "count7d"
  | "count30d"
  | "count90d"
  | "countYtd"
  | "countTtm"
  | "proceedsTtmUsdM"
  | "lastListingDate";

type SortDir = "asc" | "desc";

const COLUMNS: { key: SortKey; label: string; hint?: string }[] = [
  { key: "name", label: "Exchange" },
  { key: "country", label: "Country" },
  { key: "count7d", label: "7d", hint: "IPOs last 7 days" },
  { key: "count30d", label: "30d", hint: "IPOs last 30 days" },
  { key: "count90d", label: "90d", hint: "IPOs last 90 days" },
  { key: "countYtd", label: "YTD", hint: "IPOs year-to-date" },
  { key: "countTtm", label: "TTM", hint: "IPOs trailing 24 months" },
  {
    key: "proceedsTtmUsdM",
    label: "Capital Raised",
    hint: "TTM USD millions (where reported)",
  },
  { key: "lastListingDate", label: "Last IPO" },
];

function compareRows(a: ExchangeIpoRow, b: ExchangeIpoRow, key: SortKey): number {
  switch (key) {
    case "name":
      return a.exchange.name.localeCompare(b.exchange.name);
    case "country":
      return a.exchange.country.localeCompare(b.exchange.country);
    case "count7d":
      return a.count7d - b.count7d;
    case "count30d":
      return a.count30d - b.count30d;
    case "count90d":
      return a.count90d - b.count90d;
    case "countYtd":
      return a.countYtd - b.countYtd;
    case "countTtm":
      return a.countTtm - b.countTtm;
    case "proceedsTtmUsdM": {
      const av = a.proceedsTtmUsdM ?? -1;
      const bv = b.proceedsTtmUsdM ?? -1;
      return av - bv;
    }
    case "lastListingDate": {
      const av = a.lastListingDate ?? "";
      const bv = b.lastListingDate ?? "";
      return av.localeCompare(bv);
    }
  }
}

function fmtInt(n: number): string {
  return n.toLocaleString("en-US");
}

function fmtProceeds(n: number | null): string {
  if (n === null) return "—";
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}B`;
  return `$${fmtInt(n)}M`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function ExchangeIpoTracker({ rows }: { rows: ExchangeIpoRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("countTtm");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const grouped = useMemo(() => {
    const byRegion = new Map<ExchangeRegion, ExchangeIpoRow[]>();
    for (const r of rows) {
      const arr = byRegion.get(r.exchange.region) ?? [];
      arr.push(r);
      byRegion.set(r.exchange.region, arr);
    }
    for (const arr of byRegion.values()) {
      arr.sort((a, b) => {
        const cmp = compareRows(a, b, sortKey);
        return sortDir === "desc" ? -cmp : cmp;
      });
    }
    return REGION_ORDER.filter((r) => byRegion.has(r)).map((region) => ({
      region,
      rows: byRegion.get(region) ?? [],
    }));
  }, [rows, sortKey, sortDir]);

  const onSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir(sortDir === "desc" ? "asc" : "desc");
    } else {
      setSortKey(key);
      setSortDir(
        key === "name" || key === "country" || key === "lastListingDate"
          ? "asc"
          : "desc",
      );
    }
  };

  if (rows.length === 0) {
    return (
      <div className="mt-6 rounded-sm border border-rule bg-surface p-6 text-sm text-muted">
        No IPO activity returned from the configured sources yet. The
        daily cron at <code>/api/refresh-ipos</code> primes the cache;
        check back after the next run.
      </div>
    );
  }

  return (
    <div className="mt-6 overflow-x-auto rounded-sm border border-rule bg-surface">
      <table className="min-w-full border-collapse text-sm">
        <thead className="border-b border-rule bg-bg">
          <tr>
            {COLUMNS.map((c) => {
              const active = c.key === sortKey;
              return (
                <th
                  key={c.key}
                  scope="col"
                  className={`whitespace-nowrap px-3 py-2 text-left font-semibold uppercase tracking-wider text-[10px] text-muted ${
                    c.key === "name" ? "" : "text-right"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSort(c.key)}
                    title={c.hint}
                    className={`inline-flex items-center gap-1 hover:!text-fg ${
                      active ? "!text-accent" : ""
                    }`}
                  >
                    {c.label}
                    {active && (
                      <span aria-hidden>{sortDir === "desc" ? "▾" : "▴"}</span>
                    )}
                  </button>
                </th>
              );
            })}
            <th
              scope="col"
              className="whitespace-nowrap px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-muted"
              title="Monthly IPO count, trailing 24 months"
            >
              24M Trend
            </th>
          </tr>
        </thead>
        <tbody>
          {grouped.map(({ region, rows: regionRows }) => (
            <RegionGroup
              key={region}
              region={region}
              rows={regionRows}
              colSpan={COLUMNS.length + 1}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RegionGroup({
  region,
  rows,
  colSpan,
}: {
  region: ExchangeRegion;
  rows: ExchangeIpoRow[];
  colSpan: number;
}) {
  return (
    <>
      <tr>
        <td
          colSpan={colSpan}
          className="border-y border-rule bg-bg px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted"
        >
          {region} · {rows.length} {rows.length === 1 ? "exchange" : "exchanges"}
        </td>
      </tr>
      {rows.map((r) => (
        <tr key={r.exchange.mic} className="border-t border-rule hover:bg-bg">
          <td className="whitespace-nowrap px-3 py-2 font-medium">
            <Link
              href={`/analytics/exchanges/${r.exchange.mic}`}
              className="!text-fg hover:!text-accent no-underline"
            >
              {r.exchange.name}
            </Link>
            <span className="ml-1.5 text-[10px] uppercase tracking-wider text-muted">
              {r.exchange.mic}
            </span>
          </td>
          <td className="whitespace-nowrap px-3 py-2 text-muted">
            {r.exchange.country}
          </td>
          <td className="px-3 py-2 text-right tabular-nums">
            {r.count7d || "—"}
          </td>
          <td className="px-3 py-2 text-right tabular-nums">
            {r.count30d || "—"}
          </td>
          <td className="px-3 py-2 text-right tabular-nums">
            {r.count90d || "—"}
          </td>
          <td className="px-3 py-2 text-right tabular-nums">
            {r.countYtd || "—"}
          </td>
          <td className="px-3 py-2 text-right font-semibold tabular-nums">
            {r.countTtm}
          </td>
          <td className="px-3 py-2 text-right tabular-nums">
            {fmtProceeds(r.proceedsTtmUsdM)}
          </td>
          <td className="whitespace-nowrap px-3 py-2 text-right text-muted">
            {fmtDate(r.lastListingDate)}
          </td>
          <td className="px-3 py-2 text-right">
            <Sparkline values={r.monthlySeries} width={72} height={18} />
          </td>
        </tr>
      ))}
    </>
  );
}
