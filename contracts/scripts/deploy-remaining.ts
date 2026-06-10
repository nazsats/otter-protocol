// Deploys only OTTERInitiation + OTTERSigil — use when OTTERToken is already deployed.
import { ethers } from "hardhat";

const OTTER_TOKEN_ADDRESS = "0x2B4e77A45d3ad079f27F0261CA7B0b07a2476E08";

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance    = ethers.formatEther(await ethers.provider.getBalance(deployer.address));
  const feeData    = await ethers.provider.getFeeData();
  const gasPriceGwei = parseFloat(ethers.formatUnits(feeData.gasPrice ?? 0n, "gwei")).toFixed(1);

  console.log("═══════════════════════════════════════════════════════");
  console.log("   OTTER Protocol — Deploy Remaining Contracts");
  console.log("═══════════════════════════════════════════════════════");
  console.log("Deployer   :", deployer.address);
  console.log("Balance    :", balance, "ETH");
  console.log("Gas price  :", gasPriceGwei, "gwei");
  console.log("OTTERToken :", OTTER_TOKEN_ADDRESS, "(already deployed — skipping)");
  console.log("");

  // Estimate: OTTERInitiation ~7M gas + OTTERSigil ~500K gas
  const estimatedCostEth = (7_500_000 * parseFloat(gasPriceGwei) * 1e-9).toFixed(4);
  console.log(`Estimated cost: ~${estimatedCostEth} ETH at ${gasPriceGwei} gwei`);

  if (parseFloat(balance) < 0.05) {
    console.error("⚠  Need at least 0.05 ETH. Get free Sepolia ETH from: https://sepoliafaucet.com");
    process.exit(1);
  }

  const GUARDIAN_ADDRESS = process.env.GUARDIAN_ADDRESS || deployer.address;

  // ── 1. OTTERInitiation ────────────────────────────────────────────────────
  console.log("Deploying OTTERInitiation…");
  const OTTERInitiation = await ethers.getContractFactory("OTTERInitiation");
  const initiation      = await OTTERInitiation.deploy(GUARDIAN_ADDRESS);
  await initiation.waitForDeployment();
  const initiationAddress = await initiation.getAddress();
  console.log("✓ OTTERInitiation:", initiationAddress);

  // Seed tasks post-deploy (separate tx — cheaper than constructor)
  console.log("  Seeding 35 tasks on-chain…");
  try {
    const seedTx = await initiation.seedTasks();
    await seedTx.wait();
    console.log("  ✓ Tasks seeded");
  } catch (e) {
    console.warn("  ⚠  seedTasks() failed — run it manually later when you have more ETH");
    console.warn("  Contract is still functional for off-chain tracking.");
  }

  // ── 2. OTTERSigil ─────────────────────────────────────────────────────────
  console.log("Deploying OTTERSigil…");
  const OTTERSigil = await ethers.getContractFactory("OTTERSigil");
  const sigil      = await OTTERSigil.deploy();
  await sigil.waitForDeployment();
  const sigilAddress = await sigil.getAddress();
  console.log("✓ OTTERSigil     :", sigilAddress);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("");
  console.log("═══════════════════════════════════════════════════════");
  console.log("   DONE — paste into .env.local");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`NEXT_PUBLIC_OTTER_CONTRACT=${OTTER_TOKEN_ADDRESS}`);
  console.log(`NEXT_PUBLIC_INITIATION_CONTRACT=${initiationAddress}`);
  console.log(`NEXT_PUBLIC_SIGIL_CONTRACT=${sigilAddress}`);
  console.log("");
  console.log("View on Etherscan:");
  console.log(`https://sepolia.etherscan.io/address/${initiationAddress}`);
  console.log(`https://sepolia.etherscan.io/address/${sigilAddress}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
