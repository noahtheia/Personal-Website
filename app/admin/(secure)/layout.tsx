import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySessionCookie } from "@/lib/admin-session";

// Auth gate for the editor. In production we require a valid signed session
// cookie (issued when you sign in with ADMIN_PASSWORD); without one we bounce
// to /admin/login. In local dev (`npm run dev`) we skip the check entirely so
// the editor still works on localhost without any setup.

export const dynamic = "force-dynamic";

export default async function SecureAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isProd = process.env.NODE_ENV === "production";
  if (isProd) {
    const cookieStore = await cookies();
    const session = verifySessionCookie(cookieStore.get(SESSION_COOKIE)?.value);
    if (!session) redirect("/admin/login");
  }

  return (
    <>
      <header className="flex items-center justify-between border-b border-rule-strong pb-3">
        <div className="flex items-center gap-3">
          <span className="rounded-sm border border-[var(--accent-warm)] bg-[#fff8e1] px-2 py-0.5 font-sans text-[11px] font-semibold uppercase tracking-wider text-[var(--accent-warm-hover)]">
            {isProd ? "Admin" : "Admin · dev"}
          </span>
          <Link
            href="/admin"
            className="font-display text-base font-semibold !text-fg no-underline hover:!text-accent"
          >
            Posts
          </Link>
        </div>
        <div className="flex items-center gap-4 font-sans text-xs">
          <Link href="/" className="!text-fg no-underline hover:!text-accent">
            ← Back to site
          </Link>
          {isProd ? (
            <form action="/api/admin/auth/logout" method="post">
              <button
                type="submit"
                className="!text-muted no-underline hover:!text-accent"
              >
                Sign out
              </button>
            </form>
          ) : null}
        </div>
      </header>
      <main className="mt-6">{children}</main>
    </>
  );
}
