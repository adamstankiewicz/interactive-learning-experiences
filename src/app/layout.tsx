import type { Metadata } from "next";
import { Geist, Geist_Mono, Lexend } from "next/font/google";
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
 * Registered globally (fonts load once, here) but applied only locally on
 * the pathway builder's own headings via `font-[family-name:var(--font-lexend)]`
 * — not wired into the shared `--font-heading` token, which the Pathways
 * dashboard, Roster, Upload, Nav, and the Crossword widget all still use.
 * Lexend specifically: it's a typeface engineered and studied for reading
 * proficiency, including K-12 classroom trials — an unusually literal fit
 * for a tool that builds reading/learning pathways, not a default pick.
 */
const lexend = Lexend({
  variable: "--font-lexend",
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
      className={cn(geistSans.variable, geistMono.variable, lexend.variable, 'h-full antialiased')}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
