/**
 * Supabase service layer
 * Abstracts database operations from hooks
 */

import type { LeaderboardEntry, PortfolioData } from "@/lib/types";
import { supabase } from "@/utils/supabase/client";

export interface HoldingUpdate {
  player_id: number; // numeric player id
  amount: number; // new token balance (0 = remove)
  value_wc: number; // estimated value in WC
}

export class SupabaseService {
  /**
   * Fetch leaderboard data
   */
  static async getLeaderboard(limit = 100): Promise<LeaderboardEntry[]> {
    console.log("[Leaderboard] Fetching top", limit, "entries");

    try {
      const { data, error } = await supabase
        .from("leaderboard_cache")
        .select("*")
        .order("portfolio_value", { ascending: false })
        .limit(limit);

      console.log("[Leaderboard] Supabase response:", {
        dataLength: data?.length,
        error,
        firstEntry: data?.[0],
      });

      if (error) {
        console.error("[Leaderboard] Supabase error:", error);
        throw error;
      }

      console.log(
        "[Leaderboard] Successfully fetched",
        data?.length || 0,
        "entries",
      );
      return data || [];
    } catch (error) {
      console.error("[Leaderboard] Failed to fetch leaderboard:", error);
      return [];
    }
  }

  /**
   * Fetch portfolio data for a wallet
   */
  static async getPortfolio(wallet: string): Promise<PortfolioData> {
    if (!wallet) {
      console.log("[Portfolio] No wallet provided");
      return { holdings: [], total_value_wc: 0 };
    }

    console.log("[Portfolio] Fetching for wallet:", wallet);

    try {
      const { data, error } = await supabase
        .from("portfolio_cache")
        .select("*")
        .eq("wallet", wallet.toLowerCase())
        .single();

      console.log("[Portfolio] Supabase response:", { data, error });

      if (error) {
        // Not found is not an error - return empty portfolio
        if (error.code === "PGRST116") {
          console.log("[Portfolio] No data found for wallet (PGRST116)");
          return { holdings: [], total_value_wc: 0 };
        }
        console.error("[Portfolio] Supabase error:", error);
        throw error;
      }

      console.log("[Portfolio] Successfully fetched:", data);
      return data || { holdings: [], total_value_wc: 0 };
    } catch (error) {
      console.error("[Portfolio] Failed to fetch portfolio:", error);
      return { holdings: [], total_value_wc: 0 };
    }
  }

  /**
   * Upsert a single player holding for a wallet into portfolio_cache and
   * leaderboard_cache.  Called right after a buy or sell confirms on-chain.
   *
   * @param wallet          - connected wallet address
   * @param update          - player id / new amount / value
   */
  static async upsertPortfolioHolding(
    wallet: string,
    update: HoldingUpdate,
  ): Promise<void> {
    if (!wallet) return;
    const lowerWallet = wallet.toLowerCase();

    try {
      // 1. Fetch the existing cached row (may not exist yet)
      const existing = await this.getPortfolio(lowerWallet);
      const holdings: HoldingUpdate[] = Array.isArray(existing.holdings)
        ? (existing.holdings as unknown as HoldingUpdate[])
        : [];

      // 2. Merge the updated player into the array
      const idx = holdings.findIndex((h) => h.player_id === update.player_id);
      if (update.amount > 0) {
        if (idx >= 0) {
          holdings[idx] = { ...holdings[idx], ...update };
        } else {
          holdings.push(update);
        }
      } else {
        // Remove holding if amount reached 0
        if (idx >= 0) holdings.splice(idx, 1);
      }

      const totalValue = holdings.reduce(
        (acc, h) => acc + (h.value_wc || 0),
        0,
      );

      // 3. Upsert portfolio_cache
      const { error: portErr } = await supabase.from("portfolio_cache").upsert(
        {
          wallet: lowerWallet,
          holdings,
          total_value_wc: totalValue,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "wallet" },
      );

      if (portErr) {
        console.error("[Portfolio] upsert error:", portErr);
      }

      // 4. Upsert leaderboard_cache
      const { error: lbErr } = await supabase.from("leaderboard_cache").upsert(
        {
          wallet: lowerWallet,
          portfolio_value: totalValue,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "wallet" },
      );

      if (lbErr) {
        console.error("[Leaderboard] upsert error:", lbErr);
      }

      console.log(
        "[Sync] portfolio + leaderboard updated for",
        lowerWallet,
        "— total value:",
        totalValue.toFixed(4),
        "WC",
      );
    } catch (err) {
      console.error("[Sync] Failed to upsert portfolio:", err);
    }
  }

  /**
   * Check if wallet exists in leaderboard
   */
  static async walletExists(wallet: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from("leaderboard_cache")
        .select("wallet")
        .eq("wallet", wallet.toLowerCase())
        .single();

      if (error && error.code !== "PGRST116") throw error;
      return !!data;
    } catch (error) {
      console.error("Failed to check wallet existence:", error);
      return false;
    }
  }
}
