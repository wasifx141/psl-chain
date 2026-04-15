-- ============================================
-- PSL Chain - Supabase Database Schema
-- ============================================
-- Run this SQL in your Supabase SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. TRANSACTIONS TABLE
-- ============================================
-- Stores all blockchain transactions (buy, sell, stake, unstake, claim)
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tx_hash TEXT NOT NULL UNIQUE,
  block_number BIGINT,
  action TEXT NOT NULL CHECK (action IN ('buy', 'sell', 'stake', 'unstake', 'claim_rewards')),
  wallet TEXT NOT NULL,
  player_token TEXT,
  player_id INTEGER,
  match_id INTEGER,
  amount NUMERIC,
  cost_wc NUMERIC,
  amount_wc NUMERIC,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for transactions
CREATE INDEX IF NOT EXISTS idx_transactions_wallet ON transactions(wallet);
CREATE INDEX IF NOT EXISTS idx_transactions_action ON transactions(action);
CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_player_id ON transactions(player_id);
CREATE INDEX IF NOT EXISTS idx_transactions_tx_hash ON transactions(tx_hash);

-- ============================================
-- 2. MATCH RESULTS TABLE
-- ============================================
-- Stores match results and player FPS scores
CREATE TABLE IF NOT EXISTS match_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id INTEGER NOT NULL,
  player_id INTEGER NOT NULL,
  fps NUMERIC NOT NULL,
  multiplier NUMERIC NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(match_id, player_id)
);

-- Indexes for match_results
CREATE INDEX IF NOT EXISTS idx_match_results_match_id ON match_results(match_id);
CREATE INDEX IF NOT EXISTS idx_match_results_player_id ON match_results(player_id);
CREATE INDEX IF NOT EXISTS idx_match_results_fps ON match_results(fps DESC);

-- ============================================
-- 3. PORTFOLIO CACHE TABLE
-- ============================================
-- Caches user portfolio values for performance
CREATE TABLE IF NOT EXISTS portfolio_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet TEXT NOT NULL UNIQUE,
  total_value_wc NUMERIC NOT NULL DEFAULT 0,
  holdings JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for portfolio_cache
CREATE INDEX IF NOT EXISTS idx_portfolio_cache_wallet ON portfolio_cache(wallet);
CREATE INDEX IF NOT EXISTS idx_portfolio_cache_total_value ON portfolio_cache(total_value_wc DESC);
CREATE INDEX IF NOT EXISTS idx_portfolio_cache_updated_at ON portfolio_cache(updated_at DESC);

-- ============================================
-- 4. LEADERBOARD CACHE TABLE
-- ============================================
-- Caches leaderboard rankings for performance
CREATE TABLE IF NOT EXISTS leaderboard_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rank INTEGER NOT NULL,
  wallet TEXT NOT NULL,
  portfolio_value NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(wallet)
);

-- Indexes for leaderboard_cache
CREATE INDEX IF NOT EXISTS idx_leaderboard_cache_rank ON leaderboard_cache(rank ASC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_cache_wallet ON leaderboard_cache(wallet);
CREATE INDEX IF NOT EXISTS idx_leaderboard_cache_portfolio_value ON leaderboard_cache(portfolio_value DESC);

-- ============================================
-- 5. PLAYER MULTIPLIERS TABLE
-- ============================================
-- Stores current multipliers for each player
CREATE TABLE IF NOT EXISTS player_multipliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id INTEGER NOT NULL UNIQUE,
  multiplier NUMERIC NOT NULL DEFAULT 100,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for player_multipliers
CREATE INDEX IF NOT EXISTS idx_player_multipliers_player_id ON player_multipliers(player_id);
CREATE INDEX IF NOT EXISTS idx_player_multipliers_multiplier ON player_multipliers(multiplier DESC);

-- ============================================
-- 6. HOLDER STREAKS TABLE
-- ============================================
-- Tracks holding streaks for users
CREATE TABLE IF NOT EXISTS holder_streaks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet TEXT NOT NULL,
  player_id INTEGER NOT NULL,
  streak INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(wallet, player_id)
);

-- Indexes for holder_streaks
CREATE INDEX IF NOT EXISTS idx_holder_streaks_wallet ON holder_streaks(wallet);
CREATE INDEX IF NOT EXISTS idx_holder_streaks_player_id ON holder_streaks(player_id);
CREATE INDEX IF NOT EXISTS idx_holder_streaks_streak ON holder_streaks(streak DESC);

-- ============================================
-- 7. ACHIEVEMENTS TABLE
-- ============================================
-- Stores user achievements
CREATE TABLE IF NOT EXISTS achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet TEXT NOT NULL,
  achievement_type TEXT NOT NULL CHECK (achievement_type IN (
    'SEVEN_DAY_STREAK',
    'DIAMOND_HANDS',
    'EARLY_ADOPTER',
    'TOP_SCOUT',
    'POWER_SCOUT',
    'SEASON_CHAMPION',
    'FIRST_TRADE',
    'WHALE',
    'DIVERSIFIED'
  )),
  reason TEXT,
  tx_hash TEXT,
  minted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(wallet, achievement_type)
);

-- Indexes for achievements
CREATE INDEX IF NOT EXISTS idx_achievements_wallet ON achievements(wallet);
CREATE INDEX IF NOT EXISTS idx_achievements_type ON achievements(achievement_type);
CREATE INDEX IF NOT EXISTS idx_achievements_minted_at ON achievements(minted_at DESC);

-- ============================================
-- 8. STAKING POSITIONS TABLE (Optional)
-- ============================================
-- Tracks active staking positions
CREATE TABLE IF NOT EXISTS staking_positions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet TEXT NOT NULL,
  player_id INTEGER NOT NULL,
  match_id INTEGER NOT NULL,
  amount NUMERIC NOT NULL,
  staked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unstaked_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(wallet, player_id, match_id)
);

-- Indexes for staking_positions
CREATE INDEX IF NOT EXISTS idx_staking_positions_wallet ON staking_positions(wallet);
CREATE INDEX IF NOT EXISTS idx_staking_positions_player_id ON staking_positions(player_id);
CREATE INDEX IF NOT EXISTS idx_staking_positions_match_id ON staking_positions(match_id);
CREATE INDEX IF NOT EXISTS idx_staking_positions_is_active ON staking_positions(is_active);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================
-- Enable RLS on all tables
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_multipliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE holder_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE staking_positions ENABLE ROW LEVEL SECURITY;

-- Public read access for all tables (adjust based on your needs)
CREATE POLICY "Public read access" ON transactions FOR SELECT USING (true);
CREATE POLICY "Public read access" ON match_results FOR SELECT USING (true);
CREATE POLICY "Public read access" ON portfolio_cache FOR SELECT USING (true);
CREATE POLICY "Public read access" ON leaderboard_cache FOR SELECT USING (true);
CREATE POLICY "Public read access" ON player_multipliers FOR SELECT USING (true);
CREATE POLICY "Public read access" ON holder_streaks FOR SELECT USING (true);
CREATE POLICY "Public read access" ON achievements FOR SELECT USING (true);
CREATE POLICY "Public read access" ON staking_positions FOR SELECT USING (true);

-- Service role can do everything (for your backend listener)
CREATE POLICY "Service role full access" ON transactions FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON match_results FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON portfolio_cache FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON leaderboard_cache FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON player_multipliers FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON holder_streaks FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON achievements FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON staking_positions FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to get user portfolio value
CREATE OR REPLACE FUNCTION get_portfolio_value(user_wallet TEXT)
RETURNS NUMERIC AS $$
  SELECT COALESCE(total_value_wc, 0)
  FROM portfolio_cache
  WHERE wallet = user_wallet;
$$ LANGUAGE SQL STABLE;

-- Function to get user rank
CREATE OR REPLACE FUNCTION get_user_rank(user_wallet TEXT)
RETURNS INTEGER AS $$
  SELECT rank
  FROM leaderboard_cache
  WHERE wallet = user_wallet;
$$ LANGUAGE SQL STABLE;

-- Function to get top holders for a player
CREATE OR REPLACE FUNCTION get_top_holders(player_token_id INTEGER, limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
  wallet TEXT,
  amount NUMERIC,
  value_wc NUMERIC
) AS $$
  SELECT 
    pc.wallet,
    (holding->>'amount')::NUMERIC as amount,
    (holding->>'value_wc')::NUMERIC as value_wc
  FROM portfolio_cache pc,
  jsonb_array_elements(pc.holdings) as holding
  WHERE (holding->>'player_id')::INTEGER = player_token_id
  ORDER BY (holding->>'amount')::NUMERIC DESC
  LIMIT limit_count;
$$ LANGUAGE SQL STABLE;

-- ============================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================

-- Insert sample player multipliers (for all 40 players)
INSERT INTO player_multipliers (player_id, multiplier) 
SELECT generate_series(0, 39), 100
ON CONFLICT (player_id) DO NOTHING;

-- ============================================
-- VIEWS (Optional - for easier querying)
-- ============================================

-- View for recent transactions
CREATE OR REPLACE VIEW recent_transactions AS
SELECT 
  t.id,
  t.tx_hash,
  t.action,
  t.wallet,
  t.player_id,
  t.amount,
  t.cost_wc,
  t.timestamp
FROM transactions t
ORDER BY t.timestamp DESC
LIMIT 100;

-- View for top performers
CREATE OR REPLACE VIEW top_performers AS
SELECT 
  mr.player_id,
  AVG(mr.fps) as avg_fps,
  MAX(mr.fps) as max_fps,
  COUNT(*) as matches_played,
  AVG(mr.multiplier) as avg_multiplier
FROM match_results mr
GROUP BY mr.player_id
ORDER BY avg_fps DESC;

-- ============================================
-- GRANTS (Ensure proper permissions)
-- ============================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Grant access to tables
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- Grant access to sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- ============================================
-- COMPLETION MESSAGE
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ PSL Chain database schema created successfully!';
  RAISE NOTICE '📊 Tables created: transactions, match_results, portfolio_cache, leaderboard_cache, player_multipliers, holder_streaks, achievements, staking_positions';
  RAISE NOTICE '🔒 Row Level Security enabled on all tables';
  RAISE NOTICE '🎯 Ready to start listening to blockchain events!';
END $$;
