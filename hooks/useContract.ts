"use client";

import { ERC20_ABI, MARKET_ABI, STAKING_ABI } from "@/config/abis";
import { CHAIN_CONFIG, CONTRACTS } from "@/config/contracts";
import { PLAYERS } from "@/config/players";
import { wagmiConfig } from "@/config/wagmi";
import { FEES } from "@/lib/constants";
import type { TradeResult } from "@/lib/types";
import { useQuery } from "@tanstack/react-query";
import { formatEther, parseEther } from "viem";
import { useReadContract, useReadContracts, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";

// ─── BUY ──────────────────────────────────────────────────────────────────────
export function useBuyTokens() {
  const { writeContractAsync } = useWriteContract();

  const buyTokens = async (
    tokenAddress: string,
    amount: number,
    buyPrice: bigint,
  ): Promise<TradeResult> => {
    if (!tokenAddress || amount <= 0) {
      throw new Error("Invalid token address or amount");
    }

    // Add slippage buffer so the contract's excess-refund handles the rest
    const slippageMultiplier = BigInt(100 + FEES.SLIPPAGE_BUFFER_PERCENT);
    const valueWithSlippage = (buyPrice * slippageMultiplier) / 100n;

    const hash = await writeContractAsync({
      address: CONTRACTS.MARKET,
      abi: MARKET_ABI,
      functionName: "buyTokens",
      args: [tokenAddress as `0x${string}`, BigInt(amount)],
      value: valueWithSlippage,
    });

    // Wait for transaction to be mined
    await waitForTransactionReceipt(wagmiConfig, { hash });

    return { txHash: hash };
  };

  return { buyTokens };
}

// ─── SELL ─────────────────────────────────────────────────────────────────────
export function useSellTokens() {
  const { writeContractAsync } = useWriteContract();

  const sellTokens = async (
    tokenAddress: string,
    amount: number,
  ): Promise<TradeResult> => {
    if (!tokenAddress || amount <= 0) {
      throw new Error("Invalid token address or amount");
    }

    // Step 1: Approve market to spend player tokens
    const approveHash = await writeContractAsync({
      address: tokenAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [CONTRACTS.MARKET, parseEther(String(amount))],
    });

    // Wait for approval to confirm before selling
    await waitForTransactionReceipt(wagmiConfig, { hash: approveHash });

    // Step 2: Sell tokens
    const hash = await writeContractAsync({
      address: CONTRACTS.MARKET,
      abi: MARKET_ABI,
      functionName: "sellTokens",
      args: [tokenAddress as `0x${string}`, BigInt(amount)],
    });

    // Wait for transaction to be mined
    await waitForTransactionReceipt(wagmiConfig, { hash });

    return { txHash: hash };
  };

  return { sellTokens };
}

// ─── STAKE ────────────────────────────────────────────────────────────────────
export function useStakeTokens() {
  const { writeContractAsync } = useWriteContract();

  const stakeTokens = async (
    tokenAddress: string,
    playerId: number,
    amount: number,
    matchId = 1,
  ): Promise<TradeResult> => {
    if (!tokenAddress || amount <= 0 || playerId < 0) {
      throw new Error("Invalid staking parameters");
    }

    // Step 1: Approve staking contract to pull tokens
    const approveHash = await writeContractAsync({
      address: tokenAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [CONTRACTS.STAKING, parseEther(String(amount))],
    });

    await waitForTransactionReceipt(wagmiConfig, { hash: approveHash });

    // Step 2: Stake for match
    const hash = await writeContractAsync({
      address: CONTRACTS.STAKING,
      abi: STAKING_ABI,
      functionName: "stakeForMatch",
      args: [
        tokenAddress as `0x${string}`,
        playerId as unknown as number & { __brand: "uint8" },
        matchId as unknown as number & { __brand: "uint8" },
        BigInt(amount),
      ],
    });

    // Wait for transaction to be mined
    await waitForTransactionReceipt(wagmiConfig, { hash });

    return { txHash: hash };
  };

  return { stakeTokens };
}

// ─── READ: Buy price ──────────────────────────────────────────────────────────
export function useGetBuyPrice(tokenAddress: string, amount: number) {
  return useReadContract({
    address: CONTRACTS.MARKET,
    abi: MARKET_ABI,
    functionName: "getBuyPrice",
    args: [tokenAddress as `0x${string}`, BigInt(amount)],
    query: { enabled: !!tokenAddress && amount > 0 },
  });
}

// ─── READ: Sell price ─────────────────────────────────────────────────────────
export function useGetSellPrice(tokenAddress: string, amount: number) {
  return useReadContract({
    address: CONTRACTS.MARKET,
    abi: MARKET_ABI,
    functionName: "getSellPrice",
    args: [tokenAddress as `0x${string}`, BigInt(amount)],
    query: { enabled: !!tokenAddress && amount > 0 },
  });
}

// ─── READ: Tokens remaining ───────────────────────────────────────────────────
export function useGetTokensRemaining(tokenAddress: string) {
  return useReadContract({
    address: CONTRACTS.MARKET,
    abi: MARKET_ABI,
    functionName: "getTokensRemaining",
    args: [tokenAddress as `0x${string}`],
    query: { enabled: !!tokenAddress },
  });
}

// ─── READ: Single wallet holdings ─────────────────────────────────────────────
export function useGetHoldings(wallet: string, tokenAddress: string) {
  return useReadContract({
    address: CONTRACTS.MARKET,
    abi: MARKET_ABI,
    functionName: "getHoldings",
    args: [wallet as `0x${string}`, tokenAddress as `0x${string}`],
    query: { enabled: !!wallet && !!tokenAddress },
  });
}

// ─── READ: Full portfolio (all 40 players batched) ───────────────────────────
export function useGetPortfolio(wallet: string) {
  const contracts = PLAYERS.map((p) => ({
    address: CONTRACTS.MARKET as `0x${string}`,
    abi: MARKET_ABI,
    functionName: "getHoldings" as const,
    args: [wallet as `0x${string}`, p.tokenAddress as `0x${string}`],
  }));

  const result = useReadContracts({
    contracts,
    query: { enabled: !!wallet },
  });

  // Map results back to player data with holding amounts
  const holdings = result.data
    ? PLAYERS.map((p, i) => ({
        player: p,
        amount: result.data?.[i]?.result
          ? Number(result.data[i].result as bigint)
          : 0,
      })).filter((h) => h.amount > 0)
    : [];

  return { holdings, isLoading: result.isLoading, isError: result.isError };
}

// ─── READ: All players' remaining tokens (for market page) ───────────────────
export function useGetAllPlayersSupply() {
  const supplyContracts = PLAYERS.map((p) => ({
    address: CONTRACTS.MARKET as `0x${string}`,
    abi: MARKET_ABI,
    functionName: "getTokensRemaining" as const,
    args: [p.tokenAddress as `0x${string}`],
  }));

  const priceContracts = PLAYERS.map((p) => ({
    address: CONTRACTS.MARKET as `0x${string}`,
    abi: MARKET_ABI,
    functionName: "getBuyPrice" as const,
    args: [p.tokenAddress as `0x${string}`, 1n],
  }));

  const result = useReadContracts({
    contracts: [...supplyContracts, ...priceContracts],
    query: {
      refetchInterval: 3000, // Refetch every 3 seconds
      staleTime: 0,
    },
  });

  // Map results back to player data with remaining supply
  const playersWithSupply = result.data
    ? PLAYERS.map((p, i) => {
        const supplyResult = result.data[i]?.result;
        const priceResult = result.data[i + PLAYERS.length]?.result;
        return {
          ...p,
          supply:
            supplyResult !== undefined
              ? Number(supplyResult as bigint)
              : p.supply,
          price:
            priceResult !== undefined
              ? Number(formatEther(priceResult as bigint))
              : p.price,
        };
      })
    : PLAYERS;
  return {
    players: playersWithSupply,
    isLoading: result.isLoading,
    isError: result.isError,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function getExplorerUrl(txHash: string) {
  return `${CHAIN_CONFIG.explorerUrl}/tx/${txHash}`;
}

export { formatEther };

// ─── PRIZE POOL ───────────────────────────────────────────────────────────────
export function useGetPrizePool() {
  const { data: currentSeason } = useReadContract({
    address: CONTRACTS.PRIZE_POOL,
    abi: [
      {
        inputs: [],
        name: "currentSeason",
        outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
        stateMutability: "view",
        type: "function",
      },
    ],
    functionName: "currentSeason",
  });

  const { data: seasonData } = useReadContract({
    address: CONTRACTS.PRIZE_POOL,
    abi: [
      {
        inputs: [{ internalType: "uint8", name: "", type: "uint8" }],
        name: "seasons",
        outputs: [
          { internalType: "uint256", name: "matchPool", type: "uint256" },
          { internalType: "uint256", name: "seasonPool", type: "uint256" },
          { internalType: "uint256", name: "platformFee", type: "uint256" },
          { internalType: "uint256", name: "totalFees", type: "uint256" },
          { internalType: "bool", name: "seasonDistributed", type: "bool" },
        ],
        stateMutability: "view",
        type: "function",
      },
    ],
    functionName: "seasons",
    args: currentSeason ? [currentSeason as number] : undefined,
    query: {
      enabled: !!currentSeason,
    },
  });

  return {
    matchPool: seasonData
      ? Number(formatEther((seasonData as any)[0] as bigint))
      : 0,
    seasonPool: seasonData
      ? Number(formatEther((seasonData as any)[1] as bigint))
      : 0,
    currentSeason: currentSeason ? Number(currentSeason) : 1,
  };
}

// ─── SUPABASE ─────────────────────────────────────────────────────────────────
import { LIMITS } from "@/lib/constants";
import { SupabaseService } from "@/lib/services/supabase.service";

export function useLeaderboard() {
  return useQuery({
    queryKey: ["leaderboard"],
    queryFn: () => SupabaseService.getLeaderboard(LIMITS.LEADERBOARD_TOP_N),
    staleTime: 0, // Always consider data stale
    refetchOnMount: "always", // Always refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when window regains focus
    refetchInterval: 3000, // Refetch every 3 seconds
    retry: 2,
  });
}

export function useDatabasePortfolio(wallet: string) {
  return useQuery({
    queryKey: ["portfolioDb", wallet],
    queryFn: () => SupabaseService.getPortfolio(wallet),
    enabled: !!wallet,
    staleTime: 0, // Always consider data stale
    refetchOnMount: "always", // Always refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when window regains focus
    refetchInterval: 3000, // Refetch every 3 seconds
    retry: 2,
  });
}
