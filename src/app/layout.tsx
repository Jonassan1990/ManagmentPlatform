import type { Metadata } from "next";
import { Source_Sans_3, Source_Serif_4 } from "next/font/google";
import { AuthenticatedShell } from "@/components/shell/authenticated-shell";
import "./globals.css";

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-source-sans",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source-serif",
});

export const metadata: Metadata = {
  title: "Management Platform",
  description:
    "Management, governance, portfolio, and PI Planning platform — Phase 6 production identity",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${sourceSans.variable} ${sourceSerif.variable} antialiased`}>
        <AuthenticatedShell>{children}</AuthenticatedShell>
      </body>
    </html>
  );
}
