#!/usr/bin/env node

// This is the Node.js script that runs separately to listen to contract events
// Run with: node scripts/supabaseListener.js

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

// Load ABIs
const PrizePoolABI = JSON.parse(readFileSync(join(__dirname, '../artifacts/contracts/pool/PrizePool.sol/PrizePool.json'), 'utf8')).abi;
const MarketContractABI = JSON.parse(readFileSync(join(__dirname, '../artifacts/contracts/market/MarketContract.sol/MarketContract.json'), 'utf8')).abi;
const PSLOracleABI = JSON.parse(readFileSync(join(__dirname, '../artifacts/contracts/oracle/PSLOracle.sol/PSLOracle.json'), 'utf8')).abi;
const StakingContractABI = JSON.parse(readFileSync(join(__dirname, '../artifacts/contracts/staking/StakingContract.sol/StakingContract.json'), 'utf8')).abi;
const PSLPlayerTokenABI = JSON.parse(readFileSync(join(__dirname, '../artifacts/contracts/tokens/PSLPlayerToken.sol/PSLPlayerToken.json'), 'utf8')).abi;

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// Ethereum provider
const provider = new ethers.JsonRpcProvider(process.env.WIREFLUID_RPC_URL)

// Contract instances
const marketContract = new ethers.Contract(
  deployments.marketContract,
  MarketContractABI,
  provider
)

const prizePool = new ethers.Contract(
  deployments.prizePool,
  PrizePoolABI,
  provider
)

const oracle = new ethers.Contract(
  deployments.oracle,
  PSLOracleABI,
  provider
)

const stakingContract = new ethers.Contract(
  deployments.stakingContract,
  StakingContractABI,
  provider
)

async function startListening() {
  console.log('🎧 Starting Supabase listener for contract events...')
  console.log('Network:', await provider.getNetwork())

  // Listen to TokenBought events
  marketContract.on('TokenBought', async (buyer, playerToken, amount, cost, newSupply, event) => {
    try {
      console.log(`📈 TokenBought: ${buyer} bought ${amount} tokens of ${playerToken}`)
      
      const { error } = await supabase.from('transactions').insert({
        tx_hash: event.transactionHash,
        block_number: event.blockNumber,
        action: 'buy',
        wallet: buyer,
        player_token: playerToken,
        amount: Number(amount),
        cost_wc: ethers.formatEther(cost),
        timestamp: new Date().toISOString()
      })

      if (error) {
        console.error('Supabase error:', error)
      } else {
        // Update portfolio cache
        await updatePortfolioCache(buyer)
        await updateLeaderboardCache()
      }

    } catch (error) {
      console.error('Error processing TokenBought event:', error)
    }
  })

  // Listen to TokenSold events
  marketContract.on('TokenSold', async (seller, playerToken, amount, refund, newSupply, event) => {
    try {
      console.log(`📉 TokenSold: ${seller} sold ${amount} tokens of ${playerToken}`)
      
      const { error } = await supabase.from('transactions').insert({
        tx_hash: event.transactionHash,
        block_number: event.blockNumber,
        action: 'sell',
        wallet: seller,
        player_token: playerToken,
        amount: Number(amount),
        cost_wc: ethers.formatEther(refund),
        timestamp: new Date().toISOString()
      })

      if (error) {
        console.error('Supabase error:', error)
      } else {
        await updatePortfolioCache(seller)
        await updateLeaderboardCache()
      }

    } catch (error) {
      console.error('Error processing TokenSold event:', error)
    }
  })

  // Listen to Staked events
  stakingContract.on('Staked', async (wallet, matchId, playerId, amount, event) => {
    try {
      console.log(`🎯 Staked: ${wallet} staked ${amount} tokens for player ${playerId} in match ${matchId}`)
      
      const { error } = await supabase.from('transactions').insert({
        tx_hash: event.transactionHash,
        block_number: event.blockNumber,
        action: 'stake',
        wallet: wallet,
        player_id: Number(playerId),
        match_id: Number(matchId),
        amount: Number(amount),
        timestamp: new Date().toISOString()
      })

      if (error) {
        console.error('Supabase error:', error)
      }

    } catch (error) {
      console.error('Error processing Staked event:', error)
    }
  })

  // Listen to MatchProcessed events from Oracle
  oracle.on('MatchProcessed', async (matchId, playerId, fps, multiplier, event) => {
    try {
      console.log(`⚽ MatchProcessed: Player ${playerId} in match ${matchId} scored ${fps} FPS with ${Number(multiplier)/100}x multiplier`)
      
      const { error } = await supabase.from('match_results').upsert({
        match_id: Number(matchId),
        player_id: Number(playerId),
        fps: Number(fps),
        multiplier: Number(multiplier),
        processed_at: new Date().toISOString()
      })

      if (error) {
        console.error('Supabase error:', error)
      } else {
        await updatePlayerMultiplierCache(Number(playerId), Number(multiplier))
      }

    } catch (error) {
      console.error('Error processing MatchProcessed event:', error)
    }
  })

  // Listen to RewardClaimed events
  prizePool.on('RewardClaimed', async (wallet, amount, event) => {
    try {
      console.log(`💰 RewardClaimed: ${wallet} claimed ${ethers.formatEther(amount)} WC`)
      
      const { error } = await supabase.from('transactions').insert({
        tx_hash: event.transactionHash,
        block_number: event.blockNumber,
        action: 'claim_rewards',
        wallet: wallet,
        amount_wc: ethers.formatEther(amount),
        timestamp: new Date().toISOString()
      })

      if (error) {
        console.error('Supabase error:', error)
      }

    } catch (error) {
      console.error('Error processing RewardClaimed event:', error)
    }
  })

  // Listen to MultiplierUpdated and StreakUpdated events from all player tokens
  for (const [playerId, tokenAddr] of Object.entries(deployments.playerTokens)) {
    const playerToken = new ethers.Contract(tokenAddr, PSLPlayerTokenABI, provider)

    playerToken.on('MultiplierUpdated', async (oldMultiplier, newMultiplier, fps, event) => {
      try {
        console.log(`🔄 MultiplierUpdated: Player ${playerId} multiplier changed to ${Number(newMultiplier)/100}x (FPS: ${fps})`)
        
        await updatePlayerMultiplierCache(Number(playerId), Number(newMultiplier))

      } catch (error) {
        console.error('Error processing MultiplierUpdated event:', error)
      }
    })

    playerToken.on('StreakUpdated', async (wallet, streak, event) => {
      try {
        console.log(`🔥 StreakUpdated: ${wallet} has ${streak} day streak for player ${playerId}`)
        
        const { error } = await supabase.from('holder_streaks').upsert({
          wallet: wallet,
          player_id: Number(playerId),
          streak: Number(streak),
          updated_at: new Date().toISOString()
        })

        if (error) {
          console.error('Supabase error:', error)
        }

      } catch (error) {
        console.error('Error processing StreakUpdated event:', error)
      }
    })
  }

  console.log('✅ All event listeners started successfully')
  console.log('📊 Monitoring contracts:')
  console.log(`   Market: ${deployments.marketContract}`)
  console.log(`   PrizePool: ${deployments.prizePool}`)
  console.log(`   Oracle: ${deployments.oracle}`)
  console.log(`   Staking: ${deployments.stakingContract}`)
  console.log(`   Player Tokens: ${Object.keys(deployments.playerTokens).length} tokens`)
}

async function updatePortfolioCache(wallet) {
  try {
    let totalValue = 0
    const holdings = []

    // Get holdings for all player tokens
    for (const [playerId, tokenAddr] of Object.entries(deployments.playerTokens)) {
      try {
        const holding = await marketContract.getHoldings(wallet, tokenAddr)
        if (Number(holding) > 0) {
          // Get current token price (price for 1 token)
          const price = await marketContract.getSellPrice(tokenAddr, 1)
          const value = Number(holding) * Number(ethers.formatEther(price))
          
          holdings.push({
            player_id: Number(playerId),
            amount: Number(holding),
            value_wc: value
          })
          
          totalValue += value
        }
      } catch (error) {
        // Skip this token if there's an error
        console.warn(`Error getting holdings for player ${playerId}:`, error.message)
      }
    }

    // Update portfolio cache
    const { error } = await supabase.from('portfolio_cache').upsert({
      wallet: wallet,
      total_value_wc: totalValue,
      holdings: holdings,
      updated_at: new Date().toISOString()
    })

    if (error) {
      console.error('Error updating portfolio cache:', error)
    }

  } catch (error) {
    console.error('Error updating portfolio cache:', error)
  }
}

async function updateLeaderboardCache() {
  try {
    const { data: portfolios, error } = await supabase
      .from('portfolio_cache')
      .select('wallet, total_value_wc')
      .order('total_value_wc', { ascending: false })
      .limit(1000)

    if (error) {
      console.error('Error fetching portfolios:', error)
      return
    }

    if (portfolios && portfolios.length > 0) {
      const leaderboardData = portfolios.map((portfolio, index) => ({
        rank: index + 1,
        wallet: portfolio.wallet,
        portfolio_value: portfolio.total_value_wc,
        updated_at: new Date().toISOString()
      }))

      // Clear and repopulate leaderboard cache
      await supabase.from('leaderboard_cache').delete().neq('rank', 0)
      const { error: insertError } = await supabase.from('leaderboard_cache').insert(leaderboardData)
      
      if (insertError) {
        console.error('Error updating leaderboard cache:', insertError)
      }
    }

  } catch (error) {
    console.error('Error updating leaderboard cache:', error)
  }
}

async function updatePlayerMultiplierCache(playerId, multiplier) {
  try {
    const { error } = await supabase.from('player_multipliers').upsert({
      player_id: playerId,
      multiplier: multiplier,
      updated_at: new Date().toISOString()
    })

    if (error) {
      console.error('Error updating player multiplier cache:', error)
    }
  } catch (error) {
    console.error('Error updating player multiplier cache:', error)
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down Supabase listener...')
  provider.removeAllListeners()
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down Supabase listener...')
  provider.removeAllListeners()
  process.exit(0)
})

// Start the listener
startListening().catch((error) => {
  console.error('Failed to start listener:', error)
  process.exit(1)
})