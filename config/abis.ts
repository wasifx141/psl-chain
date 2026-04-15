/** Minimal ABI slices for wagmi / viem — sourced from the deployed Solidity contracts */

export const MARKET_ABI = [
  {
    name: "buyTokens",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "playerToken", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "sellTokens",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "playerToken", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "getBuyPrice",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "playerToken", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getSellPrice",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "playerToken", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getTokensRemaining",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "playerToken", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getHoldings",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "wallet", type: "address" },
      { name: "playerToken", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "tokensSold",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getAllPlayerTokens",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address[]" }],
  },
] as const;

export const ERC20_ABI = [
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
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export const STAKING_ABI = [
  {
    name: "stakeForMatch",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "playerTokenAddr", type: "address" },
      { name: "playerId_", type: "uint8" },
      { name: "matchId_", type: "uint8" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "getStake",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "wallet", type: "address" },
      { name: "matchId_", type: "uint8" },
      { name: "playerId_", type: "uint8" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "amount", type: "uint256" },
          { name: "playerId", type: "uint8" },
          { name: "matchId", type: "uint8" },
          { name: "claimed", type: "bool" },
        ],
      },
    ],
  },
  {
    name: "claimAndUnstake",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "playerTokenAddr", type: "address" },
      { name: "playerId_", type: "uint8" },
      { name: "matchId_", type: "uint8" },
    ],
    outputs: [],
  },
] as const;
