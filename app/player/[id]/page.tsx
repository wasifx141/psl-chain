"use client";

import { MARKET_ABI, STAKING_ABI } from "@/config/abis";
import { CONTRACTS } from "@/config/contracts";
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
import { PrizePoolStorage } from "@/lib/services/prizePool.storage";
import { SupabaseService } from "@/lib/services/supabase.service";
import { formatNumber } from "@/utils/format";
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
import { formatEther, parseAbiItem } from "viem";
import { useAccount, usePublicClient } from "wagmi";

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
  time: number;
  price: number;
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const TOKEN_BOUGHT_EVENT = parseAbiItem(
  "event TokenBought(address indexed buyer, address indexed playerToken, uint256 amount, uint256 cost, uint256 newSupply)",
);
const TOKEN_SOLD_EVENT = parseAbiItem(
  "event TokenSold(address indexed seller, address indexed playerToken, uint256 amount, uint256 refund, uint256 newSupply)",
);
const STAKED_EVENT = parseAbiItem(
  "event Staked(address indexed wallet, uint8 matchId, uint8 playerId, uint256 amount)",
);
const UNSTAKED_EVENT = parseAbiItem(
  "event Unstaked(address indexed wallet, uint8 matchId, uint8 playerId, uint256 amount)",
);

const chartTickFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
});
const tooltipDateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function buildChartData(
  priceHistory: PriceHistoryPoint[],
  currentPrice: number,
): PriceHistoryPoint[] {
  const now = Date.now();
  const windowStart = now - THIRTY_DAYS_MS;
  const sortedHistory = [...priceHistory].sort((a, b) => a.time - b.time);
  const visibleHistory = sortedHistory.filter(
    (point) => point.time >= windowStart && point.time <= now,
  );
  const previousPoint = [...sortedHistory]
    .reverse()
    .find((point) => point.time < windowStart);
  const fallbackPrice =
    currentPrice > 0
      ? currentPrice
      : sortedHistory[sortedHistory.length - 1]?.price ?? 0;
  const seedPrice =
    previousPoint?.price ?? visibleHistory[0]?.price ?? fallbackPrice;

  return [
    {
      timestamp: new Date(windowStart).toISOString(),
      time: windowStart,
      price: seedPrice,
    },
    ...visibleHistory.map((point) => ({ ...point })),
    {
      timestamp: new Date(now).toISOString(),
      time: now,
      price: fallbackPrice || seedPrice,
    },
  ];
}

export default function PlayerDetail() {
  const params = useParams();
  const id = params.id as string;
  const player = PLAYERS.find((p) => p.id === id);

  const [tab, setTab] = useState<"BUY" | "SELL" | "STAKE">("BUY");
  const [amount, setAmount] = useState(1);
  const [loading, setLoading] = useState(false);

  // Market data state
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>(
    [],
  );
  const [topHolders, setTopHolders] = useState<TopHolder[]>([]);
  const [priceHistory, setPriceHistory] = useState<PriceHistoryPoint[]>([]);
  const [myStaked, setMyStaked] = useState(0);

  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();

  // On-chain reads
  const { data: remaining } = useGetTokensRemaining(player?.tokenAddress ?? "");
  const { data: currentUnitBuyPrice } = useGetBuyPrice(
    player?.tokenAddress ?? "",
    1,
  );
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

  // Fetch player activity and holders directly from chain data
  useEffect(() => {
    if (!player || !publicClient || !player.tokenAddress) return;

    let cancelled = false;
    const playerToken = player.tokenAddress as `0x${string}`;

    const fetchData = async () => {
      try {
        const currentBlock = await publicClient.getBlockNumber();
        const fromBlock = currentBlock - 8000n > 0n ? currentBlock - 8000n : 0n;

        const [buyLogs, sellLogs, stakeLogs, unstakeLogs] = await Promise.all([
          publicClient.getLogs({
            address: CONTRACTS.MARKET,
            event: TOKEN_BOUGHT_EVENT,
            args: { playerToken },
            fromBlock,
            toBlock: "latest",
          }),
          publicClient.getLogs({
            address: CONTRACTS.MARKET,
            event: TOKEN_SOLD_EVENT,
            args: { playerToken },
            fromBlock,
            toBlock: "latest",
          }),
          publicClient.getLogs({
            address: CONTRACTS.STAKING,
            event: STAKED_EVENT,
            fromBlock,
            toBlock: "latest",
          }),
          publicClient.getLogs({
            address: CONTRACTS.STAKING,
            event: UNSTAKED_EVENT,
            fromBlock,
            toBlock: "latest",
          }),
        ]);

        const playerStakeLogs = stakeLogs.filter(
          (log) => Number(log.args.playerId ?? -1n) === player.numericId,
        );
        const playerUnstakeLogs = unstakeLogs.filter(
          (log) => Number(log.args.playerId ?? -1n) === player.numericId,
        );

        const relevantBlockNumbers = Array.from(
          new Set(
            [...buyLogs, ...sellLogs, ...playerStakeLogs, ...playerUnstakeLogs]
              .map((log) => log.blockNumber?.toString())
              .filter(Boolean),
          ),
        ).map((blockNumber) => BigInt(blockNumber));

        const blockTimes = new Map<string, number>(
          await Promise.all(
            relevantBlockNumbers.map(async (blockNumber) => {
              const block = await publicClient.getBlock({ blockNumber });
              return [
                blockNumber.toString(),
                Number(block.timestamp) * 1000,
              ] as const;
            }),
          ),
        );

        const transactions: Transaction[] = [
          ...buyLogs.map((log) => {
            const blockKey = log.blockNumber?.toString() ?? "";
            const timestampMs = blockTimes.get(blockKey) ?? Date.now();
            return {
              id: `${log.transactionHash ?? ""}-${Number(log.logIndex ?? 0)}`,
              tx_hash: log.transactionHash ?? "",
              action: "buy",
              wallet: (log.args.buyer ?? "").toLowerCase(),
              amount: Number(log.args.amount ?? 0n),
              cost_wc: Number(formatEther(log.args.cost ?? 0n)),
              timestamp: new Date(timestampMs).toISOString(),
            };
          }),
          ...sellLogs.map((log) => {
            const blockKey = log.blockNumber?.toString() ?? "";
            const timestampMs = blockTimes.get(blockKey) ?? Date.now();
            return {
              id: `${log.transactionHash ?? ""}-${Number(log.logIndex ?? 0)}`,
              tx_hash: log.transactionHash ?? "",
              action: "sell",
              wallet: (log.args.seller ?? "").toLowerCase(),
              amount: Number(log.args.amount ?? 0n),
              cost_wc: Number(formatEther(log.args.refund ?? 0n)),
              timestamp: new Date(timestampMs).toISOString(),
            };
          }),
          ...playerStakeLogs.map((log) => {
            const blockKey = log.blockNumber?.toString() ?? "";
            const timestampMs = blockTimes.get(blockKey) ?? Date.now();
            return {
              id: `${log.transactionHash ?? ""}-${Number(log.logIndex ?? 0)}`,
              tx_hash: log.transactionHash ?? "",
              action: "stake",
              wallet: (log.args.wallet ?? "").toLowerCase(),
              amount: Number(log.args.amount ?? 0n),
              timestamp: new Date(timestampMs).toISOString(),
            };
          }),
          ...playerUnstakeLogs.map((log) => {
            const blockKey = log.blockNumber?.toString() ?? "";
            const timestampMs = blockTimes.get(blockKey) ?? Date.now();
            return {
              id: `${log.transactionHash ?? ""}-${Number(log.logIndex ?? 0)}`,
              tx_hash: log.transactionHash ?? "",
              action: "unstake",
              wallet: (log.args.wallet ?? "").toLowerCase(),
              amount: Number(log.args.amount ?? 0n),
              timestamp: new Date(timestampMs).toISOString(),
            };
          }),
        ]
          .filter((tx) => tx.wallet && tx.tx_hash)
          .sort(
            (a, b) =>
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
          );

        const history = transactions
          .filter(
            (tx) =>
              (tx.action === "buy" || tx.action === "sell") &&
              Number(tx.amount) > 0 &&
              Number(tx.cost_wc) > 0,
          )
          .map((tx) => ({
            timestamp: tx.timestamp,
            time: new Date(tx.timestamp).getTime(),
            price: Number(tx.cost_wc) / Number(tx.amount),
          }))
          .sort((a, b) => a.time - b.time);

        const holderWallets = Array.from(
          new Set([
            ...transactions.map((tx) => tx.wallet.toLowerCase()),
            ...(address ? [address.toLowerCase()] : []),
          ]),
        ).filter(Boolean);

        const holderResults = await Promise.allSettled(
          holderWallets.map(async (wallet) => {
            const amountHeld = await publicClient.readContract({
              address: CONTRACTS.MARKET,
              abi: MARKET_ABI,
              functionName: "getHoldings",
              args: [wallet as `0x${string}`, playerToken],
            });

            return {
              wallet,
              amount: Number(amountHeld),
            };
          }),
        );

        let stakedAmount = 0;
        if (address) {
          const stake = (await publicClient.readContract({
            address: CONTRACTS.STAKING,
            abi: STAKING_ABI,
            functionName: "getStake",
            args: [
              address as `0x${string}`,
              1 as unknown as number & { __brand: "uint8" },
              player.numericId as unknown as number & { __brand: "uint8" },
            ],
          })) as { amount: bigint };

          stakedAmount = Number(stake.amount ?? 0n);
        }

        if (!cancelled) {
          setRecentTransactions(transactions.slice(0, 10));
          setPriceHistory(history);
          setTopHolders(
            holderResults
              .flatMap((result) =>
                result.status === "fulfilled" && result.value.amount > 0
                  ? [result.value]
                  : [],
              )
              .sort((a, b) => b.amount - a.amount)
              .slice(0, 10),
          );
          setMyStaked(stakedAmount);
        }
      } catch (error) {
        console.error("Failed to fetch player activity:", error);
      }
    };

    fetchData();

    const pollInterval = setInterval(fetchData, 10000);

    return () => {
      cancelled = true;
      clearInterval(pollInterval);
    };
  }, [player, publicClient, address]);

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

  const currentPrice =
    currentUnitBuyPrice !== undefined
      ? parseFloat(formatEther(currentUnitBuyPrice as bigint))
      : player.price;

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
        // Add 2% of trade value to daily prize pool
        const buyValueWC = parseFloat(formatEther(buyPrice as bigint));
        const poolContribution = buyValueWC * 0.02;
        PrizePoolStorage.addToPool(poolContribution);

        // ── Sync portfolio + leaderboard to Supabase ──────────────────
        if (address) {
          const newAmount = myHoldings + amount;
          const newValueWC = newAmount * currentPrice;
          await SupabaseService.upsertPortfolioHolding(address, {
            player_id: player.numericId,
            amount: newAmount,
            value_wc: newValueWC,
          });
        }

        toast.success(
          <span>
            Bought {amount} {player.symbol}! (+{poolContribution.toFixed(4)} WC → Prize Pool){" "}
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
        // Add 2% of sell value to daily prize pool
        const sellValueWC = displaySellPrice;
        const poolContributionSell = sellValueWC * 0.02;
        PrizePoolStorage.addToPool(poolContributionSell);

        // ── Sync portfolio + leaderboard to Supabase ──────────────────
        if (address) {
          const newAmount = Math.max(0, myHoldings - amount);
          const newValueWC = newAmount * currentPrice;
          await SupabaseService.upsertPortfolioHolding(address, {
            player_id: player.numericId,
            amount: newAmount,
            value_wc: newValueWC,
          });
        }

        toast.success(
          <span>
            Sold {amount} {player.symbol}! (+{poolContributionSell.toFixed(4)} WC → Prize Pool){" "}
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

  const chartData = buildChartData(priceHistory, currentPrice);

  const CustomTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: Array<{ value: number }>;
    label?: number | string;
  }) => {
    if (active && payload && payload.length) {
      const labelValue = Number(label);
      const labelText = Number.isFinite(labelValue)
        ? tooltipDateFormatter.format(new Date(labelValue))
        : "";

      return (
        <div className="rounded-lg border border-[#2a2b3e] bg-[#1a1b2e] p-3 text-left shadow-xl">
          <p className="mb-1 font-medium text-white">{labelText}</p>
          <p className="text-[#FFD700]">
            price : {formatNumber(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
  };

  const chartPrices = chartData.map((point) => point.price);
  const minChartPrice = chartPrices.length > 0 ? Math.min(...chartPrices) : 0;
  const maxChartPrice =
    chartPrices.length > 0 ? Math.max(...chartPrices) : currentPrice;
  const yPadding = Math.max(
    (maxChartPrice - minChartPrice) * 0.2,
    maxChartPrice * 0.08,
    0.01,
  );
  const yMin = Math.max(0, minChartPrice - yPadding);
  const yMax = maxChartPrice + yPadding;

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
              {chartData.length > 0 ? (
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
                      dataKey="time"
                      type="number"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#64748b", fontSize: 12 }}
                      dy={10}
                      domain={["dataMin", "dataMax"]}
                      tickFormatter={(value) =>
                        chartTickFormatter.format(new Date(Number(value)))
                      }
                      tickCount={6}
                      minTickGap={24}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#64748b", fontSize: 12 }}
                      tickFormatter={(value) => formatNumber(Number(value))}
                      width={56}
                      dx={-10}
                      domain={[yMin, yMax]}
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
                          {tx.cost_wc && tx.amount > 0
                            ? `${formatNumber(Number(tx.cost_wc) / Number(tx.amount))} WC`
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
