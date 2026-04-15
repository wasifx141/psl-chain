import { ethers } from 'ethers'
import { createClient } from '@supabase/supabase-js'
import { contracts, playerTokens } from '../config/contracts'

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

// Ethereum provider
const provider = new ethers.JsonRpcProvider(process.env.WIREFLUID_RPC_URL)

// Contract instances
const marketContract = new ethers.Contract(
  contracts.marketContract.address,
  contracts.marketContract.abi,
  provider
)

const prizePool = new ethers.Contract(
  contracts.prizePool.address,
  contracts.prizePool.abi,
  provider
)

const oracle = new ethers.Contract(
  contracts.oracle.address,
  contracts.oracle.abi,
  provider
)

const stakingContract = new ethers.Contract(
  contracts.stakingContract.address,
  contracts.stakingContract.abi,
  provider
)

interface TokenBoughtEvent {
  buyer: string
  playerToken: string
  amount: bigint
  cost: bigint
  newSupply: bigint
}

interface TokenSoldEvent {
  seller: string
  playerToken: string
  amount: bigint
  refund: bigint
  newSupply: bigint
}

interface MatchProcessedEvent {
  matchId: number
  playerId: number
  fps: bigint
  multiplier: bigint
}

interface RewardClaimedEvent {
  wallet: string
  amount: bigint
}

interface StakedEvent {
  wallet: string
  matchId: number
  playerId: number
  amount: bigint
}

async function startListening() {
  console.log('🎧 Starting Supabase listener for contract events...')

  // Listen to TokenBought events
  marketContract.on('TokenBought', async (buyer, playerToken, amount, cost, newSupply, event) => {
    try {
      console.log(`📈 TokenBought: ${buyer} bought ${amount} tokens`)
      
      await supabase.from('transactions').insert({
        tx_hash: event.transactionHash,
        block_number: event.blockNumber,
        action: 'buy',
        wallet: buyer,
        player_token: playerToken,
        amount: Number(amount),
        cost_wc: ethers.formatEther(cost),
        timestamp: new Date().toISOString()
      })

      // Update leaderboard cache
      await updatePortfolioCache(buyer)
      await updateLeaderboardCache()

    } catch (error) {
      console.error('Error processing TokenBought event:', error)
    }
  })

  // Listen to TokenSold events
  marketContract.on('TokenSold', async (seller, playerToken, amount, refund, newSupply, event) => {
    try {
      console.log(`📉 TokenSold: ${seller} sold ${amount} tokens`)
      
      await supabase.from('transactions').insert({
        tx_hash: event.transactionHash,
        block_number: event.blockNumber,
        action: 'sell',
        wallet: seller,
        player_token: playerToken,
        amount: Number(amount),
        cost_wc: ethers.formatEther(refund),
        timestamp: new Date().toISOString()
      })

      // Update leaderboard cache
      await updatePortfolioCache(seller)
      await updateLeaderboardCache()

    } catch (error) {
      console.error('Error processing TokenSold event:', error)
    }
  })

  // Listen to Staked events
  stakingContract.on('Staked', async (wallet, matchId, playerId, amount, event) => {
    try {
      console.log(`🎯 Staked: ${wallet} staked ${amount} tokens for player ${playerId}`)
      
      await supabase.from('transactions').insert({
        tx_hash: event.transactionHash,
        block_number: event.blockNumber,
        action: 'stake',
        wallet: wallet,
        player_id: Number(playerId),
        match_id: Number(matchId),
        amount: Number(amount),
        timestamp: new Date().toISOString()
      })

    } catch (error) {
      console.error('Error processing Staked event:', error)
    }
  })

  // Listen to MatchProcessed events from Oracle
  oracle.on('MatchProcessed', async (matchId, playerId, fps, multiplier, event) => {
    try {
      console.log(`⚽ MatchProcessed: Player ${playerId} scored ${fps} FPS`)
      
      await supabase.from('match_results').upsert({
        match_id: Number(matchId),
        player_id: Number(playerId),
        fps: Number(fps),
        multiplier: Number(multiplier),
        processed_at: new Date().toISOString()
      })

      // Update player token multiplier cache
      await updatePlayerMultiplierCache(Number(playerId), Number(multiplier))

    } catch (error) {
      console.error('Error processing MatchProcessed event:', error)
    }
  })

  // Listen to RewardClaimed events
  prizePool.on('RewardClaimed', async (wallet, amount, event) => {
    try {
      console.log(`💰 RewardClaimed: ${wallet} claimed ${ethers.formatEther(amount)} WC`)
      
      await supabase.from('transactions').insert({
        tx_hash: event.transactionHash,
        block_number: event.blockNumber,
        action: 'claim_rewards',
        wallet: wallet,
        amount_wc: ethers.formatEther(amount),
        timestamp: new Date().toISOString()
      })

    } catch (error) {
      console.error('Error processing RewardClaimed event:', error)
    }
  })

  // Listen to MultiplierUpdated events from player tokens
  for (const [playerId, tokenAddr] of Object.entries(playerTokens)) {
    const playerToken = new ethers.Contract(
      tokenAddr,
      [
        'event MultiplierUpdated(uint256 oldMultiplier, uint256 newMultiplier, uint256 fps)',
        'event StreakUpdated(address wallet, uint256 streak)'
      ],
      provider
    )

    playerToken.on('MultiplierUpdated', async (oldMultiplier, newMultiplier, fps, event) => {
      try {
        console.log(`🔄 MultiplierUpdated: Player ${playerId} multiplier ${Number(newMultiplier)/100}x`)
        
        await updatePlayerMultiplierCache(Number(playerId), Number(newMultiplier))

      } catch (error) {
        console.error('Error processing MultiplierUpdated event:', error)
      }
    })

    playerToken.on('StreakUpdated', async (wallet, streak, event) => {
      try {
        console.log(`🔥 StreakUpdated: ${wallet} has ${streak} day streak`)
        
        await supabase.from('holder_streaks').upsert({
          wallet: wallet,
          player_id: Number(playerId),
          streak: Number(streak),
          updated_at: new Date().toISOString()
        })

      } catch (error) {
        console.error('Error processing StreakUpdated event:', error)
      }
    })
  }

  console.log('✅ All event listeners started successfully')
}

async function updatePortfolioCache(wallet: string) {
  try {
    let totalValue = 0
    const holdings = []

    // Get holdings for all player tokens
    for (const [playerId, tokenAddr] of Object.entries(playerTokens)) {
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
    }

    // Update portfolio cache
    await supabase.from('portfolio_cache').upsert({
      wallet: wallet,
      total_value_wc: totalValue,
      holdings: holdings,
      updated_at: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error updating portfolio cache:', error)
  }
}

async function updateLeaderboardCache() {
  try {
    const { data: portfolios } = await supabase
      .from('portfolio_cache')
      .select('wallet, total_value_wc')
      .order('total_value_wc', { ascending: false })
      .limit(1000)

    if (portfolios) {
      const leaderboardData = portfolios.map((portfolio, index) => ({
        rank: index + 1,
        wallet: portfolio.wallet,
        portfolio_value: portfolio.total_value_wc,
        updated_at: new Date().toISOString()
      }))

      // Clear and repopulate leaderboard cache
      await supabase.from('leaderboard_cache').delete().neq('rank', 0)
      await supabase.from('leaderboard_cache').insert(leaderboardData)
    }

  } catch (error) {
    console.error('Error updating leaderboard cache:', error)
  }
}

async function updatePlayerMultiplierCache(playerId: number, multiplier: number) {
  try {
    await supabase.from('player_multipliers').upsert({
      player_id: playerId,
      multiplier: multiplier,
      updated_at: new Date().toISOString()
    })
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
startListening().catch(console.error)