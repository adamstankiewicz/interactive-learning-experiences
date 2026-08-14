import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "Topic to student pathway",
  description:
    "Turn a topic into a standards-grounded learning pathway with an interactive widget.",
};

/**
 * shadcn's `dark` variant is class-based, so something has to put `.dark` on the
 * document. This mirrors the OS setting before first paint — no flash, and the
 * same prefers-color-scheme behaviour the app had before shadcn replaced
 * globals.css. A manual theme toggle would override the class here.
 */
const themeScript = `try{var m=matchMedia('(prefers-color-scheme: dark)'),a=function(){document.documentElement.classList.toggle('dark',m.matches)};a();m.addEventListener('change',a)}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
