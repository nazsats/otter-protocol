"use client";
import { useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useWallet } from "./useWallet";

/**
 * Central wallet-binding logic.
 *
 * Model:
 *  - The FIRST wallet a signed-in user connects is bound to their account
 *    (stored as `walletAddress` on the user doc). Only that wallet earns points
 *    and is wired to their profile.
 *  - If they later connect a DIFFERENT wallet, it is reported as a mismatch —
 *    it is NOT eligible and the binding is left untouched.
 *  - Changing the bound wallet is an explicit action in Profile (changeWallet).
 *
 * `eligibleWallet` is the only address that should ever be sent to the
 * points/claim APIs: the bound wallet, and only while it's the one actually
 * connected on the correct network.
 */
export type WalletBindingStatus =
  | "no-user"       // not signed in
  | "disconnected"  // signed in, no wallet connected
  | "binding"       // connected, first-time bind in flight
  | "matched"       // connected wallet === bound wallet
  | "mismatch";     // connected wallet !== bound wallet

export function useWalletBinding() {
  const { user, profile, bindWallet, changeWallet } = useAuth();
  const wallet = useWallet();

  const bound  = profile?.walletAddress?.toLowerCase() ?? null;
  const active = wallet.address?.toLowerCase() ?? null;

  const isConnected = wallet.isConnected && !!active;
  const isBound     = !!bound;
  const isMatch     = isBound && isConnected && active === bound;
  const isMismatch  = isBound && isConnected && active !== bound;

  // Auto-bind the first wallet a signed-in user connects. Guarded so it only
  // fires once per address and never while the profile is still loading (which
  // could otherwise look like "no binding" and bind the wrong wallet).
  const triedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!user || !profile) return;        // wait until profile is loaded
    if (!isConnected || isBound) return;  // only first-time, only when connected
    if (!wallet.address || triedRef.current === wallet.address) return;
    triedRef.current = wallet.address;
    void bindWallet(wallet.address);
  }, [user, profile, isConnected, isBound, wallet.address, bindWallet]);

  const status: WalletBindingStatus =
    !user            ? "no-user"
    : !isConnected   ? "disconnected"
    : isMismatch     ? "mismatch"
    : isMatch        ? "matched"
    : "binding";

  const eligibleWallet =
    isMatch && wallet.isCorrectNetwork ? (profile?.walletAddress ?? null) : null;

  return {
    ...wallet,
    boundWallet:  profile?.walletAddress ?? null,
    activeWallet: wallet.address ?? null,
    isBound,
    isMatch,
    isMismatch,
    status,
    /** The wallet safe to use for points/claims, else null. */
    eligibleWallet,
    /** Explicit rebind (Profile → Change wallet). */
    changeWallet,
  };
}
