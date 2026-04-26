import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Noah's Notes",
    template: "%s — Noah's Notes",
  },
  description: "Investment ideas, models, and notes.",
  openGraph: {
    title: "Noah's Notes",
    description: "Investment ideas, models, and notes.",
    type: "website",
    url: siteUrl,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-serif antialiased">
        <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-10">
          <Header />
          <main className="flex-1 py-10">{children}</main>
          <Footer />
        </div>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
