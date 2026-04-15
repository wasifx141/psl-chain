/**
 * Daily Prize Pool Storage Service
 * - Starts at 0 each day
 * - Grows when users buy/sell tokens (2% of each trade goes into pool)
 * - Claim distributes a calculated percentage proportionally by portfolio rank/value
 * - Updates leaderboard on claim
 */

const POOL_KEY = 'psl_daily_prize_pool';
const CLAIMS_KEY = 'psl_daily_claims';
const DATE_KEY = 'psl_pool_date';

export interface DailyPoolState {
  amount: number;      // total accumulated WC
  date: string;        // ISO date string (YYYY-MM-DD)
}

export interface ClaimRecord {
  wallet: string;
  claimedAt: number;
  amountClaimed: number;
  poolAtClaim: number;
  percentAwarded: number;
}

function getTodayStr(): string {
  return new Date().toISOString().split('T')[0];
}

export const PrizePoolStorage = {
  /** Get current pool state, reset if it's a new day */
  getPool(): DailyPoolState {
    if (typeof window === 'undefined') return { amount: 0, date: getTodayStr() };
    try {
      const raw = localStorage.getItem(POOL_KEY);
      const state: DailyPoolState = raw ? JSON.parse(raw) : { amount: 0, date: getTodayStr() };
      // Reset pool if it's a new day
      if (state.date !== getTodayStr()) {
        const fresh = { amount: 0, date: getTodayStr() };
        localStorage.setItem(POOL_KEY, JSON.stringify(fresh));
        localStorage.removeItem(CLAIMS_KEY); // Reset claims for new day
        return fresh;
      }
      return state;
    } catch {
      return { amount: 0, date: getTodayStr() };
    }
  },

  /** Add an amount to the prize pool (called on buy/sell) */
  addToPool(amount: number): DailyPoolState {
    if (typeof window === 'undefined') return { amount: 0, date: getTodayStr() };
    const current = this.getPool();
    const updated: DailyPoolState = {
      amount: Math.round((current.amount + amount) * 10000) / 10000,
      date: getTodayStr(),
    };
    localStorage.setItem(POOL_KEY, JSON.stringify(updated));
    return updated;
  },

  /** Check if wallet has already claimed today */
  hasClaimedToday(wallet: string): boolean {
    if (typeof window === 'undefined') return false;
    try {
      const raw = localStorage.getItem(CLAIMS_KEY);
      const claims: ClaimRecord[] = raw ? JSON.parse(raw) : [];
      const today = getTodayStr();
      return claims.some(
        (c) => c.wallet.toLowerCase() === wallet.toLowerCase() &&
               new Date(c.claimedAt).toISOString().split('T')[0] === today
      );
    } catch {
      return false;
    }
  },

  /**
   * Claim reward for a wallet.
   * @param wallet - Connected wallet address
   * @param portfolioValue - This user's portfolio value (WC)
   * @param totalPortfolioValue - Sum of all portfolio values on leaderboard (WC)
   * @param leaderboardRank - User's rank (1-based)
   * @param totalParticipants - Total people on leaderboard
   * @returns Reward amount in WC, or 0 if already claimed / pool empty
   */
  claimReward(
    wallet: string,
    portfolioValue: number,
    totalPortfolioValue: number,
    leaderboardRank: number,
    totalParticipants: number,
  ): { success: boolean; amount: number; percent: number; message: string } {
    if (typeof window === 'undefined') {
      return { success: false, amount: 0, percent: 0, message: 'Not available on server' };
    }
    const pool = this.getPool();
    if (pool.amount <= 0) {
      return { success: false, amount: 0, percent: 0, message: 'Prize pool is empty today' };
    }
    if (this.hasClaimedToday(wallet)) {
      return { success: false, amount: 0, percent: 0, message: 'Already claimed today' };
    }

    // Calculate percent based on portfolio rank:
    // Top 5%: share 60% of pool proportionally by portfolio value
    // Next 15%: share 30% of pool
    // Rest: share 10% of pool
    let poolSharePercent = 0;

    if (totalPortfolioValue <= 0 || portfolioValue <= 0) {
      return { success: false, amount: 0, percent: 0, message: 'No portfolio value to claim with' };
    }

    // Rank-based tier multipliers
    const top5Pct = Math.max(1, Math.ceil(totalParticipants * 0.05));
    const next15Pct = Math.max(1, Math.ceil(totalParticipants * 0.20));

    let tierPoolAllocation: number; // portion of pool allocated to this tier
    if (leaderboardRank <= top5Pct) {
      tierPoolAllocation = 0.60; // top 5% share 60%
    } else if (leaderboardRank <= next15Pct) {
      tierPoolAllocation = 0.30; // next 15% share 30%
    } else {
      tierPoolAllocation = 0.10; // everyone else shares 10%
    }

    // Within each tier, split by portfolio value proportion
    poolSharePercent = (portfolioValue / totalPortfolioValue) * tierPoolAllocation * 100;
    poolSharePercent = Math.min(poolSharePercent, 25); // cap at 25% of pool per wallet

    const rewardAmount = Math.round((pool.amount * poolSharePercent / 100) * 10000) / 10000;

    if (rewardAmount <= 0) {
      return { success: false, amount: 0, percent: 0, message: 'Reward too small to claim' };
    }

    // Deduct from pool
    const updatedPool: DailyPoolState = {
      amount: Math.max(0, Math.round((pool.amount - rewardAmount) * 10000) / 10000),
      date: getTodayStr(),
    };
    localStorage.setItem(POOL_KEY, JSON.stringify(updatedPool));

    // Record claim
    const claim: ClaimRecord = {
      wallet: wallet.toLowerCase(),
      claimedAt: Date.now(),
      amountClaimed: rewardAmount,
      poolAtClaim: pool.amount,
      percentAwarded: poolSharePercent,
    };
    try {
      const raw = localStorage.getItem(CLAIMS_KEY);
      const claims: ClaimRecord[] = raw ? JSON.parse(raw) : [];
      claims.push(claim);
      localStorage.setItem(CLAIMS_KEY, JSON.stringify(claims));
    } catch { /* ignore */ }

    return {
      success: true,
      amount: rewardAmount,
      percent: Math.round(poolSharePercent * 100) / 100,
      message: `Claimed ${rewardAmount.toFixed(4)} WC from prize pool!`,
    };
  },

  /** Get all claims for today */
  getTodayClaims(): ClaimRecord[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(CLAIMS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },
};
