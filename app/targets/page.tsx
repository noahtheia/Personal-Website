import Link from "next/link";
import {
  formatCurrency,
  formatImplied,
  formatShortDate,
  getPricedTargets,
  type PricedTarget,
} from "@/lib/targets";

export const metadata = {
  title: "Price targets",
  description:
    "Names I've covered, where I think they're worth, and the implied move from the latest market price.",
};

// Page revalidates every 15 minutes; live prices fetch on background regen.
export const revalidate = 900;

export default async function TargetsPage() {
  const priced = await getPricedTargets();
  const lastFetched =
    priced[0]?.fetchedAt ?? new Date().toISOString();

  return (
    <div className="page-narrow">
      <p className="eyebrow">Targets</p>
      <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
        Price targets
      </h1>
      <p className="mt-4 max-w-[36rem] font-sans text-base leading-relaxed text-fg-soft">
        Names I&apos;ve covered, where I think they&apos;re worth, and the
        implied move from the latest market price. Click through for the
        underlying write-up and methodology.
      </p>

      {priced.length === 0 ? (
        <p className="mt-10 text-muted">
          No price targets published yet.
        </p>
      ) : (
        <>
          <DesktopTable rows={priced} />
          <MobileList rows={priced} />
        </>
      )}

      <p className="mt-10 font-sans text-xs leading-relaxed text-muted">
        Last refreshed{" "}
        <time dateTime={lastFetched}>
          {new Date(lastFetched).toLocaleString("en-US", {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </time>
        . Market prices may be delayed by up to 15 minutes and are sourced
        from public Yahoo Finance endpoints. Targets reflect the
        author&apos;s opinion as of the date set; positions and views may
        change without notice. Nothing here is investment advice — see the{" "}
        <Link href="/disclosures" className="!text-muted underline hover:!text-accent">
          Disclosures
        </Link>
        .
      </p>
    </div>
  );
}

function impliedTextClass(t: PricedTarget): string {
  if (t.impliedReturn === null) return "text-muted";
  return t.impliedReturn >= 0
    ? "text-[var(--positive)]"
    : "text-[var(--negative)]";
}

function impliedArrow(t: PricedTarget): string {
  if (t.impliedReturn === null) return "";
  return t.impliedReturn >= 0 ? "▲" : "▼";
}

function DesktopTable({ rows }: { rows: PricedTarget[] }) {
  return (
    <div className="mt-10 hidden sm:block">
      <table className="w-full border-collapse font-sans text-sm tabular-nums">
        <thead>
          <tr className="border-b border-rule-strong text-left">
            <Th align="left">Asset</Th>
            <Th align="right">Target</Th>
            <Th align="right">Last</Th>
            <Th align="right">Implied</Th>
            <Th align="right">Set</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.ticker} className="border-b border-rule">
              <td className="py-4 pr-4">
                <div className="font-semibold text-fg">{t.ticker}</div>
                <div className="text-xs text-muted">
                  {t.name} · {t.side}
                </div>
              </td>
              <td className="py-4 px-4 text-right text-fg">
                {formatCurrency(t.target, t.currency)}
              </td>
              <td className="py-4 px-4 text-right text-fg">
                {t.lastPrice !== null
                  ? formatCurrency(t.lastPrice, t.currency)
                  : "—"}
              </td>
              <td
                className={`py-4 px-4 text-right font-semibold ${impliedTextClass(t)}`}
              >
                {t.impliedReturn !== null ? (
                  <>
                    <span aria-hidden className="mr-1">
                      {impliedArrow(t)}
                    </span>
                    {formatImplied(t.impliedReturn)}
                  </>
                ) : (
                  "—"
                )}
              </td>
              <td className="py-4 pl-4 text-right text-xs text-muted">
                <div>{formatShortDate(t.thesisDate)}</div>
                {t.postSlug ? (
                  <Link
                    href={`/posts/${t.postSlug}`}
                    className="block !text-accent no-underline hover:underline"
                  >
                    Read →
                  </Link>
                ) : null}
                {t.model ? (
                  <a
                    href={t.model.path}
                    download
                    className="block !text-accent no-underline hover:underline"
                  >
                    Model →
                  </a>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MobileList({ rows }: { rows: PricedTarget[] }) {
  return (
    <ul className="mt-8 space-y-6 sm:hidden">
      {rows.map((t) => (
        <li
          key={t.ticker}
          className="border-b border-rule pb-6 last:border-b-0"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="font-sans text-base font-semibold text-fg">
                {t.ticker}
              </div>
              <div className="font-sans text-xs text-muted">
                {t.name} · {t.side}
              </div>
            </div>
            <div
              className={`font-sans text-base font-semibold tabular-nums ${impliedTextClass(t)}`}
            >
              {t.impliedReturn !== null ? (
                <>
                  <span aria-hidden className="mr-1">
                    {impliedArrow(t)}
                  </span>
                  {formatImplied(t.impliedReturn)}
                </>
              ) : (
                "—"
              )}
            </div>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-y-1 font-sans text-sm tabular-nums">
            <dt className="text-muted">Target</dt>
            <dd className="text-right text-fg">
              {formatCurrency(t.target, t.currency)}
            </dd>
            <dt className="text-muted">Last</dt>
            <dd className="text-right text-fg">
              {t.lastPrice !== null
                ? formatCurrency(t.lastPrice, t.currency)
                : "—"}
            </dd>
            <dt className="text-muted">Set</dt>
            <dd className="text-right text-muted">
              {formatShortDate(t.thesisDate)}
            </dd>
          </dl>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 font-sans text-sm">
            {t.postSlug ? (
              <Link
                href={`/posts/${t.postSlug}`}
                className="!text-accent no-underline hover:underline"
              >
                Read →
              </Link>
            ) : null}
            {t.model ? (
              <a
                href={t.model.path}
                download
                className="!text-accent no-underline hover:underline"
              >
                Model →
              </a>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

function Th({
  children,
  align,
}: {
  children: React.ReactNode;
  align: "left" | "right";
}) {
  return (
    <th
      className={`py-3 ${align === "right" ? "px-4 text-right" : "pr-4"} font-sans text-xs font-semibold uppercase tracking-wider text-muted`}
    >
      {children}
    </th>
  );
}
