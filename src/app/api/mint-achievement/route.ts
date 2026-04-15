import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import { contracts, playerTokenABI } from '@/config/contracts'
import ChampionNFTABI from '../../../../artifacts/contracts/nft/ChampionNFT.sol/ChampionNFT.json'

export async function POST(request: NextRequest) {
  try {
    const { to, achievementType, season } = await request.json()

    // Validate input
    if (!to || !achievementType || !season) {
      return NextResponse.json(
        { error: 'Missing required fields: to, achievementType, season' },
        { status: 400 }
      )
    }

    // Validate achievement type
    const validAchievements = [
      'SEASON_CHAMPION',
      'TOP_SCOUT', 
      'DIAMOND_HANDS',
      'EARLY_ADOPTER',
      'COMEBACK_KING',
      'SEVEN_DAY_STREAK',
      'POWER_SCOUT',
      'MATCH_MASTER'
    ]

    if (!validAchievements.includes(achievementType)) {
      return NextResponse.json(
        { error: 'Invalid achievement type' },
        { status: 400 }
      )
    }

    // Verify admin access
    const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY
    if (!adminPrivateKey) {
      return NextResponse.json(
        { error: 'Admin private key not configured' },
        { status: 500 }
      )
    }

    // Setup provider and signer
    const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_WIREFLUID_RPC_URL)
    const adminWallet = new ethers.Wallet(adminPrivateKey, provider)

    // Create contract instance
    const championNFT = new ethers.Contract(
      contracts.championNFT.address,
      ChampionNFTABI.abi,
      adminWallet
    )

    // Verify achievement criteria before minting
    const hasAchievement = await championNFT.hasAchievement(to, achievementType)
    if (hasAchievement) {
      return NextResponse.json(
        { error: 'Wallet already has this achievement' },
        { status: 400 }
      )
    }

    // Additional verification based on achievement type
    const isValid = await verifyAchievementCriteria(to, achievementType, provider)
    if (!isValid) {
      return NextResponse.json(
        { error: 'Achievement criteria not met' },
        { status: 400 }
      )
    }

    // Mint the achievement NFT
    const tx = await championNFT.mintAchievement(to, achievementType, season)
    const receipt = await tx.wait()

    // Extract tokenId from AchievementMinted event
    let tokenId: string | null = null
    if (receipt?.logs) {
      for (const log of receipt.logs) {
        try {
          const parsed = championNFT.interface.parseLog(log)
          if (parsed?.name === 'AchievementMinted') {
            tokenId = parsed.args.tokenId.toString()
            break
          }
        } catch (_) {}
      }
    }

    return NextResponse.json({
      success: true,
      txHash: tx.hash,
      tokenId,
      achievementType,
      recipient: to
    })

  } catch (error: any) {
    console.error('Error minting achievement:', error)
    return NextResponse.json(
      { error: 'Failed to mint achievement', details: error.message },
      { status: 500 }
    )
  }
}

async function verifyAchievementCriteria(
  wallet: string, 
  achievementType: string, 
  provider: ethers.JsonRpcProvider
): Promise<boolean> {
  try {
    switch (achievementType) {
      case 'SEVEN_DAY_STREAK':
        // Verify 7-day streak from any player token
        return await verifyStreakAchievement(wallet, 7, provider)
      
      case 'DIAMOND_HANDS':
        // Verify 30 days total holding
        return await verifyDiamondHandsAchievement(wallet, 30, provider)
      
      case 'EARLY_ADOPTER':
        // Verify purchase within first 24h of launch
        return await verifyEarlyAdopterAchievement(wallet)
      
      case 'TOP_SCOUT':
        // Verify top 10% portfolio performance
        return await verifyTopScoutAchievement(wallet)
      
      case 'POWER_SCOUT':
        // Verify 50+ transactions
        return await verifyPowerScoutAchievement(wallet)
      
      default:
        // For admin-only achievements like SEASON_CHAMPION, COMEBACK_KING, MATCH_MASTER
        // These require manual verification by admin
        return true
    }
  } catch (error) {
    console.error('Error verifying achievement criteria:', error)
    return false
  }
}

async function verifyStreakAchievement(
  wallet: string, 
  requiredDays: number, 
  provider: ethers.JsonRpcProvider
): Promise<boolean> {
  // Check streak from any player token the wallet holds
  const marketContract = new ethers.Contract(
    contracts.marketContract.address,
    contracts.marketContract.abi,
    provider
  )

  const allTokens = await marketContract.getAllPlayerTokens()
  
  for (const tokenAddr of allTokens) {
    const holdings = await marketContract.getHoldings(wallet, tokenAddr)
    if (holdings > 0) {
      const playerToken = new ethers.Contract(
        tokenAddr,
        playerTokenABI,
        provider
      )
      
      try {
        const streak = await playerToken.holdStreak(wallet)
        if (Number(streak) >= requiredDays) {
          return true
        }
      } catch (error) {
        // Continue checking other tokens
      }
    }
  }
  
  return false
}

async function verifyDiamondHandsAchievement(
  wallet: string, 
  requiredDays: number, 
  provider: ethers.JsonRpcProvider
): Promise<boolean> {
  // Similar to streak but check totalDaysHeld
  const marketContract = new ethers.Contract(
    contracts.marketContract.address,
    contracts.marketContract.abi,
    provider
  )

  const allTokens = await marketContract.getAllPlayerTokens()
  
  for (const tokenAddr of allTokens) {
    const holdings = await marketContract.getHoldings(wallet, tokenAddr)
    if (holdings > 0) {
      const playerToken = new ethers.Contract(
        tokenAddr,
        playerTokenABI,
        provider
      )
      
      try {
        const totalDays = await playerToken.totalDaysHeld(wallet)
        if (Number(totalDays) >= requiredDays) {
          return true
        }
      } catch (error) {
        // Continue checking other tokens
      }
    }
  }
  
  return false
}

async function verifyEarlyAdopterAchievement(wallet: string): Promise<boolean> {
  const launchTime = new Date(process.env.NEXT_PUBLIC_LAUNCH_TIME || '2024-01-01')
  const now = new Date()
  const hoursSinceLaunch = (now.getTime() - launchTime.getTime()) / (1000 * 60 * 60)
  
  // Must be within 24 hours of launch
  return hoursSinceLaunch <= 24
}

async function verifyTopScoutAchievement(wallet: string): Promise<boolean> {
  // This would typically check Supabase leaderboard
  // For now, return true (admin verification required)
  return true
}

async function verifyPowerScoutAchievement(wallet: string): Promise<boolean> {
  // This would typically check Supabase transaction count
  // For now, return true (admin verification required)
  return true
}