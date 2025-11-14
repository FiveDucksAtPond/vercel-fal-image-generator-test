import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Analytics } from "@vercel/analytics/react";
import { DevBanner } from "@/components/DevBanner";
import { AuthHydrator } from "@/components/AuthHydrator";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  display: "swap",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Replicate x Vercel Image Generator",
  description: "An open-source AI image generator using the AI SDK and Replicate",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`dark ${geistSans.variable} ${geistMono.variable}`}>
      <body className="antialiased">
        <DevBanner />
        <AuthHydrator />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
