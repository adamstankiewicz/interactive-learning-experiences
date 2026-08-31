import type { Metadata } from "next";
import { Geist, Geist_Mono, Source_Serif_4 } from "next/font/google";
import "./globals.css";

import { cn } from "@/lib/utils";
import { THEME_SCRIPT } from "@/lib/theme";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Reading passages are the one serif surface — student-facing prose renders
 * in Source Serif 4 while every piece of chrome stays in the sans. Exposed
 * as `--font-serif` via the theme so widgets reach it with `font-serif`.
 */
const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Topic to student pathway",
  description:
    "Turn a topic into a standards-grounded learning pathway with an interactive widget.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={cn(geistSans.variable, geistMono.variable, sourceSerif.variable, 'h-full antialiased')}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
