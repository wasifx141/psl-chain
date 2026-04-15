'use client';

import { getNextMatch, getTodayMatches } from '@/config/matches';
import { PLAYERS, TEAM_COLORS, TeamCode } from '@/config/players';
import { useDatabasePortfolio } from '@/hooks/useContract';
import { formatNumber } from '@/utils/format';
import Link from 'next/link';
import { useAccount } from 'wagmi';

export default function Portfolio() {
  const { address, isConnected } = useAccount();
  const { data: dbPortfolio, isLoading, refetch } = useDatabasePortfolio(address ?? '');

  // Debug logging
  console.log('Portfolio Debug:', {
    address,
    isConnected,
    dbPortfolio,
    isLoading,
  });

  const mappedHoldings = (dbPortfolio?.holdings || []).map((h: any) => ({
    player: PLAYERS.find(p => p.numericId === h.player_id),
    amount: h.amount,
    value_wc: h.value_wc
  })).filter((h: any) => h.player && h.amount > 0);

  const totalTokens = mappedHoldings.reduce((acc: number, h: any) => acc + h.amount, 0);
  const estimatedValue = dbPortfolio?.total_value_wc || 0;

  // Next Match / Today Match functionality
  const todayMatches = getTodayMatches();
  const nextMatch = getNextMatch();
  
  // Find which of the user's players are playing today / next
  const playersInAction = mappedHoldings.filter((h: any) => {
    // If there's a match today, look at today's match. Otherwise look at the next match.
    const relevantMatches = todayMatches.length > 0 ? todayMatches : (nextMatch ? [nextMatch] : []);
    return relevantMatches.some(m => m.team1 === h.player.team || m.team2 === h.player.team);
  });

  if (!isConnected) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center px-4">
        <div className="text-5xl mb-4">👛</div>
        <h2 className="font-display text-2xl font-bold text-foreground mb-2">
          Connect Your Wallet
        </h2>
        <p className="text-muted-foreground">
          Connect your wallet to view your on-chain portfolio and holdings.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 animate-shimmer rounded-xl" />
          ))}
        </div>
        <div className="h-64 animate-shimmer rounded-xl" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 animate-in fade-in duration-700">
      {/* Debug Info & Refresh Button */}
      <div className="mb-4 flex items-center justify-between bg-muted/50 rounded-lg p-3">
        <div className="text-xs text-muted-foreground">
          <div>Wallet: {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Not connected'}</div>
          <div>Holdings: {mappedHoldings.length} players</div>
          <div>Total Value: {formatNumber(estimatedValue)} WC</div>
        </div>
        <button
          onClick={() => refetch()}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:brightness-110 transition-all"
        >
          🔄 Refresh Data
        </button>
      </div>

      {/* Dynamic Match Alert Widget */}
      {playersInAction.length > 0 && (
        <div className="mb-8 rounded-xl bg-primary/10 border border-primary/30 p-6 flex flex-col sm:flex-row items-center gap-6 animate-pulse-glow">
          <div className="flex-1">
            <h3 className="font-display text-xl font-bold text-foreground mb-2 flex items-center gap-2">
              <span className="text-2xl">⚡</span> Players in Action!
            </h3>
            <p className="text-muted-foreground text-sm">
              You own {playersInAction.length} player(s) participating in the upcoming match! 
              Stake them or hold to accumulate rewards directly from the match pool.
            </p>
          </div>
          <div className="flex -space-x-3">
            {playersInAction.slice(0, 5).map((h: any, i: number) => (
              <div 
                key={h.player.id} 
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
            href="/market"
            className="bg-primary text-primary-foreground font-semibold px-6 py-2 rounded-lg hover:brightness-110 transition-all whitespace-nowrap text-sm"
          >
            Stake Now
          </Link>
        </div>
      )}

      {/* Top Metrics */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="card-surface rounded-xl p-6 text-center">
          <p className="text-xs text-muted-foreground">Total Portfolio Value</p>
          <p className="mt-2 text-3xl font-bold text-primary font-display">
            {formatNumber(estimatedValue)} WC
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            (based on bonding-curve base prices)
          </p>
        </div>
        <div className="card-surface rounded-xl p-6 text-center">
          <p className="text-xs text-muted-foreground">Unique Players Held</p>
          <p className="mt-2 text-3xl font-bold text-foreground font-display">
            {mappedHoldings.length}
          </p>
        </div>
        <div className="card-surface rounded-xl p-6 text-center">
          <p className="text-xs text-muted-foreground">Total Tokens Held</p>
          <p className="mt-2 text-3xl font-bold text-foreground font-display">
            {totalTokens}
          </p>
        </div>
      </div>

      {/* Holdings Table */}
      <div className="card-surface rounded-xl p-5 overflow-x-auto">
        <h3 className="mb-4 font-display text-lg font-semibold text-foreground">
          On-Chain Holdings
        </h3>

        {mappedHoldings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="text-4xl mb-4">📦</div>
            <p className="text-muted-foreground">No holdings yet.</p>
            <Link
              href="/market"
              className="mt-4 bg-gold-gradient rounded-lg px-6 py-2 text-sm font-semibold text-primary-foreground hover:brightness-90"
            >
              Browse Market
            </Link>
          </div>
        ) : (
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
              {mappedHoldings.map(({ player, amount, value_wc }: any) => {
                const colors = TEAM_COLORS[player.team as import('@/config/players').TeamCode] || TEAM_COLORS["IU"];
                return (
                  <tr
                    key={player.id}
                    className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                  >
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                          style={{
                            background: `linear-gradient(135deg, ${colors.from}, ${colors.to})`,
                          }}
                        >
                          {player.initials}
                        </div>
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
                        href={`/player/${player.id}`}
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
        )}
      </div>

      {/* Achievements */}
      <div className="mt-8">
        <h3 className="mb-4 font-display text-lg font-semibold text-foreground">
          Achievements — Soulbound NFT Badges
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: '🏆',
              name: 'Season Champion',
              desc: 'Win a season prize pool',
              earned: false,
            },
            {
              icon: '🔍',
              name: 'Top Scout',
              desc: 'Hold 3+ unique players',
              earned: mappedHoldings.length >= 3,
            },
            {
              icon: '💎',
              name: 'Diamond Hands',
              desc: 'Hold 7-day streak',
              earned: false,
            },
            {
              icon: '🚀',
              name: 'Moonshot',
              desc: 'Hold a Legend player',
              earned: mappedHoldings.some((h: any) => h.player.tier === 'Legend'),
            },
          ].map((a) => (
            <div
              key={a.name}
              className={`card-surface rounded-xl p-5 transition-all ${
                a.earned ? 'border-primary glow-gold' : 'opacity-50'
              }`}
            >
              <div className="text-3xl mb-2">{a.icon}</div>
              <h4 className="font-display text-sm font-bold text-foreground">
                {a.name}
              </h4>
              <p className="mt-1 text-xs text-muted-foreground">{a.desc}</p>
              <p className="mt-2 text-xs font-semibold">
                {a.earned ? (
                  <span className="text-green">✓ Earned</span>
                ) : (
                  <span className="text-muted-foreground">Locked</span>
                )}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
