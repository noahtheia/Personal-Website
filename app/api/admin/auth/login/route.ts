// POST /api/admin/auth/login — accepts a password form submission. If it
// matches ADMIN_PASSWORD, we issue a signed session cookie and redirect to
// /admin. Otherwise we bounce back to /admin/login?error=invalid.

import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  serializeSession,
  verifyAdminPassword,
} from "@/lib/admin-session";

function siteUrl(req: NextRequest): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/$/, "");
  return new URL(req.url).origin;
}

export async function POST(req: NextRequest) {
  let password = "";
  try {
    const form = await req.formData();
    const v = form.get("password");
    if (typeof v === "string") password = v;
  } catch {
    // ignore — falls through to invalid
  }

  const base = siteUrl(req);
  if (!password || !verifyAdminPassword(password)) {
    return NextResponse.redirect(`${base}/admin/login?error=invalid`, 303);
  }

  let cookieValue: string;
  try {
    cookieValue = serializeSession({
      authed: true,
      exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "session error";
    return NextResponse.redirect(
      `${base}/admin/login?error=${encodeURIComponent(msg)}`,
      303,
    );
  }

  const res = NextResponse.redirect(`${base}/admin`, 303);
  res.cookies.set(SESSION_COOKIE, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return res;
}
