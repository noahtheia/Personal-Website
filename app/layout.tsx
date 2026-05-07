import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { site } from "@/lib/site";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-fraunces",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: site.brand,
    template: `%s — ${site.brand}`,
  },
  description: site.description,
  alternates: {
    types: {
      "application/rss+xml": [
        { url: "/feed.xml", title: `${site.brand} — RSS` },
      ],
    },
  },
  openGraph: {
    title: site.brand,
    description: site.description,
    type: "website",
    url: site.url,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <body className="bg-bg font-sans text-fg antialiased">
        <div className="flex min-h-screen flex-col">
          <div className="mx-auto w-full max-w-prose px-6 pt-8 sm:pt-10">
            <Header />
          </div>
          <main className="flex-1">{children}</main>
          <div className="mx-auto w-full max-w-prose px-6 pb-8 sm:pb-10">
            <Footer />
          </div>
        </div>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
