import { NextResponse } from "next/server";
import { z } from "zod";
import { getAudienceId, getResendClient } from "@/lib/resend";

export const runtime = "nodejs";

const Body = z.object({
  email: z.string().email(),
});

export async function POST(req: Request) {
  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid email." }, { status: 400 });
  }

  const resend = getResendClient();
  const audienceId = getAudienceId();
  if (!resend || !audienceId) {
    console.warn("[subscribe] RESEND_API_KEY or RESEND_AUDIENCE_ID not set; skipping.");
    return NextResponse.json(
      { error: "Subscriptions are not configured yet." },
      { status: 503 },
    );
  }

  const { error } = await resend.contacts.create({
    email: parsed.email,
    audienceId,
    unsubscribed: false,
  });

  if (error) {
    // Resend returns a duplicate-style error for already-subscribed emails;
    // treat that as success so the user sees a friendly state.
    const message = (error.message ?? "").toLowerCase();
    if (message.includes("already")) {
      return NextResponse.json({ ok: true, alreadySubscribed: true });
    }
    console.error("[subscribe] Resend error:", error);
    return NextResponse.json(
      { error: "Couldn't subscribe right now. Try again later." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
