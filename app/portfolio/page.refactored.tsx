'use client';

/**
 * Portfolio Page - Refactored Version
 * Shows user's token holdings, achievements, and match alerts
 */

import Link from 'next/link';
import { useAccount } from 'wagmi';
import { useDatabasePortfolio } from '@/hooks/useContract';
import { formatNumber } from '@/utils/format';
import { TEAM_COLORS, PLAYERS, TeamCode } from '@/config/players';
import { getNextMatch, getTodayMatches } from '@/config/matches';
import { ACHIEVEMENTS, ROUTES } from '@/lib/constants';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { StatCard } from '@/components/features/StatCard';
import { AchievementCard } from '@/components/features/AchievementCard';
import { TeamBadge } from '@/components/features/TeamBadge';

/**
 * Match Alert Widget Component
 */
function MatchAlertWidget({ playersInAction }: { playersInAction: any[] }) {
  if (playersInAction.length === 0) return null;

  return (
    <div className="mb-8 rounded-xl bg-primary/10 border border-primary/30 p-6 flex flex-col sm:flex-row items-center gap-6 animate-pulse-glow">
      <div className="flex-1">
        <h3 className="font-display text-xl font-bold text-foreground mb-2 flex items-center gap-2">
          <span className="text-2xl" role="img" aria-label="Lightning">⚡</span> 
          Players in Action!
        </h3>
        <p className="text-muted-foreground text-sm">
          You own {playersInAction.length} player(s) participating in the upcoming match! 
          Stake them or hold to accumulate rewards directly from the match pool.
        </p>
      </div>
      
      <div className="flex -space-x-3" role="list" aria-label="Players in action">
        {playersInAction.slice(0, 5).map((h: any, i: number) => (
          <div 
            key={h.player.id} 
            role="listitem"
            className="w-12 h-12 rounded-full border-2 border-background flex items-center justify-center font-bold text-xs shadow-md"
            style={{
              background: `linear-gradient(135deg, ${TEAM_COLORS[h.player.team as TeamCode]?.from || '#444'}, ${TEAM_COLORS[h.player.team as TeamCode]?.to || '#000'})`,
              color: "white",
              zIndex: 10 - i
            }}
            title={`${h.player.name} (${h.amount} tokens)`}
          >
            {h.player.initials}
          </div>
        ))}
        {playersInAction.length > 5 && (
          <div className="w-12 h-12 rounded-full border-2 border-background bg-muted flex items-center justify-center font-bold text-xs shadow-md z-0">
            +{playersInAction.length - 5}
          </div>
        )}
      </div>
      
      <Link
        href={ROUTES.MARKET}
        className="bg-primary text-primary-foreground font-semibold px-6 py-2 rounded-lg hover:brightness-110 transition-all whitespace-nowrap text-sm"
      >
        Stake Now
      </Link>
    </div>
  );
}

/**
 * Holdings Table Component
 */
function HoldingsTable({ holdings }: { holdings: any[] }) {
  if (holdings.length === 0) {
    return (
      <EmptyState
        icon="📦"
        title="No holdings yet"
        description="Start building your portfolio by buying player tokens"
        actionLabel="Browse Market"
        actionHref={ROUTES.MARKET}
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="pb-2">Player</th>
            <th className="pb-2">Team</th>
            <th className="pb-2">Role</th>
            <th className="pb-2">Tokens</th>
            <th className="pb-2">Base Price</th>
            <th className="pb-2">Est. Value</th>
            <th className="pb-2"></th>
          </tr>
        </thead>
        <tbody>
          {holdings.map(({ player, amount, value_wc }: any) => {
            const colors = TEAM_COLORS[player.team as TeamCode] || TEAM_COLORS["IU"];
            return (
              <tr
                key={player.id}
                className="border-b border-border/50 hover:bg-muted/30 transition-colors"
              >
                <td className="py-3">
                  <div className="flex items-center gap-2">
                    <TeamBadge teamCode={player.team} size="sm" />
                    <div>
                      <p className="font-medium text-foreground">
                        {player.name}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono">
                        ${player.symbol}
                      </p>
                    </div>
                  </div>
                </td>
                <td>
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{
                      backgroundColor: `${colors.from}22`,
                      color: colors.from,
                    }}
                  >
                    {player.teamName}
                  </span>
                </td>
                <td className="text-muted-foreground">{player.role}</td>
                <td className="text-foreground font-bold">{amount}</td>
                <td className="text-muted-foreground">
                  {value_wc > 0 ? formatNumber(value_wc / amount) : "0"} WC
                </td>
                <td className="text-primary font-semibold">
                  {formatNumber(value_wc)} WC
                </td>
                <td>
                  <Link
                    href={ROUTES.PLAYER(player.id)}
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                  >
                    Trade
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Main Portfolio Page Component
 */
export default function Portfolio() {
  const { address, isConnected } = useAccount();
  const { data: dbPortfolio, isLoading } = useDatabasePortfolio(address ?? '');

  // Map holdings with player data
  const mappedHoldings = (dbPortfolio?.holdings || []).map((h: any) => ({
    player: PLAYERS.find(p => p.numericId === h.player_id),
    amount: h.amount,
    value_wc: h.value_wc
  })).filter((h: any) => h.player && h.amount > 0);

  const totalTokens = mappedHoldings.reduce((acc: number, h: any) => acc + h.amount, 0);
  const estimatedValue = dbPortfolio?.total_value_wc || 0;

  // Find players in upcoming matches
  const todayMatches = getTodayMatches();
  const nextMatch = getNextMatch();
  const relevantMatches = todayMatches.length > 0 ? todayMatches : (nextMatch ? [nextMatch] : []);
  
  const playersInAction = mappedHoldings.filter((h: any) => {
    return relevantMatches.some(m => m.team1 === h.player.team || m.team2 === h.player.team);
  });

  // Calculate achievements
  const achievements = ACHIEVEMENTS.map(achievement => ({
    ...achievement,
    earned: achievement.checkEarned({ holdings: mappedHoldings }),
  }));

  // Not connected state
  if (!isConnected) {
    return (
      <EmptyState
        icon="👛"
        title="Connect Your Wallet"
        description="Connect your wallet to view your on-chain portfolio and holdings."
      />
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="container mx-auto px-4 py-8 animate-in fade-in duration-700">
        {/* Match Alert */}
        <MatchAlertWidget playersInAction={playersInAction} />

        {/* Top Metrics */}
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Total Portfolio Value"
            value={`${formatNumber(estimatedValue)} WC`}
          />
          <StatCard
            label="Unique Players Held"
            value={mappedHoldings.length}
          />
          <StatCard
            label="Total Tokens Held"
            value={totalTokens}
          />
        </div>

        {/* Holdings Table */}
        <div className="card-surface rounded-xl p-5">
          <h3 className="mb-4 font-display text-lg font-semibold text-foreground">
            On-Chain Holdings
          </h3>
          <HoldingsTable holdings={mappedHoldings} />
        </div>

        {/* Achievements */}
        <div className="mt-8">
          <h3 className="mb-4 font-display text-lg font-semibold text-foreground">
            Achievements — Soulbound NFT Badges
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {achievements.map((achievement) => (
              <AchievementCard
                key={achievement.id}
                icon={achievement.icon}
                name={achievement.name}
                description={achievement.description}
                earned={achievement.earned}
              />
            ))}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
