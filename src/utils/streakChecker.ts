import { supabase } from './supabase/client'

interface AchievementCheck {
  wallet: string
  playerTokenAddr: string
  action: 'buy' | 'sell' | 'stake'
}

export async function checkAchievements({ wallet, playerTokenAddr, action }: AchievementCheck) {
  try {
    // Only check achievements on buy actions
    if (action !== 'buy') return

    // Get current streak from contract (this would be called from the hook)
    const streakResponse = await fetch('/api/get-streak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet, playerTokenAddr })
    })
    
    if (!streakResponse.ok) return
    
    const { streak, totalDaysHeld } = await streakResponse.json()

    // Check for achievements
    const achievements = []

    // 7-day streak achievement
    if (streak >= 7) {
      const { data: existing } = await supabase
        .from('achievements')
        .select('id')
        .eq('wallet', wallet)
        .eq('achievement_type', 'SEVEN_DAY_STREAK')
        .single()

      if (!existing) {
        achievements.push({
          wallet,
          achievementType: 'SEVEN_DAY_STREAK',
          reason: `Held tokens for ${streak} consecutive days`
        })
      }
    }

    // Diamond Hands achievement (30 days total)
    if (totalDaysHeld >= 30) {
      const { data: existing } = await supabase
        .from('achievements')
        .select('id')
        .eq('wallet', wallet)
        .eq('achievement_type', 'DIAMOND_HANDS')
        .single()

      if (!existing) {
        achievements.push({
          wallet,
          achievementType: 'DIAMOND_HANDS',
          reason: `Held tokens for ${totalDaysHeld} total days`
        })
      }
    }

    // Early Adopter achievement (within first 24h of launch)
    const launchTime = new Date(process.env.NEXT_PUBLIC_LAUNCH_TIME || '2024-01-01')
    const now = new Date()
    const hoursSinceLaunch = (now.getTime() - launchTime.getTime()) / (1000 * 60 * 60)

    if (hoursSinceLaunch <= 24) {
      const { data: existing } = await supabase
        .from('achievements')
        .select('id')
        .eq('wallet', wallet)
        .eq('achievement_type', 'EARLY_ADOPTER')
        .single()

      if (!existing) {
        achievements.push({
          wallet,
          achievementType: 'EARLY_ADOPTER',
          reason: 'Purchased tokens within first 24 hours of launch'
        })
      }
    }

    // Mint achievements via admin API
    for (const achievement of achievements) {
      await mintAchievement(achievement)
    }

  } catch (error) {
    console.error('Error checking achievements:', error)
  }
}

async function mintAchievement(achievement: {
  wallet: string
  achievementType: string
  reason: string
}) {
  try {
    const response = await fetch('/api/mint-achievement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: achievement.wallet,
        achievementType: achievement.achievementType,
        season: 1 // Current season
      })
    })

    if (response.ok) {
      const { txHash } = await response.json()
      
      // Save achievement to Supabase
      await supabase.from('achievements').insert({
        wallet: achievement.wallet,
        achievement_type: achievement.achievementType,
        reason: achievement.reason,
        tx_hash: txHash,
        minted_at: new Date().toISOString()
      })

      console.log(`Achievement ${achievement.achievementType} minted for ${achievement.wallet}`)
    }
  } catch (error) {
    console.error('Error minting achievement:', error)
  }
}

// Check for other achievements based on portfolio performance
export async function checkPerformanceAchievements(wallet: string) {
  try {
    // Get portfolio data
    const { data: portfolio } = await supabase
      .from('portfolio_cache')
      .select('*')
      .eq('wallet', wallet)
      .single()

    if (!portfolio) return

    const achievements = []

    // Top Scout - top 10% of portfolios
    const { data: leaderboard } = await supabase
      .from('leaderboard_cache')
      .select('wallet, portfolio_value')
      .order('portfolio_value', { ascending: false })

    if (leaderboard) {
      const topTenPercent = Math.ceil(leaderboard.length * 0.1)
      const userRank = leaderboard.findIndex(entry => entry.wallet === wallet) + 1
      
      if (userRank > 0 && userRank <= topTenPercent) {
        const { data: existing } = await supabase
          .from('achievements')
          .select('id')
          .eq('wallet', wallet)
          .eq('achievement_type', 'TOP_SCOUT')
          .single()

        if (!existing) {
          achievements.push({
            wallet,
            achievementType: 'TOP_SCOUT',
            reason: `Ranked #${userRank} in portfolio performance`
          })
        }
      }
    }

    // Power Scout - made 50+ transactions
    const { count } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('wallet', wallet)

    if (count && count >= 50) {
      const { data: existing } = await supabase
        .from('achievements')
        .select('id')
        .eq('wallet', wallet)
        .eq('achievement_type', 'POWER_SCOUT')
        .single()

      if (!existing) {
        achievements.push({
          wallet,
          achievementType: 'POWER_SCOUT',
          reason: `Completed ${count} transactions`
        })
      }
    }

    // Mint achievements
    for (const achievement of achievements) {
      await mintAchievement(achievement)
    }

  } catch (error) {
    console.error('Error checking performance achievements:', error)
  }
}