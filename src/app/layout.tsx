import type { Metadata } from "next";
import { Geist, Geist_Mono, Cinzel } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { ToastProvider } from "@/context/ToastContext";
import { InitiationProvider } from "@/context/InitiationContext";
import AuthGate from "@/components/auth/AuthGate";
import AppKitProvider from "@/components/AppKitProvider";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const cinzel = Cinzel({ variable: "--font-cinzel", subsets: ["latin"], weight: ["400", "700", "900"] });

export const metadata: Metadata = {
  title: "OTTER Protocol — Hold Together. Build Together.",
  description:
    "The first community-owned meme token standard on Ethereum. ERC-OTTER enforces community ownership, contribution rewards, and anti-manipulation mechanics at the protocol level.",
  keywords: ["OTTER", "ERC", "EIP", "Ethereum", "meme token", "community", "DeFi", "Web3"],
  openGraph: {
    title: "OTTER Protocol — Hold Together. Build Together.",
    description: "The first community-owned meme token standard on Ethereum.",
    type: "website",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${cinzel.variable}`}>
      <body>
        <AppKitProvider>
          <ToastProvider>
            <AuthProvider>
              <InitiationProvider>
                <AuthGate />
                {children}
              </InitiationProvider>
            </AuthProvider>
          </ToastProvider>
        </AppKitProvider>
      </body>
    </html>
  );
}
