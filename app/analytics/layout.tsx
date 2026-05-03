import { AnalyticsSidebar } from "@/components/AnalyticsSidebar";

export default function AnalyticsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="page-wide">
      <div className="grid gap-8 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <AnalyticsSidebar />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
