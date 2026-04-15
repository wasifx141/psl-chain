// ─── CricAPI & Match Result Types ────────────────────────────────────────────

export interface PlayerPerformance {
  playerId: string;          // matches our players.json id (string)
  playerName: string;
  teamCode: string;          // e.g. "IU", "PZ"
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  wickets: number;
  overs: number;
  maidens: number;
  catches: number;
  stumpings: number;
  runOuts: number;
  isDuck: boolean;
  fantasyPoints: number;     // computed
}

export interface TeamScore {
  teamCode: string;
  teamName: string;
  score: number;
  wickets: number;
  overs: number;
}

export interface MatchResult {
  matchId: number;           // our internal match id
  cricApiMatchId?: string;   // CricAPI match id (if fetched live)
  source: 'cricapi' | 'manual' | 'mock';
  status: 'completed' | 'live' | 'upcoming';
  winner?: string;           // teamCode of winner
  team1Score?: TeamScore;
  team2Score?: TeamScore;
  playerPerformances: PlayerPerformance[];
  savedAt: number;           // timestamp when saved
}

export interface RewardShare {
  walletAddress: string;
  playerName: string;
  playerId: string;
  tokensStaked: number;
  playerFantasyPoints: number;
  weightedScore: number;     // tokensStaked × fantasyPoints
  rewardWFL: number;         // calculated share of matchPool
  rewardPercent: number;     // percentage of pool
}

export interface MatchRewardSummary {
  matchId: number;
  totalMatchPool: number;    // in WFL
  totalWeightedScore: number;
  shares: RewardShare[];
}

// ─── Manual Admin Input ───────────────────────────────────────────────────────

export interface ManualPlayerStat {
  playerId: string;
  playerName: string;
  teamCode: string;
  runs?: number;
  balls?: number;
  fours?: number;
  sixes?: number;
  wickets?: number;
  overs?: number;
  maidens?: number;
  catches?: number;
  stumpings?: number;
  runOuts?: number;
}

export interface ManualMatchResult {
  matchId: number;
  winner: string;            // teamCode
  team1Score: string;        // e.g. "187/4 (20)"
  team2Score: string;        // e.g. "155/8 (20)"
  playerStats: ManualPlayerStat[];
}
