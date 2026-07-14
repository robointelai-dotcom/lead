import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "LeadFlow Pro", template: "%s | LeadFlow Pro" },
  description: "Professional business lead generation and campaign management platform",
  keywords: ["lead generation", "campaign management", "email outreach", "CRM"],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-[#f8f9fb]">{children}</body>
    </html>
  );
}
