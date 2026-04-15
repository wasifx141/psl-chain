/**
 * scripts/seedPlayers.ts
 *
 * Reads data/players.json and verifies all 40 player tokens are deployed on-chain.
 * Prints a table of player → token address → supply remaining.
 * Run after: npm run deploy
 */
import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

interface DeploymentAddresses {
  marketContract: string;
  playerTokenFactory: string;
  playerTokens: { [playerId: string]: string };
}

interface PlayerData {
  id: number;
  name: string;
  symbol: string;
  tier: number;
  team: string;
}

async function main() {
  const deploymentsPath = path.join(__dirname, "../deployments.json");
  const deployments: DeploymentAddresses = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));

  const playersPath = path.join(__dirname, "../data/players.json");
  const playersData: PlayerData[] = JSON.parse(fs.readFileSync(playersPath, "utf8"));

  console.log("\n=== PSL CHAIN — PLAYER TOKEN VERIFICATION ===\n");

  const MarketContract = await ethers.getContractFactory("MarketContract");
  const market = MarketContract.attach(deployments.marketContract);

  const results: { ID: number; Symbol: string; Name: string; Tier: string; Team: string; TokenAddress: string; Remaining: string }[] = [];
  let errors = 0;

  for (const player of playersData) {
    const tokenAddr = deployments.playerTokens[player.id.toString()];
    if (!tokenAddr || tokenAddr === "") {
      console.error(`❌ Player ${player.id} (${player.symbol}) — NOT deployed!`);
      errors++;
      continue;
    }

    try {
      const remaining = await market.getTokensRemaining(tokenAddr);
      const tier = player.tier === 0 ? "Legend" : player.tier === 1 ? "Star" : "Regular";
      results.push({
        ID: player.id,
        Symbol: player.symbol,
        Name: player.name,
        Tier: tier,
        Team: player.team,
        TokenAddress: tokenAddr,
        Remaining: `${remaining}/100`
      });
    } catch (err) {
      console.error(`❌ Error reading player ${player.id} (${player.symbol}):`, err);
      errors++;
    }
  }

  if (results.length > 0) {
    console.table(results);
  }

  console.log(`\n✅ Verified: ${results.length} / ${playersData.length} player tokens`);
  if (errors > 0) {
    console.error(`❌ Errors: ${errors} player tokens missing or broken`);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
