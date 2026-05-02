import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "@/styles/globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Finlint — Quant Code Reviewer",
  description:
    "AI-powered static analysis for Python quantitative finance code. Detects lookahead bias, survivorship bias, data leakage, and more.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased h-full`}
      >
        {children}
      </body>
    </html>
  );
}
