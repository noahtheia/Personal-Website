// Session helpers for the admin portal. Sessions are stored client-side in an
// HTTP-only signed cookie. The payload is HMAC-signed with ADMIN_SESSION_SECRET;
// tampering invalidates it.
//
// With password auth there's nothing per-user to store — the session just
// records that someone proved knowledge of ADMIN_PASSWORD and when that proof
// expires. Commits use GITHUB_TOKEN on the server, not anything in the cookie.
//
// Cookie format: `<base64url(JSON(payload))>.<base64url(hmac-sha256(payload))>`.

import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "admin_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export type AdminSession = {
  authed: true;
  exp: number;
};

function getSecret(): string {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error(
      "ADMIN_SESSION_SECRET is not set (or too short). Set a 32+ character random string.",
    );
  }
  return s;
}

function b64urlEncode(buf: Buffer): string {
  return buf.toString("base64url");
}

function b64urlDecode(s: string): Buffer {
  return Buffer.from(s, "base64url");
}

function sign(payload: string, secret: string): string {
  return b64urlEncode(createHmac("sha256", secret).update(payload).digest());
}

export function serializeSession(session: AdminSession): string {
  const secret = getSecret();
  const payload = b64urlEncode(Buffer.from(JSON.stringify(session)));
  return `${payload}.${sign(payload, secret)}`;
}

export function verifySessionCookie(raw: string | undefined): AdminSession | null {
  if (!raw) return null;
  const idx = raw.indexOf(".");
  if (idx <= 0) return null;
  const payload = raw.slice(0, idx);
  const sigGiven = raw.slice(idx + 1);
  let secret: string;
  try {
    secret = getSecret();
  } catch {
    return null;
  }
  const sigExpected = sign(payload, secret);
  const a = Buffer.from(sigGiven);
  const b = Buffer.from(sigExpected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  let session: AdminSession;
  try {
    session = JSON.parse(b64urlDecode(payload).toString("utf8")) as AdminSession;
  } catch {
    return null;
  }
  if (session.authed !== true || typeof session.exp !== "number") return null;
  if (session.exp < Math.floor(Date.now() / 1000)) return null;
  return session;
}

/** Constant-time check of a submitted password against ADMIN_PASSWORD. */
export function verifyAdminPassword(supplied: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const a = Buffer.from(supplied, "utf8");
  const b = Buffer.from(expected, "utf8");
  // Length leak is acceptable — the password length itself isn't sensitive.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Read the server-side commit token (a fine-grained PAT) from env. */
export function getGithubToken(): string {
  const t = process.env.GITHUB_TOKEN;
  if (!t) throw new Error("GITHUB_TOKEN is not set (need a PAT with `contents: write` on this repo).");
  return t;
}
