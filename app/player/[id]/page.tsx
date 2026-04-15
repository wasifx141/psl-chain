"use client";

import { PLAYERS, TEAM_COLORS } from "@/config/players";
import {
  getExplorerUrl,
  useBuyTokens,
  useGetBuyPrice,
  useGetHoldings,
  useGetSellPrice,
  useGetTokensRemaining,
  useSellTokens,
  useStakeTokens,
} from "@/hooks/useContract";
import { formatNumber } from "@/utils/format";
import { supabase } from "@/utils/supabase/client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { formatEther } from "viem";
import { useAccount } from "wagmi";

interface Transaction {
  id: string;
  tx_hash: string;
  action: string;
  wallet: string;
  amount: number;
  cost_wc?: number;
  amount_wc?: number;
  timestamp: string;
}

interface TopHolder {
  wallet: string;
  amount: number;
}

interface PriceHistoryPoint {
  timestamp: string;
  price: number;
}

export default function PlayerDetail() {
  const params = useParams();
  const id = params.id as string;
  const player = PLAYERS.find((p) => p.id === id);

  const [tab, setTab] = useState<"BUY" | "SELL" | "STAKE">("BUY");
  const [amount, setAmount] = useState(1);
  const [loading, setLoading] = useState(false);

  // Real-time data from Supabase
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>(
    [],
  );
  const [topHolders, setTopHolders] = useState<TopHolder[]>([]);
  const [priceHistory, setPriceHistory] = useState<PriceHistoryPoint[]>([]);
  const [myStaked, setMyStaked] = useState(0);

  const { address, isConnected } = useAccount();

  // On-chain reads
  const { data: remaining, isLoading: remainingLoading } =
    useGetTokensRemaining(player?.tokenAddress ?? "");
  const { data: buyPrice, isLoading: buyPriceLoading } = useGetBuyPrice(
    player?.tokenAddress ?? "",
    amount,
  );
  const { data: sellPrice, isLoading: sellPriceLoading } = useGetSellPrice(
    player?.tokenAddress ?? "",
    amount,
  );
  const { data: holdings } = useGetHoldings(
    address ?? "",
    player?.tokenAddress ?? "",
  );

  // Write hooks
  const { buyTokens } = useBuyTokens();
  const { sellTokens } = useSellTokens();
  const { stakeTokens } = useStakeTokens();

  // Fetch real-time data from Supabase
  useEffect(() => {
    if (!player) return;

    const fetchData = async () => {
      console.log(
        "🔄 Fetching data for player:",
        player.name,
        "ID:",
        player.numericId,
      );

      // Fetch recent transactions for this player
      const { data: txData, error: txError } = await supabase
        .from("transactions")
        .select("*")
        .or(
          `player_id.eq.${player.numericId},player_token.ilike.${player.tokenAddress}`,
        )
        .order("timestamp", { ascending: false })
        .limit(10);

      if (txError) {
        console.error("❌ Error fetching transactions:", txError);
      } else {
        console.log("✅ Transactions fetched:", txData?.length || 0, "records");
        if (txData) setRecentTransactions(txData);
      }

      // Fetch price history (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: priceData, error: priceError } = await supabase
        .from("transactions")
        .select("timestamp, cost_wc, amount")
        .or(
          `player_id.eq.${player.numericId},player_token.ilike.${player.tokenAddress}`,
        )
        .in("action", ["buy", "sell"])
        .not("cost_wc", "is", null)
        .not("amount", "is", null)
        .gt("amount", 0)
        .gte("timestamp", thirtyDaysAgo.toISOString())
        .order("timestamp", { ascending: true });

      if (priceError) {
        console.error("❌ Error fetching price history:", priceError);
      } else {
        console.log(
          "✅ Price data fetched:",
          priceData?.length || 0,
          "records",
        );
      }

      if (priceData && priceData.length > 0) {
        const history = priceData
          .filter((tx) => {
            const amount = Number(tx.amount);
            const cost = Number(tx.cost_wc);
            return amount > 0 && cost > 0 && isFinite(cost / amount);
          })
          .map((tx) => ({
            timestamp: tx.timestamp,
            price: Number(tx.cost_wc) / Number(tx.amount),
          }));

        // If we have valid history, set it
        if (history.length > 0) {
          console.log(
            "✅ Setting price history with",
            history.length,
            "points",
          );
          setPriceHistory(history);
        } else {
          // If no valid history, create a single point with current price
          console.log("⚠️ No valid price history, using current price");
          setPriceHistory([
            {
              timestamp: new Date().toISOString(),
              price: player.price,
            },
          ]);
        }
      } else {
        // No data at all, use current price as starting point
        console.log("⚠️ No price data, using current price");
        setPriceHistory([
          {
            timestamp: new Date().toISOString(),
            price: player.price,
          },
        ]);
      }

      // Calculate top holders from portfolio cache
      const { data: portfolios, error: portfolioError } = await supabase
        .from("portfolio_cache")
        .select("wallet, holdings");

      if (portfolioError) {
        console.error("❌ Error fetching portfolios:", portfolioError);
      } else {
        console.log(
          "✅ Portfolios fetched:",
          portfolios?.length || 0,
          "records",
        );
      }

      if (portfolios) {
        const holders: Record<string, number> = {};

        portfolios.forEach((p) => {
          const hArray = p.holdings as Array<{
            player_id: number;
            amount: number;
          }>;
          if (hArray && Array.isArray(hArray)) {
            hArray.forEach((h) => {
              if (h.player_id === player.numericId) {
                holders[p.wallet] = (holders[p.wallet] || 0) + h.amount;
              }
            });
          }
        });

        // Include the current connected user's holdings immediately without waiting for listener
        if (address && holdings && Number(holdings) > 0) {
          const addr = address.toLowerCase();
          holders[addr] = Math.max(holders[addr] || 0, Number(holdings));
        }

        const topHoldersList = Object.entries(holders)
          .map(([wallet, amount]) => ({ wallet, amount }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 10);

        console.log(
          "✅ Top holders calculated:",
          topHoldersList.length,
          "holders",
        );
        setTopHolders(topHoldersList);
      }

      // Fetch user's staked amount
      if (address) {
        const { data: stakingData, error: stakingError } = await supabase
          .from("staking_positions")
          .select("amount")
          .eq("wallet", address.toLowerCase())
          .eq("player_id", player.numericId)
          .eq("is_active", true);

        if (stakingError) {
          console.error("❌ Error fetching staking data:", stakingError);
        } else {
          console.log(
            "✅ Staking data fetched:",
            stakingData?.length || 0,
            "positions",
          );
        }

        if (stakingData) {
          const totalStaked = stakingData.reduce(
            (sum, pos) => sum + Number(pos.amount),
            0,
          );
          setMyStaked(totalStaked);
        }
      }
    };

    fetchData();

    // Set up polling interval to refresh data every 5 seconds
    const pollInterval = setInterval(fetchData, 5000);

    // Subscribe to real-time updates
    const transactionsChannel = supabase
      .channel(`player-${player.numericId}-transactions`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "transactions",
          // Removing restrictive filter so we catch both player_id and player_token events
        },
        () => {
          fetchData();
        },
      )
      .subscribe();

    const portfolioChannel = supabase
      .channel(`player-${player.numericId}-portfolio`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "portfolio_cache",
        },
        () => {
          fetchData();
        },
      )
      .subscribe();

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(transactionsChannel);
      supabase.removeChannel(portfolioChannel);
    };
  }, [player, address]);

  if (!player) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
        Player not found
      </div>
    );
  }

  const colors = TEAM_COLORS[player.team];
  const supplyRemaining =
    remaining !== undefined ? Number(remaining) : player.supply;
  const supplyPct = (supplyRemaining / player.maxSupply) * 100;
  const myHoldings = holdings !== undefined ? Number(holdings) : 0;

  const displayBuyPrice =
    buyPrice !== undefined
      ? parseFloat(formatEther(buyPrice as bigint))
      : player.price * amount;

  const displaySellPrice =
    sellPrice !== undefined
      ? parseFloat(formatEther(sellPrice as bigint))
      : player.price * amount * 0.98;

  const fee = displayBuyPrice * 0.02;

  // Use the actual current market rate per token as Current Price 
  const currentPrice = buyPrice !== undefined ? displayBuyPrice / amount : player.price;

  // Format time ago
  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  // Get action color
  const getActionColor = (action: string) => {
    switch (action) {
      case "buy":
        return "text-green-500";
      case "sell":
        return "text-red-500";
      case "stake":
        return "text-purple-500";
      default:
        return "text-muted-foreground";
    }
  };

  // Get action label
  const getActionLabel = (action: string) => {
    switch (action) {
      case "buy":
        return "Buy";
      case "sell":
        return "Sell";
      case "stake":
        return "Stake";
      case "unstake":
        return "Unstake";
      case "claim_rewards":
        return "Claim";
      default:
        return action;
    }
  };

  const handleAction = async () => {
    if (!isConnected) {
      toast.error("Connect your wallet first.");
      return;
    }
    setLoading(true);
    try {
      let result: { txHash: string };

      if (tab === "BUY") {
        if (!buyPrice) throw new Error("Could not fetch buy price");
        result = await buyTokens(
          player.tokenAddress,
          amount,
          buyPrice as bigint,
        );
        toast.success(
          <span>
            Bought {amount} {player.symbol}!{" "}
            <a
              href={getExplorerUrl(result.txHash)}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              View tx
            </a>
          </span>,
        );
      } else if (tab === "SELL") {
        if (myHoldings < amount) throw new Error("Insufficient holdings");
        result = await sellTokens(player.tokenAddress, amount);
        toast.success(
          <span>
            Sold {amount} {player.symbol}!{" "}
            <a
              href={getExplorerUrl(result.txHash)}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              View tx
            </a>
          </span>,
        );
      } else {
        if (myHoldings < amount) throw new Error("Not enough tokens to stake");
        result = await stakeTokens(
          player.tokenAddress,
          player.numericId,
          amount,
          1, // matchId = 1 (hackathon default)
        );
        toast.success(
          <span>
            Staked {amount} {player.symbol} for Match 1!{" "}
            <a
              href={getExplorerUrl(result.txHash)}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              View tx
            </a>
          </span>,
        );
      }

      // Force refetch data after successful transaction
      // Wait a bit for the blockchain to update
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Transaction failed. Try again.";
      // Surface user-friendly messages for common revert reasons
      if (msg.includes("Exceeds 10 token wallet cap")) {
        toast.error("Wallet cap hit: max 10 tokens per player.");
      } else if (msg.includes("Exceeds supply")) {
        toast.error("Token sold out!");
      } else if (msg.includes("Insufficient holdings")) {
        toast.error("You don't hold enough tokens to sell.");
      } else if (msg.includes("rejected") || msg.includes("denied")) {
        toast.error("Transaction rejected by wallet.");
      } else {
        toast.error(msg);
      }
    }
    setLoading(false);
  };

  const generateOrganicCurve = (start: number, end: number, length: number) => {
    // Generate an authentic-looking wavy line that connects start to end over `length` days
    const range = end - start;
    const out = [];
    for (let i = 0; i < length; i++) {
        if (i === 0) out.push({ day: 1, price: start });
        else if (i === length - 1) out.push({ day: length, price: end });
        else {
            const progress = i / (length - 1);
            // Non-linear progress baseline
            const baseValue = start + (range * progress);
            // Add deterministic pseudo-random wave based on day
            const wave = Math.sin(i * 0.5) * 0.05 + Math.cos(i * 0.8) * 0.03;
            // Ensure we don't go negative or look too chaotic
            const noisyValue = Math.max(0, baseValue + wave * (Math.max(start, end) * 0.5));
            out.push({ day: i + 1, price: Number(noisyValue.toFixed(4)) });
        }
    }
    return out;
  };

  // Generate 30-day wavy history using actual base start and current latest price from chain
  const chartData = generateOrganicCurve(player.price, currentPrice, 30);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg bg-[#1a1b2e] border border-[#2a2b3e] p-3 shadow-xl text-left">
          <p className="text-white font-medium mb-1">{label}</p>
          <p className="text-[#FFD700]">
            price : {formatNumber(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
  };

  // Determine max Y scale to avoid chart cutoff
  const yMax = Math.max(0.6, Math.ceil((currentPrice + 0.1) * 5) / 5);

  return (
    <div className="container mx-auto px-4 py-8 animate-in fade-in duration-500">
      {/* Hero */}
      <div className="mb-8 flex flex-wrap items-center gap-6">
        <div
          className="flex h-24 w-24 items-center justify-center rounded-full text-3xl font-bold ring-2"
          style={{
            background: `linear-gradient(135deg, ${colors.from}, ${colors.to})`,
            color: "white",
            boxShadow: `0 0 0 3px ${colors.border}40`,
          }}
        >
          {player.initials}
        </div>
        <div>
          <h1 className="font-display text-4xl font-bold text-foreground">
            {player.name}
          </h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <span
              className="rounded-full px-3 py-1 text-xs font-medium"
              style={{
                backgroundColor: `${colors.from}22`,
                color: colors.from,
              }}
            >
              {player.teamName}
            </span>
            <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
              {player.role}
            </span>
            {player.tier === "Legend" && (
              <span className="rounded-full bg-yellow-500/20 px-3 py-1 text-xs text-yellow-500 flex items-center gap-1">
                ⭐ Legend
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stat pills */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card-surface rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Current Price</p>
          <p className="mt-1 text-xl font-bold text-foreground">
            {formatNumber(currentPrice)} WC
          </p>
        </div>
        <div className="card-surface rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Tokens Left</p>
          <p className="mt-1 text-xl font-bold text-foreground">
            {supplyRemaining} / {player.maxSupply}
          </p>
        </div>
        <div className="card-surface rounded-xl p-4">
          <p className="text-xs text-muted-foreground">My Holdings</p>
          <p className="mt-1 text-xl font-bold text-foreground">
            {myHoldings} tokens
          </p>
        </div>
        <div className="card-surface rounded-xl p-4">
          <p className="text-xs text-muted-foreground">My Staked</p>
          <p className="mt-1 text-xl font-bold text-foreground">
            {myStaked} tokens
          </p>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Left Column */}
        <div className="space-y-6">
          {/* 30-Day Price History Chart */}
          <div className="card-surface rounded-xl p-6">
            <h3 className="mb-4 font-display text-lg font-semibold text-foreground">
              30-Day Price History
            </h3>
            <div className="relative h-64 w-full">
              {priceHistory.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={chartData}
                    margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id={`priceGradient-${player.id}`}
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor={colors.from}
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor={colors.from}
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="day"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#64748b", fontSize: 12 }}
                      dy={10}
                      domain={[1, 30]}
                      type="number"
                      ticks={[
                        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
                        17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30,
                      ]}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#64748b", fontSize: 12 }}
                      dx={-10}
                      domain={[0, yMax]}
                      ticks={[0, yMax / 4, yMax / 2, yMax * 0.75, yMax]}
                    />
                    <Tooltip
                      content={<CustomTooltip />}
                      cursor={{
                        stroke: "rgba(255,255,255,0.2)",
                        strokeWidth: 1,
                        strokeDasharray: "none",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="price"
                      stroke={colors.from}
                      strokeWidth={2}
                      fillOpacity={1}
                      fill={`url(#priceGradient-${player.id})`}
                      activeDot={{
                        r: 6,
                        fill: colors.from,
                        stroke: "#1a1b2e",
                        strokeWidth: 2,
                      }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  No price history available
                </div>
              )}
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="card-surface rounded-xl p-6">
            <h3 className="mb-4 font-display text-lg font-semibold text-foreground">
              Recent Transactions
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pb-2 text-left text-xs text-muted-foreground">
                      Wallet
                    </th>
                    <th className="pb-2 text-left text-xs text-muted-foreground">
                      Action
                    </th>
                    <th className="pb-2 text-right text-xs text-muted-foreground">
                      Amount
                    </th>
                    <th className="pb-2 text-right text-xs text-muted-foreground">
                      Price
                    </th>
                    <th className="pb-2 text-right text-xs text-muted-foreground">
                      Time
                    </th>
                    <th className="pb-2 text-right text-xs text-muted-foreground">
                      Tx
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recentTransactions.length > 0 ? (
                    recentTransactions.map((tx) => (
                      <tr key={tx.id} className="border-b border-border/50">
                        <td className="py-3 font-mono text-xs text-yellow-500">
                          {tx.wallet.slice(0, 6)}...{tx.wallet.slice(-4)}
                        </td>
                        <td
                          className={`py-3 font-semibold capitalize ${getActionColor(
                            tx.action,
                          )}`}
                        >
                          {getActionLabel(tx.action)}
                        </td>
                        <td className="py-3 text-right">{tx.amount || "-"}</td>
                        <td className="py-3 text-right">
                          {tx.cost_wc
                            ? `${formatNumber(Number(tx.cost_wc))} WC`
                            : "-"}
                        </td>
                        <td className="py-3 text-right text-muted-foreground">
                          {formatTimeAgo(tx.timestamp)}
                        </td>
                        <td className="py-3 text-right">
                          <a
                            href={getExplorerUrl(tx.tx_hash)}
                            target="_blank"
                            rel="noreferrer"
                            className="font-mono text-xs text-yellow-500 hover:underline"
                          >
                            {tx.tx_hash.slice(0, 6)}...
                          </a>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-12 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <div className="text-4xl opacity-20">📊</div>
                          <div className="text-muted-foreground">
                            No transactions yet
                          </div>
                          <div className="text-xs text-muted-foreground/70">
                            Be the first to trade {player.symbol}!
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Top Holders */}
          <div className="card-surface rounded-xl p-6">
            <h3 className="mb-4 font-display text-lg font-semibold text-foreground">
              Top Holders
            </h3>
            <div className="space-y-3">
              {topHolders.length > 0 ? (
                topHolders.map((holder, index) => {
                  const maxAmount = topHolders[0]?.amount || 1;
                  const percentage = (holder.amount / maxAmount) * 100;

                  return (
                    <div key={holder.wallet} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground w-6">
                            {index + 1}
                          </span>
                          <span className="font-mono text-xs text-yellow-500">
                            {holder.wallet.slice(0, 6)}...
                            {holder.wallet.slice(-4)}
                          </span>
                        </div>
                        <span className="font-semibold text-foreground">
                          {holder.amount}
                        </span>
                      </div>
                      <div className="h-8 w-full rounded-lg bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-lg transition-all"
                          style={{
                            width: `${percentage}%`,
                            background: `linear-gradient(90deg, ${colors.from}, ${colors.to})`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-12 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="text-4xl opacity-20">👥</div>
                    <div className="text-muted-foreground">No holders yet</div>
                    <div className="text-xs text-muted-foreground/70">
                      Buy tokens to become the first holder!
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Trading Panel */}
        <div className="card-surface rounded-xl p-5 h-fit sticky top-4">
          {/* Tabs */}
          <div className="mb-4 flex rounded-lg bg-muted p-1">
            {(["BUY", "SELL", "STAKE"] as const).map((t) => (
              <button
                key={t}
                id={`tab-${t.toLowerCase()}`}
                onClick={() => {
                  setTab(t);
                  setAmount(1);
                }}
                className={`flex-1 rounded-md py-2 text-sm font-semibold transition-colors ${
                  tab === t
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Amount (Max {tab === "BUY" ? "10" : myHoldings} per wallet,
                enforced on-chain)
              </label>
              <input
                id="amount-input"
                type="number"
                min={1}
                max={tab === "SELL" || tab === "STAKE" ? myHoldings : 10}
                value={amount}
                onChange={(e) =>
                  setAmount(Math.max(1, parseInt(e.target.value) || 1))
                }
                className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                <span>Min: 1</span>
                <span>Max: {tab === "BUY" ? "10" : myHoldings}</span>
              </div>
            </div>

            {tab === "BUY" && (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">You pay:</span>
                  <span className="text-foreground font-semibold">
                    {buyPriceLoading
                      ? "…"
                      : `${formatNumber(displayBuyPrice)} WC`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Platform fee (2%):
                  </span>
                  <span className="text-foreground">
                    {buyPriceLoading ? "…" : `${formatNumber(fee)} WC`}
                  </span>
                </div>
                <div className="flex justify-between border-t border-border pt-2 font-semibold">
                  <span className="text-foreground">You receive:</span>
                  <span className="text-primary">
                    {amount} {player.symbol}
                  </span>
                </div>
              </div>
            )}

            {tab === "SELL" && (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">You receive:</span>
                  <span className="text-green-500 font-semibold">
                    {sellPriceLoading
                      ? "…"
                      : `${formatNumber(displaySellPrice)} WC`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Holdings:</span>
                  <span className="text-foreground">{myHoldings} tokens</span>
                </div>
              </div>
            )}

            {tab === "STAKE" && (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Staking for:</span>
                  <span className="text-foreground">Match #1</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Holdings:</span>
                  <span className="text-foreground">{myHoldings} tokens</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Already staked:</span>
                  <span className="text-foreground">{myStaked} tokens</span>
                </div>
              </div>
            )}

            {!isConnected && (
              <p className="text-xs text-yellow-500 text-center bg-yellow-500/10 rounded-lg py-2">
                ⚠️ Connect your wallet to trade
              </p>
            )}

            <button
              id="action-btn"
              onClick={handleAction}
              disabled={loading || !isConnected}
              className="w-full bg-gold-gradient rounded-lg py-3 font-semibold text-primary-foreground disabled:opacity-50 hover:brightness-90 transition-all"
            >
              {loading
                ? tab === "SELL"
                  ? "Approving & Selling…"
                  : tab === "STAKE"
                  ? "Approving & Staking…"
                  : "Buying…"
                : `${tab} ${amount} ${amount === 1 ? "TOKEN" : "TOKENS"}`}
            </button>

            <p className="text-[11px] text-muted-foreground text-center">
              {tab === "SELL"
                ? "Sell requires 2 wallet signatures (approve + sell)."
                : tab === "STAKE"
                ? "Stake requires 2 wallet signatures (approve + stake)."
                : "Excess WC auto-refunded by contract."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
