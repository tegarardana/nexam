import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Nexam – Platform CBT Sekolah Terpadu",
  description:
    "Sistem Computer-Based Testing (CBT) sekolah modern, terstandar, aman, dengan pemantauan anti-cheat dan manajemen akademik terpadu.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={`${inter.variable} h-full`}>
      <head>
        <link rel="stylesheet" href="/katex/katex.min.css" />
      </head>
      <body className="min-h-full flex flex-col font-sans bg-[#F8FAFC] text-slate-900 antialiased selection:bg-[#65C443]/30 selection:text-slate-900">
        {children}
      </body>
    </html>
  );
}
