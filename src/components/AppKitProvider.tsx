"use client";
// Importing appkit.ts triggers createAppKit() — must happen on the client side only.
import "@/lib/appkit";

export default function AppKitProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
