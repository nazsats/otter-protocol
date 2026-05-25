import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying OTTER Protocol contracts...");
  console.log("Deployer:", deployer.address);
  console.log("Balance: ", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  // In production: replace with actual multisig treasury and locked LP address
  const TREASURY_ADDRESS      = process.env.TREASURY_ADDRESS      || deployer.address;
  const LIQUIDITY_LOCK_ADDRESS = process.env.LIQUIDITY_LOCK_ADDRESS || deployer.address;

  const OTTERToken = await ethers.getContractFactory("OTTERToken");
  const token = await OTTERToken.deploy(TREASURY_ADDRESS, LIQUIDITY_LOCK_ADDRESS);
  await token.waitForDeployment();

  const address = await token.getAddress();
  console.log("\n✓ OTTERToken deployed to:", address);
  console.log("  Treasury:      ", TREASURY_ADDRESS);
  console.log("  LiquidityLock: ", LIQUIDITY_LOCK_ADDRESS);
  console.log("  Total Supply:  ", ethers.formatEther(await token.totalSupply()), "OTTER");
  console.log("\nVerify on Etherscan:");
  console.log(`  npx hardhat verify --network sepolia ${address} "${TREASURY_ADDRESS}" "${LIQUIDITY_LOCK_ADDRESS}"`);
}

main().catch((err) => { console.error(err); process.exit(1); });
