import type { Metadata, Viewport } from "next";
import { Archivo, Figtree, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";
import { Disclaimer } from "@/components/disclaimer";
import { SessionSupersededNotice } from "@/components/session/reset-controls";
import { SiteHeader } from "@/components/site-header";
import { SyntheticBanner } from "@/components/synthetic-banner";
import "./globals.css";

// Display: a heavy italic grotesque, the closest open match to the sickway wordmark.
const display = Archivo({
  variable: "--font-display-face",
  subsets: ["latin"],
  weight: ["800", "900"],
  style: ["italic"],
});

// Body: open, friendly letterforms that stay legible for tired students and second-language readers.
const body = Figtree({
  variable: "--font-body",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "sickway — say how you feel, in your language",
  description:
    "A synthetic prototype for students who find it hard to describe symptoms in English: English and Spanish screens, the student's own words kept beside the clinician's brief, and prewritten instructions in their language. Nothing is translated.",
};

// Draw under the iOS notch and home indicator; the banner and tab bar pad themselves with the safe-area insets.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // The browser's top bar matches the banner under it: cream on a phone, black from 640px up.
  themeColor: [
    { media: "(max-width: 639px)", color: "#fdf9e8" },
    { media: "(min-width: 640px)", color: "#000000" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <div aria-hidden className="page-backdrop" />
        {/* One sticky frame: the required banner, then the floating nav pill. Its empty gutters let clicks through. */}
        <div className="pointer-events-none sticky top-0 z-50">
          <div className="pointer-events-auto">
            <SyntheticBanner />
          </div>
          <SiteHeader />
        </div>
        <div className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-32 sm:px-6 lg:pb-16">
          <SessionSupersededNotice />
          <main>{children}</main>
          {/* Required on every screen. It sits under the content so each page opens on its own heading. */}
          <Disclaimer className="mt-12 border-t border-ink/10 pt-5 text-xs text-muted-foreground" />
        </div>
      </body>
    </html>
  );
}
