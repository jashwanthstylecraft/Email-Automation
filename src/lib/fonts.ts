import { Jost, Montserrat, Roboto, JetBrains_Mono } from "next/font/google";

export const jost = Jost({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-jost",
  display: "swap",
});

export const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-montserrat",
  display: "swap",
});

export const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-roboto",
  display: "swap",
});

export const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const fontVariables = `${jost.variable} ${montserrat.variable} ${roboto.variable} ${jetbrainsMono.variable}`;
