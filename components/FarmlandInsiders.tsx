import type { InsiderFile } from "@/lib/farmland-insiders";

export function FarmlandInsiders({ data }: { data: InsiderFile }) {
  const txs = [...data.transactions].sort((a, b) =>
    b.date.localeCompare(a.date),
  );
  const recent = txs.slice(0, 25);
  const s = data.summary;

  return (
    <section className="mt-12 border-t border-rule pt-8">
      <div className="flex items-baseline justify-between border-b border-rule pb-2">
        <h2 className="font-display text-xl font-semibold tracking-tight">
          Insider transactions
        </h2>
        <span className="text-xs text-muted">
          As of {data.asOf} · last {recent.length} of{" "}
          {s.transactionCount ?? data.transactions.length} Form 4 filings
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card
          label="TTM buys"
          value={fmtMoney(s.ttmBuyValueUSD)}
          tone="positive"
        />
        <Card
          label="TTM sells"
          value={fmtMoney(s.ttmSellValueUSD)}
          tone="negative"
        />
        <Card
          label="TTM net"
          value={fmtMoneySigned(s.ttmNetUSD)}
          tone={s.ttmNetUSD >= 0 ? "positive" : "negative"}
        />
        <Card
          label="Insiders active TTM"
          value={String(s.ttmInsiders)}
        />
      </div>

      <div className="mt-4 overflow-x-auto rounded-sm border border-rule bg-surface">
        <table className="w-full border-collapse font-sans text-xs tabular-nums">
          <thead>
            <tr className="border-b border-rule-strong">
              <Th>Date</Th>
              <Th>Insider</Th>
              <Th>Role</Th>
              <Th>Action</Th>
              <Th align="right">Shares</Th>
              <Th align="right">Price</Th>
              <Th align="right">Value (USD)</Th>
              <Th align="right">Remaining</Th>
            </tr>
          </thead>
          <tbody>
            {recent.map((t, i) => (
              <tr key={i} className="border-b border-rule align-top">
                <td className="px-3 py-2 text-muted">{formatDate(t.date)}</td>
                <td className="px-3 py-2">
                  {t.filingUrl ? (
                    <a
                      href={t.filingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="!text-fg no-underline hover:!text-accent"
                    >
                      {t.insider}
                    </a>
                  ) : (
                    t.insider
                  )}
                </td>
                <td className="px-3 py-2 text-muted">{t.title}</td>
                <td
                  className={`px-3 py-2 ${
                    t.type === "Buy"
                      ? "text-[var(--positive)]"
                      : t.type === "Sell"
                      ? "text-[var(--negative)]"
                      : "text-fg-soft"
                  }`}
                >
                  {t.type}
                </td>
                <td className="px-3 py-2 text-right">
                  {fmtInt(t.shares)}
                </td>
                <td className="px-3 py-2 text-right">
                  {t.pricePerShare != null
                    ? `$${t.pricePerShare.toFixed(2)}`
                    : "—"}
                </td>
                <td
                  className={`px-3 py-2 text-right ${
                    (t.valueUSD ?? 0) > 0 && t.type === "Sell"
                      ? "text-[var(--negative)]"
                      : (t.valueUSD ?? 0) > 0 && t.type === "Buy"
                      ? "text-[var(--positive)]"
                      : ""
                  }`}
                >
                  {t.valueUSD != null && t.valueUSD > 0
                    ? fmtMoney(t.valueUSD)
                    : "—"}
                </td>
                <td className="px-3 py-2 text-right text-muted">
                  {t.remainingShares != null
                    ? fmtInt(t.remainingShares)
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[11px] text-muted">
        Source: SEC EDGAR Form 4 (Statement of Changes in Beneficial
        Ownership) filings. Buy / Sell figures exclude option exercises,
        grants, vests, gifts, and tax-withholding events. Click an
        insider&apos;s name to open the underlying Form 4 filing.
      </p>
    </section>
  );
}

function Card({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative";
}) {
  const valueClass =
    tone === "positive"
      ? "text-[var(--positive)]"
      : tone === "negative"
      ? "text-[var(--negative)]"
      : "";
  return (
    <div className="rounded-sm border border-rule bg-surface p-4">
      <div className="text-[10px] uppercase tracking-wider text-muted">
        {label}
      </div>
      <div
        className={`mt-1 font-display text-xl font-semibold tabular-nums ${valueClass}`}
      >
        {value}
      </div>
    </div>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`whitespace-nowrap px-3 pb-2 pt-3 text-[11px] font-medium uppercase tracking-wider text-muted ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function fmtInt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function fmtMoneySigned(n: number): string {
  if (n < 0) return `(${fmtMoney(Math.abs(n))})`;
  return fmtMoney(n);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
