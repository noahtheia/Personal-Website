import Link from "next/link";
import { notFound } from "next/navigation";

// Local-dev gate. `/admin` is only mounted when running `npm run dev`. On
// production builds (and Vercel) every /admin/* route 404s. The server actions
// in app/admin/actions.ts enforce the same check independently as a backstop.

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <div className="page-wide">
      <header className="flex items-center justify-between border-b border-rule-strong pb-3">
        <div className="flex items-center gap-3">
          <span className="rounded-sm border border-[var(--accent-warm)] bg-[#fff8e1] px-2 py-0.5 font-sans text-[11px] font-semibold uppercase tracking-wider text-[var(--accent-warm-hover)]">
            Admin · dev only
          </span>
          <Link
            href="/admin"
            className="font-display text-base font-semibold !text-fg no-underline hover:!text-accent"
          >
            Posts
          </Link>
        </div>
        <Link
          href="/"
          className="font-sans text-xs !text-fg no-underline hover:!text-accent"
        >
          ← Back to site
        </Link>
      </header>
      <main className="mt-6">{children}</main>
    </div>
  );
}
