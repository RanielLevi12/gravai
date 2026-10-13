import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk } from "next/font/google";
import "./globals.css";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--display",
  display: "swap",
});

const ui = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--ui",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Gravaí",
  description: "Do material ao post, num lugar só.",
};

export const viewport: Viewport = {
  themeColor: "#E11D55",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${ui.variable}`}>
      <body>{children}</body>
    </html>
  );
}
