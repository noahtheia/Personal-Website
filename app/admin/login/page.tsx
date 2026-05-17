import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySessionCookie } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const isProd = process.env.NODE_ENV === "production";

  // Dev bypasses auth entirely — bounce straight in.
  if (!isProd) redirect("/admin");

  // Already signed in? Skip the form.
  const cookieStore = await cookies();
  const session = verifySessionCookie(cookieStore.get(SESSION_COOKIE)?.value);
  if (session) redirect("/admin");

  const { error } = await searchParams;
  const configured =
    !!process.env.ADMIN_PASSWORD &&
    !!process.env.ADMIN_SESSION_SECRET &&
    !!process.env.GITHUB_TOKEN &&
    !!process.env.GITHUB_OWNER &&
    !!process.env.GITHUB_REPO;

  return (
    <div className="mx-auto mt-16 max-w-sm">
      <h1 className="font-display text-2xl font-semibold">Admin sign-in</h1>
      <p className="mt-2 text-sm text-muted">
        Enter the admin password. Sessions last 30 days; sign out clears them.
      </p>

      {!configured ? (
        <div className="mt-6 rounded-sm border border-[var(--negative)] bg-[#fdecea] px-3 py-2 font-sans text-xs">
          <div className="font-semibold text-[var(--negative)]">
            Admin isn&rsquo;t configured
          </div>
          <p className="mt-1 text-fg-soft">
            Set <code>ADMIN_PASSWORD</code>, <code>ADMIN_SESSION_SECRET</code>,{" "}
            <code>GITHUB_TOKEN</code>, <code>GITHUB_OWNER</code>, and{" "}
            <code>GITHUB_REPO</code> in your Vercel env vars, redeploy, and reload.
          </p>
        </div>
      ) : (
        <form action="/api/admin/auth/login" method="post" className="mt-6 space-y-3">
          {error ? (
            <p className="rounded-sm border border-[var(--negative)] bg-[#fdecea] px-2 py-1.5 text-xs text-[var(--negative)]">
              {error === "invalid" ? "Wrong password." : error}
            </p>
          ) : null}
          <label className="block">
            <span className="font-sans text-[11px] uppercase tracking-wider text-muted">Password</span>
            <input
              name="password"
              type="password"
              autoFocus
              required
              autoComplete="current-password"
              className="mt-1 w-full rounded-sm border border-rule bg-[var(--bg)] px-2 py-1.5 font-sans text-sm focus:border-[var(--accent-warm)] focus:outline-none"
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-sm border border-[var(--accent-warm)] bg-[var(--accent-warm)] px-3 py-1.5 font-sans text-sm font-semibold !text-fg transition-opacity hover:opacity-90"
          >
            Sign in
          </button>
        </form>
      )}
    </div>
  );
}
