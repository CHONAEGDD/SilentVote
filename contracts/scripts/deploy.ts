import { ethers } from "hardhat";

async function main() {
  console.log("Deploying SilentVote to Sepolia...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH\n");

  if (parseFloat(ethers.formatEther(balance)) < 0.01) {
    console.error("ERROR: Insufficient balance for deployment");
    process.exit(1);
  }

  console.log("Deploying contract...");
  const SilentVote = await ethers.getContractFactory("SilentVote");
  const silentVote = await SilentVote.deploy();

  console.log("Waiting for deployment confirmation...");
  await silentVote.waitForDeployment();

  const address = await silentVote.getAddress();
  
  console.log("\n========================================");
  console.log("SilentVote deployed to:", address);
  console.log("========================================\n");
  
  console.log("Next steps:");
  console.log(`1. Verify: npx hardhat verify --network sepolia ${address}`);
  console.log(`2. Update frontend/.env.local: NEXT_PUBLIC_CONTRACT_ADDRESS=${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

