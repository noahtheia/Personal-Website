"use client";

import { useState, type ReactNode } from "react";

type TabId = "fmv" | "insiders" | "financial" | "sectorTrends";

export function FarmlandDetailTabs({
  fmvAnalysis,
  insiders,
  financialSnapshot,
  sectorTrends,
}: {
  fmvAnalysis: ReactNode;
  // Optional — hidden when the issuer doesn't surface insider data
  // (international filers without a Form-4 equivalent).
  insiders?: ReactNode;
  financialSnapshot: ReactNode;
  // Optional — hidden when there's no multi-period sector-block data.
  sectorTrends?: ReactNode;
}) {
  const tabs: { id: TabId; label: string }[] = [
    { id: "fmv", label: "FMV Analysis" },
    ...(insiders ? [{ id: "insiders" as const, label: "Insider Transactions" }] : []),
    { id: "financial", label: "Financial Snapshot" },
    ...(sectorTrends ? [{ id: "sectorTrends" as const, label: "Sector Trends" }] : []),
  ];
  const [activeId, setActiveId] = useState<TabId>("fmv");

  return (
    <div>
      <div
        role="tablist"
        aria-label="Detail sections"
        className="mt-8 flex flex-wrap gap-1 border-b border-rule"
      >
        {tabs.map((t) => {
          const on = t.id === activeId;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={on}
              onClick={() => setActiveId(t.id)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${
                on
                  ? "border-accent !text-accent"
                  : "border-transparent !text-muted hover:!text-fg"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div hidden={activeId !== "fmv"}>{fmvAnalysis}</div>
      {insiders && <div hidden={activeId !== "insiders"}>{insiders}</div>}
      <div hidden={activeId !== "financial"}>{financialSnapshot}</div>
      {sectorTrends && (
        <div hidden={activeId !== "sectorTrends"}>{sectorTrends}</div>
      )}
    </div>
  );
}
