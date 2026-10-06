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
        {/* Light (plain white background, dark text) is the default instead
            of following the OS preference, but the toggle below still lets
            anyone switch to Dark -- not forced. Note for anyone testing this:
            next-themes persists whatever theme a browser previously resolved
            to in localStorage, so a browser that already loaded this app
            under the old "system" default keeps showing dark until the
            toggle is used once or site data is cleared. */}
        <ThemeProvider attribute="data-theme" defaultTheme="light" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
