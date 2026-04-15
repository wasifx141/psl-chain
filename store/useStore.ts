import { create } from "zustand";

interface Holding {
  playerId: string;
  tokens: number;
  avgBuyPrice: number;
  staked: number;
  streakDays: number;
}

interface Transaction {
  id: string;
  playerId: string;
  playerName: string;
  action: "Buy" | "Sell" | "Stake" | "Claim" | "Achievement";
  amount: number;
  price: number;
  time: string;
  txHash: string;
}

interface Achievement {
  id: string;
  name: string;
  icon: string;
  description: string;
  criteria: string;
  earned: boolean;
  earnedDate?: string;
  progress?: number;
  maxProgress?: number;
}

interface AppState {
  walletConnected: boolean;
  walletAddress: string;
  balance: number;
  holdings: Holding[];
  transactions: Transaction[];
  achievements: Achievement[];
  isLoading: boolean;
  connectWallet: () => void;
  disconnectWallet: () => void;
  setLoading: (loading: boolean) => void;
}

const MOCK_ACHIEVEMENTS: Achievement[] = [
  { id: "season-champion", name: "Season Champion", icon: "🏆", description: "Top portfolio at season end", criteria: "Finish #1 in season rankings", earned: false },
  { id: "top-scout", name: "Top Scout", icon: "🔍", description: "First to buy a player who scores FPS ≥ 150", criteria: "Buy a player before their FPS ≥ 150 match", earned: true, earnedDate: "2026-03-15" },
  { id: "diamond-hands", name: "Diamond Hands", icon: "💎", description: "Hold any token 30 consecutive days", criteria: "Hold any single token for 30 days straight", earned: false, progress: 12, maxProgress: 30 },
];

const MOCK_HOLDINGS: Holding[] = [
  { playerId: "babar-azam", tokens: 5, avgBuyPrice: 0.28, staked: 2, streakDays: 8 },
  { playerId: "rashid-khan", tokens: 3, avgBuyPrice: 0.29, staked: 1, streakDays: 5 },
  { playerId: "haris-rauf", tokens: 2, avgBuyPrice: 0.25, staked: 0, streakDays: 2 },
];

const MOCK_TRANSACTIONS: Transaction[] = [
  { id: "t1", playerId: "babar-azam", playerName: "Babar Azam", action: "Buy", amount: 5, price: 0.28, time: "2h ago", txHash: "0xabc...123" },
  { id: "t2", playerId: "rashid-khan", playerName: "Rashid Khan", action: "Buy", amount: 3, price: 0.29, time: "4h ago", txHash: "0xdef...456" },
];

const useStore = create<AppState>((set) => ({
  walletConnected: false,
  walletAddress: "",
  balance: 0,
  holdings: MOCK_HOLDINGS,
  transactions: MOCK_TRANSACTIONS,
  achievements: MOCK_ACHIEVEMENTS,
  isLoading: false,
  connectWallet: () =>
    set({
      walletConnected: true,
      walletAddress: `0x${Math.random().toString(16).slice(2, 10)}...${Math.random().toString(16).slice(2, 10)}`,
      balance: 500,
    }),
  disconnectWallet: () =>
    set({
      walletConnected: false,
      walletAddress: "",
      balance: 0,
    }),
  setLoading: (loading: boolean) => set({ isLoading: loading }),
}));

export { useStore };
