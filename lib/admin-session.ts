// Session helpers for the admin portal. Sessions are stored client-side in an
// HTTP-only signed cookie containing the GitHub OAuth access token + the
// authenticated username. The cookie payload is HMAC-signed with
// ADMIN_SESSION_SECRET; tampering invalidates it.
//
// Cookie format: `<base64url(JSON(payload))>.<base64url(hmac-sha256(payload))>`.
// Payload shape: { accessToken, githubUser, exp } where `exp` is a Unix
// timestamp (seconds).

import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "admin_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export type AdminSession = {
  accessToken: string;
  githubUser: string;
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
  if (
    typeof session.accessToken !== "string" ||
    typeof session.githubUser !== "string" ||
    typeof session.exp !== "number"
  ) {
    return null;
  }
  if (session.exp < Math.floor(Date.now() / 1000)) return null;
  return session;
}

export function isAllowedGithubUser(user: string): boolean {
  const allowed = process.env.ADMIN_GITHUB_USER;
  if (!allowed) return false;
  return user.toLowerCase() === allowed.toLowerCase();
}
