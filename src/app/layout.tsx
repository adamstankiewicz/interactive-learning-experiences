import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono, IBM_Plex_Sans, Source_Serif_4 } from "next/font/google";
import "./globals.css";

import { cn } from "@/lib/utils";
import { THEME_SCRIPT } from "@/lib/theme";

/**
 * The Practice Pathways type system, per the design handoff:
 * Archivo carries headlines, UI labels and every numeral (its width axis is
 * loaded so headlines can stretch 106–118%); IBM Plex Sans carries body copy
 * and tables; IBM Plex Mono carries standard codes, timings and micro-labels;
 * Source Serif 4 exists for student reading passages only — remediation
 * prose, activity prompts, the student's own draft.
 */
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Practice Pathways",
  description:
    "Turn a topic into a standards-verified learning pathway of interactive activities.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={cn(
        archivo.variable,
        plexSans.variable,
        plexMono.variable,
        sourceSerif.variable,
        'h-full antialiased',
      )}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
