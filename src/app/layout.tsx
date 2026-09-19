import type { Metadata, Viewport } from "next";
import { Archivo, Figtree, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";
import { NoticeEquivalent } from "@/components/notice-equivalent";
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
  title: "sickway — a sick day, said once",
  description: "A synthetic student intake and clinician workflow prototype.",
};

// Draw under the iOS notch and home indicator; the banner and tab bar pad themselves with the safe-area insets.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#000000",
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
          <p className="mb-6 text-xs leading-5 text-muted-foreground">
            <span lang="en">Prototype workflow. Not medical advice. Do not enter real health information.</span>
            <NoticeEquivalent notice="disclaimer" className="block" />
          </p>
          <SessionSupersededNotice />
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
