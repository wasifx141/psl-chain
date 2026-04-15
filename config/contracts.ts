import { MARKET_ABI, STAKING_ABI } from "@/config/abis";

// ─── Load deployments from environment variables or file ─────────────────────

interface Deployments {
  prizePool: string;
  stakingContract: string;
  oracle: string;
  championNFT: string;
  marketContract: string;
  playerTokenFactory: string;
  playerTokens: Record<string, string>;
}

function loadDeployments(): Deployments {
  // Try environment variables first (for Vercel/production)
  if (process.env.NEXT_PUBLIC_PRIZE_POOL_ADDRESS) {
    return {
      prizePool: process.env.NEXT_PUBLIC_PRIZE_POOL_ADDRESS,
      stakingContract: process.env.NEXT_PUBLIC_STAKING_CONTRACT_ADDRESS || "0x0000000000000000000000000000000000000000",
      oracle: process.env.NEXT_PUBLIC_ORACLE_ADDRESS || "0x0000000000000000000000000000000000000000",
      championNFT: process.env.NEXT_PUBLIC_CHAMPION_NFT_ADDRESS || "0x0000000000000000000000000000000000000000",
      marketContract: process.env.NEXT_PUBLIC_MARKET_CONTRACT_ADDRESS || "0x0000000000000000000000000000000000000000",
      playerTokenFactory: process.env.NEXT_PUBLIC_PLAYER_TOKEN_FACTORY_ADDRESS || "0x0000000000000000000000000000000000000000",
      playerTokens: JSON.parse(process.env.NEXT_PUBLIC_PLAYER_TOKENS || "{}"),
    };
  }

  // Try to load from deployments.json (for local development)
  try {
    const deploymentsFile = require("@/deployments.json");
    return deploymentsFile;
  } catch (e) {
    console.warn("⚠️ No deployments.json found and no environment variables set. Using placeholder addresses.");
    return {
      prizePool: "0x0000000000000000000000000000000000000000",
      stakingContract: "0x0000000000000000000000000000000000000000",
      oracle: "0x0000000000000000000000000000000000000000",
      championNFT: "0x0000000000000000000000000000000000000000",
      marketContract: "0x0000000000000000000000000000000000000000",
      playerTokenFactory: "0x0000000000000000000000000000000000000000",
      playerTokens: {},
    };
  }
}

const deployments = loadDeployments();

// ─── Additional ABIs needed by src/hooks and API routes ──────────────────────

export const PRIZE_POOL_ABI = [
  {
    name: "pendingRewards",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "wallet", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "claimRewards",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    name: "currentSeason",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;

export const ORACLE_ABI = [
  {
    name: "playerMatchFps",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "matchId", type: "uint256" },
      { name: "playerId", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

/** ABI slices for PSLPlayerToken — used by API routes and streak hooks */
export const playerTokenABI = [
  {
    name: "holdStreak",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "totalDaysHeld",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "transferFrom",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

/** Raw playerTokens mapping: numeric playerId string → deployed ERC-20 address */
export const playerTokens = deployments.playerTokens as Record<string, string>;

/**
 * Type-safe contract descriptors — spread into wagmi/viem read & write hooks.
 * Format: { address: `0x${string}`, abi: ABI }
 */
export const contracts = {
  marketContract: {
    address: deployments.marketContract as `0x${string}`,
    abi: MARKET_ABI,
  },
  stakingContract: {
    address: deployments.stakingContract as `0x${string}`,
    abi: STAKING_ABI,
  },
  prizePool: {
    address: deployments.prizePool as `0x${string}`,
    abi: PRIZE_POOL_ABI,
  },
  oracle: {
    address: deployments.oracle as `0x${string}`,
    abi: ORACLE_ABI,
  },
  championNFT: {
    address: deployments.championNFT as `0x${string}`,
    // ChampionNFT ABI is imported directly from artifacts in the API route
    abi: [] as const,
  },
} as const;

/** Flat named constants for simpler component-level imports */
export const CONTRACTS = {
  PLAYER_TOKEN_FACTORY: deployments.playerTokenFactory as `0x${string}`,
  PRIZE_POOL: deployments.prizePool as `0x${string}`,
  STAKING: deployments.stakingContract as `0x${string}`,
  ACHIEVEMENT_NFT: deployments.championNFT as `0x${string}`,
  MARKET: deployments.marketContract as `0x${string}`,
} as const;

export const CHAIN_CONFIG = {
  chainId: Number(process.env.NEXT_PUBLIC_WIREFLUID_CHAIN_ID || 92533),
  name: "WireFluid",
  explorerUrl:
    process.env.NEXT_PUBLIC_EXPLORER_URL || "https://wirefluidscan.com",
};
