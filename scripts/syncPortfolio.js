#!/usr/bin/env node

// Manual portfolio sync script - run this to update portfolio cache for a specific wallet

import dotenv from 'dotenv';
import { ethers } from 'ethers';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load deployments
const deployments = JSON.parse(readFileSync(join(__dirname, '../deployments.json'), 'utf8'));

// Load Market ABI
const MarketContractABI = JSON.parse(readFileSync(join(__dirname, '../artifacts/contracts/market/MarketContract.sol/MarketContract.json'), 'utf8')).abi;

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Ethereum provider
const provider = new ethers.JsonRpcProvider(process.env.WIREFLUID_RPC_URL);

// Contract instance
const marketContract = new ethers.Contract(
  deployments.marketContract,
  MarketContractABI,
  provider
);

async function updatePortfolioCache(wallet) {
  try {
    console.log(`\n🔄 Updating portfolio for wallet: ${wallet}`);
    let totalValue = 0;
    const holdings = [];

    // Get holdings for all player tokens
    for (const [playerId, tokenAddr] of Object.entries(deployments.playerTokens)) {
      try {
        const holding = await marketContract.getHoldings(wallet, tokenAddr);
        if (Number(holding) > 0) {
          // Get current token price (price for 1 token)
          const price = await marketContract.getSellPrice(tokenAddr, 1);
          const value = Number(holding) * Number(ethers.formatEther(price));
          
          holdings.push({
            player_id: Number(playerId),
            amount: Number(holding),
            value_wc: value
          });
          
          totalValue += value;
          console.log(`  ✓ Player ${playerId}: ${Number(holding)} tokens, value: ${value.toFixed(4)} WC`);
        }
      } catch (error) {
        console.warn(`  ⚠ Error getting holdings for player ${playerId}:`, error.message);
      }
    }

    if (holdings.length === 0) {
      console.log('  ℹ No holdings found for this wallet');
      return;
    }

    // Update portfolio cache
    const { error } = await supabase.from('portfolio_cache').upsert({
      wallet: wallet.toLowerCase(),
      total_value_wc: totalValue,
      holdings: holdings,
      updated_at: new Date().toISOString()
    });

    if (error) {
      console.error('❌ Error updating portfolio cache:', error);
    } else {
      console.log(`\n✅ Portfolio updated successfully!`);
      console.log(`   Total holdings: ${holdings.length} players`);
      console.log(`   Total value: ${totalValue.toFixed(4)} WC`);
    }

  } catch (error) {
    console.error('❌ Error updating portfolio cache:', error);
  }
}

async function updateLeaderboardCache() {
  try {
    console.log('\n🏆 Updating leaderboard cache...');
    const { data: portfolios, error } = await supabase
      .from('portfolio_cache')
      .select('wallet, total_value_wc')
      .order('total_value_wc', { ascending: false })
      .limit(1000);

    if (error) {
      console.error('❌ Error fetching portfolios:', error);
      return;
    }

    if (portfolios && portfolios.length > 0) {
      const leaderboardData = portfolios.map((portfolio, index) => ({
        rank: index + 1,
        wallet: portfolio.wallet,
        portfolio_value: portfolio.total_value_wc,
        updated_at: new Date().toISOString()
      }));

      // Clear and repopulate leaderboard cache
      await supabase.from('leaderboard_cache').delete().neq('rank', 0);
      const { error: insertError } = await supabase.from('leaderboard_cache').insert(leaderboardData);
      
      if (insertError) {
        console.error('❌ Error updating leaderboard cache:', insertError);
      } else {
        console.log(`✅ Leaderboard updated with ${leaderboardData.length} entries`);
      }
    }

  } catch (error) {
    console.error('❌ Error updating leaderboard cache:', error);
  }
}

// Main execution
const walletAddress = process.argv[2];

if (!walletAddress) {
  console.error('❌ Usage: node scripts/syncPortfolio.js <wallet_address>');
  process.exit(1);
}

console.log('🚀 PSL Chain - Portfolio Sync Tool');
console.log('===================================');

updatePortfolioCache(walletAddress)
  .then(() => updateLeaderboardCache())
  .then(() => {
    console.log('\n✨ Sync complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Sync failed:', error);
    process.exit(1);
  });
