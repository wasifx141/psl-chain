'use client';

import { getNextMatch, getTodayMatches } from '@/config/matches';
import { PLAYERS, TEAM_COLORS, TeamCode } from '@/config/players';
import { useDatabasePortfolio, useGetPortfolio } from '@/hooks/useContract';
import { formatNumber } from '@/utils/format';
import Link from 'next/link';
import { useAccount } from 'wagmi';

export default function Portfolio() {
  const { address, isConnected } = useAccount();
  const {
    data: dbPortfolio,
    isLoading,
    refetch,
  } = useDatabasePortfolio(address ?? '');
  const {
    holdings: onChainHoldings,
    isLoading: onChainLoading,
  } = useGetPortfolio(address ?? '');

  const useSupabaseData =
    !!dbPortfolio?.holdings && dbPortfolio.holdings.length > 0;

  const mappedHoldings = useSupabaseData
    ? (dbPortfolio?.holdings || [])
        .map((holding: any) => ({
          player: PLAYERS.find((player) => player.numericId === holding.player_id),
          amount: holding.amount,
          value_wc: holding.value_wc,
        }))
        .filter((holding: any) => holding.player && holding.amount > 0)
    : onChainHoldings.map((holding: any) => ({
        player: holding.player,
        amount: holding.amount,
        value_wc: holding.player.price * holding.amount,
      }));

  const totalTokens = mappedHoldings.reduce(
    (total: number, holding: any) => total + holding.amount,
    0,
  );
  const estimatedValue = useSupabaseData
    ? dbPortfolio?.total_value_wc || 0
    : mappedHoldings.reduce(
        (total: number, holding: any) => total + holding.value_wc,
        0,
      );

  const todayMatches = getTodayMatches();
  const nextMatch = getNextMatch();
  const playersInAction = mappedHoldings.filter((holding: any) => {
    const relevantMatches =
      todayMatches.length > 0 ? todayMatches : nextMatch ? [nextMatch] : [];
    return relevantMatches.some(
      (match) =>
        match.team1 === holding.player.team || match.team2 === holding.player.team,
    );
  });

  if (!isConnected) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <h2 className="mb-2 font-display text-2xl font-bold text-foreground">
          Connect Your Wallet
        </h2>
        <p className="max-w-md text-sm text-muted-foreground sm:text-base">
          Connect your wallet to view your on-chain portfolio and holdings.
        </p>
      </div>
    );
  }

  if (isLoading || onChainLoading) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <div key={index} className="h-28 animate-shimmer rounded-xl" />
          ))}
        </div>
        <div className="h-64 animate-shimmer rounded-xl" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-6 animate-in fade-in duration-700 sm:py-8">
      <div className="mb-4 flex flex-col gap-3 rounded-lg bg-muted/50 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1 text-xs text-muted-foreground">
          <div>
            Wallet:{' '}
            {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Not connected'}
          </div>
          <div>Holdings: {mappedHoldings.length} players</div>
          <div>Total Value: {formatNumber(estimatedValue)} WC</div>
          <div>
            {useSupabaseData ? (
              <span className="text-green-500">Using cached data</span>
            ) : (
              <span className="text-yellow-500">
                Using on-chain data (cache empty)
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => refetch()}
          className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 sm:w-auto"
        >
          Refresh Data
        </button>
      </div>

      {playersInAction.length > 0 && (
        <div className="mb-8 flex flex-col gap-5 rounded-xl border border-primary/30 bg-primary/10 p-5 animate-pulse-glow sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <h3 className="mb-2 font-display text-xl font-bold text-foreground">
              Players in Action
            </h3>
            <p className="text-sm text-muted-foreground">
              You own {playersInAction.length} player(s) participating in the
              upcoming match. Stake them or hold to accumulate rewards from the
              match pool.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {playersInAction.slice(0, 5).map((holding: any, index: number) => (
              <div
                key={holding.player.id}
                className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-background text-xs font-bold text-white shadow-md"
                style={{
                  background: `linear-gradient(135deg, ${
                    TEAM_COLORS[holding.player.team as TeamCode]?.from || '#444'
                  }, ${TEAM_COLORS[holding.player.team as TeamCode]?.to || '#000'})`,
                  zIndex: 10 - index,
                }}
                title={`${holding.player.name} (${holding.amount} tokens)`}
              >
                {holding.player.initials}
              </div>
            ))}
            {playersInAction.length > 5 && (
              <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-background bg-muted text-xs font-bold shadow-md">
                +{playersInAction.length - 5}
              </div>
            )}
          </div>

          <Link
            href="/market"
            className="w-full rounded-lg bg-primary px-6 py-3 text-center text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 sm:w-auto"
          >
            Stake Now
          </Link>
        </div>
      )}

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="card-surface rounded-xl p-6 text-center">
          <p className="text-xs text-muted-foreground">Total Portfolio Value</p>
          <p className="mt-2 font-display text-3xl font-bold text-primary">
            {formatNumber(estimatedValue)} WC
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Based on bonding-curve base prices
          </p>
        </div>
        <div className="card-surface rounded-xl p-6 text-center">
          <p className="text-xs text-muted-foreground">Unique Players Held</p>
          <p className="mt-2 font-display text-3xl font-bold text-foreground">
            {mappedHoldings.length}
          </p>
        </div>
        <div className="card-surface rounded-xl p-6 text-center">
          <p className="text-xs text-muted-foreground">Total Tokens Held</p>
          <p className="mt-2 font-display text-3xl font-bold text-foreground">
            {totalTokens}
          </p>
        </div>
      </div>

      <div className="card-surface rounded-xl p-4 sm:p-5">
        <h3 className="mb-4 font-display text-lg font-semibold text-foreground">
          On-Chain Holdings
        </h3>

        {mappedHoldings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-muted-foreground">No holdings yet.</p>
            <Link
              href="/market"
              className="mt-4 rounded-lg bg-gold-gradient px-6 py-2 text-sm font-semibold text-primary-foreground hover:brightness-90"
            >
              Browse Market
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-3 md:hidden">
              {mappedHoldings.map(({ player, amount, value_wc }: any) => {
                const colors =
                  TEAM_COLORS[player.team as TeamCode] || TEAM_COLORS.IU;

                return (
                  <div
                    key={player.id}
                    className="rounded-xl border border-border/60 bg-muted/20 p-4"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                        style={{
                          background: `linear-gradient(135deg, ${colors.from}, ${colors.to})`,
                        }}
                      >
                        {player.initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-medium text-foreground">
                            {player.name}
                          </p>
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                            style={{
                              backgroundColor: `${colors.from}22`,
                              color: colors.from,
                            }}
                          >
                            {player.teamName}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          ${player.symbol} · {player.role}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Tokens</p>
                        <p className="mt-1 font-semibold text-foreground">
                          {amount}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Base Price</p>
                        <p className="mt-1 font-semibold text-foreground">
                          {value_wc > 0 ? formatNumber(value_wc / amount) : '0'} WC
                        </p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs text-muted-foreground">Est. Value</p>
                        <p className="mt-1 font-semibold text-primary">
                          {formatNumber(value_wc)} WC
                        </p>
                      </div>
                    </div>

                    <Link
                      href={`/player/${player.id}`}
                      className="mt-4 inline-flex text-sm font-medium text-primary hover:underline"
                    >
                      Trade Player
                    </Link>
                  </div>
                );
              })}
            </div>

            <div className="hidden overflow-x-auto md:block">
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
                    const colors =
                      TEAM_COLORS[player.team as TeamCode] || TEAM_COLORS.IU;

                    return (
                      <tr
                        key={player.id}
                        className="border-b border-border/50 transition-colors hover:bg-muted/30"
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
                              <p className="font-mono text-xs text-muted-foreground">
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
                        <td className="font-bold text-foreground">{amount}</td>
                        <td className="text-muted-foreground">
                          {value_wc > 0 ? formatNumber(value_wc / amount) : '0'} WC
                        </td>
                        <td className="font-semibold text-primary">
                          {formatNumber(value_wc)} WC
                        </td>
                        <td>
                          <Link
                            href={`/player/${player.id}`}
                            className="text-xs text-muted-foreground underline hover:text-foreground"
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
          </>
        )}
      </div>

      <div className="mt-8">
        <h3 className="mb-4 font-display text-lg font-semibold text-foreground">
          Achievements - Soulbound NFT Badges
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              name: 'Season Champion',
              desc: 'Win a season prize pool',
              earned: false,
            },
            {
              name: 'Top Scout',
              desc: 'Hold 3+ unique players',
              earned: mappedHoldings.length >= 3,
            },
            {
              name: 'Diamond Hands',
              desc: 'Hold 7-day streak',
              earned: false,
            },
            {
              name: 'Moonshot',
              desc: 'Hold a Legend player',
              earned: mappedHoldings.some(
                (holding: any) => holding.player.tier === 'Legend',
              ),
            },
          ].map((achievement) => (
            <div
              key={achievement.name}
              className={`card-surface rounded-xl p-5 transition-all ${
                achievement.earned ? 'border-primary glow-gold' : 'opacity-50'
              }`}
            >
              <h4 className="font-display text-sm font-bold text-foreground">
                {achievement.name}
              </h4>
              <p className="mt-2 text-xs text-muted-foreground">
                {achievement.desc}
              </p>
              <p className="mt-3 text-xs font-semibold">
                {achievement.earned ? (
                  <span className="text-green">Earned</span>
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
