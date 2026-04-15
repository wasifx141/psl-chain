import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

interface DeploymentAddresses {
  oracle: string;
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
  const deployments: DeploymentAddresses = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));

  // Load players data
  const playersPath = path.join(__dirname, "../data/players.json");
  const playersData: PlayerData[] = JSON.parse(fs.readFileSync(playersPath, "utf8"));

  const [deployer] = await ethers.getSigners();
  console.log("Processing mock match with account:", deployer.address);

  const txHashes: string[] = [];

  // Get oracle contract
  const PSLOracle = await ethers.getContractFactory("PSLOracle");
  const oracle = PSLOracle.attach(deployments.oracle);

  // Helper function to find player by symbol
  const findPlayer = (symbol: string) => playersData.find(p => p.symbol === symbol);
  const getTokenAddress = (symbol: string) => {
    const player = findPlayer(symbol);
    return player ? deployments.playerTokens[player.id.toString()] : null;
  };

  console.log("\n=== MOCK MATCH DATA ===\n");

  // Prepare match results for matchId=1
  const matchResults = [];

  // Babar: 82 runs, 48 balls, 0 wkts, 0 overs, 3 catches, notOut=false, matchWon=true, topScorer=true
  const babarPlayer = findPlayer("BBAR");
  if (babarPlayer) {
    matchResults.push({
      matchId: 1,
      playerId: babarPlayer.id,
      playerTokenAddr: getTokenAddress("BBAR"),
      runs: 82,
      balls: 48,
      wickets: 0,
      dotsBowled: 0,
      runsConc: 0,
      oversBowled: 0,
      catches: 3,
      stumpings: 0,
      runOuts: 0,
      droppedCatches: 0,
      notOut: false,
      matchWon: true,
      topScorer: true,
      deathOver: false
    });
    console.log("Babar Azam: 82 runs, 48 balls, 3 catches, top scorer → Expected FPS ~165, mult=3.0x");
  }

  // Shaheen: 0 runs, 3 wickets, 4.0 overs (40), 28 runs conceded, 8 dots, deathOver=true
  const shaheenPlayer = findPlayer("SHAH");
  if (shaheenPlayer) {
    matchResults.push({
      matchId: 1,
      playerId: shaheenPlayer.id,
      playerTokenAddr: getTokenAddress("SHAH"),
      runs: 0,
      balls: 0,
      wickets: 3,
      dotsBowled: 8,
      runsConc: 28,
      oversBowled: 40, // 4.0 overs * 10
      catches: 0,
      stumpings: 0,
      runOuts: 0,
      droppedCatches: 0,
      notOut: false,
      matchWon: true,
      topScorer: false,
      deathOver: true
    });
    console.log("Shaheen Afridi: 3 wickets, 4.0 overs, 28 runs, 8 dots, death over → Expected FPS ~110, mult=2.5x");
  }

  // Rizwan: 34 runs, 22 balls, 1 stumping, matchWon=true
  const rizwanPlayer = findPlayer("RIZW");
  if (rizwanPlayer) {
    matchResults.push({
      matchId: 1,
      playerId: rizwanPlayer.id,
      playerTokenAddr: getTokenAddress("RIZW"),
      runs: 34,
      balls: 22,
      wickets: 0,
      dotsBowled: 0,
      runsConc: 0,
      oversBowled: 0,
      catches: 0,
      stumpings: 1,
      runOuts: 0,
      droppedCatches: 0,
      notOut: false,
      matchWon: true,
      topScorer: false,
      deathOver: false
    });
    console.log("Mohammad Rizwan: 34 runs, 22 balls, 1 stumping → Expected FPS ~70, mult=2.0x");
  }

  // Add other players with minimal performance
  const otherSymbols = ["SHDB", "FKHR", "RSHD", "WRNR", "HRUF"];
  for (const symbol of otherSymbols) {
    const player = findPlayer(symbol);
    if (player) {
      matchResults.push({
        matchId: 1,
        playerId: player.id,
        playerTokenAddr: getTokenAddress(symbol),
        runs: 5,
        balls: 8,
        wickets: 0,
        dotsBowled: 0,
        runsConc: 0,
        oversBowled: 0,
        catches: 0,
        stumpings: 0,
        runOuts: 0,
        droppedCatches: 0,
        notOut: false,
        matchWon: true,
        topScorer: false,
        deathOver: false
      });
      console.log(`${symbol}: 5 runs, 8 balls → Expected FPS ~25, mult=1.0x`);
    }
  }

  console.log("\n=== PROCESSING MATCH RESULTS ===\n");

  // Preview FPS calculations
  console.log("FPS Preview:");
  for (const result of matchResults) {
    try {
      const [fps, multiplier, tier] = await oracle.previewFPS(result);
      console.log(`  ${playersData.find(p => p.id === result.playerId)?.symbol}: FPS=${fps}, Mult=${Number(multiplier)/100}x, Tier=${tier}`);
    } catch (error) {
      console.log(`  Error previewing FPS for player ${result.playerId}:`, error);
    }
  }

  // Push match results
  console.log("\nPushing match results to oracle...");
  const pushTx = await oracle.pushMatchResults(matchResults);
  await pushTx.wait();
  txHashes.push(`MOCK_MATCH:matchId=1:${pushTx.hash}`);
  console.log("✅ Match results processed");

  // Save transaction hashes
  const txHashesPath = path.join(__dirname, "../txhashes.txt");
  const existingHashes = fs.existsSync(txHashesPath) ? fs.readFileSync(txHashesPath, "utf8") : "";
  fs.writeFileSync(txHashesPath, existingHashes + txHashes.join("\n") + "\n");
  console.log("✅ Transaction hashes appended to txhashes.txt");

  console.log("\n=== REWARD DISTRIBUTION CALCULATION ===\n");
  
  // Get prize pool contract to check pending rewards
  const PrizePool = await ethers.getContractFactory("PrizePool");
  const prizePoolAddr = JSON.parse(fs.readFileSync(deploymentsPath, "utf8")).prizePool;
  const prizePool = PrizePool.attach(prizePoolAddr);

  // Demo wallet addresses (from .env)
  const demoKeys = [
    process.env.DEMO_PRIVATE_KEY_1,
    process.env.DEMO_PRIVATE_KEY_2,
    process.env.DEMO_PRIVATE_KEY_3
  ];

  if (demoKeys[0] && demoKeys[1] && demoKeys[2]) {
    const wallets = demoKeys.map(key => new ethers.Wallet(key!, ethers.provider));
    
    console.log("Pending rewards for demo wallets:");
    for (let i = 0; i < wallets.length; i++) {
      try {
        const pendingReward = await prizePool.pendingRewards(wallets[i].address);
        console.log(`  Wallet ${i + 1} (${wallets[i].address}): ${ethers.formatEther(pendingReward)} WC`);
      } catch (error) {
        console.log(`  Wallet ${i + 1}: Error reading rewards`);
      }
    }
  }

  console.log("\n🎉 Mock match processed successfully!");
  console.log("Demo wallets can now claim their rewards using prizePool.claimRewards()");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });