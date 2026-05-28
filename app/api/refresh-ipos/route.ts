import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { getExchangeIpoSummary, IPO_CACHE_TAG } from "@/lib/exchange-ipos";

export const runtime = "nodejs";
export const maxDuration = 300;

// Daily IPO refresh job. Called by a cron schedule (Vercel cron via
// vercel.json). Re-runs the SEC EDGAR + Yahoo aggregation so the
// underlying fetches (wrapped in Next's Data Cache with
// next: { revalidate: 86400, tags: ["ipos"] }) are warm for the next
// user request, then explicitly busts the "ipos" tag and revalidates
// the analytics exchange routes.
//
// Mirrors the auth pattern in /api/refresh-prices:
//   • Vercel cron: Authorization: Bearer ${CRON_SECRET}
//   • Manual:      GET /api/refresh-ipos?secret=${REFRESH_IPOS_SECRET}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const querySecret = url.searchParams.get("secret");
  const manualSecret = process.env.REFRESH_IPOS_SECRET;
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization") ?? "";
  const bearerOk = !!cronSecret && authHeader === `Bearer ${cronSecret}`;
  const querySecretOk = !!manualSecret && querySecret === manualSecret;
  if (!bearerOk && !querySecretOk) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();

  // Bust the tag first so the call below re-fetches from source
  // instead of returning the stale cached aggregation.
  try {
    revalidateTag(IPO_CACHE_TAG);
  } catch {
    // Non-fatal — cache will just lag by one revalidate cycle.
  }

  let summary: Awaited<ReturnType<typeof getExchangeIpoSummary>> | null = null;
  let error: string | null = null;
  try {
    summary = await getExchangeIpoSummary();
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  try {
    revalidatePath("/analytics/exchanges");
    revalidatePath("/analytics/exchanges/[mic]", "page");
  } catch {
    // Non-fatal.
  }

  const elapsedMs = Date.now() - startedAt;
  return NextResponse.json({
    refreshedAt: new Date().toISOString(),
    elapsedMs,
    ok: !error,
    error,
    sources: summary?.sourcesOk ?? { sec: false, yahoo: false },
    exchangesWithData: summary?.rows.length ?? 0,
    totalIpos: summary?.totalIpos ?? 0,
  });
}
