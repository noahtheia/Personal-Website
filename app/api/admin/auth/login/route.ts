// GET /api/admin/auth/login → redirect to GitHub's authorize URL with a fresh
// random `state` cookie for CSRF protection. The callback verifies the state.

import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

const STATE_COOKIE = "admin_oauth_state";
const STATE_TTL_SECONDS = 600;

export async function GET() {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!clientId || !siteUrl) {
    return new NextResponse("Admin OAuth is not configured.", { status: 500 });
  }
  const state = randomBytes(24).toString("base64url");
  const callback = `${siteUrl.replace(/\/$/, "")}/api/admin/auth/callback`;
  const authorize = new URL("https://github.com/login/oauth/authorize");
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("redirect_uri", callback);
  authorize.searchParams.set("scope", "repo");
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("allow_signup", "false");
  const res = NextResponse.redirect(authorize.toString());
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: STATE_TTL_SECONDS,
  });
  return res;
}
