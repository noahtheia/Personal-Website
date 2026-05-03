import Link from "next/link";

const tabs = [{ href: "/analytics/public-farmland", label: "Public Farmland" }];

export default function AnalyticsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="eyebrow">Analytics</p>
      <nav
        aria-label="Analytics sections"
        className="mt-3 flex flex-wrap gap-1 border-b border-rule"
      >
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="-mb-px border-b-2 border-accent px-3 py-2 text-sm font-medium !text-accent no-underline"
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <div className="mt-6">{children}</div>
    </div>
  );
}
