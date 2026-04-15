"use client";

import CountUp from "@/components/CountUp";
import FlipCountdown from "@/components/FlipCountdown";
import { useGetPrizePool, useLeaderboard } from "@/hooks/useContract";
import { PrizePoolStorage } from "@/lib/services/prizePool.storage";
import { truncateAddress } from "@/utils/format";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAccount } from "wagmi";

const PRIZE_SEGMENTS = [
  { label: "#1 - 25%", pct: 25, color: "hsl(42 92% 56%)" },
  { label: "#2 - 15%", pct: 15, color: "hsl(210 40% 70%)" },
  { label: "#3 - 10%", pct: 10, color: "hsl(25 70% 55%)" },
  { label: "#4-10 - 35%", pct: 35, color: "hsl(270 60% 55%)" },
  { label: "#11-20 - 10%", pct: 10, color: "hsl(142 70% 45%)" },
  { label: "Rollover - 5%", pct: 5, color: "hsl(215 20% 55%)" },
];

function getRankLabel(rank: number) {
  if (rank === 1) return "1";
  if (rank === 2) return "2";
  if (rank === 3) return "3";
  return String(rank);
}

export default function Leaderboard() {
  const [loaded, setLoaded] = useState(false);
  const [seasonEnd, setSeasonEnd] = useState<Date>(new Date());
  const [dailyPoolAmount, setDailyPoolAmount] = useState(0);
  const [hasClaimed, setHasClaimed] = useState(false);
  const [claimLoading, setClaimLoading] = useState(false);

  const { address } = useAccount();
  const { matchPool, totalFees } = useGetPrizePool();
  const { data: leaderboardData = [], isLoading, refetch } = useLeaderboard();

  useEffect(() => {
    if (totalFees > 0) {
      const existingPool = PrizePoolStorage.getPool();
      if (totalFees > existingPool.amount) {
        PrizePoolStorage.addToPool(totalFees - existingPool.amount);
      }
      setDailyPoolAmount(totalFees);
    } else {
      setDailyPoolAmount(PrizePoolStorage.getPool().amount);
    }

    const interval = setInterval(() => {
      const pool = PrizePoolStorage.getPool();
      if (totalFees > 0) {
        setDailyPoolAmount(Math.max(totalFees, pool.amount));
      } else {
        setDailyPoolAmount(pool.amount);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [totalFees]);

  useEffect(() => {
    if (address) {
      setHasClaimed(PrizePoolStorage.hasClaimedToday(address));
    }
  }, [address]);

  useEffect(() => {
    const timeout = setTimeout(() => setLoaded(true), 1500);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    setSeasonEnd(new Date("2026-05-10T23:59:59-08:00"));
  }, []);

  const totalPortfolioValue = useMemo(
    () =>
      leaderboardData.reduce(
        (total: number, row: any) => total + (row.portfolio_value || 0),
        0,
      ),
    [leaderboardData],
  );

  const myEntry = address
    ? leaderboardData.find(
        (row: any) => row.wallet.toLowerCase() === address.toLowerCase(),
      )
    : null;

  const myRank = myEntry
    ? leaderboardData.findIndex(
        (row: any) => row.wallet.toLowerCase() === address?.toLowerCase(),
      ) + 1
    : null;

  function getEstSeasonPrize(rank: number) {
    if (!matchPool) return 0;
    if (rank === 1) return matchPool * 0.25;
    if (rank === 2) return matchPool * 0.15;
    if (rank === 3) return matchPool * 0.1;
    if (rank >= 4 && rank <= 10) return matchPool * 0.05;
    if (rank >= 11 && rank <= 20) return matchPool * 0.01;
    return 0;
  }

  function getPoolSharePercent(rank: number, portfolioValue: number) {
    if (!leaderboardData.length || totalPortfolioValue <= 0) return 0;

    const topFivePercentCount = Math.max(
      1,
      Math.ceil(leaderboardData.length * 0.05),
    );
    const nextTwentyPercentCount = Math.max(
      1,
      Math.ceil(leaderboardData.length * 0.2),
    );

    let tierAllocation = 0.1;
    if (rank <= topFivePercentCount) tierAllocation = 0.6;
    else if (rank <= nextTwentyPercentCount) tierAllocation = 0.3;

    return Math.min((portfolioValue / totalPortfolioValue) * tierAllocation * 100, 25);
  }

  async function handleClaim() {
    if (!address) {
      toast.error("Connect your wallet first.");
      return;
    }

    const entry = leaderboardData.find(
      (row: any) => row.wallet.toLowerCase() === address.toLowerCase(),
    );

    if (!entry) {
      toast.error(
        "You must have a portfolio to claim rewards. Buy tokens first!",
      );
      return;
    }

    setClaimLoading(true);

    try {
      const rank =
        leaderboardData.findIndex(
          (row: any) => row.wallet.toLowerCase() === address.toLowerCase(),
        ) + 1;

      const result = PrizePoolStorage.claimReward(
        address,
        entry.portfolio_value || 0,
        totalPortfolioValue,
        rank,
        leaderboardData.length,
      );

      if (result.success) {
        setDailyPoolAmount(PrizePoolStorage.getPool().amount);
        setHasClaimed(true);
        toast.success(
          `Claimed ${result.amount.toFixed(4)} WC (${result.percent.toFixed(
            2,
          )}% of pool). Your rank: #${rank}`,
          { duration: 6000 },
        );
        refetch();
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error("Claim failed. Please try again.");
    } finally {
      setClaimLoading(false);
    }
  }

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <div className="mb-4 flex flex-col gap-3 rounded-lg bg-muted/50 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-muted-foreground">
          <div>Leaderboard Entries: {leaderboardData.length}</div>
          <div>Loading: {isLoading ? "Yes" : "No"}</div>
        </div>
        <button
          onClick={() => refetch()}
          className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 sm:w-auto"
        >
          Refresh Data
        </button>
      </div>

      <div className="mb-8 text-center animate-in fade-in slide-in-from-top duration-700">
        <p className="text-sm text-muted-foreground">Daily Prize Pool</p>
        <p className="font-display text-4xl font-bold text-primary sm:text-5xl">
          <CountUp end={dailyPoolAmount} suffix=" WC" decimals={4} />
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Grows with every buy and sell (2% of each trade). Resets daily.
        </p>

        {address ? (
          <div className="mt-4 flex flex-col items-center gap-3">
            {myEntry ? (
              <>
                <div className="text-center text-xs text-muted-foreground">
                  Your portfolio:{" "}
                  <span className="font-semibold text-foreground">
                    {myEntry.portfolio_value?.toFixed(4)} WC
                  </span>
                  {myRank ? <span className="ml-2">Rank #{myRank}</span> : null}
                </div>
                <button
                  onClick={handleClaim}
                  disabled={hasClaimed || claimLoading || dailyPoolAmount <= 0}
                  className={`w-full rounded-xl px-8 py-3 text-sm font-bold text-primary-foreground transition-all sm:w-auto ${
                    hasClaimed || dailyPoolAmount <= 0
                      ? "cursor-not-allowed bg-gold-gradient opacity-50"
                      : "bg-gold-gradient hover:scale-105 hover:brightness-110"
                  }`}
                >
                  {claimLoading
                    ? "Claiming..."
                    : hasClaimed
                    ? "Claimed Today"
                    : dailyPoolAmount <= 0
                    ? "Pool Empty"
                    : "Claim Daily Reward"}
                </button>
              </>
            ) : (
              <p className="text-xs italic text-muted-foreground">
                Buy player tokens to appear on the leaderboard and claim rewards.
              </p>
            )}
          </div>
        ) : null}
      </div>

      <div className="mb-8 card-surface rounded-xl p-5">
        <h3 className="mb-3 text-sm font-semibold text-foreground">
          Daily Reward Distribution (Rank-weighted)
        </h3>
        <div className="flex h-8 w-full overflow-hidden rounded-full">
          {PRIZE_SEGMENTS.map((segment) => (
            <div
              key={segment.label}
              style={{
                width: `${segment.pct}%`,
                backgroundColor: segment.color,
              }}
              className="flex items-center justify-center truncate px-1 text-[9px] font-bold text-background"
              title={segment.label}
            >
              {segment.pct}%
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-3">
          {PRIZE_SEGMENTS.map((segment) => (
            <div
              key={segment.label}
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <div
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: segment.color }}
              />
              {segment.label}
            </div>
          ))}
        </div>
        <p className="mt-3 border-t border-border/50 pt-3 text-xs text-muted-foreground">
          Top 5% share 60% of pool. Next 15% share 30%. Rest share 10%, split
          proportionally by portfolio value.
        </p>
      </div>

      <div className="mb-6 flex w-full rounded-lg bg-muted p-1 sm:max-w-xs">
        <button className="flex-1 rounded-md bg-primary py-2 text-sm font-semibold text-primary-foreground">
          Daily Match Rankings
        </button>
      </div>

      {!loaded || isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-14 animate-shimmer rounded-lg" />
          ))}
        </div>
      ) : leaderboardData.length === 0 ? (
        <div className="card-surface rounded-xl p-6 text-center text-muted-foreground">
          No leaderboard data yet. Start trading to be the first.
        </div>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {leaderboardData.map((row: any) => {
              const isYou =
                !!address && row.wallet.toLowerCase() === address.toLowerCase();
              const seasonPrize = getEstSeasonPrize(row.rank);
              const poolSharePercent = getPoolSharePercent(
                row.rank,
                row.portfolio_value,
              );
              const estPoolReward = (dailyPoolAmount * poolSharePercent) / 100;

              return (
                <div
                  key={row.rank}
                  className={`rounded-xl border p-4 ${
                    isYou
                      ? "border-primary/50 bg-primary/5"
                      : "border-border/60 bg-muted/20"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Rank
                      </p>
                      <p className="font-display text-2xl font-bold text-foreground">
                        #{getRankLabel(row.rank)}
                      </p>
                    </div>
                    {isYou ? (
                      <span className="rounded-full bg-primary/20 px-2 py-1 text-[10px] font-bold text-primary">
                        YOU
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-3 font-mono text-xs text-muted-foreground">
                    {truncateAddress(row.wallet)}
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Portfolio Value
                      </p>
                      <p className="mt-1 font-semibold text-foreground">
                        {row.portfolio_value.toLocaleString(undefined, {
                          maximumFractionDigits: 4,
                        })}{" "}
                        WC
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Est. Pool Share
                      </p>
                      <p className="mt-1 font-semibold text-yellow-400">
                        {dailyPoolAmount > 0 && estPoolReward > 0
                          ? `~${estPoolReward.toFixed(4)} WC`
                          : "-"}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground">
                        Season Prize
                      </p>
                      <p className="mt-1 font-semibold text-primary">
                        {seasonPrize > 0
                          ? `${seasonPrize.toLocaleString(undefined, {
                              maximumFractionDigits: 2,
                            })} WC`
                          : "-"}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="hidden overflow-x-auto rounded-xl border border-border/60 bg-card md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="p-3">Rank</th>
                  <th className="p-3">Wallet</th>
                  <th className="p-3">Portfolio Value</th>
                  <th className="p-3">Est. Pool Share</th>
                  <th className="p-3">Season Prize</th>
                </tr>
              </thead>
              <tbody>
                {leaderboardData.map((row: any, index: number) => {
                  const isYou =
                    !!address &&
                    row.wallet.toLowerCase() === address.toLowerCase();
                  const seasonPrize = getEstSeasonPrize(row.rank);
                  const poolSharePercent = getPoolSharePercent(
                    row.rank,
                    row.portfolio_value,
                  );
                  const estPoolReward =
                    (dailyPoolAmount * poolSharePercent) / 100;

                  return (
                    <tr
                      key={row.rank}
                      className={`border-b border-border/50 transition-all animate-in fade-in ${
                        isYou ? "bg-primary/5 ring-1 ring-primary/30" : ""
                      }`}
                      style={{ animationDelay: `${index * 0.05}s` }}
                    >
                      <td className="p-3">
                        <span className="text-muted-foreground">
                          {getRankLabel(row.rank)}
                        </span>
                      </td>
                      <td className="max-w-[160px] truncate p-3 font-mono text-xs text-foreground">
                        {truncateAddress(row.wallet)}
                        {isYou ? (
                          <span className="ml-2 rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary">
                            YOU
                          </span>
                        ) : null}
                      </td>
                      <td className="p-3 font-medium text-foreground">
                        {row.portfolio_value.toLocaleString(undefined, {
                          maximumFractionDigits: 4,
                        })}{" "}
                        WC
                      </td>
                      <td className="p-3 font-semibold text-yellow-400">
                        {dailyPoolAmount > 0 && estPoolReward > 0
                          ? `~${estPoolReward.toFixed(4)} WC`
                          : "-"}
                      </td>
                      <td className="p-3 text-primary">
                        {seasonPrize > 0
                          ? `${seasonPrize.toLocaleString(undefined, {
                              maximumFractionDigits: 2,
                            })} WC`
                          : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="mt-12 text-center">
        <p className="mb-4 text-sm text-muted-foreground">Season Ends In</p>
        <FlipCountdown targetDate={seasonEnd} className="justify-center" />
      </div>
    </div>
  );
}
