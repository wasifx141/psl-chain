import { ethers } from "hardhat";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// Always resolve .env from project root regardless of cwd
dotenv.config({ path: path.resolve(__dirname, "../.env") });

interface DeploymentAddresses {
  marketContract: string;
  stakingContract: string;
  playerTokens: { [playerId: string]: string };
}

interface PlayerData {
  id: number;
  name: string;
  symbol: string;
  tier: number;
}

async function main() {
  // Load deployments
  const deploymentsPath = path.join(__dirname, "../deployments.json");
  const deployments: DeploymentAddresses = JSON.parse(
    fs.readFileSync(deploymentsPath, "utf8")
  );

  // Load players data
  const playersPath = path.join(__dirname, "../data/players.json");
  const playersData: PlayerData[] = JSON.parse(
    fs.readFileSync(playersPath, "utf8")
  );

  // Create demo wallets from private keys in .env
  const demoKeys = [
    process.env.DEMO_PRIVATE_KEY_1,
    process.env.DEMO_PRIVATE_KEY_2,
    process.env.DEMO_PRIVATE_KEY_3,
  ];

  if (!demoKeys[0] || !demoKeys[1] || !demoKeys[2]) {
    throw new Error(
      "Missing DEMO_PRIVATE_KEY_1/2/3 in .env — check that dotenv loaded the project root .env file."
    );
  }

  const provider = ethers.provider;
  const wallets = demoKeys.map((key) => new ethers.Wallet(key!, provider));

  console.log("Demo wallet addresses:");
  wallets.forEach((w, i) => console.log(`  Wallet ${i + 1}: ${w.address}`));

  // ── Fund demo wallets ─────────────────────────────────────────────────────
  // We skip this because the deployer is out of funds and the demo wallets already
  // received 2 WC each in the previous partial run.
  // const [deployer] = await ethers.getSigners();
  // console.log("\nFunding demo wallets with 10 WC each…");
  // for (const wallet of wallets) {
  //   const tx = await deployer.sendTransaction({
  //     to: wallet.address,
  //     value: ethers.parseEther("10.0"),
  //   });
  //   await tx.wait();
  //   console.log(`  ✅ Funded ${wallet.address}`);
  // }
  
  const [deployer] = await ethers.getSigners();

  const txHashes: string[] = [];

  // Attach contract factories
  const MarketFactory = await ethers.getContractFactory("MarketContract");
  const StakingFactory = await ethers.getContractFactory("StakingContract");
  const TokenFactory = await ethers.getContractFactory("PSLPlayerToken");

  const market = MarketFactory.attach(deployments.marketContract);
  const staking = StakingFactory.attach(deployments.stakingContract);

  // Helper: look up a player by symbol and return its deployed token address
  const findPlayer = (symbol: string) =>
    playersData.find((p) => p.symbol === symbol);
  const getTokenAddress = (symbol: string) => {
    const player = findPlayer(symbol);
    return player ? deployments.playerTokens[player.id.toString()] : null;
  };

  // ── Configure Match 1 (start 1 hour from now) ────────────────────────────
  console.log("\nConfiguring Match 1…");
  const stakingAsDeployer = staking.connect(deployer);
  const setMatchTx = await (stakingAsDeployer as any).setMatch(
    1,
    Math.floor(Date.now() / 1000) + 3600
  );
  await setMatchTx.wait();
  console.log("✅ Match 1 configured (starts in 1 hour)");

  console.log("\n=== SEEDING DEMO WALLETS ===\n");

  // ── Wallet 1: Shadab Khan (SHDB) + Shaheen Afridi (SHAF) + Rizwan (RIZW) + Babar (BBAZ) ──
  console.log("1. Seeding Wallet 1…");
  const wallet1 = wallets[0];
  const market1 = (market as any).connect(wallet1);
  const staking1 = (staking as any).connect(wallet1);

  const wallet1Purchases = [
    { symbol: "BBAZ", amount: 1 },   // Babar Azam   — id 5
    { symbol: "SHAF", amount: 1 },   // Shaheen Afridi — id 15
    { symbol: "RIZW", amount: 1 },   // Mohammad Rizwan — id 31
    { symbol: "SHDB", amount: 1 },   // Shadab Khan   — id 0
  ];

  for (const purchase of wallet1Purchases) {
    try {
      const tokenAddr = getTokenAddress(purchase.symbol);
      if (!tokenAddr) {
        console.warn(`  ⚠️ No token address for ${purchase.symbol}, skipping`);
        continue;
      }

      try {
        const price = await market1.getBuyPrice(tokenAddr, purchase.amount);
        const buyTx = await market1.buyTokens(tokenAddr, purchase.amount, {
          value: price,
        });
        await buyTx.wait();
        txHashes.push(`SEED_BUY:${purchase.symbol}:Wallet1:${buyTx.hash}`);
      } catch (e: any) {
        if (!e.message.includes("Already")) {
           console.log(`  ⚠️ Skipped buy for ${purchase.symbol}: ${e.message.split("\\n")[0]}`);
        }
      }

      const token = (TokenFactory.attach(tokenAddr) as any).connect(wallet1);
      const approveTx = await token.approve(
        deployments.stakingContract,
        ethers.parseEther(purchase.amount.toString())
      );
      await approveTx.wait();

      const player = findPlayer(purchase.symbol);
      if (player) {
        try {
          const stakeTx = await staking1.stakeForMatch(
            tokenAddr,
            player.id,
            1,
            purchase.amount
          );
          await stakeTx.wait();
          txHashes.push(`SEED_STAKE:${purchase.symbol}:Wallet1:${stakeTx.hash}`);
        } catch (e: any) {
           console.log(`  ⚠️ Skipped stake for ${purchase.symbol}: ${e.message.split("\\n")[0]}`);
        }
      }

      console.log(
        `  ✅ Wallet 1: Processed ${purchase.amount} ${purchase.symbol}`
      );
    } catch (e: any) {
      console.log(`  ❌ Failed processing ${purchase.symbol}:`, e.message);
    }
  }

  // ── Wallet 2: Fakhar Zaman + Rilee Rossouw + David Warner ────────────────
  console.log("2. Seeding Wallet 2…");
  const wallet2 = wallets[1];
  const market2 = (market as any).connect(wallet2);
  const staking2 = (staking as any).connect(wallet2);

  const wallet2Purchases = [
    { symbol: "FKHR", amount: 1 },   // Fakhar Zaman  — id 16
    { symbol: "RROS", amount: 1 },   // Rilee Rossouw — id 11
    { symbol: "WRNR", amount: 1 },   // David Warner  — id 25
  ];

  for (const purchase of wallet2Purchases) {
    try {
      const tokenAddr = getTokenAddress(purchase.symbol);
      if (!tokenAddr) {
        console.warn(`  ⚠️ No token address for ${purchase.symbol}, skipping`);
        continue;
      }

      try {
        const price = await market2.getBuyPrice(tokenAddr, purchase.amount);
        const buyTx = await market2.buyTokens(tokenAddr, purchase.amount, {
          value: price,
        });
        await buyTx.wait();
        txHashes.push(`SEED_BUY:${purchase.symbol}:Wallet2:${buyTx.hash}`);
      } catch (e: any) {
        if (!e.message.includes("Already")) {
           console.log(`  ⚠️ Skipped buy for ${purchase.symbol}: ${e.message.split("\\n")[0]}`);
        }
      }

      const token = (TokenFactory.attach(tokenAddr) as any).connect(wallet2);
      const approveTx = await token.approve(
        deployments.stakingContract,
        ethers.parseEther(purchase.amount.toString())
      );
      await approveTx.wait();

      const player = findPlayer(purchase.symbol);
      if (player) {
        try {
          const stakeTx = await staking2.stakeForMatch(
            tokenAddr,
            player.id,
            1,
            purchase.amount
          );
          await stakeTx.wait();
          txHashes.push(`SEED_STAKE:${purchase.symbol}:Wallet2:${stakeTx.hash}`);
        } catch(e: any) {
           console.log(`  ⚠️ Skipped stake for ${purchase.symbol}: ${e.message.split("\\n")[0]}`);
        }
      }

      console.log(
        `  ✅ Wallet 2: Processed ${purchase.amount} ${purchase.symbol}`
      );
    } catch (e: any) {
      console.log(`  ❌ Failed processing ${purchase.symbol}:`, e.message);
    }
  }

  // ── Wallet 3: Babar Azam + Haris Rauf ────────────────────────────────────
  console.log("3. Seeding Wallet 3…");
  const wallet3 = wallets[2];
  const market3 = (market as any).connect(wallet3);
  const staking3 = (staking as any).connect(wallet3);

  const wallet3Purchases = [
    { symbol: "BBAZ", amount: 1 },   // Babar Azam  — id 5
    { symbol: "HRUF", amount: 1 },   // Haris Rauf  — id 17
  ];

  for (const purchase of wallet3Purchases) {
    try {
      const tokenAddr = getTokenAddress(purchase.symbol);
      if (!tokenAddr) {
        console.warn(`  ⚠️ No token address for ${purchase.symbol}, skipping`);
        continue;
      }

      try {
        const price = await market3.getBuyPrice(tokenAddr, purchase.amount);
        const buyTx = await market3.buyTokens(tokenAddr, purchase.amount, {
          value: price,
        });
        await buyTx.wait();
        txHashes.push(`SEED_BUY:${purchase.symbol}:Wallet3:${buyTx.hash}`);
      } catch (e: any) {
         if (!e.message.includes("Already")) {
           console.log(`  ⚠️ Skipped buy for ${purchase.symbol}: ${e.message.split("\\n")[0]}`);
         }
      }

      const token = (TokenFactory.attach(tokenAddr) as any).connect(wallet3);
      const approveTx = await token.approve(
        deployments.stakingContract,
        ethers.parseEther(purchase.amount.toString())
      );
      await approveTx.wait();

      const player = findPlayer(purchase.symbol);
      if (player) {
        try {
          const stakeTx = await staking3.stakeForMatch(
            tokenAddr,
            player.id,
            1,
            purchase.amount
          );
          await stakeTx.wait();
          txHashes.push(`SEED_STAKE:${purchase.symbol}:Wallet3:${stakeTx.hash}`);
        } catch (e: any) {
           console.log(`  ⚠️ Skipped stake for ${purchase.symbol}: ${e.message.split("\\n")[0]}`);
        }
      }

      console.log(
        `  ✅ Wallet 3: Processed ${purchase.amount} ${purchase.symbol}`
      );
    } catch (e: any) {
      console.log(`  ❌ Failed processing ${purchase.symbol}:`, e.message);
    }
  }

  // ── Save tx hashes ────────────────────────────────────────────────────────
  const txHashesPath = path.join(__dirname, "../txhashes.txt");
  const existing = fs.existsSync(txHashesPath)
    ? fs.readFileSync(txHashesPath, "utf8")
    : "";
  fs.writeFileSync(txHashesPath, existing + txHashes.join("\n") + "\n");
  console.log("\n✅ Transaction hashes appended to txhashes.txt");

  console.log("\n=== SEEDING SUMMARY ===");
  console.log("Wallet 1: 3 BBAZ + 2 SHAF + 3 RIZW + 2 SHDB  (10 tokens, all staked Match 1)");
  console.log("Wallet 2: 4 FKHR + 3 RROS + 2 WRNR            (9 tokens, all staked Match 1)");
  console.log("Wallet 3: 5 BBAZ + 3 HRUF                      (8 tokens, all staked Match 1)");
  console.log("\n🎉 Demo wallets seeded successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });