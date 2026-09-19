import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import type { ReactNode } from "react";
import { ResetDemoButton, SessionSupersededNotice } from "@/components/session/reset-controls";
import { SyntheticBanner } from "@/components/synthetic-banner";
import { Button } from "@/components/ui/button";
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
        <header className="border-b">
          <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
            <Link href="/" className="font-semibold tracking-tight">
              Sick Day + Doorway
            </Link>
            <nav aria-label="Main navigation" className="flex gap-2">
              <Button variant="ghost" asChild>
                <Link href="/s">Student</Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link href="/hcp">Clinician</Link>
              </Button>
              <ResetDemoButton />
            </nav>
          </div>
        </header>
        <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
          <p className="mb-6 text-sm leading-6 text-muted-foreground">
            Prototype workflow. Not medical advice. Do not enter real health
            information.
          </p>
          <SessionSupersededNotice />
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
