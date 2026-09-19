import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";
import { NoticeEquivalent } from "@/components/notice-equivalent";
import { SessionSupersededNotice } from "@/components/session/reset-controls";
import { SiteHeader } from "@/components/site-header";
import { SyntheticBanner } from "@/components/synthetic-banner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sick Day + Doorway",
  description: "A synthetic student intake and clinician workflow prototype.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <SyntheticBanner />
        <SiteHeader />
        <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
          <p className="mb-6 text-sm leading-6 text-muted-foreground">
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
