import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { getFilings } from "@/lib/farmland-comps";
import { fetchPriceHistory } from "@/lib/farmland-history";

export const runtime = "nodejs";
// Allow this to run on a schedule even if it takes a while.
export const maxDuration = 300;

// Daily price refresh job. Called by a cron schedule (Vercel cron via
// vercel.json, or GitHub Actions via a webhook). For each ticker:
//   1. fetch the latest 10-year daily price history from Yahoo. The
//      fetch is wrapped in `next: { revalidate: 86400 }` inside
//      fetchPriceHistory(), so re-fetching here primes the cache for
//      the next user request.
//   2. revalidate the comps page + every per-ticker detail page so
//      the next request is served from fresh static pre-renders.
//
// To trigger:
//   • Vercel cron: scheduled in vercel.json. Vercel auto-injects an
//     Authorization: Bearer <CRON_SECRET> header on every cron call;
//     CRON_SECRET is the env var (auto-set by Vercel). The route
//     accepts that header.
//   • Manual: GET /api/refresh-prices?secret=YOUR_SECRET (env var
//     REFRESH_PRICES_SECRET — separate from CRON_SECRET so manual
//     refreshes can be triggered without exposing the cron token).
// Without either credential the route returns 401.

export async function GET(req: Request) {
  const url = new URL(req.url);
  const querySecret = url.searchParams.get("secret");
  const manualSecret = process.env.REFRESH_PRICES_SECRET;
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization") ?? "";
  const bearerOk =
    !!cronSecret && authHeader === `Bearer ${cronSecret}`;
  const querySecretOk =
    !!manualSecret && querySecret === manualSecret;
  if (!bearerOk && !querySecretOk) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const filings = getFilings();
  const results: { ticker: string; ok: boolean; points?: number }[] = [];

  // Run in parallel batches of 10 to stay under Yahoo rate limits.
  const BATCH = 10;
  for (let i = 0; i < filings.length; i += BATCH) {
    const slice = filings.slice(i, i + BATCH);
    const fetched = await Promise.all(
      slice.map(async (f) => {
        try {
          const h = await fetchPriceHistory(f.ticker);
          return {
            ticker: f.ticker,
            ok: !!h,
            points: h?.points.length ?? 0,
          };
        } catch {
          return { ticker: f.ticker, ok: false };
        }
      }),
    );
    results.push(...fetched);
  }

  try {
    revalidatePath("/analytics/trends");
    revalidatePath("/analytics/regression-analysis");
    revalidateTag("farmland-prices");
  } catch {
    // revalidate failures are non-fatal — caching just remains stale
    // until the next natural revalidation tick.
  }

  const ok = results.filter((r) => r.ok).length;
  const failed = results.length - ok;
  const elapsedMs = Date.now() - startedAt;

  return NextResponse.json({
    refreshedAt: new Date().toISOString(),
    elapsedMs,
    tickers: results.length,
    ok,
    failed,
    failedTickers: results.filter((r) => !r.ok).map((r) => r.ticker),
  });
}
