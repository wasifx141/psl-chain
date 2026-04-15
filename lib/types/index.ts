/**
 * Centralized TypeScript type definitions
 */

import { Player, TeamCode } from '@/config/players';

// ─── PORTFOLIO ────────────────────────────────────────────────────────────────
export interface Holding {
  player: Player;
  amount: number;
  value_wc: number;
}

export interface PortfolioData {
  holdings: Holding[];
  total_value_wc: number;
}

// ─── LEADERBOARD ──────────────────────────────────────────────────────────────
export interface LeaderboardEntry {
  rank: number;
  wallet: string;
  portfolio_value: number;
}

// ─── MATCH ────────────────────────────────────────────────────────────────────
export interface MatchData {
  id: number;
  dateStr: string;
  timestamp: number;
  team1?: TeamCode;
  team2?: TeamCode;
  venue: string;
  stage?: string;
  isPlayoff: boolean;
}

// ─── TRADING ──────────────────────────────────────────────────────────────────
export interface TradeResult {
  txHash: string;
}

export type TradeAction = 'BUY' | 'SELL' | 'STAKE';

// ─── PRIZE POOL ───────────────────────────────────────────────────────────────
export interface PrizePoolData {
  matchPool: number;
  seasonPool: number;
  currentSeason: number;
}

// ─── COMPONENT PROPS ──────────────────────────────────────────────────────────
export interface PlayerCardProps {
  player: Player;
  index?: number;
}

export interface CountUpProps {
  end: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
}

export interface FlipCountdownProps {
  targetDate: Date;
  className?: string;
}

// ─── ACHIEVEMENT ──────────────────────────────────────────────────────────────
export interface Achievement {
  id: string;
  icon: string;
  name: string;
  description: string;
  earned: boolean;
}

// ─── API RESPONSES ────────────────────────────────────────────────────────────
export interface ApiError {
  message: string;
  code?: string;
  details?: unknown;
}

export interface ApiResponse<T> {
  data?: T;
  error?: ApiError;
}
