import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "SyndiCheck — Vet Your Syndicator",
    template: "%s | SyndiCheck",
  },
  description:
    "The trusted platform for LP investors to vet real estate syndicators. Powered by SEC filings, FINRA records, and community reviews.",
  keywords: [
    "syndicator vetting",
    "real estate syndication",
    "LP investor",
    "due diligence",
    "SEC Form D",
    "trust score",
  ],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: process.env.NEXT_PUBLIC_APP_URL,
    siteName: "SyndiCheck",
    title: "SyndiCheck — Vet Your Syndicator",
    description:
      "The trusted platform for LP investors to vet real estate syndicators.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "SyndiCheck",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SyndiCheck — Vet Your Syndicator",
    description:
      "The trusted platform for LP investors to vet real estate syndicators.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
