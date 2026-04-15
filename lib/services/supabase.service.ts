/**
 * Supabase service layer
 * Abstracts database operations from hooks
 */

import type { LeaderboardEntry, PortfolioData } from '@/lib/types';
import { supabase } from '@/utils/supabase/client';

export class SupabaseService {
  /**
   * Fetch leaderboard data
   */
  static async getLeaderboard(limit = 100): Promise<LeaderboardEntry[]> {
    console.log('[Leaderboard] Fetching top', limit, 'entries');
    
    try {
      const { data, error } = await supabase
        .from('leaderboard_cache')
        .select('*')
        .order('portfolio_value', { ascending: false })
        .limit(limit);

      console.log('[Leaderboard] Supabase response:', { 
        dataLength: data?.length, 
        error,
        firstEntry: data?.[0]
      });

      if (error) {
        console.error('[Leaderboard] Supabase error:', error);
        throw error;
      }
      
      console.log('[Leaderboard] Successfully fetched', data?.length || 0, 'entries');
      return data || [];
    } catch (error) {
      console.error('[Leaderboard] Failed to fetch leaderboard:', error);
      return [];
    }
  }

  /**
   * Fetch portfolio data for a wallet
   */
  static async getPortfolio(wallet: string): Promise<PortfolioData> {
    if (!wallet) {
      console.log('[Portfolio] No wallet provided');
      return { holdings: [], total_value_wc: 0 };
    }

    console.log('[Portfolio] Fetching for wallet:', wallet);

    try {
      const { data, error } = await supabase
        .from('portfolio_cache')
        .select('*')
        .eq('wallet', wallet.toLowerCase())
        .single();

      console.log('[Portfolio] Supabase response:', { data, error });

      if (error) {
        // Not found is not an error - return empty portfolio
        if (error.code === 'PGRST116') {
          console.log('[Portfolio] No data found for wallet (PGRST116)');
          return { holdings: [], total_value_wc: 0 };
        }
        console.error('[Portfolio] Supabase error:', error);
        throw error;
      }

      console.log('[Portfolio] Successfully fetched:', data);
      return data || { holdings: [], total_value_wc: 0 };
    } catch (error) {
      console.error('[Portfolio] Failed to fetch portfolio:', error);
      return { holdings: [], total_value_wc: 0 };
    }
  }

  /**
   * Check if wallet exists in leaderboard
   */
  static async walletExists(wallet: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('leaderboard_cache')
        .select('wallet')
        .eq('wallet', wallet.toLowerCase())
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return !!data;
    } catch (error) {
      console.error('Failed to check wallet existence:', error);
      return false;
    }
  }
}
