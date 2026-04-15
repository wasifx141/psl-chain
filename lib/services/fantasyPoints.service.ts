import type {
  ManualPlayerStat,
  MatchResult,
  PlayerPerformance,
  RewardShare,
} from '@/lib/types/matchResult';
import { PLAYERS } from '@/config/players';

// ─── Fantasy Points Scoring Rules (standard T20) ──────────────────────────────
export const FANTASY_SCORING = {
  RUN: 1,
  FOUR_BONUS: 1,
  SIX_BONUS: 2,
  WICKET: 25,
  MAIDEN_OVER: 12,
  CATCH: 8,
  STUMPING: 12,
  RUN_OUT: 6,
  DUCK_PENALTY: -5,
  HALF_CENTURY_BONUS: 10,
  CENTURY_BONUS: 25,
  THREE_WICKET_BONUS: 10,
  FIVE_WICKET_BONUS: 25,
} as const;

// ─── Calculate fantasy points for one player ─────────────────────────────────
export function calculateFantasyPoints(stat: ManualPlayerStat): number {
  let pts = 0;

  const runs = stat.runs ?? 0;
  const wickets = stat.wickets ?? 0;
  const fours = stat.fours ?? 0;
  const sixes = stat.sixes ?? 0;
  const maidens = stat.maidens ?? 0;
  const catches = stat.catches ?? 0;
  const stumpings = stat.stumpings ?? 0;
  const runOuts = stat.runOuts ?? 0;
  const balls = stat.balls ?? 0;

  // Batting
  pts += runs * FANTASY_SCORING.RUN;
  pts += fours * FANTASY_SCORING.FOUR_BONUS;
  pts += sixes * FANTASY_SCORING.SIX_BONUS;
  if (runs >= 50 && runs < 100) pts += FANTASY_SCORING.HALF_CENTURY_BONUS;
  if (runs >= 100) pts += FANTASY_SCORING.CENTURY_BONUS;
  if (runs === 0 && balls > 0) pts += FANTASY_SCORING.DUCK_PENALTY;

  // Bowling
  pts += wickets * FANTASY_SCORING.WICKET;
  pts += maidens * FANTASY_SCORING.MAIDEN_OVER;
  if (wickets >= 3) pts += FANTASY_SCORING.THREE_WICKET_BONUS;
  if (wickets >= 5) pts += FANTASY_SCORING.FIVE_WICKET_BONUS;

  // Fielding
  pts += catches * FANTASY_SCORING.CATCH;
  pts += stumpings * FANTASY_SCORING.STUMPING;
  pts += runOuts * FANTASY_SCORING.RUN_OUT;

  return Math.max(pts, 0);
}

// ─── Build full PlayerPerformance objects from ManualPlayerStats ──────────────
export function buildPlayerPerformances(stats: ManualPlayerStat[]): PlayerPerformance[] {
  return stats.map((stat) => ({
    playerId: stat.playerId,
    playerName: stat.playerName,
    teamCode: stat.teamCode,
    runs: stat.runs ?? 0,
    balls: stat.balls ?? 0,
    fours: stat.fours ?? 0,
    sixes: stat.sixes ?? 0,
    wickets: stat.wickets ?? 0,
    overs: stat.overs ?? 0,
    maidens: stat.maidens ?? 0,
    catches: stat.catches ?? 0,
    stumpings: stat.stumpings ?? 0,
    runOuts: stat.runOuts ?? 0,
    isDuck: (stat.runs ?? 0) === 0 && (stat.balls ?? 0) > 0,
    fantasyPoints: calculateFantasyPoints(stat),
  }));
}

// ─── Calculate reward shares from staking positions ──────────────────────────
export interface StakingPosition {
  walletAddress: string;
  playerId: string;
  tokensStaked: number;
}

export function calculateRewardShares(
  result: MatchResult,
  stakingPositions: StakingPosition[],
  totalMatchPool: number,
): RewardShare[] {
  if (!result.playerPerformances.length || !stakingPositions.length) return [];

  // Build fantasy points lookup by playerId
  const fpByPlayer: Record<string, number> = {};
  for (const perf of result.playerPerformances) {
    fpByPlayer[perf.playerId] = perf.fantasyPoints;
  }

  // Calculate weighted score per position: stake × fantasy_points
  const positions = stakingPositions.map((pos) => {
    const fp = fpByPlayer[pos.playerId] ?? 0;
    const player = PLAYERS.find((p) => p.id === pos.playerId);
    return {
      ...pos,
      playerName: player?.name ?? pos.playerId,
      playerFantasyPoints: fp,
      weightedScore: pos.tokensStaked * fp,
    };
  });

  const totalWeightedScore = positions.reduce((acc, p) => acc + p.weightedScore, 0);

  if (totalWeightedScore === 0) {
    // Equal split if nobody scored (edge case)
    const equalShare = totalMatchPool / positions.length;
    return positions.map((p) => ({
      walletAddress: p.walletAddress,
      playerName: p.playerName,
      playerId: p.playerId,
      tokensStaked: p.tokensStaked,
      playerFantasyPoints: 0,
      weightedScore: 0,
      rewardWFL: equalShare,
      rewardPercent: 100 / positions.length,
    }));
  }

  return positions.map((p) => {
    const rewardPercent = totalWeightedScore > 0 ? (p.weightedScore / totalWeightedScore) * 100 : 0;
    const rewardWFL = (rewardPercent / 100) * totalMatchPool;
    return {
      walletAddress: p.walletAddress,
      playerName: p.playerName,
      playerId: p.playerId,
      tokensStaked: p.tokensStaked,
      playerFantasyPoints: p.playerFantasyPoints,
      weightedScore: p.weightedScore,
      rewardWFL: Math.round(rewardWFL * 10000) / 10000,
      rewardPercent: Math.round(rewardPercent * 100) / 100,
    };
  });
}

// ─── Parse CricAPI scorecard response into PlayerPerformances ─────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseCricApiScorecard(apiData: any): ManualPlayerStat[] {
  const stats: ManualPlayerStat[] = [];
  if (!apiData?.scorecard) return stats;

  for (const innings of apiData.scorecard) {
    const teamCode = innings.inningsTeam ?? '';

    // Batting
    for (const batter of innings.batting ?? []) {
      const existing = stats.find((s) => s.playerName === batter.batsman?.name);
      const playerName: string = batter.batsman?.name ?? '';
      const matchedPlayer = PLAYERS.find(
        (p) => p.name.toLowerCase() === playerName.toLowerCase(),
      );
      const entry: ManualPlayerStat = existing ?? {
        playerId: matchedPlayer?.id ?? playerName,
        playerName,
        teamCode,
      };
      entry.runs = batter.r ?? 0;
      entry.balls = batter.b ?? 0;
      entry.fours = batter['4s'] ?? 0;
      entry.sixes = batter['6s'] ?? 0;
      if (!existing) stats.push(entry);
    }

    // Bowling
    for (const bowler of innings.bowling ?? []) {
      const playerName: string = bowler.bowler?.name ?? '';
      const existing = stats.find((s) => s.playerName === playerName);
      const matchedPlayer = PLAYERS.find(
        (p) => p.name.toLowerCase() === playerName.toLowerCase(),
      );
      if (existing) {
        existing.wickets = (existing.wickets ?? 0) + (bowler.w ?? 0);
        existing.maidens = (existing.maidens ?? 0) + (bowler.m ?? 0);
        existing.overs = bowler.o ?? 0;
      } else {
        stats.push({
          playerId: matchedPlayer?.id ?? playerName,
          playerName,
          teamCode,
          wickets: bowler.w ?? 0,
          maidens: bowler.m ?? 0,
          overs: bowler.o ?? 0,
        });
      }
    }
  }

  return stats;
}
