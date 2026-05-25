import { ethers } from "ethers";

// ─── CREATE NEW WALLET ────────────────────────────────────
export function createNewWallet(): {
  address: string;
  mnemonic: string;
  privateKey: string;
} {
  const wallet = ethers.Wallet.createRandom();
  return {
    address:    wallet.address,
    mnemonic:   wallet.mnemonic!.phrase,
    privateKey: wallet.privateKey,
  };
}

// Encrypt wallet with password and return keystore JSON (safe to store)
export async function encryptWallet(
  privateKey: string,
  password: string
): Promise<string> {
  const wallet = new ethers.Wallet(privateKey);
  return wallet.encrypt(password);
}

// Decrypt keystore JSON
export async function decryptWallet(
  keystore: string,
  password: string
): Promise<ethers.Wallet | ethers.HDNodeWallet> {
  return ethers.Wallet.fromEncryptedJson(keystore, password);
}

// Import wallet from mnemonic
export function importFromMnemonic(mnemonic: string): {
  address: string;
  privateKey: string;
} {
  const wallet = ethers.Wallet.fromPhrase(mnemonic.trim());
  return { address: wallet.address, privateKey: wallet.privateKey };
}

// Import wallet from private key
export function importFromPrivateKey(privateKey: string): {
  address: string;
} {
  const wallet = new ethers.Wallet(privateKey.trim());
  return { address: wallet.address };
}

// ─── METAMASK / INJECTED WALLET ──────────────────────────
export async function connectInjectedWallet(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const eth = (window as Window & { ethereum?: ethers.Eip1193Provider }).ethereum;
  if (!eth) return null;

  const provider = new ethers.BrowserProvider(eth);
  const accounts = await provider.send("eth_requestAccounts", []);
  return accounts[0] ?? null;
}

export function hasInjectedWallet(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window as Window & { ethereum?: unknown }).ethereum;
}

// Format address for display
export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
