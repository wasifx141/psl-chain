import fs from "fs";
import pkg from "hardhat";
import path from "path";
import { fileURLToPath } from "url";
const { ethers } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface DeploymentAddresses {
  prizePool: string;
  stakingContract: string;
  oracle: string;
  championNFT: string;
  marketContract: string;
  playerTokenFactory: string;
  playerTokens: { [playerId: string]: string };
}

interface PlayerData {
  id: number;
  name: string;
  symbol: string;
  tier: number;
}

async function appendTxHash(txHashesPath: string, label: string, hash: string) {
  const line = `${label} | tx: ${hash}\n`;
  fs.appendFileSync(txHashesPath, line);
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "WC");

  const deploymentsPath = path.join(__dirname, "../deployments.json");
  const txHashesPath = path.join(__dirname, "../txhashes.txt");

  // Clear txhashes for this deployment run
  fs.writeFileSync(
    txHashesPath,
    `=== PSL Chain Deployment — ${new Date().toISOString()} ===\n`,
  );

  const deployments: DeploymentAddresses = {
    prizePool: "",
    stakingContract: "",
    oracle: "",
    championNFT: "",
    marketContract: "",
    playerTokenFactory: "",
    playerTokens: {},
  };

  // Load players data
  const playersPath = path.join(__dirname, "../data/players.json");
  const playersData: PlayerData[] = JSON.parse(
    fs.readFileSync(playersPath, "utf8"),
  );
  console.log(
    `\n📋 Loaded ${playersData.length} players from data/players.json`,
  );
  if (playersData.length !== 40) {
    throw new Error(
      `Expected 40 players, got ${playersData.length} — fix data/players.json first`,
    );
  }

  console.log("\n=== DEPLOYMENT SEQUENCE ===\n");

  // ──────────────────────────────────────────────────────────────
  // 1. PrizePool
  // ──────────────────────────────────────────────────────────────
  console.log("1. Deploying PrizePool...");
  const PrizePool = await ethers.getContractFactory("PrizePool");
  const prizePool = await PrizePool.deploy(deployer.address);
  await prizePool.waitForDeployment();
  deployments.prizePool = await prizePool.getAddress();
  fs.writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));
  const prizePoolTx = prizePool.deploymentTransaction()!;
  await prizePoolTx.wait();
  await appendTxHash(txHashesPath, "DEPLOY:PrizePool", prizePoolTx.hash);
  console.log("✅ PrizePool deployed to:", deployments.prizePool);

  // ──────────────────────────────────────────────────────────────
  // 2. StakingContract
  // ──────────────────────────────────────────────────────────────
  console.log("2. Deploying StakingContract...");
  const StakingContract = await ethers.getContractFactory("StakingContract");
  const stakingContract = await StakingContract.deploy(
    deployments.prizePool,
    deployer.address,
  );
  await stakingContract.waitForDeployment();
  deployments.stakingContract = await stakingContract.getAddress();
  fs.writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));
  const stakingTx = stakingContract.deploymentTransaction()!;
  await stakingTx.wait();
  await appendTxHash(txHashesPath, "DEPLOY:StakingContract", stakingTx.hash);
  console.log("✅ StakingContract deployed to:", deployments.stakingContract);

  // ──────────────────────────────────────────────────────────────
  // 3. PSLOracle
  // ──────────────────────────────────────────────────────────────
  console.log("3. Deploying PSLOracle...");
  const PSLOracle = await ethers.getContractFactory("PSLOracle");
  const oracle = await PSLOracle.deploy(
    deployments.prizePool,
    deployer.address,
  );
  await oracle.waitForDeployment();
  deployments.oracle = await oracle.getAddress();
  fs.writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));
  const oracleTx = oracle.deploymentTransaction()!;
  await oracleTx.wait();
  await appendTxHash(txHashesPath, "DEPLOY:PSLOracle", oracleTx.hash);
  console.log("✅ PSLOracle deployed to:", deployments.oracle);

  // ──────────────────────────────────────────────────────────────
  // 4. ChampionNFT
  // ──────────────────────────────────────────────────────────────
  console.log("4. Deploying ChampionNFT...");
  const ChampionNFT = await ethers.getContractFactory("ChampionNFT");
  const championNFT = await ChampionNFT.deploy(deployer.address);
  await championNFT.waitForDeployment();
  deployments.championNFT = await championNFT.getAddress();
  fs.writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));
  const nftTx = championNFT.deploymentTransaction()!;
  await nftTx.wait();
  await appendTxHash(txHashesPath, "DEPLOY:ChampionNFT", nftTx.hash);
  console.log("✅ ChampionNFT deployed to:", deployments.championNFT);

  // ──────────────────────────────────────────────────────────────
  // 5. MarketContract
  // ──────────────────────────────────────────────────────────────
  console.log("5. Deploying MarketContract...");
  const MarketContract = await ethers.getContractFactory("MarketContract");
  const marketContract = await MarketContract.deploy(
    deployments.prizePool,
    deployer.address,
  );
  await marketContract.waitForDeployment();
  deployments.marketContract = await marketContract.getAddress();
  fs.writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));
  const marketTx = marketContract.deploymentTransaction()!;
  await marketTx.wait();
  await appendTxHash(txHashesPath, "DEPLOY:MarketContract", marketTx.hash);
  console.log("✅ MarketContract deployed to:", deployments.marketContract);

  // ──────────────────────────────────────────────────────────────
  // 6. PlayerTokenFactory
  // ──────────────────────────────────────────────────────────────
  console.log("6. Deploying PlayerTokenFactory...");
  const PlayerTokenFactory = await ethers.getContractFactory(
    "PlayerTokenFactory",
  );
  const factory = await PlayerTokenFactory.deploy(
    deployments.oracle,
    deployments.marketContract,
    deployer.address,
  );
  await factory.waitForDeployment();
  deployments.playerTokenFactory = await factory.getAddress();
  fs.writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));
  const factoryTx = factory.deploymentTransaction()!;
  await factoryTx.wait();
  await appendTxHash(txHashesPath, "DEPLOY:PlayerTokenFactory", factoryTx.hash);
  console.log(
    "✅ PlayerTokenFactory deployed to:",
    deployments.playerTokenFactory,
  );

  // ──────────────────────────────────────────────────────────────
  // 7. Configure cross-references
  // ──────────────────────────────────────────────────────────────
  console.log("\n=== CONFIGURATION ===\n");
  console.log("7. Configuring contract relationships...");

  const tx1 = await prizePool.setMarket(deployments.marketContract);
  await tx1.wait();
  await appendTxHash(txHashesPath, "CONFIG:PrizePool.setMarket", tx1.hash);

  const tx2 = await prizePool.setOracle(deployments.oracle);
  await tx2.wait();
  await appendTxHash(txHashesPath, "CONFIG:PrizePool.setOracle", tx2.hash);

  const tx3 = await stakingContract.setOracle(deployments.oracle);
  await tx3.wait();
  await appendTxHash(
    txHashesPath,
    "CONFIG:StakingContract.setOracle",
    tx3.hash,
  );

  const tx4 = await oracle.setStaking(deployments.stakingContract);
  await tx4.wait();
  await appendTxHash(txHashesPath, "CONFIG:Oracle.setStaking", tx4.hash);

  const tx5 = await oracle.setNFT(deployments.championNFT);
  await tx5.wait();
  await appendTxHash(txHashesPath, "CONFIG:Oracle.setNFT", tx5.hash);

  const tx6 = await marketContract.setFactory(deployments.playerTokenFactory);
  await tx6.wait();
  await appendTxHash(txHashesPath, "CONFIG:Market.setFactory", tx6.hash);
  console.log("✅ All cross-references configured");

  // ──────────────────────────────────────────────────────────────
  // 8. Deploy all 40 player tokens via factory
  // ──────────────────────────────────────────────────────────────
  console.log("\n=== PLAYER TOKEN DEPLOYMENT ===\n");
  console.log("8. Deploying all 40 player tokens...");

  const BATCH_SIZE = 5;
  for (let i = 0; i < playersData.length; i += BATCH_SIZE) {
    const end = Math.min(i + BATCH_SIZE - 1, playersData.length - 1);
    console.log(`   Deploying batch ${i} to ${end}...`);
    const tx = await factory.deployBatch(playersData, i, end);
    await tx.wait();
    await appendTxHash(
      txHashesPath,
      `FACTORY:deployBatch_${i}_${end}`,
      tx.hash,
    );
  }
  console.log("✅ All player tokens deployed in batches");

  // ──────────────────────────────────────────────────────────────
  // 9. Collect all token addresses and save
  // ──────────────────────────────────────────────────────────────
  console.log("9. Collecting token addresses...");
  for (const player of playersData) {
    const tokenAddr = await factory.getPlayerToken(player.id);
    deployments.playerTokens[player.id.toString()] = tokenAddr;
    console.log(
      `  [${player.id}] ${player.symbol} (${player.name}) → ${tokenAddr}`,
    );

    // Also register player token in StakingContract
    const regTx = await stakingContract.registerPlayerToken(
      player.id,
      tokenAddr,
    );
    await regTx.wait();
  }

  // Final save of complete deployments
  fs.writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));
  console.log("\n✅ deployments.json saved with all addresses");
  await appendTxHash(
    txHashesPath,
    "INFO:DeploymentComplete",
    "all-addresses-in-deployments.json",
  );

  // ──────────────────────────────────────────────────────────────
  // Summary table
  // ──────────────────────────────────────────────────────────────
  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║       PSL CHAIN — DEPLOYMENT SUMMARY        ║");
  console.log("╠══════════════════════════════════════════════╣");
  console.table({
    PrizePool: deployments.prizePool,
    StakingContract: deployments.stakingContract,
    PSLOracle: deployments.oracle,
    ChampionNFT: deployments.championNFT,
    MarketContract: deployments.marketContract,
    PlayerTokenFactory: deployments.playerTokenFactory,
  });
  console.log("╚══════════════════════════════════════════════╝");
  console.log(
    `\n🎉 Deployment complete! ${playersData.length} player tokens deployed.`,
  );
  console.log("📄 Addresses saved to deployments.json");
  console.log("📝 TX hashes saved to txhashes.txt");
  console.log("\nNext step: npm run seed");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1);
  });
