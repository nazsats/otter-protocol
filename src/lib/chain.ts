/**
 * Secure treasury transfer utilities.
 * All on-chain operations go through here.
 *
 * Hardened for concurrency + reliability:
 *  - RPC failover: rotates through multiple endpoints on connection failure.
 *  - Nonce lock: nonces are reserved through a Firestore counter so concurrent
 *    serverless invocations can't grab the same nonce (which silently drops txs).
 *  - Retry with backoff on transient RPC errors.
 *  - Receipt validation (confirms the tx mined, not just broadcast).
 *  - Per-transfer amount cap + treasury balance check.
 */
import { ethers } from "ethers";
import { getAdminDb } from "./firebase-admin";

const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY!;

// Primary RPC from env, plus public fallbacks. Failover rotates on error.
const RPC_URLS = [
  process.env.SEPOLIA_RPC_URL,
  process.env.SEPOLIA_RPC_URL_2,
  "https://ethereum-sepolia-rpc.publicnode.com",
  "https://rpc.sepolia.org",
  "https://1rpc.io/sepolia",
].filter((u): u is string => typeof u === "string" && u.length > 0);

const MAX_TRANSFER = 100_000; // hard cap per transfer (defense-in-depth)

const OTTER_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
];

let _providerIdx = 0;
const _providers: (ethers.JsonRpcProvider | null)[] = RPC_URLS.map(() => null);

function providerAt(i: number): ethers.JsonRpcProvider {
  if (!_providers[i]) _providers[i] = new ethers.JsonRpcProvider(RPC_URLS[i]);
  return _providers[i]!;
}

function getProvider(): ethers.JsonRpcProvider {
  if (RPC_URLS.length === 0) throw new Error("No RPC endpoint configured");
  return providerAt(_providerIdx);
}

/** Rotate to the next RPC endpoint (called after a connection failure). */
function rotateProvider(): ethers.JsonRpcProvider {
  _providerIdx = (_providerIdx + 1) % RPC_URLS.length;
  return getProvider();
}

function getWallet(provider: ethers.JsonRpcProvider): ethers.Wallet {
  if (!PRIVATE_KEY) throw new Error("DEPLOYER_PRIVATE_KEY not set");
  return new ethers.Wallet(PRIVATE_KEY, provider);
}

function isTransient(e: unknown): boolean {
  const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
  return (
    msg.includes("timeout") || msg.includes("network") || msg.includes("econn") ||
    msg.includes("rate limit") || msg.includes("429") || msg.includes("503") ||
    msg.includes("could not detect network") || msg.includes("server error")
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Run a read op against RPCs, rotating + retrying on transient failures. */
async function withRpc<T>(fn: (p: ethers.JsonRpcProvider) => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < RPC_URLS.length * 2; attempt++) {
    try {
      return await fn(getProvider());
    } catch (e) {
      lastErr = e;
      if (!isTransient(e)) throw e;
      rotateProvider();
      await sleep(150 * (attempt + 1));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("RPC failed");
}

/**
 * Reserve the next nonce atomically via a Firestore counter so two concurrent
 * invocations never reuse the same nonce. The floor is the on-chain *confirmed*
 * count, so if a gap ever forms (a reserved nonce whose tx failed to broadcast),
 * the counter realigns once the chain catches up.
 */
async function reserveNonce(address: string): Promise<number> {
  const confirmed = await withRpc((p) => p.getTransactionCount(address, "latest"));
  const db  = getAdminDb();
  const ref = db.collection("treasury_state").doc(address.toLowerCase());
  return db.runTransaction(async (tx) => {
    const snap   = await tx.get(ref);
    const stored = snap.exists ? (snap.data()!.nextNonce as number) : 0;
    const nonce  = Math.max(stored, confirmed);
    tx.set(ref, { nextNonce: nonce + 1, updatedAt: Date.now() }, { merge: true });
    return nonce;
  });
}

export interface TransferResult {
  txHash:  string;
  gasUsed: string;
  from:    string;
  to:      string;
  amount:  string;
}

/**
 * Securely transfer OTTER from treasury to recipient.
 * Nonce is reserved through the Firestore lock; the send is retried across RPCs.
 */
export async function treasuryTransfer(
  contractAddress: string,
  toAddress: string,
  amountOtter: number
): Promise<TransferResult> {
  if (!ethers.isAddress(toAddress))       throw new Error("Invalid recipient address");
  if (!ethers.isAddress(contractAddress)) throw new Error("Invalid contract address");
  if (!Number.isFinite(amountOtter) || amountOtter <= 0 || amountOtter > MAX_TRANSFER)
    throw new Error("Invalid transfer amount");

  const amount = ethers.parseEther(String(amountOtter));

  // Verify treasury balance up front (read op, with failover).
  const treasuryAddr = getWallet(getProvider()).address;
  const balance = await withRpc((p) =>
    new ethers.Contract(contractAddress, OTTER_ABI, p).balanceOf(treasuryAddr)
  );
  if (balance < amount) throw new Error("Insufficient treasury balance");

  // Estimate gas BEFORE reserving a nonce. estimateGas consumes no nonce, so if
  // it fails here (treasury out of Sepolia ETH, or a revert) we bail out without
  // burning one. Reserving first — as we used to — meant every failed/un-broadcast
  // attempt advanced the Firestore counter past the chain, eventually handing out
  // a gapped nonce that left transfers stuck in the mempool forever.
  const gasLimit = await withRpc(async (p) => {
    const c   = new ethers.Contract(contractAddress, OTTER_ABI, getWallet(p));
    const est = await c.transfer.estimateGas(toAddress, amount);
    return (est * BigInt(120)) / BigInt(100);
  });

  // Reserve a nonce that no concurrent invocation can reuse — only now that the
  // transfer is known to be viable.
  const nonce = await reserveNonce(treasuryAddr);

  // Broadcast + confirm, retrying across RPCs on transient failure. The nonce is
  // fixed across retries so a re-broadcast can't double-spend.
  let lastErr: unknown;
  for (let attempt = 0; attempt < RPC_URLS.length; attempt++) {
    try {
      const provider = getProvider();
      const wallet   = getWallet(provider);
      const contract = new ethers.Contract(contractAddress, OTTER_ABI, wallet);

      const tx      = await contract.transfer(toAddress, amount, { nonce, gasLimit });
      const receipt = await tx.wait(1);
      if (!receipt || receipt.status !== 1) throw new Error("Transaction failed on-chain");

      return {
        txHash:  tx.hash,
        gasUsed: receipt.gasUsed.toString(),
        from:    treasuryAddr,
        to:      toAddress,
        amount:  amountOtter.toString(),
      };
    } catch (e) {
      lastErr = e;
      // Only retry transient RPC issues; a revert/insufficient-funds is terminal.
      if (!isTransient(e)) throw e;
      rotateProvider();
      await sleep(300 * (attempt + 1));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Transfer failed after retries");
}

/** Get treasury wallet address (read-only, safe to log) */
export function getTreasuryAddress(): string {
  return getWallet(getProvider()).address;
}

/** Get treasury OTTER balance */
export async function getTreasuryBalance(contractAddress: string): Promise<string> {
  const treasuryAddr = getWallet(getProvider()).address;
  const bal = await withRpc((p) =>
    new ethers.Contract(contractAddress, OTTER_ABI, p).balanceOf(treasuryAddr)
  );
  return ethers.formatEther(bal);
}
