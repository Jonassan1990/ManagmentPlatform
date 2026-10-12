import type { Metadata } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import { AuthenticatedShell } from "@/components/shell/authenticated-shell";
import { TegelProvider } from "@/components/tegel/tegel-provider";
import "./globals.css";

/** Industrial companion fonts — Scania Sans is brand-restricted; Barlow tracks Tegel proportions. */
const tegelSans = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-tegel-sans",
});

const tegelDisplay = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-tegel-display",
});

export const metadata: Metadata = {
  title: "Management Platform",
  description:
    "Management, governance, portfolio, and PI Planning platform — Scania Tegel UI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scania">
      <body
        className={`scania tds-mode-light ${tegelSans.variable} ${tegelDisplay.variable} antialiased`}
      >
        <TegelProvider>
          <AuthenticatedShell>{children}</AuthenticatedShell>
        </TegelProvider>
      </body>
    </html>
  );
}
