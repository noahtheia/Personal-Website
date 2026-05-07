"use client";

import { useState, type ReactNode } from "react";

type TabId = "fmv" | "financial";

const TABS: { id: TabId; label: string }[] = [
  { id: "fmv", label: "FMV Analysis" },
  { id: "financial", label: "Financial Snapshot" },
];

export function FarmlandDetailTabs({
  fmvAnalysis,
  financialSnapshot,
}: {
  fmvAnalysis: ReactNode;
  financialSnapshot: ReactNode;
}) {
  const [activeId, setActiveId] = useState<TabId>("fmv");

  return (
    <div>
      <div
        role="tablist"
        aria-label="Detail sections"
        className="mt-8 flex flex-wrap gap-1 border-b border-rule"
      >
        {TABS.map((t) => {
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
      <div hidden={activeId !== "financial"}>{financialSnapshot}</div>
    </div>
  );
}
