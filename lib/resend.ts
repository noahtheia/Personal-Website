import { Resend } from "resend";

export function getResendClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

export function getAudienceId(): string | null {
  return process.env.RESEND_AUDIENCE_ID ?? null;
}
