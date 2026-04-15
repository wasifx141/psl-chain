'use client';

import type { MatchResult, PlayerPerformance } from '@/lib/types/matchResult';
import { TEAM_COLORS, TEAM_NAMES } from '@/config/players';
import type { TeamCode } from '@/config/players';

interface Props {
  result: MatchResult;
  matchLabel: string;
  userRewardWFL?: number; // user's personal reward from this match
  userStakedPlayers?: { playerName: string; tokens: number }[];
  onClaim?: () => void;
}

function FantasyBadge({ points }: { points: number }) {
  const color =
    points >= 100 ? '#f59e0b' : points >= 60 ? '#a78bfa' : points >= 30 ? '#34d399' : '#94a3b8';
  return (
    <span
      style={{ background: color + '22', color, border: `1px solid ${color}55` }}
      className="text-xs font-bold px-2 py-0.5 rounded-full ml-2 whitespace-nowrap"
    >
      {points} pts
    </span>
  );
}

function PlayerRow({ perf, rank }: { perf: PlayerPerformance; rank: number }) {
  const medals = ['🥇', '🥈', '🥉'];
  const tc = TEAM_COLORS[perf.teamCode as TeamCode];
  return (
    <div
      className="flex items-center justify-between py-2 px-3 rounded-lg border border-white/5"
      style={{
        background: tc
          ? `linear-gradient(135deg, ${tc.from}10, ${tc.to}08)`
          : 'rgba(255,255,255,0.03)',
      }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-base w-6 shrink-0">{medals[rank] ?? `#${rank + 1}`}</span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{perf.playerName}</p>
          <p className="text-xs text-muted-foreground">
            {perf.runs > 0 && `${perf.runs}R `}
            {perf.fours > 0 && `${perf.fours}×4 `}
            {perf.sixes > 0 && `${perf.sixes}×6 `}
            {perf.wickets > 0 && `${perf.wickets}W `}
            {perf.catches > 0 && `${perf.catches}ct `}
            {perf.stumpings > 0 && `${perf.stumpings}st`}
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

  const winnerName =
    result.winner
      ? TEAM_NAMES[result.winner as TeamCode] ?? result.winner
      : 'Result Pending';

  const t1 = result.team1Score;
  const t2 = result.team2Score;
  const t1Colors = t1 ? TEAM_COLORS[t1.teamCode as TeamCode] : null;
  const t2Colors = t2 ? TEAM_COLORS[t2.teamCode as TeamCode] : null;

  const sourceBadge = {
    cricapi: { label: 'Live API', color: '#22c55e' },
    manual:  { label: 'Manual',  color: '#f59e0b' },
    mock:    { label: 'Demo',    color: '#6366f1' },
  }[result.source];

  return (
    <div className="card-surface rounded-xl overflow-hidden border border-white/10">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary/20 to-primary/5 px-5 py-4 flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-xs text-muted-foreground font-medium">{matchLabel}</p>
          <h3 className="font-display text-lg font-bold text-foreground">Match Result</h3>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ background: sourceBadge.color + '22', color: sourceBadge.color, border: `1px solid ${sourceBadge.color}44` }}
          >
            {sourceBadge.label}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30 font-semibold">
            ✓ Completed
          </span>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Scoreboard */}
        {(t1 || t2) && (
          <div className="grid grid-cols-2 gap-3">
            {t1 && (
              <div
                className="rounded-lg p-3 text-center border border-white/5"
                style={{ background: t1Colors ? `linear-gradient(135deg, ${t1Colors.from}18, ${t1Colors.to}10)` : 'rgba(255,255,255,0.04)' }}
              >
                <p className="text-xs text-muted-foreground font-medium mb-1">{t1.teamCode}</p>
                <p className="font-display text-2xl font-bold text-foreground">
                  {t1.score}/{t1.wickets}
                </p>
                <p className="text-xs text-muted-foreground">({t1.overs} ov)</p>
              </div>
            )}
            {t2 && (
              <div
                className="rounded-lg p-3 text-center border border-white/5"
                style={{ background: t2Colors ? `linear-gradient(135deg, ${t2Colors.from}18, ${t2Colors.to}10)` : 'rgba(255,255,255,0.04)' }}
              >
                <p className="text-xs text-muted-foreground font-medium mb-1">{t2.teamCode}</p>
                <p className="font-display text-2xl font-bold text-foreground">
                  {t2.score}/{t2.wickets}
                </p>
                <p className="text-xs text-muted-foreground">({t2.overs} ov)</p>
              </div>
            )}
          </div>
        )}

        {/* Winner */}
        <div className="text-center py-2">
          <p className="text-sm font-semibold text-primary">
            🏆 {winnerName} won the match
          </p>
        </div>

        {/* Top Performers */}
        {topPerformers.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Top Performers
            </h4>
            <div className="space-y-1.5">
              {topPerformers.map((p, i) => (
                <PlayerRow key={p.playerId} perf={p} rank={i} />
              ))}
            </div>
          </div>
        )}

        {/* User Reward */}
        {(userRewardWFL !== undefined || userStakedPlayers.length > 0) && (
          <div className="rounded-xl p-4 bg-gradient-to-br from-yellow-500/10 to-amber-600/5 border border-yellow-500/20">
            <h4 className="text-xs font-semibold text-yellow-400 uppercase tracking-wider mb-3">
              ⚡ Your Rewards
            </h4>

            {userStakedPlayers.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {userStakedPlayers.map((sp) => (
                  <span
                    key={sp.playerName}
                    className="text-xs px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-foreground"
                  >
                    {sp.playerName} ×{sp.tokens}
                  </span>
                ))}
              </div>
            )}

            {userRewardWFL !== undefined && userRewardWFL > 0 && (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Your share</p>
                  <p className="font-display text-xl font-bold text-yellow-400">
                    {userRewardWFL.toFixed(4)} WFL
                  </p>
                </div>
                {onClaim && (
                  <button
                    onClick={onClaim}
                    className="bg-gold-gradient text-primary-foreground text-sm font-semibold px-4 py-2 rounded-lg hover:scale-105 transition-transform"
                  >
                    Claim Rewards
                  </button>
                )}
              </div>
            )}

            {userRewardWFL === 0 && (
              <p className="text-xs text-muted-foreground">
                You didn&apos;t stake on players in this match. Stake next time to earn rewards!
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
