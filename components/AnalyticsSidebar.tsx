"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string };
type Section = { id: string; label: string; items: Item[] };

const SECTIONS: Section[] = [
  {
    id: "sector",
    label: "Sector",
    items: [{ href: "/analytics/public-farmland", label: "Agriculture" }],
  },
  {
    id: "trends",
    label: "Trends",
    items: [{ href: "/analytics/trends", label: "Agriculture" }],
  },
  {
    id: "regression",
    label: "Regression Analysis",
    items: [
      { href: "/analytics/regression-analysis", label: "Agriculture" },
    ],
  },
  {
    id: "compare",
    label: "Compare",
    items: [{ href: "/analytics/compare", label: "Agriculture" }],
  },
  {
    id: "screener",
    label: "Screener",
    items: [{ href: "/analytics/screener", label: "Agriculture" }],
  },
];

export function AnalyticsSidebar() {
  const pathname = usePathname() ?? "";
  return (
    <aside className="lg:sticky lg:top-6 lg:self-start">
      <nav
        aria-label="Analytics sections"
        className="rounded-sm border border-rule bg-surface"
      >
        <div className="border-b border-rule px-4 py-3">
          <p className="font-display text-sm font-semibold tracking-tight text-fg">
            Analytics
          </p>
          <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted">
            Comps · charts · references
          </p>
        </div>
        <ul className="py-2">
          {SECTIONS.map((section) => (
            <li key={section.id} className="mb-2 last:mb-0">
              <p className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted">
                {section.label}
              </p>
              <ul>
                {section.items.map((item) => {
                  const active =
                    pathname === item.href ||
                    pathname.startsWith(item.href + "/");
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={`flex items-center gap-2 border-l-2 px-4 py-1.5 text-sm no-underline transition-colors ${
                          active
                            ? "border-accent bg-bg !text-accent font-medium"
                            : "border-transparent !text-fg-soft hover:border-rule-strong hover:bg-bg hover:!text-fg"
                        }`}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
