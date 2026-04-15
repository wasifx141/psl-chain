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
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
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

function buildChartData(history: PriceHistoryPoint[], currentPrice: number) {
  const now = Date.now();
  const start = now - THIRTY_DAYS_MS;
  const sorted = [...history].sort((a, b) => a.time - b.time);
  const visible = sorted.filter((point) => point.time >= start && point.time <= now);
  const previous = [...sorted].reverse().find((point) => point.time < start);
  const fallback = currentPrice > 0 ? currentPrice : sorted.at(-1)?.price ?? 0;
  const seed = previous?.price ?? visible[0]?.price ?? fallback;

  return [
    { timestamp: new Date(start).toISOString(), time: start, price: seed },
    ...visible,
    { timestamp: new Date(now).toISOString(), time: now, price: fallback || seed },
  ];
}

export default function PlayerDetail() {
  const params = useParams();
  const id = params.id as string;
  const player = PLAYERS.find((entry) => entry.id === id);

  const [tab, setTab] = useState<"BUY" | "SELL" | "STAKE">("BUY");
  const [amount, setAmount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [topHolders, setTopHolders] = useState<TopHolder[]>([]);
  const [priceHistory, setPriceHistory] = useState<PriceHistoryPoint[]>([]);
  const [myStaked, setMyStaked] = useState(0);

  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();

  const { data: remaining } = useGetTokensRemaining(player?.tokenAddress ?? "");
  const { data: currentUnitBuyPrice } = useGetBuyPrice(player?.tokenAddress ?? "", 1);
  const { data: buyPrice, isLoading: buyPriceLoading } = useGetBuyPrice(
    player?.tokenAddress ?? "",
    amount,
  );
  const { data: sellPrice, isLoading: sellPriceLoading } = useGetSellPrice(
    player?.tokenAddress ?? "",
    amount,
  );
  const { data: holdings } = useGetHoldings(address ?? "", player?.tokenAddress ?? "");

  const { buyTokens } = useBuyTokens();
  const { sellTokens } = useSellTokens();
  const { stakeTokens } = useStakeTokens();

  useEffect(() => {
    if (!player || !publicClient || !player.tokenAddress) return;
    let cancelled = false;
    const playerToken = player.tokenAddress as `0x${string}`;

    const fetchData = async () => {
      try {
        const currentBlock = await publicClient.getBlockNumber();
        const fromBlock = currentBlock - 8000n > 0n ? currentBlock - 8000n : 0n;
        const [buyLogs, sellLogs, stakeLogs, unstakeLogs] = await Promise.all([
          publicClient.getLogs({ address: CONTRACTS.MARKET, event: TOKEN_BOUGHT_EVENT, args: { playerToken }, fromBlock, toBlock: "latest" }),
          publicClient.getLogs({ address: CONTRACTS.MARKET, event: TOKEN_SOLD_EVENT, args: { playerToken }, fromBlock, toBlock: "latest" }),
          publicClient.getLogs({ address: CONTRACTS.STAKING, event: STAKED_EVENT, fromBlock, toBlock: "latest" }),
          publicClient.getLogs({ address: CONTRACTS.STAKING, event: UNSTAKED_EVENT, fromBlock, toBlock: "latest" }),
        ]);

        const playerStakeLogs = stakeLogs.filter((log) => Number(log.args.playerId ?? -1n) === player.numericId);
        const playerUnstakeLogs = unstakeLogs.filter((log) => Number(log.args.playerId ?? -1n) === player.numericId);
        const blockNumbers = Array.from(new Set([...buyLogs, ...sellLogs, ...playerStakeLogs, ...playerUnstakeLogs].map((log) => log.blockNumber?.toString()).filter(Boolean))).map((value) => BigInt(value));
        const blockTimes = new Map<string, number>(
          await Promise.all(
            blockNumbers.map(async (blockNumber) => {
              const block = await publicClient.getBlock({ blockNumber });
              return [blockNumber.toString(), Number(block.timestamp) * 1000] as const;
            }),
          ),
        );

        const transactions: Transaction[] = [
          ...buyLogs.map((log) => ({ id: `${log.transactionHash ?? ""}-${Number(log.logIndex ?? 0)}`, tx_hash: log.transactionHash ?? "", action: "buy", wallet: (log.args.buyer ?? "").toLowerCase(), amount: Number(log.args.amount ?? 0n), cost_wc: Number(formatEther(log.args.cost ?? 0n)), timestamp: new Date(blockTimes.get(log.blockNumber?.toString() ?? "") ?? Date.now()).toISOString() })),
          ...sellLogs.map((log) => ({ id: `${log.transactionHash ?? ""}-${Number(log.logIndex ?? 0)}`, tx_hash: log.transactionHash ?? "", action: "sell", wallet: (log.args.seller ?? "").toLowerCase(), amount: Number(log.args.amount ?? 0n), cost_wc: Number(formatEther(log.args.refund ?? 0n)), timestamp: new Date(blockTimes.get(log.blockNumber?.toString() ?? "") ?? Date.now()).toISOString() })),
          ...playerStakeLogs.map((log) => ({ id: `${log.transactionHash ?? ""}-${Number(log.logIndex ?? 0)}`, tx_hash: log.transactionHash ?? "", action: "stake", wallet: (log.args.wallet ?? "").toLowerCase(), amount: Number(log.args.amount ?? 0n), timestamp: new Date(blockTimes.get(log.blockNumber?.toString() ?? "") ?? Date.now()).toISOString() })),
          ...playerUnstakeLogs.map((log) => ({ id: `${log.transactionHash ?? ""}-${Number(log.logIndex ?? 0)}`, tx_hash: log.transactionHash ?? "", action: "unstake", wallet: (log.args.wallet ?? "").toLowerCase(), amount: Number(log.args.amount ?? 0n), timestamp: new Date(blockTimes.get(log.blockNumber?.toString() ?? "") ?? Date.now()).toISOString() })),
        ]
          .filter((transaction) => transaction.wallet && transaction.tx_hash)
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        const history = transactions
          .filter((transaction) => (transaction.action === "buy" || transaction.action === "sell") && transaction.amount > 0 && Number(transaction.cost_wc) > 0)
          .map((transaction) => ({ timestamp: transaction.timestamp, time: new Date(transaction.timestamp).getTime(), price: Number(transaction.cost_wc) / transaction.amount }))
          .sort((a, b) => a.time - b.time);

        const holderWallets = Array.from(new Set([...transactions.map((transaction) => transaction.wallet.toLowerCase()), ...(address ? [address.toLowerCase()] : [])])).filter(Boolean);
        const holderResults = await Promise.allSettled(
          holderWallets.map(async (wallet) => {
            const amountHeld = await publicClient.readContract({ address: CONTRACTS.MARKET, abi: MARKET_ABI, functionName: "getHoldings", args: [wallet as `0x${string}`, playerToken] });
            return { wallet, amount: Number(amountHeld) };
          }),
        );

        let stakedAmount = 0;
        if (address) {
          const stake = (await publicClient.readContract({
            address: CONTRACTS.STAKING,
            abi: STAKING_ABI,
            functionName: "getStake",
            args: [address as `0x${string}`, 1 as unknown as number & { __brand: "uint8" }, player.numericId as unknown as number & { __brand: "uint8" }],
          })) as { amount: bigint };
          stakedAmount = Number(stake.amount ?? 0n);
        }

        if (!cancelled) {
          setRecentTransactions(transactions.slice(0, 10));
          setPriceHistory(history);
          setTopHolders(holderResults.flatMap((result) => result.status === "fulfilled" && result.value.amount > 0 ? [result.value] : []).sort((a, b) => b.amount - a.amount).slice(0, 10));
          setMyStaked(stakedAmount);
        }
      } catch (error) {
        console.error("Failed to fetch player activity:", error);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [player, publicClient, address]);

  if (!player) {
    return <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">Player not found</div>;
  }

  const colors = TEAM_COLORS[player.team];
  const supplyRemaining = remaining !== undefined ? Number(remaining) : player.supply;
  const myHoldings = holdings !== undefined ? Number(holdings) : 0;
  const displayBuyPrice = buyPrice !== undefined ? parseFloat(formatEther(buyPrice as bigint)) : player.price * amount;
  const displaySellPrice = sellPrice !== undefined ? parseFloat(formatEther(sellPrice as bigint)) : player.price * amount * 0.98;
  const fee = displayBuyPrice * 0.02;
  const currentPrice = currentUnitBuyPrice !== undefined ? parseFloat(formatEther(currentUnitBuyPrice as bigint)) : player.price;
  const formatTimeAgo = (timestamp: string) => {
    const diffMs = Date.now() - new Date(timestamp).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };
  const getActionColor = (action: string) => action === "buy" ? "text-green-500" : action === "sell" ? "text-red-500" : action === "stake" ? "text-purple-500" : "text-muted-foreground";
  const getActionLabel = (action: string) => action === "buy" ? "Buy" : action === "sell" ? "Sell" : action === "stake" ? "Stake" : action === "unstake" ? "Unstake" : action;

  async function handleAction() {
    if (!player) return;
    if (!isConnected) {
      toast.error("Connect your wallet first.");
      return;
    }
    setLoading(true);
    try {
      let result: { txHash: string };
      if (tab === "BUY") {
        if (!buyPrice) throw new Error("Could not fetch buy price");
        result = await buyTokens(player.tokenAddress, amount, buyPrice as bigint);
        const contribution = parseFloat(formatEther(buyPrice as bigint)) * 0.02;
        PrizePoolStorage.addToPool(contribution);
        if (address) {
          const newAmount = myHoldings + amount;
          await SupabaseService.upsertPortfolioHolding(address, { player_id: player.numericId, amount: newAmount, value_wc: newAmount * currentPrice });
        }
        toast.success(<span>Bought {amount} {player.symbol}. (+{contribution.toFixed(4)} WC to Prize Pool) <a href={getExplorerUrl(result.txHash)} target="_blank" rel="noreferrer" className="underline">View tx</a></span>);
      } else if (tab === "SELL") {
        if (myHoldings < amount) throw new Error("Insufficient holdings");
        result = await sellTokens(player.tokenAddress, amount);
        const contribution = displaySellPrice * 0.02;
        PrizePoolStorage.addToPool(contribution);
        if (address) {
          const newAmount = Math.max(0, myHoldings - amount);
          await SupabaseService.upsertPortfolioHolding(address, { player_id: player.numericId, amount: newAmount, value_wc: newAmount * currentPrice });
        }
        toast.success(<span>Sold {amount} {player.symbol}. (+{contribution.toFixed(4)} WC to Prize Pool) <a href={getExplorerUrl(result.txHash)} target="_blank" rel="noreferrer" className="underline">View tx</a></span>);
      } else {
        if (myHoldings < amount) throw new Error("Not enough tokens to stake");
        result = await stakeTokens(player.tokenAddress, player.numericId, amount, 1);
        toast.success(<span>Staked {amount} {player.symbol} for Match 1. <a href={getExplorerUrl(result.txHash)} target="_blank" rel="noreferrer" className="underline">View tx</a></span>);
      }
      setTimeout(() => window.location.reload(), 2000);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Transaction failed. Try again.";
      if (message.includes("Exceeds 10 token wallet cap")) toast.error("Wallet cap hit: max 10 tokens per player.");
      else if (message.includes("Exceeds supply")) toast.error("Token sold out.");
      else if (message.includes("Insufficient holdings")) toast.error("You do not hold enough tokens to sell.");
      else if (message.includes("rejected") || message.includes("denied")) toast.error("Transaction rejected by wallet.");
      else toast.error(message);
    }
    setLoading(false);
  }

  const chartData = buildChartData(priceHistory, currentPrice);
  const chartPrices = chartData.map((point) => point.price);
  const minChartPrice = chartPrices.length > 0 ? Math.min(...chartPrices) : 0;
  const maxChartPrice = chartPrices.length > 0 ? Math.max(...chartPrices) : currentPrice;
  const yPadding = Math.max((maxChartPrice - minChartPrice) * 0.2, maxChartPrice * 0.08, 0.01);
  const yMin = Math.max(0, minChartPrice - yPadding);
  const yMax = maxChartPrice + yPadding;

  return (
    <div className="container mx-auto max-w-7xl px-4 py-6 animate-in fade-in duration-500 sm:py-8">
      <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-center">
        <div
          className="flex h-20 w-20 items-center justify-center rounded-full text-2xl font-bold ring-2 sm:h-24 sm:w-24 sm:text-3xl"
          style={{
            background: `linear-gradient(135deg, ${colors.from}, ${colors.to})`,
            color: "white",
            boxShadow: `0 0 0 3px ${colors.border}40`,
          }}
        >
          {player.initials}
        </div>
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-bold text-foreground sm:text-4xl">
            {player.name}
          </h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <span
              className="rounded-full px-3 py-1 text-xs font-medium"
              style={{ backgroundColor: `${colors.from}22`, color: colors.from }}
            >
              {player.teamName}
            </span>
            <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
              {player.role}
            </span>
            {player.tier === "Legend" ? (
              <span className="rounded-full bg-yellow-500/20 px-3 py-1 text-xs text-yellow-500">
                Legend
              </span>
            ) : null}
          </div>
        </div>
      </div>

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
          <p className="mt-1 text-xl font-bold text-foreground">{myHoldings} tokens</p>
        </div>
        <div className="card-surface rounded-xl p-4">
          <p className="text-xs text-muted-foreground">My Staked</p>
          <p className="mt-1 text-xl font-bold text-foreground">{myStaked} tokens</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
        <div className="order-2 space-y-6 lg:order-1">
          <div className="card-surface rounded-xl p-4 sm:p-6">
            <h3 className="mb-4 font-display text-lg font-semibold text-foreground">
              30-Day Price History
            </h3>
            <div className="relative h-56 w-full sm:h-64">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 20, right: 16, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id={`priceGradient-${player.id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={colors.from} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={colors.from} stopOpacity={0} />
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
                      tickFormatter={(value) => chartTickFormatter.format(new Date(Number(value)))}
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
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        const labelValue = Number(label);
                        return (
                          <div className="rounded-lg border border-[#2a2b3e] bg-[#1a1b2e] p-3 text-left shadow-xl">
                            <p className="mb-1 font-medium text-white">
                              {Number.isFinite(labelValue)
                                ? tooltipDateFormatter.format(new Date(labelValue))
                                : ""}
                            </p>
                            <p className="text-[#FFD700]">
                              Price: {formatNumber(payload[0].value as number)} WC
                            </p>
                          </div>
                        );
                      }}
                      cursor={{ stroke: "rgba(255,255,255,0.2)", strokeWidth: 1 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="price"
                      stroke={colors.from}
                      strokeWidth={2}
                      fillOpacity={1}
                      fill={`url(#priceGradient-${player.id})`}
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

          <div className="card-surface rounded-xl p-4 sm:p-6">
            <h3 className="mb-4 font-display text-lg font-semibold text-foreground">
              Recent Transactions
            </h3>
            {recentTransactions.length > 0 ? (
              <div className="space-y-3">
                {recentTransactions.map((transaction) => (
                  <div key={transaction.id} className="rounded-xl border border-border/60 bg-muted/20 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-xs text-yellow-500">
                          {transaction.wallet.slice(0, 6)}...{transaction.wallet.slice(-4)}
                        </p>
                        <p className={`mt-1 text-sm font-semibold ${getActionColor(transaction.action)}`}>
                          {getActionLabel(transaction.action)}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatTimeAgo(transaction.timestamp)}
                      </p>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Amount</p>
                        <p className="mt-1 font-medium text-foreground">{transaction.amount || "-"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Unit Price</p>
                        <p className="mt-1 font-medium text-foreground">
                          {transaction.cost_wc && transaction.amount > 0
                            ? `${formatNumber(transaction.cost_wc / transaction.amount)} WC`
                            : "-"}
                        </p>
                      </div>
                    </div>
                    <a
                      href={getExplorerUrl(transaction.tx_hash)}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-flex text-xs font-medium text-primary hover:underline"
                    >
                      View transaction
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center">
                <p className="text-muted-foreground">No transactions yet</p>
                <p className="mt-1 text-xs text-muted-foreground/70">
                  Be the first to trade {player.symbol}.
                </p>
              </div>
            )}
          </div>

          <div className="card-surface rounded-xl p-4 sm:p-6">
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
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="w-6 text-muted-foreground">{index + 1}</span>
                          <span className="truncate font-mono text-xs text-yellow-500">
                            {holder.wallet.slice(0, 6)}...{holder.wallet.slice(-4)}
                          </span>
                        </div>
                        <span className="font-semibold text-foreground">{holder.amount}</span>
                      </div>
                      <div className="h-8 w-full overflow-hidden rounded-lg bg-muted">
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
                  <p className="text-muted-foreground">No holders yet</p>
                  <p className="mt-1 text-xs text-muted-foreground/70">
                    Buy tokens to become the first holder.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="order-1 h-fit rounded-xl card-surface p-5 lg:order-2 lg:sticky lg:top-24">
          <div className="mb-4 flex rounded-lg bg-muted p-1">
            {(["BUY", "SELL", "STAKE"] as const).map((value) => (
              <button
                key={value}
                onClick={() => {
                  setTab(value);
                  setAmount(1);
                }}
                className={`flex-1 rounded-md py-2 text-sm font-semibold transition-colors ${
                  tab === value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {value}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                Amount (Max {tab === "BUY" ? "10" : myHoldings} per wallet, enforced on-chain)
              </label>
              <input
                type="number"
                min={1}
                max={tab === "SELL" || tab === "STAKE" ? myHoldings : 10}
                value={amount}
                onChange={(event) => setAmount(Math.max(1, parseInt(event.target.value, 10) || 1))}
                className="w-full rounded-lg border border-border bg-background px-4 py-3 text-lg font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {tab === "BUY" ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">You pay:</span>
                  <span className="font-semibold text-foreground">
                    {buyPriceLoading ? "..." : `${formatNumber(displayBuyPrice)} WC`}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Platform fee (2%):</span>
                  <span className="text-foreground">
                    {buyPriceLoading ? "..." : `${formatNumber(fee)} WC`}
                  </span>
                </div>
                <div className="flex justify-between gap-3 border-t border-border pt-2 font-semibold">
                  <span className="text-foreground">You receive:</span>
                  <span className="text-primary">{amount} {player.symbol}</span>
                </div>
              </div>
            ) : null}

            {tab === "SELL" ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">You receive:</span>
                  <span className="font-semibold text-green-500">
                    {sellPriceLoading ? "..." : `${formatNumber(displaySellPrice)} WC`}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Holdings:</span>
                  <span className="text-foreground">{myHoldings} tokens</span>
                </div>
              </div>
            ) : null}

            {tab === "STAKE" ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Staking for:</span>
                  <span className="text-foreground">Match #1</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Holdings:</span>
                  <span className="text-foreground">{myHoldings} tokens</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Already staked:</span>
                  <span className="text-foreground">{myStaked} tokens</span>
                </div>
              </div>
            ) : null}

            {!isConnected ? (
              <p className="rounded-lg bg-yellow-500/10 py-2 text-center text-xs text-yellow-500">
                Connect your wallet to trade
              </p>
            ) : null}

            <button
              onClick={handleAction}
              disabled={loading || !isConnected}
              className="w-full rounded-lg bg-gold-gradient py-3 font-semibold text-primary-foreground transition-all hover:brightness-90 disabled:opacity-50"
            >
              {loading
                ? tab === "SELL"
                  ? "Approving and Selling..."
                  : tab === "STAKE"
                  ? "Approving and Staking..."
                  : "Buying..."
                : `${tab} ${amount} ${amount === 1 ? "TOKEN" : "TOKENS"}`}
            </button>

            <p className="text-center text-[11px] text-muted-foreground">
              {tab === "SELL"
                ? "Sell requires 2 wallet signatures (approve + sell)."
                : tab === "STAKE"
                ? "Stake requires 2 wallet signatures (approve + stake)."
                : "Excess WC is auto-refunded by the contract."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
