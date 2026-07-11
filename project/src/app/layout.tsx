import type { Metadata } from "next";
import { Sarina, Cormorant_Garamond, Mulish } from "next/font/google";
import "./globals.css";

// Logo only — display face for the "Rumbo." wordmark.
const sarina = Sarina({
  variable: "--font-logo",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

// Headings — editorial boutique serif voice.
const cormorant = Cormorant_Garamond({
  variable: "--font-serif",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
});

// Body / UI — clean humanist sans (deliberately not Inter/Roboto/Arial).
const mulish = Mulish({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Rumbo — All of El Salvador, none of the planning",
  description:
    "Tell us how you picture your trip. We build every day of it — you just show up and live it. A boutique inbound experience builder for El Salvador.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${sarina.variable} ${cormorant.variable} ${mulish.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
