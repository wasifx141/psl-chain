"use client";

import CountUp from "@/components/CountUp";
import FlipCountdown from "@/components/FlipCountdown";
import { useGetPrizePool, useLeaderboard } from "@/hooks/useContract";
import { truncateAddress } from "@/utils/format";
import { useEffect, useState } from "react";
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

  const { address } = useAccount();
  const { matchPool } = useGetPrizePool();
  const { data: leaderboardData = [], isLoading, refetch } = useLeaderboard();

  // Debug logging
  console.log("Leaderboard Debug:", {
    leaderboardData,
    isLoading,
    dataLength: leaderboardData.length,
  });

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 1500);
    return () => clearTimeout(t);
  }, []);

  // Initialize season end date on client side to avoid hydration mismatch
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

      {/* Banner */}
      <div className="mb-8 text-center animate-in fade-in slide-in-from-top duration-700">
        <p className="text-sm text-muted-foreground">Daily Match Prize Pool</p>
        <p className="text-4xl font-bold text-primary font-display">
          <CountUp
            end={matchPool > 0 ? matchPool : 2500}
            suffix=" WC"
            decimals={0}
          />
        </p>
      </div>

      {/* Prize distribution */}
      <div className="mb-8 card-surface rounded-xl p-5">
        <h3 className="mb-3 text-sm font-semibold text-foreground">
          Prize Distribution
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
                <th className="p-3">Est. Match Prize</th>
              </tr>
            </thead>
            <tbody>
              {leaderboardData.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="p-6 text-center text-muted-foreground"
                  >
                    No leaderboard data yet. Start trading to be the first!
                  </td>
                </tr>
              ) : null}
              {leaderboardData.map((r, i) => {
                const isYou =
                  address && r.wallet.toLowerCase() === address.toLowerCase();
                const seasonPrize = getEstSeasonPrize(r.rank);
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
                      {isYou ? truncateAddress(r.wallet) : r.wallet}
                      {isYou && (
                        <span className="ml-2 rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary">
                          YOU
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-foreground font-medium">
                      {r.portfolio_value.toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })}{" "}
                      WC
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
        <p className="text-sm text-muted-foreground mb-4">Match Ends In</p>
        <FlipCountdown targetDate={seasonEnd} className="justify-center" />
      </div>
    </div>
  );
}
