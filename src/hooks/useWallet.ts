"use client";
import { useCallback } from "react";
import { useAppKit, useAppKitAccount, useAppKitNetwork, useAppKitProvider } from "@reown/appkit/react";
import { BrowserProvider, JsonRpcSigner, ethers } from "ethers";

export const SEPOLIA_CHAIN_ID = 11155111;

// Re-export for consumers that need it
export type { BrowserProvider, JsonRpcSigner };

export function useWallet() {
  const { open }                            = useAppKit();
  const { address, isConnected, status }    = useAppKitAccount();
  const { chainId, switchNetwork }          = useAppKitNetwork();
  const { walletProvider }                  = useAppKitProvider("eip155");

  const isCorrectNetwork = chainId === SEPOLIA_CHAIN_ID;
  const shortAddress     = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : null;

  // NOTE: connecting a wallet here no longer writes to Firestore. Binding the
  // wallet to the account is handled deliberately by useWalletBinding (first
  // connect auto-binds; changing it is an explicit Profile action) so a freshly
  // connected wallet can never silently overwrite the user's eligible wallet.

  // Get ethers signer for transactions
  const getSigner = useCallback(async (): Promise<JsonRpcSigner | null> => {
    if (!walletProvider || !address) return null;
    try {
      const provider = new BrowserProvider(walletProvider as ethers.Eip1193Provider);
      return provider.getSigner();
    } catch { return null; }
  }, [walletProvider, address]);

  // Get ethers provider for read-only calls
  const getProvider = useCallback((): BrowserProvider | null => {
    if (!walletProvider) return null;
    try {
      return new BrowserProvider(walletProvider as ethers.Eip1193Provider);
    } catch { return null; }
  }, [walletProvider]);

  const connect        = useCallback(() => open({ view: "Connect" }), [open]);
  const switchToSepolia = useCallback(() => {
    const { sepolia } = require("@reown/appkit/networks");
    switchNetwork(sepolia);
  }, [switchNetwork]);

  return {
    address:          address ?? null,
    shortAddress,
    isConnected,
    isCorrectNetwork,
    isConnecting:     status === "connecting" || status === "reconnecting",
    chainId:          chainId ?? null,
    connect,
    switchToSepolia,
    getSigner,
    getProvider,
    // open the full modal
    openModal:        open,
  };
}
