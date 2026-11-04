import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "ABF New Companies",
    template: "%s · ABF New Companies",
  },
  description:
    "Internal tool for ABF Accounting — pull new Companies House incorporations, print letters and labels, and track what was sent.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#09242d",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB" className={`${manrope.variable} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
