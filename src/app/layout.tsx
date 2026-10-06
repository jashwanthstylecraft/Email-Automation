import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { fontVariables } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "StyleCraft | Email Automation & Intelligence",
  description: "AI-powered email classification, RAG-based auto-replies, and visual rules engine for customer support.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fontVariables} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        {/* Forced to light (plain white background, dark text) -- a plain
            defaultTheme wasn't enough: next-themes persists whatever theme a
            browser previously resolved to in localStorage, so anyone who'd
            loaded this app before (under the old "system" default) kept
            seeing the dark theme regardless. forcedTheme overrides that
            stored value and the OS preference unconditionally. */}
        <ThemeProvider attribute="data-theme" forcedTheme="light">
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
