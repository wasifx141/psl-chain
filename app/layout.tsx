import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { ToasterProvider } from "@/components/Toaster";
import { Web3Provider } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PSL Chain — Pakistan's Fantasy Cricket On-Chain",
  description:
    "Own the Game. Trade PSL Stars. Pakistan's first on-chain fantasy cricket market powered by WireFluid blockchain. Buy, sell, and stake player tokens to earn real WireCoin rewards.",
  openGraph: {
    title: "PSL Chain — Fantasy Cricket DApp on WireFluid",
    description:
      "Trade PSL player tokens on a bonding curve. Stake before matches. Earn rewards based on real performance.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background">
        <Web3Provider>
          <Navbar />
          <main className="flex-1">{children}</main>
          <ToasterProvider />
        </Web3Provider>
      </body>
    </html>
  );
}
