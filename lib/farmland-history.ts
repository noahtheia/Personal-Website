// Historical price data fetcher for individual issuer detail pages.
// Uses Yahoo's chart API which is the same source as live quotes; range=5y
// at monthly interval gives ~60 data points per ticker.

export type PricePoint = {
  // ISO date (YYYY-MM-DD) at month-end.
  date: string;
  // Close price in the issuer's listing currency (NOT USD-converted).
  close: number;
};

export type PriceHistory = {
  ticker: string;
  // The currency Yahoo returns the prices in. May differ from filing
  // currency (e.g. MPE.L is USD-reporting but lists in GBp).
  currency: string;
  points: PricePoint[];
};

export async function fetchPriceHistory(
  ticker: string,
  range: string = "5y",
  interval: string = "1mo",
): Promise<PriceHistory | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      ticker,
    )}?interval=${interval}&range=${range}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; PersonalBlog/1.0; +https://noahsideas.com)",
        Accept: "application/json",
      },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return null;
    const meta = result.meta;
    let currency: string =
      typeof meta?.currency === "string" ? meta.currency : "USD";
    const ts: number[] = result.timestamp ?? [];
    const closes: (number | null)[] =
      result.indicators?.quote?.[0]?.close ?? [];

    const points: PricePoint[] = [];
    let priceFactor = 1;
    // LSE and similar quote in pence — normalize to pounds so the time
    // series is consistent with the live priceCurrency=GBP convention.
    if (currency === "GBp" || currency === "GBX") {
      priceFactor = 0.01;
      currency = "GBP";
    }

    for (let i = 0; i < ts.length; i++) {
      const close = closes[i];
      if (typeof close !== "number") continue;
      const d = new Date(ts[i] * 1000);
      const iso = d.toISOString().slice(0, 10);
      points.push({ date: iso, close: close * priceFactor });
    }

    if (points.length === 0) return null;
    return { ticker, currency, points };
  } catch {
    return null;
  }
}
