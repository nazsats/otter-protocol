import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OTTER Protocol — Hold Together. Build Together.",
  description:
    "The first community-owned meme token standard on Ethereum. ERC-OTTER proposes on-chain standards that enforce community ownership, contribution rewards, and anti-manipulation mechanics.",
  keywords: ["OTTER", "ERC", "EIP", "Ethereum", "meme token", "community", "DeFi", "Web3"],
  openGraph: {
    title: "OTTER Protocol — Hold Together. Build Together.",
    description:
      "The first community-owned meme token standard on Ethereum. A Raft of builders shaping the future of ERC standards.",
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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
