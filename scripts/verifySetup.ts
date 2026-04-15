import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

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

async function main() {
  console.log("🔍 VERIFYING DEPLOYMENT SETUP\n");

  // Load deployments
  const deploymentsPath = path.join(__dirname, "../deployments.json");
  if (!fs.existsSync(deploymentsPath)) {
    console.log("❌ deployments.json not found. Run deploy.ts first.");
    return;
  }

  const deployments: DeploymentAddresses = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));

  // Load players data
  const playersPath = path.join(__dirname, "../data/players.json");
  const playersData: PlayerData[] = JSON.parse(fs.readFileSync(playersPath, "utf8"));

  const [deployer] = await ethers.getSigners();
  
  let allChecks = true;

  // Check 1: All 40 tokens deployed
  console.log("1. Checking player token deployment...");
  const expectedTokenCount = playersData.length;
  const actualTokenCount = Object.keys(deployments.playerTokens).length;
  
  if (actualTokenCount === expectedTokenCount) {
    console.log(`   ✅ All ${expectedTokenCount} player tokens deployed`);
  } else {
    console.log(`   ❌ Expected ${expectedTokenCount} tokens, found ${actualTokenCount}`);
    allChecks = false;
  }

  // Check 2: Market has correct prizePool address
  console.log("2. Checking MarketContract configuration...");
  try {
    const MarketContract = await ethers.getContractFactory("MarketContract");
    const market = MarketContract.attach(deployments.marketContract);
    const marketPrizePool = await market.prizePool();
    
    if (marketPrizePool.toLowerCase() === deployments.prizePool.toLowerCase()) {
      console.log("   ✅ MarketContract has correct PrizePool address");
    } else {
      console.log("   ❌ MarketContract PrizePool address mismatch");
      console.log(`      Expected: ${deployments.prizePool}`);
      console.log(`      Actual: ${marketPrizePool}`);
      allChecks = false;
    }
  } catch (error) {
    console.log("   ❌ Error checking MarketContract:", error);
    allChecks = false;
  }

  // Check 3: Oracle can call updateMultiplier
  console.log("3. Checking Oracle permissions...");
  try {
    const PSLOracle = await ethers.getContractFactory("PSLOracle");
    const oracle = PSLOracle.attach(deployments.oracle);
    
    // Test with first player token
    const firstPlayerId = Object.keys(deployments.playerTokens)[0];
    const firstTokenAddr = deployments.playerTokens[firstPlayerId];
    
    const PSLPlayerToken = await ethers.getContractFactory("PSLPlayerToken");
    const token = PSLPlayerToken.attach(firstTokenAddr);
    
    const tokenOracleAddr = await token.oracleAddress();
    
    if (tokenOracleAddr.toLowerCase() === deployments.oracle.toLowerCase()) {
      console.log("   ✅ Oracle has permission to update multipliers");
    } else {
      console.log("   ❌ Oracle address mismatch in player tokens");
      console.log(`      Expected: ${deployments.oracle}`);
      console.log(`      Actual: ${tokenOracleAddr}`);
      allChecks = false;
    }
  } catch (error) {
    console.log("   ❌ Error checking Oracle permissions:", error);
    allChecks = false;
  }

  // Check 4: Staking can lock tokens
  console.log("4. Checking StakingContract configuration...");
  try {
    const StakingContract = await ethers.getContractFactory("StakingContract");
    const staking = StakingContract.attach(deployments.stakingContract);
    
    const stakingPrizePool = await staking.prizePool();
    const stakingOracle = await staking.oracleAddress();
    
    if (stakingPrizePool.toLowerCase() === deployments.prizePool.toLowerCase() &&
        stakingOracle.toLowerCase() === deployments.oracle.toLowerCase()) {
      console.log("   ✅ StakingContract properly configured");
    } else {
      console.log("   ❌ StakingContract configuration issues");
      if (stakingPrizePool.toLowerCase() !== deployments.prizePool.toLowerCase()) {
        console.log(`      PrizePool mismatch - Expected: ${deployments.prizePool}, Actual: ${stakingPrizePool}`);
      }
      if (stakingOracle.toLowerCase() !== deployments.oracle.toLowerCase()) {
        console.log(`      Oracle mismatch - Expected: ${deployments.oracle}, Actual: ${stakingOracle}`);
      }
      allChecks = false;
    }
  } catch (error) {
    console.log("   ❌ Error checking StakingContract:", error);
    allChecks = false;
  }

  // Check 5: PrizePool configuration
  console.log("5. Checking PrizePool configuration...");
  try {
    const PrizePool = await ethers.getContractFactory("PrizePool");
    const prizePool = PrizePool.attach(deployments.prizePool);
    
    const prizePoolMarket = await prizePool.marketAddress();
    const prizePoolOracle = await prizePool.oracleAddress();
    
    if (prizePoolMarket.toLowerCase() === deployments.marketContract.toLowerCase() &&
        prizePoolOracle.toLowerCase() === deployments.oracle.toLowerCase()) {
      console.log("   ✅ PrizePool properly configured");
    } else {
      console.log("   ❌ PrizePool configuration issues");
      if (prizePoolMarket.toLowerCase() !== deployments.marketContract.toLowerCase()) {
        console.log(`      Market mismatch - Expected: ${deployments.marketContract}, Actual: ${prizePoolMarket}`);
      }
      if (prizePoolOracle.toLowerCase() !== deployments.oracle.toLowerCase()) {
        console.log(`      Oracle mismatch - Expected: ${deployments.oracle}, Actual: ${prizePoolOracle}`);
      }
      allChecks = false;
    }
  } catch (error) {
    console.log("   ❌ Error checking PrizePool:", error);
    allChecks = false;
  }

  // Check 6: Token registration in market
  console.log("6. Checking token registration in market...");
  try {
    const MarketContract = await ethers.getContractFactory("MarketContract");
    const market = MarketContract.attach(deployments.marketContract);
    
    let registeredCount = 0;
    for (const playerId of Object.keys(deployments.playerTokens)) {
      const tokenAddr = deployments.playerTokens[playerId];
      const isRegistered = await market.isRegisteredToken(tokenAddr);
      if (isRegistered) {
        registeredCount++;
      }
    }
    
    if (registeredCount === Object.keys(deployments.playerTokens).length) {
      console.log(`   ✅ All ${registeredCount} tokens registered in market`);
    } else {
      console.log(`   ❌ Only ${registeredCount}/${Object.keys(deployments.playerTokens).length} tokens registered`);
      allChecks = false;
    }
  } catch (error) {
    console.log("   ❌ Error checking token registration:", error);
    allChecks = false;
  }

  // Check 7: Contract ownership
  console.log("7. Checking contract ownership...");
  try {
    const contracts = [
      { name: "PrizePool", address: deployments.prizePool },
      { name: "StakingContract", address: deployments.stakingContract },
      { name: "PSLOracle", address: deployments.oracle },
      { name: "ChampionNFT", address: deployments.championNFT },
      { name: "MarketContract", address: deployments.marketContract },
      { name: "PlayerTokenFactory", address: deployments.playerTokenFactory }
    ];

    let ownershipOk = true;
    for (const contract of contracts) {
      try {
        const contractInstance = await ethers.getContractAt("Ownable", contract.address);
        const owner = await contractInstance.owner();
        if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
          console.log(`   ❌ ${contract.name} owner mismatch - Expected: ${deployer.address}, Actual: ${owner}`);
          ownershipOk = false;
        }
      } catch (error) {
        console.log(`   ❌ Error checking ${contract.name} ownership`);
        ownershipOk = false;
      }
    }
    
    if (ownershipOk) {
      console.log("   ✅ All contracts have correct ownership");
    } else {
      allChecks = false;
    }
  } catch (error) {
    console.log("   ❌ Error checking contract ownership:", error);
    allChecks = false;
  }

  // Final summary
  console.log("\n" + "=".repeat(50));
  if (allChecks) {
    console.log("🎉 ALL CHECKS PASSED - Setup is ready for use!");
  } else {
    console.log("❌ SOME CHECKS FAILED - Please review and fix issues");
  }
  console.log("=".repeat(50));

  // Additional info
  console.log("\nDeployment Summary:");
  console.log(`- ${Object.keys(deployments.playerTokens).length} player tokens deployed`);
  console.log(`- All contracts owned by: ${deployer.address}`);
  console.log(`- Network: ${(await ethers.provider.getNetwork()).name}`);
  console.log(`- Chain ID: ${(await ethers.provider.getNetwork()).chainId}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });