/**
 * Application-wide constants
 * Centralized configuration for magic numbers, strings, and settings
 */

// ─── TIMING ───────────────────────────────────────────────────────────────────
export const TIMING = {
  SKELETON_DELAY: 1500,
  CLOCK_UPDATE_INTERVAL: 1000,
  QUERY_STALE_TIME: 0, // No caching - always fetch fresh data
  ANIMATION_DELAY_BASE: 0.05,
  ANIMATION_DELAY_HERO: 0.2,
  ANIMATION_DELAY_CARDS: 0.5,
} as const;

// ─── LIMITS ───────────────────────────────────────────────────────────────────
export const LIMITS = {
  MAX_TOKENS_PER_PLAYER: 10,
  MAX_SUPPLY_PER_PLAYER: 100,
  LEADERBOARD_TOP_N: 100,
  RECENT_MATCHES_COUNT: 5,
  UPCOMING_MATCHES_COUNT: 10,
  HERO_PLAYERS_COUNT: 3,
} as const;

// ─── FEES ─────────────────────────────────────────────────────────────────────
export const FEES = {
  TRADING_FEE_PERCENT: 2,
  SLIPPAGE_BUFFER_PERCENT: 5,
} as const;

// ─── PRIZE DISTRIBUTION ───────────────────────────────────────────────────────
export const PRIZE_DISTRIBUTION = [
  { rank: 1, label: '#1 — 25%', percent: 25, color: 'hsl(42 92% 56%)' },
  { rank: 2, label: '#2 — 15%', percent: 15, color: 'hsl(210 40% 70%)' },
  { rank: 3, label: '#3 — 10%', percent: 10, color: 'hsl(25 70% 55%)' },
  { rank: '4-10', label: '#4-10 — 35%', percent: 35, color: 'hsl(270 60% 55%)' },
  { rank: '11-20', label: '#11-20 — 10%', percent: 10, color: 'hsl(142 70% 45%)' },
  { rank: 'rollover', label: 'Rollover — 5%', percent: 5, color: 'hsl(215 20% 55%)' },
] as const;

// ─── SEASON ───────────────────────────────────────────────────────────────────
export const SEASON = {
  END_DATE: new Date('May 10, 2026 23:59:59 PST'),
  DEFAULT_MATCH_POOL: 2500,
  DEFAULT_SEASON_POOL: 125000,
} as const;

// ─── MESSAGES ─────────────────────────────────────────────────────────────────
export const MESSAGES = {
  CONNECT_WALLET: 'Connect your wallet first.',
  TRANSACTION_REJECTED: 'Transaction rejected by wallet.',
  INSUFFICIENT_HOLDINGS: "You don't hold enough tokens.",
  WALLET_CAP_HIT: 'Wallet cap hit: max 10 tokens per player.',
  TOKEN_SOLD_OUT: 'Token sold out!',
  MATCH_DETAILS_SOON: 'Match details coming soon!',
} as const;

// ─── ROUTES ───────────────────────────────────────────────────────────────────
export const ROUTES = {
  HOME: '/',
  MARKET: '/market',
  PORTFOLIO: '/portfolio',
  MATCHES: '/matches',
  LEADERBOARD: '/leaderboard',
  TROPHIES: '/trophies',
  PLAYER: (id: string) => `/player/${id}`,
} as const;

// ─── ACHIEVEMENTS ─────────────────────────────────────────────────────────────
export const ACHIEVEMENTS = [
  {
    id: 'season-champion',
    icon: '🏆',
    name: 'Season Champion',
    description: 'Win a season prize pool',
    checkEarned: (data: { holdings: any[] }) => false,
  },
  {
    id: 'top-scout',
    icon: '🔍',
    name: 'Top Scout',
    description: 'Hold 3+ unique players',
    checkEarned: (data: { holdings: any[] }) => data.holdings.length >= 3,
  },
  {
    id: 'diamond-hands',
    icon: '💎',
    name: 'Diamond Hands',
    description: 'Hold 7-day streak',
    checkEarned: (data: { holdings: any[] }) => false,
  },
  {
    id: 'moonshot',
    icon: '🚀',
    name: 'Moonshot',
    description: 'Hold a Legend player',
    checkEarned: (data: { holdings: any[] }) =>
      data.holdings.some((h: any) => h.player?.tier === 'Legend'),
  },
] as const;
