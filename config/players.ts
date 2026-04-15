import rawPlayers from "@/data/players.json";
import deployments from "@/deployments.json";

export type PlayerRole = "Batsman" | "Bowler" | "All-rounder" | "Wicketkeeper";
export type PlayerTier = "Legend" | "Star" | "Regular";
export type TeamCode = "IU" | "KK" | "LQ" | "PZ" | "QG" | "SS" | "RW" | "HK";

const TEAM_MAP: Record<string, TeamCode> = {
  "Islamabad United": "IU",
  "Peshawar Zalmi": "PZ",
  "Quetta Gladiators": "QG",
  "Lahore Qalandars": "LQ",
  "Sialkot Stallions": "SS",
  "Karachi Kings": "KK",
  "Rawalpindi Team": "RW",
  "Hyderabad Kingsmen": "HK",
};

const TIER_LABEL: Record<number, PlayerTier> = { 0: "Legend", 1: "Star", 2: "Regular" };
// Approximate base prices derived from bonding curve starting point
const BASE_PRICES: Record<number, number> = { 0: 0.30, 1: 0.12, 2: 0.05 };

export interface Player {
  id: string;           // numeric string: "0"–"39"
  numericId: number;
  name: string;
  initials: string;
  team: TeamCode;
  teamName: string;
  role: PlayerRole;
  tier: PlayerTier;
  price: number;        // static fallback price (WC)
  priceChange: number;  // seeded at 0; will be overridden by oracle data
  supply: number;       // static fallback — will be overridden by on-chain reads
  maxSupply: number;
  symbol: string;
  tokenAddress: string; // deployed ERC20 address
  color: string;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

const playerTokens = deployments.playerTokens as Record<string, string>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const PLAYERS: Player[] = rawPlayers.map((p: any) => ({
  id: String(p.id),
  numericId: p.id,
  name: p.name,
  initials: getInitials(p.name),
  team: TEAM_MAP[p.team] ?? "IU",
  teamName: p.team,
  role: p.role as PlayerRole,
  tier: TIER_LABEL[p.tier] ?? "Regular",
  price: BASE_PRICES[p.tier] ?? 0.05,
  priceChange: 0,
  supply: 100,
  maxSupply: 100,
  symbol: p.symbol,
  tokenAddress: playerTokens[String(p.id)] ?? "",
  color: p.color,
}));

export const PLAYER_TOKENS: Record<string, string> = playerTokens;

export const TEAM_COLORS: Record<TeamCode, { from: string; to: string; border: string }> = {
  IU: { from: "hsl(22 90% 58%)",  to: "hsl(22 75% 38%)",  border: "hsl(22 90% 58%)" },   // Islamabad — orange
  PZ: { from: "hsl(48 100% 52%)", to: "hsl(48 90% 36%)",  border: "hsl(48 100% 52%)" },  // Peshawar  — gold
  QG: { from: "hsl(275 55% 58%)", to: "hsl(275 48% 36%)", border: "hsl(275 55% 58%)" },  // Quetta    — purple
  LQ: { from: "hsl(143 70% 46%)", to: "hsl(143 62% 30%)", border: "hsl(143 70% 46%)" },  // Lahore    — green
  SS: { from: "hsl(185 60% 46%)", to: "hsl(185 54% 30%)", border: "hsl(185 60% 46%)" },  // Sialkot   — teal
  KK: { from: "hsl(217 80% 56%)", to: "hsl(217 68% 36%)", border: "hsl(217 80% 56%)" },  // Karachi   — blue
  RW: { from: "hsl(207 52% 50%)", to: "hsl(207 46% 32%)", border: "hsl(207 52% 50%)" },  // Rawalpindi — steel
  HK: { from: "hsl(0 82% 56%)",   to: "hsl(0 72% 38%)",   border: "hsl(0 82% 56%)" },    // Hyderabad — red
};

export const TEAM_NAMES: Record<TeamCode, string> = {
  IU: "Islamabad United",
  KK: "Karachi Kings",
  LQ: "Lahore Qalandars",
  PZ: "Peshawar Zalmi",
  QG: "Quetta Gladiators",
  SS: "Sialkot Stallions",
  RW: "Rawalpindi Team",
  HK: "Hyderabad Kingsmen",
};
