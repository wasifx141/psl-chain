'use client';

import { TEAM_COLORS, TEAM_NAMES } from '@/config/players';
import type { TeamCode } from '@/config/players';
import type { MatchResult, PlayerPerformance } from '@/lib/types/matchResult';

interface Props {
  result: MatchResult;
  matchLabel: string;
  userRewardWFL?: number;
  userStakedPlayers?: { playerName: string; tokens: number }[];
  onClaim?: () => void;
}

function FantasyBadge({ points }: { points: number }) {
  const color =
    points >= 100
      ? '#f59e0b'
      : points >= 60
      ? '#a78bfa'
      : points >= 30
      ? '#34d399'
      : '#94a3b8';

  return (
    <span
      style={{ background: `${color}22`, color, border: `1px solid ${color}55` }}
      className="ml-2 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold"
    >
      {points} pts
    </span>
  );
}

function PlayerRow({ perf, rank }: { perf: PlayerPerformance; rank: number }) {
  const medals = ['1', '2', '3'];
  const teamColors = TEAM_COLORS[perf.teamCode as TeamCode];

  return (
    <div
      className="flex items-center justify-between rounded-lg border border-white/5 px-3 py-2"
      style={{
        background: teamColors
          ? `linear-gradient(135deg, ${teamColors.from}10, ${teamColors.to}08)`
          : 'rgba(255,255,255,0.03)',
      }}
    >
      <div className="min-w-0 flex items-center gap-2">
        <span className="w-6 shrink-0 text-base">{medals[rank] ?? `#${rank + 1}`}</span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {perf.playerName}
          </p>
          <p className="text-xs text-muted-foreground">
            {perf.runs > 0 ? `${perf.runs}R ` : ''}
            {perf.fours > 0 ? `${perf.fours}x4 ` : ''}
            {perf.sixes > 0 ? `${perf.sixes}x6 ` : ''}
            {perf.wickets > 0 ? `${perf.wickets}W ` : ''}
            {perf.catches > 0 ? `${perf.catches}ct ` : ''}
            {perf.stumpings > 0 ? `${perf.stumpings}st` : ''}
          </p>
        </div>
      </div>
      <FantasyBadge points={perf.fantasyPoints} />
    </div>
  );
}

export default function MatchResultCard({
  result,
  matchLabel,
  userRewardWFL,
  userStakedPlayers = [],
  onClaim,
}: Props) {
  const topPerformers = [...result.playerPerformances]
    .sort((a, b) => b.fantasyPoints - a.fantasyPoints)
    .slice(0, 5);

  const winnerName = result.winner
    ? TEAM_NAMES[result.winner as TeamCode] ?? result.winner
    : 'Result Pending';

  const teamOneScore = result.team1Score;
  const teamTwoScore = result.team2Score;
  const teamOneColors = teamOneScore
    ? TEAM_COLORS[teamOneScore.teamCode as TeamCode]
    : null;
  const teamTwoColors = teamTwoScore
    ? TEAM_COLORS[teamTwoScore.teamCode as TeamCode]
    : null;

  const sourceBadge = {
    cricapi: { label: 'Live API', color: '#22c55e' },
    manual: { label: 'Manual', color: '#f59e0b' },
    mock: { label: 'Demo', color: '#6366f1' },
  }[result.source];

  return (
    <div className="card-surface overflow-hidden rounded-xl border border-white/10">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-gradient-to-r from-primary/20 to-primary/5 px-4 py-4 sm:px-5">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{matchLabel}</p>
          <h3 className="font-display text-lg font-bold text-foreground">
            Match Result
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="rounded-full px-2 py-0.5 text-xs font-semibold"
            style={{
              background: `${sourceBadge.color}22`,
              color: sourceBadge.color,
              border: `1px solid ${sourceBadge.color}44`,
            }}
          >
            {sourceBadge.label}
          </span>
          <span className="rounded-full border border-green-500/30 bg-green-500/20 px-2 py-0.5 text-xs font-semibold text-green-400">
            Completed
          </span>
        </div>
      </div>

      <div className="space-y-5 p-4 sm:p-5">
        {teamOneScore || teamTwoScore ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {teamOneScore ? (
              <div
                className="rounded-lg border border-white/5 p-3 text-center"
                style={{
                  background: teamOneColors
                    ? `linear-gradient(135deg, ${teamOneColors.from}18, ${teamOneColors.to}10)`
                    : 'rgba(255,255,255,0.04)',
                }}
              >
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  {teamOneScore.teamCode}
                </p>
                <p className="font-display text-2xl font-bold text-foreground">
                  {teamOneScore.score}/{teamOneScore.wickets}
                </p>
                <p className="text-xs text-muted-foreground">
                  ({teamOneScore.overs} ov)
                </p>
              </div>
            ) : null}

            {teamTwoScore ? (
              <div
                className="rounded-lg border border-white/5 p-3 text-center"
                style={{
                  background: teamTwoColors
                    ? `linear-gradient(135deg, ${teamTwoColors.from}18, ${teamTwoColors.to}10)`
                    : 'rgba(255,255,255,0.04)',
                }}
              >
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  {teamTwoScore.teamCode}
                </p>
                <p className="font-display text-2xl font-bold text-foreground">
                  {teamTwoScore.score}/{teamTwoScore.wickets}
                </p>
                <p className="text-xs text-muted-foreground">
                  ({teamTwoScore.overs} ov)
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="py-1 text-center">
          <p className="text-sm font-semibold text-primary">{winnerName} won the match</p>
        </div>

        {topPerformers.length > 0 ? (
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Top Performers
            </h4>
            <div className="space-y-1.5">
              {topPerformers.map((performance, index) => (
                <PlayerRow
                  key={performance.playerId}
                  perf={performance}
                  rank={index}
                />
              ))}
            </div>
          </div>
        ) : null}

        {userRewardWFL !== undefined || userStakedPlayers.length > 0 ? (
          <div className="rounded-xl border border-yellow-500/20 bg-gradient-to-br from-yellow-500/10 to-amber-600/5 p-4">
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-yellow-400">
              Your Rewards
            </h4>

            {userStakedPlayers.length > 0 ? (
              <div className="mb-3 flex flex-wrap gap-2">
                {userStakedPlayers.map((stakedPlayer) => (
                  <span
                    key={stakedPlayer.playerName}
                    className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-foreground"
                  >
                    {stakedPlayer.playerName} x{stakedPlayer.tokens}
                  </span>
                ))}
              </div>
            ) : null}

            {userRewardWFL !== undefined && userRewardWFL > 0 ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Your share</p>
                  <p className="font-display text-xl font-bold text-yellow-400">
                    {userRewardWFL.toFixed(4)} WFL
                  </p>
                </div>
                {onClaim ? (
                  <button
                    onClick={onClaim}
                    className="w-full rounded-lg bg-gold-gradient px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform hover:scale-105 sm:w-auto"
                  >
                    Claim Rewards
                  </button>
                ) : null}
              </div>
            ) : null}

            {userRewardWFL === 0 ? (
              <p className="text-xs text-muted-foreground">
                You did not stake on players in this match. Stake next time to earn rewards.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
