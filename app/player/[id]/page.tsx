'use client';

import { PLAYERS, TEAM_COLORS } from '@/config/players';
import {
    getExplorerUrl,
    useBuyTokens,
    useGetBuyPrice,
    useGetHoldings,
    useGetSellPrice,
    useGetTokensRemaining,
    useSellTokens,
    useStakeTokens,
} from '@/hooks/useContract';
import { formatNumber } from '@/utils/format';
import { supabase } from '@/utils/supabase/client';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { formatEther } from 'viem';
import { useAccount } from 'wagmi';

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

  const [tab, setTab] = useState<'BUY' | 'SELL' | 'STAKE'>('BUY');
  const [amount, setAmount] = useState(1);
  const [loading, setLoading] = useState(false);

  // Real-time data from Supabase
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [topHolders, setTopHolders] = useState<TopHolder[]>([]);
  const [priceHistory, setPriceHistory] = useState<PriceHistoryPoint[]>([]);
  const [myStaked, setMyStaked] = useState(0);

  const { address, isConnected } = useAccount();

  // On-chain reads
  const { data: remaining, isLoading: remainingLoading } =
    useGetTokensRemaining(player?.tokenAddress ?? '');
  const { data: buyPrice, isLoading: buyPriceLoading } =
    useGetBuyPrice(player?.tokenAddress ?? '', amount);
  const { data: sellPrice, isLoading: sellPriceLoading } =
    useGetSellPrice(player?.tokenAddress ?? '', amount);
  const { data: holdings } = useGetHoldings(
    address ?? '',
    player?.tokenAddress ?? '',
  );

  // Write hooks
  const { buyTokens } = useBuyTokens();
  const { sellTokens } = useSellTokens();
  const { stakeTokens } = useStakeTokens();

  // Fetch real-time data from Supabase
  useEffect(() => {
    if (!player) return;

    const fetchData = async () => {
      // Fetch recent transactions for this player
      const { data: txData } = await supabase
        .from('transactions')
        .select('*')
        .eq('player_id', player.numericId)
        .order('timestamp', { ascending: false })
        .limit(10);

      if (txData) setRecentTransactions(txData);

      // Fetch price history (last 30 days)
      const { data: priceData } = await supabase
        .from('transactions')
        .select('timestamp, cost_wc, amount')
        .eq('player_id', player.numericId)
        .in('action', ['buy', 'sell'])
        .not('cost_wc', 'is', null)
        .not('amount', 'is', null)
        .order('timestamp', { ascending: true })
        .limit(100);

      if (priceData) {
        const history = priceData
          .filter((tx) => tx.cost_wc && tx.amount)
          .map((tx) => ({
            timestamp: tx.timestamp,
            price: Number(tx.cost_wc) / Number(tx.amount),
          }));
        setPriceHistory(history);
      }

      // Calculate top holders from portfolio cache
      const { data: portfolios } = await supabase
        .from('portfolio_cache')
        .select('wallet, holdings');

      if (portfolios) {
        const holders: Record<string, number> = {};
        
        portfolios.forEach((p) => {
          const holdings = p.holdings as Array<{ player_id: number; amount: number }>;
          holdings.forEach((h) => {
            if (h.player_id === player.numericId) {
              holders[p.wallet] = (holders[p.wallet] || 0) + h.amount;
            }
          });
        });

        const topHoldersList = Object.entries(holders)
          .map(([wallet, amount]) => ({ wallet, amount }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 10);

        setTopHolders(topHoldersList);
      }

      // Fetch user's staked amount
      if (address) {
        const { data: stakingData } = await supabase
          .from('staking_positions')
          .select('amount')
          .eq('wallet', address.toLowerCase())
          .eq('player_id', player.numericId)
          .eq('is_active', true);

        if (stakingData) {
          const totalStaked = stakingData.reduce((sum, pos) => sum + Number(pos.amount), 0);
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
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `player_id=eq.${player.numericId}`,
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    const portfolioChannel = supabase
      .channel(`player-${player.numericId}-portfolio`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'portfolio_cache',
        },
        () => {
          fetchData();
        }
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

  // Calculate current price from recent transactions
  const currentPrice = priceHistory.length > 0 
    ? priceHistory[priceHistory.length - 1].price 
    : displayBuyPrice;

  // Format time ago
  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  // Get action color
  const getActionColor = (action: string) => {
    switch (action) {
      case 'buy': return 'text-green-500';
      case 'sell': return 'text-red-500';
      case 'stake': return 'text-purple-500';
      default: return 'text-muted-foreground';
    }
  };

  // Get action label
  const getActionLabel = (action: string) => {
    switch (action) {
      case 'buy': return 'Buy';
      case 'sell': return 'Sell';
      case 'stake': return 'Stake';
      case 'unstake': return 'Unstake';
      case 'claim_rewards': return 'Claim';
      default: return action;
    }
  };

  const handleAction = async () => {
    if (!isConnected) {
      toast.error('Connect your wallet first.');
      return;
    }
    setLoading(true);
    try {
      let result: { txHash: string };

      if (tab === 'BUY') {
        if (!buyPrice) throw new Error('Could not fetch buy price');
        result = await buyTokens(player.tokenAddress, amount, buyPrice as bigint);
        toast.success(
          <span>
            Bought {amount} {player.symbol}!{' '}
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
      } else if (tab === 'SELL') {
        if (myHoldings < amount) throw new Error('Insufficient holdings');
        result = await sellTokens(player.tokenAddress, amount);
        toast.success(
          <span>
            Sold {amount} {player.symbol}!{' '}
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
        if (myHoldings < amount) throw new Error('Not enough tokens to stake');
        result = await stakeTokens(
          player.tokenAddress,
          player.numericId,
          amount,
          1, // matchId = 1 (hackathon default)
        );
        toast.success(
          <span>
            Staked {amount} {player.symbol} for Match 1!{' '}
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
        err instanceof Error ? err.message : 'Transaction failed. Try again.';
      // Surface user-friendly messages for common revert reasons
      if (msg.includes('Exceeds 10 token wallet cap')) {
        toast.error('Wallet cap hit: max 10 tokens per player.');
      } else if (msg.includes('Exceeds supply')) {
        toast.error('Token sold out!');
      } else if (msg.includes('Insufficient holdings')) {
        toast.error('You don\'t hold enough tokens to sell.');
      } else if (msg.includes('rejected') || msg.includes('denied')) {
        toast.error('Transaction rejected by wallet.');
      } else {
        toast.error(msg);
      }
    }
    setLoading(false);
  };

  return (
    <div className="container mx-auto px-4 py-8 animate-in fade-in duration-500">
      {/* Hero */}
      <div className="mb-8 flex flex-wrap items-center gap-6">
        <div
          className="flex h-24 w-24 items-center justify-center rounded-full text-3xl font-bold ring-2"
          style={{
            background: `linear-gradient(135deg, ${colors.from}, ${colors.to})`,
            color: 'white',
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
            {player.tier === 'Legend' && (
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
                <svg className="w-full h-full" viewBox="0 0 600 200" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="priceGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor={colors.from} stopOpacity="0.3" />
                      <stop offset="100%" stopColor={colors.from} stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {/* Price line */}
                  <polyline
                    fill="url(#priceGradient)"
                    stroke={colors.from}
                    strokeWidth="2"
                    points={priceHistory
                      .map((point, i) => {
                        const x = (i / (priceHistory.length - 1)) * 600;
                        const minPrice = Math.min(...priceHistory.map(p => p.price));
                        const maxPrice = Math.max(...priceHistory.map(p => p.price));
                        const priceRange = maxPrice - minPrice || 1;
                        const y = 180 - ((point.price - minPrice) / priceRange) * 160;
                        return `${x},${y}`;
                      })
                      .join(' ') + ' 600,200 0,200'}
                  />
                  <polyline
                    fill="none"
                    stroke={colors.from}
                    strokeWidth="3"
                    points={priceHistory
                      .map((point, i) => {
                        const x = (i / (priceHistory.length - 1)) * 600;
                        const minPrice = Math.min(...priceHistory.map(p => p.price));
                        const maxPrice = Math.max(...priceHistory.map(p => p.price));
                        const priceRange = maxPrice - minPrice || 1;
                        const y = 180 - ((point.price - minPrice) / priceRange) * 160;
                        return `${x},${y}`;
                      })
                      .join(' ')}
                  />
                  {/* Hover point */}
                  {priceHistory.length > 0 && (
                    <circle
                      cx={600}
                      cy={180 - ((priceHistory[priceHistory.length - 1].price - Math.min(...priceHistory.map(p => p.price))) / (Math.max(...priceHistory.map(p => p.price)) - Math.min(...priceHistory.map(p => p.price)) || 1)) * 160}
                      r="4"
                      fill={colors.from}
                    />
                  )}
                </svg>
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  No price history available
                </div>
              )}
              {priceHistory.length > 0 && (
                <div className="absolute bottom-4 right-4 rounded-lg bg-background/80 backdrop-blur-sm px-3 py-2 text-sm">
                  <div className="text-xs text-muted-foreground">Latest</div>
                  <div className="font-bold text-foreground">
                    price: {formatNumber(priceHistory[priceHistory.length - 1].price)}
                  </div>
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
                    <th className="pb-2 text-left text-xs text-muted-foreground">Wallet</th>
                    <th className="pb-2 text-left text-xs text-muted-foreground">Action</th>
                    <th className="pb-2 text-right text-xs text-muted-foreground">Amount</th>
                    <th className="pb-2 text-right text-xs text-muted-foreground">Price</th>
                    <th className="pb-2 text-right text-xs text-muted-foreground">Time</th>
                    <th className="pb-2 text-right text-xs text-muted-foreground">Tx</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTransactions.length > 0 ? (
                    recentTransactions.map((tx) => (
                      <tr key={tx.id} className="border-b border-border/50">
                        <td className="py-3 font-mono text-xs text-yellow-500">
                          {tx.wallet.slice(0, 6)}...{tx.wallet.slice(-4)}
                        </td>
                        <td className={`py-3 font-semibold capitalize ${getActionColor(tx.action)}`}>
                          {getActionLabel(tx.action)}
                        </td>
                        <td className="py-3 text-right">{tx.amount || '-'}</td>
                        <td className="py-3 text-right">
                          {tx.cost_wc ? `${formatNumber(Number(tx.cost_wc))} WC` : '-'}
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
                      <td colSpan={6} className="py-8 text-center text-muted-foreground">
                        No transactions yet
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
                          <span className="text-muted-foreground w-6">{index + 1}</span>
                          <span className="font-mono text-xs text-yellow-500">
                            {holder.wallet.slice(0, 6)}...{holder.wallet.slice(-4)}
                          </span>
                        </div>
                        <span className="font-semibold text-foreground">{holder.amount}</span>
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
                <div className="py-8 text-center text-muted-foreground">
                  No holders yet
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Trading Panel */}
        <div className="card-surface rounded-xl p-5 h-fit sticky top-4">
          {/* Tabs */}
          <div className="mb-4 flex rounded-lg bg-muted p-1">
            {(['BUY', 'SELL', 'STAKE'] as const).map((t) => (
              <button
                key={t}
                id={`tab-${t.toLowerCase()}`}
                onClick={() => {
                  setTab(t);
                  setAmount(1);
                }}
                className={`flex-1 rounded-md py-2 text-sm font-semibold transition-colors ${
                  tab === t
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Amount (Max {tab === 'BUY' ? '10' : myHoldings} per wallet, enforced on-chain)
              </label>
              <input
                id="amount-input"
                type="number"
                min={1}
                max={tab === 'SELL' || tab === 'STAKE' ? myHoldings : 10}
                value={amount}
                onChange={(e) =>
                  setAmount(Math.max(1, parseInt(e.target.value) || 1))
                }
                className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                <span>Min: 1</span>
                <span>Max: {tab === 'BUY' ? '10' : myHoldings}</span>
              </div>
            </div>

            {tab === 'BUY' && (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">You pay:</span>
                  <span className="text-foreground font-semibold">
                    {buyPriceLoading ? '…' : `${formatNumber(displayBuyPrice)} WC`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Platform fee (2%):</span>
                  <span className="text-foreground">
                    {buyPriceLoading ? '…' : `${formatNumber(fee)} WC`}
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

            {tab === 'SELL' && (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">You receive:</span>
                  <span className="text-green-500 font-semibold">
                    {sellPriceLoading
                      ? '…'
                      : `${formatNumber(displaySellPrice)} WC`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Holdings:</span>
                  <span className="text-foreground">{myHoldings} tokens</span>
                </div>
              </div>
            )}

            {tab === 'STAKE' && (
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
                ? tab === 'SELL'
                  ? 'Approving & Selling…'
                  : tab === 'STAKE'
                  ? 'Approving & Staking…'
                  : 'Buying…'
                : `${tab} ${amount} ${amount === 1 ? 'TOKEN' : 'TOKENS'}`}
            </button>

            <p className="text-[11px] text-muted-foreground text-center">
              {tab === 'SELL'
                ? 'Sell requires 2 wallet signatures (approve + sell).'
                : tab === 'STAKE'
                ? 'Stake requires 2 wallet signatures (approve + stake).'
                : 'Excess WC auto-refunded by contract.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
