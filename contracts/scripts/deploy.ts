import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance    = ethers.formatEther(await ethers.provider.getBalance(deployer.address));

  console.log("═══════════════════════════════════════════════════════");
  console.log("   OTTER Protocol — Sepolia Deployment");
  console.log("═══════════════════════════════════════════════════════");
  console.log("Deployer :", deployer.address);
  console.log("Balance  :", balance, "ETH");
  console.log("");

  if (parseFloat(balance) < 0.05) {
    console.error("⚠  Low balance — you need at least 0.05 SepoliaETH for gas.");
    console.error("   Get free Sepolia ETH from: https://sepoliafaucet.com");
    process.exit(1);
  }

  // ── Addresses (default to deployer wallet — change for production) ────────
  const TREASURY_ADDRESS       = process.env.TREASURY_ADDRESS       || deployer.address;
  const LIQUIDITY_LOCK_ADDRESS = process.env.LIQUIDITY_LOCK_ADDRESS || deployer.address;
  const GUARDIAN_ADDRESS       = process.env.GUARDIAN_ADDRESS       || deployer.address;

  console.log("Treasury     :", TREASURY_ADDRESS);
  console.log("LiquidityLock:", LIQUIDITY_LOCK_ADDRESS);
  console.log("Guardian     :", GUARDIAN_ADDRESS);
  console.log("");

  // ── 1. Deploy OTTERToken ──────────────────────────────────────────────────
  console.log("Deploying OTTERToken…");
  const OTTERToken = await ethers.getContractFactory("OTTERToken");
  const token      = await OTTERToken.deploy(TREASURY_ADDRESS, LIQUIDITY_LOCK_ADDRESS);
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log("✓ OTTERToken     :", tokenAddress);

  // ── 2. Deploy OTTERInitiation ─────────────────────────────────────────────
  console.log("Deploying OTTERInitiation…");
  const OTTERInitiation = await ethers.getContractFactory("OTTERInitiation");
  const initiation      = await OTTERInitiation.deploy(GUARDIAN_ADDRESS);
  await initiation.waitForDeployment();
  const initiationAddress = await initiation.getAddress();
  console.log("✓ OTTERInitiation:", initiationAddress);

  // ── 3. Deploy OTTERSigil (soulbound initiation badge) ────────────────────
  console.log("Deploying OTTERSigil…");
  const OTTERSigil = await ethers.getContractFactory("OTTERSigil");
  const sigil      = await OTTERSigil.deploy();
  await sigil.waitForDeployment();
  const sigilAddress = await sigil.getAddress();
  console.log("✓ OTTERSigil     :", sigilAddress);

  // ── Summary ───────────────────────────────────────────────────────────────
  const supply = ethers.formatEther(await token.totalSupply());
  console.log("");
  console.log("═══════════════════════════════════════════════════════");
  console.log("   DEPLOYMENT COMPLETE");
  console.log("═══════════════════════════════════════════════════════");
  console.log("Total Supply :", supply, "OTTER");
  console.log("");
  console.log("══ Copy these into your .env.local ════════════════════");
  console.log(`NEXT_PUBLIC_OTTER_CONTRACT=${tokenAddress}`);
  console.log(`NEXT_PUBLIC_INITIATION_CONTRACT=${initiationAddress}`);
  console.log(`NEXT_PUBLIC_SIGIL_CONTRACT=${sigilAddress}`);
  console.log("");
  console.log("══ Also set in Vercel env vars ═════════════════════════");
  console.log(`NEXT_PUBLIC_OTTER_CONTRACT=${tokenAddress}`);
  console.log(`NEXT_PUBLIC_INITIATION_CONTRACT=${initiationAddress}`);
  console.log(`NEXT_PUBLIC_SIGIL_CONTRACT=${sigilAddress}`);
  console.log("  OR set contract addresses in /admin → ⚙ CONFIG");
  console.log("");
  console.log("══ View on Etherscan ════════════════════════════════════");
  console.log(`https://sepolia.etherscan.io/address/${tokenAddress}`);
  console.log(`https://sepolia.etherscan.io/address/${initiationAddress}`);
  console.log(`https://sepolia.etherscan.io/address/${sigilAddress}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
