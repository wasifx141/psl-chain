"use client";

import CountUp from "@/components/CountUp";
import FlipCountdown from "@/components/FlipCountdown";
import { useGetPrizePool, useLeaderboard } from "@/hooks/useContract";
import { PrizePoolStorage } from "@/lib/services/prizePool.storage";
import { truncateAddress } from "@/utils/format";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAccount } from "wagmi";

const PRIZE_SEGMENTS = [
  { label: "#1 — 25%", pct: 25, color: "hsl(42 92% 56%)" },
  { label: "#2 — 15%", pct: 15, color: "hsl(210 40% 70%)" },
  { label: "#3 — 10%", pct: 10, color: "hsl(25 70% 55%)" },
  { label: "#4-10 — 35%", pct: 35, color: "hsl(270 60% 55%)" },
  { label: "#11-20 — 10%", pct: 10, color: "hsl(142 70% 45%)" },
  { label: "Rollover — 5%", pct: 5, color: "hsl(215 20% 55%)" },
];

export default function Leaderboard() {
  const [loaded, setLoaded] = useState(false);
  const [seasonEnd, setSeasonEnd] = useState<Date>(new Date());
  const [dailyPoolAmount, setDailyPoolAmount] = useState(0);
  const [hasClaimed, setHasClaimed] = useState(false);
  const [claimLoading, setClaimLoading] = useState(false);

  const { address } = useAccount();
  const { matchPool } = useGetPrizePool();
  const { data: leaderboardData = [], isLoading, refetch } = useLeaderboard();

  // Load daily prize pool from localStorage
  useEffect(() => {
    const pool = PrizePoolStorage.getPool();
    setDailyPoolAmount(pool.amount);

    // Refresh every 5 seconds in case trades happen in another tab
    const interval = setInterval(() => {
      setDailyPoolAmount(PrizePoolStorage.getPool().amount);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Check if user already claimed today
  useEffect(() => {
    if (address) {
      setHasClaimed(PrizePoolStorage.hasClaimedToday(address));
    }
  }, [address]);

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 1500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    setSeasonEnd(new Date("May 10, 2026 23:59:59 PST"));
  }, []);

  function getEstSeasonPrize(rank: number) {
    if (!matchPool) return 0;
    if (rank === 1) return matchPool * 0.25;
    if (rank === 2) return matchPool * 0.15;
    if (rank === 3) return matchPool * 0.1;
    if (rank >= 4 && rank <= 10) return matchPool * 0.05;
    if (rank >= 11 && rank <= 20) return matchPool * 0.01;
    return 0;
  }

  async function handleClaim() {
    if (!address) {
      toast.error("Connect your wallet first.");
      return;
    }

    const myEntry = leaderboardData.find(
      (r: any) => r.wallet.toLowerCase() === address.toLowerCase()
    );

    if (!myEntry) {
      toast.error("You must have a portfolio to claim rewards. Buy tokens first!");
      return;
    }

    setClaimLoading(true);

    try {
      const totalPortfolioValue = leaderboardData.reduce(
        (acc: number, r: any) => acc + (r.portfolio_value || 0),
        0
      );
      const myRank = leaderboardData.findIndex(
        (r: any) => r.wallet.toLowerCase() === address.toLowerCase()
      ) + 1;

      const result = PrizePoolStorage.claimReward(
        address,
        myEntry.portfolio_value || 0,
        totalPortfolioValue,
        myRank,
        leaderboardData.length,
      );

      if (result.success) {
        setDailyPoolAmount(PrizePoolStorage.getPool().amount);
        setHasClaimed(true);
        toast.success(
          `🎉 Claimed ${result.amount.toFixed(4)} WC (${result.percent.toFixed(2)}% of pool)! Your rank: #${myRank}`,
          { duration: 6000 }
        );
        // Trigger leaderboard refresh to reflect any changes
        refetch();
      } else {
        toast.error(result.message);
      }
    } catch (e) {
      toast.error("Claim failed. Please try again.");
    } finally {
      setClaimLoading(false);
    }
  }

  // Find current user's entry
  const myEntry = address
    ? leaderboardData.find(
        (r: any) => r.wallet.toLowerCase() === address.toLowerCase()
      )
    : null;
  const myRank = myEntry
    ? leaderboardData.findIndex(
        (r: any) => r.wallet.toLowerCase() === address?.toLowerCase()
      ) + 1
    : null;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Debug & Refresh Button */}
      <div className="mb-4 flex items-center justify-between bg-muted/50 rounded-lg p-3">
        <div className="text-xs text-muted-foreground">
          <div>Leaderboard Entries: {leaderboardData.length}</div>
          <div>Loading: {isLoading ? "Yes" : "No"}</div>
        </div>
        <button
          onClick={() => refetch()}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:brightness-110 transition-all"
        >
          🔄 Refresh Data
        </button>
      </div>

      {/* Banner — Daily Prize Pool */}
      <div className="mb-8 text-center animate-in fade-in slide-in-from-top duration-700">
        <p className="text-sm text-muted-foreground">Daily Prize Pool</p>
        <p className="text-4xl font-bold text-primary font-display">
          <CountUp
            end={dailyPoolAmount}
            suffix=" WC"
            decimals={4}
          />
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Grows with every buy &amp; sell (2% of each trade). Resets daily.
        </p>

        {/* Claim Button */}
        {address && (
          <div className="mt-4 flex flex-col items-center gap-2">
            {myEntry ? (
              <>
                <div className="text-xs text-muted-foreground">
                  Your portfolio: <span className="text-foreground font-semibold">{myEntry.portfolio_value?.toFixed(4)} WC</span>
                  {myRank && <span className="ml-2">• Rank #{myRank}</span>}
                </div>
                <button
                  onClick={handleClaim}
                  disabled={hasClaimed || claimLoading || dailyPoolAmount <= 0}
                  className={`bg-gold-gradient text-primary-foreground font-bold px-8 py-3 rounded-xl transition-all text-sm ${
                    hasClaimed || dailyPoolAmount <= 0
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:scale-105 hover:brightness-110"
                  }`}
                >
                  {claimLoading
                    ? "⏳ Claiming…"
                    : hasClaimed
                    ? "✅ Claimed Today"
                    : dailyPoolAmount <= 0
                    ? "Pool Empty"
                    : "🏆 Claim Daily Reward"}
                </button>
              </>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                Buy player tokens to appear on the leaderboard and claim rewards.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Prize distribution */}
      <div className="mb-8 card-surface rounded-xl p-5">
        <h3 className="mb-3 text-sm font-semibold text-foreground">
          Daily Reward Distribution (Rank-weighted)
        </h3>
        <div className="flex h-8 w-full overflow-hidden rounded-full">
          {PRIZE_SEGMENTS.map((s) => (
            <div
              key={s.label}
              style={{ width: `${s.pct}%`, backgroundColor: s.color }}
              className="flex items-center justify-center text-[9px] font-bold text-background truncate px-1"
              title={s.label}
            >
              {s.pct}%
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-3">
          {PRIZE_SEGMENTS.map((s) => (
            <div
              key={s.label}
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <div
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              {s.label}
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-3 border-t border-border/50 pt-3">
          Top 5% share 60% of pool · Next 15% share 30% · Rest share 10% (split proportionally by portfolio value)
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex rounded-lg bg-muted p-1 max-w-xs">
        <button className="flex-1 rounded-md py-2 text-sm font-semibold transition-colors capitalize bg-primary text-primary-foreground">
          Daily Match Rankings
        </button>
      </div>

      {!loaded || isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 animate-shimmer rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="card-surface rounded-xl overflow-x-auto">
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
              {leaderboardData.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="p-6 text-center text-muted-foreground"
                  >
                    No leaderboard data yet. Start trading to be the first!
                  </td>
                </tr>
              ) : null}
              {leaderboardData.map((r: any, i: number) => {
                const isYou =
                  address && r.wallet.toLowerCase() === address.toLowerCase();
                const seasonPrize = getEstSeasonPrize(r.rank);

                // Calculate their daily pool share estimate
                const totalVal = leaderboardData.reduce(
                  (acc: number, x: any) => acc + (x.portfolio_value || 0),
                  0
                );
                const top5Pct = Math.max(1, Math.ceil(leaderboardData.length * 0.05));
                const next15Pct = Math.max(1, Math.ceil(leaderboardData.length * 0.20));
                let tierAlloc = 0.10;
                if (r.rank <= top5Pct) tierAlloc = 0.60;
                else if (r.rank <= next15Pct) tierAlloc = 0.30;
                const poolSharePct = totalVal > 0
                  ? Math.min((r.portfolio_value / totalVal) * tierAlloc * 100, 25)
                  : 0;
                const estPoolReward = dailyPoolAmount * poolSharePct / 100;

                return (
                  <tr
                    key={r.rank}
                    className={`border-b border-border/50 transition-all animate-in fade-in ${
                      isYou ? "bg-primary/5 ring-1 ring-primary/30" : ""
                    }`}
                    style={{ animationDelay: `${i * 0.05}s` }}
                  >
                    <td className="p-3">
                      {r.rank === 1 ? (
                        <span className="text-lg">👑</span>
                      ) : r.rank === 2 ? (
                        <span className="text-lg">🥈</span>
                      ) : r.rank === 3 ? (
                        <span className="text-lg">🥉</span>
                      ) : (
                        <span className="text-muted-foreground">{r.rank}</span>
                      )}
                    </td>
                    <td className="p-3 text-foreground font-mono text-xs truncate max-w-[140px]">
                      {truncateAddress(r.wallet)}
                      {isYou && (
                        <span className="ml-2 rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary">
                          YOU
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-foreground font-medium">
                      {r.portfolio_value.toLocaleString(undefined, {
                        maximumFractionDigits: 4,
                      })}{" "}
                      WC
                    </td>
                    <td className="p-3 text-yellow-400 font-semibold">
                      {dailyPoolAmount > 0 && estPoolReward > 0
                        ? `~${estPoolReward.toFixed(4)} WC`
                        : "—"}
                    </td>
                    <td className="p-3 text-primary">
                      {seasonPrize > 0
                        ? `${seasonPrize.toLocaleString(undefined, {
                            maximumFractionDigits: 2,
                          })} WC`
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Countdown */}
      <div className="mt-12 text-center">
        <p className="text-sm text-muted-foreground mb-4">Season Ends In</p>
        <FlipCountdown targetDate={seasonEnd} className="justify-center" />
      </div>
    </div>
  );
}
