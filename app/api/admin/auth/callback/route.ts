// GET /api/admin/auth/callback?code=…&state=… — GitHub redirects here after the
// user authorises. We verify state, exchange the code for an access token,
// confirm the GitHub user is in our allowlist (ADMIN_GITHUB_USER), then set
// the signed session cookie and redirect to /admin.

import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  isAllowedGithubUser,
  serializeSession,
} from "@/lib/admin-session";

const STATE_COOKIE = "admin_oauth_state";

function fail(reason: string, status = 400) {
  return new NextResponse(`Sign-in failed: ${reason}`, { status });
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const stateCookie = req.cookies.get(STATE_COOKIE)?.value;

  if (!code || !state) return fail("missing code/state");
  if (!stateCookie || stateCookie !== state) return fail("state mismatch (possible CSRF)");

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!clientId || !clientSecret || !siteUrl) {
    return fail("OAuth env vars not configured", 500);
  }

  // Exchange code for access token
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: `${siteUrl.replace(/\/$/, "")}/api/admin/auth/callback`,
    }),
  });
  if (!tokenRes.ok) return fail(`token exchange failed (${tokenRes.status})`, 502);
  const tokenJson = (await tokenRes.json()) as { access_token?: string; error?: string };
  if (!tokenJson.access_token) {
    return fail(`token exchange returned no access_token (${tokenJson.error ?? "unknown"})`, 502);
  }
  const accessToken = tokenJson.access_token;

  // Identify the user
  const userRes = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "tradernoah-admin",
    },
  });
  if (!userRes.ok) return fail(`user lookup failed (${userRes.status})`, 502);
  const user = (await userRes.json()) as { login?: string };
  if (!user.login) return fail("user lookup returned no login", 502);

  if (!isAllowedGithubUser(user.login)) {
    return new NextResponse(
      `Signed in as ${user.login}, but this account isn't on the admin allowlist.`,
      { status: 403 },
    );
  }

  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const cookieValue = serializeSession({ accessToken, githubUser: user.login, exp });

  const res = NextResponse.redirect(`${siteUrl.replace(/\/$/, "")}/admin`);
  res.cookies.set(SESSION_COOKIE, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  res.cookies.delete(STATE_COOKIE);
  return res;
}
