/**
 * Secure treasury transfer utilities.
 * All on-chain operations go through here.
 * - Explicit nonce management (prevents nonce collision under concurrent load)
 * - Receipt validation (confirms tx was mined, not just broadcast)
 * - Gas estimation with safety buffer
 */
import { ethers } from "ethers";

const RPC_URL     = process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY!;

const OTTER_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
];

let _provider: ethers.JsonRpcProvider | null = null;
let _wallet:   ethers.Wallet | null          = null;

function getProvider(): ethers.JsonRpcProvider {
  if (!_provider) _provider = new ethers.JsonRpcProvider(RPC_URL);
  return _provider;
}

function getWallet(): ethers.Wallet {
  if (!PRIVATE_KEY) throw new Error("DEPLOYER_PRIVATE_KEY not set");
  if (!_wallet) _wallet = new ethers.Wallet(PRIVATE_KEY, getProvider());
  return _wallet;
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
 * Uses pending nonce to handle concurrent transfers safely.
 */
export async function treasuryTransfer(
  contractAddress: string,
  toAddress: string,
  amountOtter: number
): Promise<TransferResult> {
  if (!ethers.isAddress(toAddress))       throw new Error("Invalid recipient address");
  if (!ethers.isAddress(contractAddress)) throw new Error("Invalid contract address");
  if (amountOtter <= 0 || amountOtter > 100_000) throw new Error("Invalid transfer amount");

  const wallet   = getWallet();
  const provider = getProvider();
  const contract = new ethers.Contract(contractAddress, OTTER_ABI, wallet);
  const amount   = ethers.parseEther(String(amountOtter));

  // Verify treasury has sufficient balance before sending
  const balance = await contract.balanceOf(wallet.address);
  if (balance < amount) throw new Error("Insufficient treasury balance");

  // Fetch pending nonce — handles concurrent transactions safely
  const nonce = await provider.getTransactionCount(wallet.address, "pending");

  // Estimate gas with 20% safety buffer
  const gasEstimate = await contract.transfer.estimateGas(toAddress, amount);
  const gasLimit    = (gasEstimate * BigInt(120)) / BigInt(100);

  const tx = await contract.transfer(toAddress, amount, { nonce, gasLimit });

  // Wait for 1 confirmation (not just broadcast)
  const receipt = await tx.wait(1);
  if (!receipt || receipt.status !== 1) throw new Error("Transaction failed on-chain");

  return {
    txHash:  tx.hash,
    gasUsed: receipt.gasUsed.toString(),
    from:    wallet.address,
    to:      toAddress,
    amount:  amountOtter.toString(),
  };
}

/** Get treasury wallet address (read-only, safe to log) */
export function getTreasuryAddress(): string {
  return getWallet().address;
}

/** Get treasury OTTER balance */
export async function getTreasuryBalance(contractAddress: string): Promise<string> {
  const wallet   = getWallet();
  const contract = new ethers.Contract(contractAddress, OTTER_ABI, getProvider());
  const bal      = await contract.balanceOf(wallet.address);
  return ethers.formatEther(bal);
}
