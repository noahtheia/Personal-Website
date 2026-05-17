import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySessionCookie } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  const isProd = process.env.NODE_ENV === "production";

  // In dev the editor doesn't require sign-in — bounce straight in so you can't
  // accidentally land here.
  if (!isProd) redirect("/admin");

  // If you already have a session, skip the sign-in dance.
  const cookieStore = await cookies();
  const session = verifySessionCookie(cookieStore.get(SESSION_COOKIE)?.value);
  if (session) redirect("/admin");

  const configured =
    !!process.env.GITHUB_CLIENT_ID &&
    !!process.env.GITHUB_CLIENT_SECRET &&
    !!process.env.ADMIN_SESSION_SECRET &&
    !!process.env.ADMIN_GITHUB_USER &&
    !!process.env.GITHUB_OWNER &&
    !!process.env.GITHUB_REPO &&
    !!process.env.NEXT_PUBLIC_SITE_URL;

  return (
    <div className="mx-auto mt-16 max-w-sm">
      <h1 className="font-display text-2xl font-semibold">Admin sign-in</h1>
      <p className="mt-2 text-sm text-muted">
        Sign in with the GitHub account on the admin allowlist. The OAuth token is
        used to commit saves back to the repo.
      </p>
      {configured ? (
        <a
          href="/api/admin/auth/login"
          className="mt-6 inline-flex w-full items-center justify-center rounded-sm border border-[var(--accent-warm)] bg-[var(--accent-warm)] px-4 py-2 font-sans text-sm font-semibold !text-fg no-underline transition-opacity hover:opacity-90"
        >
          Continue with GitHub
        </a>
      ) : (
        <div className="mt-6 rounded-sm border border-[var(--negative)] bg-[#fdecea] px-3 py-2 font-sans text-xs">
          <div className="font-semibold text-[var(--negative)]">Admin OAuth isn&rsquo;t configured</div>
          <p className="mt-1 text-fg-soft">
            Set <code>GITHUB_CLIENT_ID</code>, <code>GITHUB_CLIENT_SECRET</code>,{" "}
            <code>ADMIN_SESSION_SECRET</code>, <code>ADMIN_GITHUB_USER</code>,{" "}
            <code>GITHUB_OWNER</code>, <code>GITHUB_REPO</code>, and{" "}
            <code>NEXT_PUBLIC_SITE_URL</code> in your Vercel env vars, redeploy,
            and reload this page.
          </p>
        </div>
      )}
    </div>
  );
}
