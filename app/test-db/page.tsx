'use client';

import { supabase } from '@/utils/supabase/client';
import { useEffect, useState } from 'react';

export default function TestDB() {
  const [results, setResults] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    testConnection();
  }, []);

  const testConnection = async () => {
    setLoading(true);
    const testResults: any = {};

    try {
      // Test 1: Check connection
      console.log('Testing Supabase connection...');
      testResults.connectionUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      testResults.hasAnonKey = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      // Test 2: Check portfolio_cache table
      console.log('Checking portfolio_cache table...');
      const { data: portfolioData, error: portfolioError } = await supabase
        .from('portfolio_cache')
        .select('*')
        .limit(5);
      
      testResults.portfolioCache = {
        count: portfolioData?.length || 0,
        error: portfolioError?.message,
        sample: portfolioData?.[0],
      };

      // Test 3: Check leaderboard_cache table
      console.log('Checking leaderboard_cache table...');
      const { data: leaderboardData, error: leaderboardError } = await supabase
        .from('leaderboard_cache')
        .select('*')
        .limit(5);
      
      testResults.leaderboardCache = {
        count: leaderboardData?.length || 0,
        error: leaderboardError?.message,
        sample: leaderboardData?.[0],
      };

      // Test 4: Check transactions table
      console.log('Checking transactions table...');
      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .limit(5);
      
      testResults.transactions = {
        count: txData?.length || 0,
        error: txError?.message,
        sample: txData?.[0],
      };

      // Test 5: Check player_multipliers table
      console.log('Checking player_multipliers table...');
      const { data: multipliersData, error: multipliersError } = await supabase
        .from('player_multipliers')
        .select('*')
        .limit(5);
      
      testResults.playerMultipliers = {
        count: multipliersData?.length || 0,
        error: multipliersError?.message,
        sample: multipliersData?.[0],
      };

      console.log('Test results:', testResults);
    } catch (error) {
      console.error('Test failed:', error);
      testResults.globalError = error instanceof Error ? error.message : String(error);
    }

    setResults(testResults);
    setLoading(false);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Supabase Connection Test</h1>
        <button
          onClick={testConnection}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-lg font-semibold hover:brightness-110"
        >
          🔄 Re-test Connection
        </button>
      </div>

      {loading ? (
        <div className="text-muted-foreground">Testing connection...</div>
      ) : (
        <div className="space-y-4">
          {/* Connection Info */}
          <div className="card-surface rounded-xl p-4">
            <h2 className="font-bold mb-2">Connection Info</h2>
            <div className="text-sm space-y-1">
              <div>URL: {results.connectionUrl || 'Not set'}</div>
              <div>Has Anon Key: {results.hasAnonKey ? '✅ Yes' : '❌ No'}</div>
            </div>
          </div>

          {/* Portfolio Cache */}
          <div className="card-surface rounded-xl p-4">
            <h2 className="font-bold mb-2">Portfolio Cache Table</h2>
            <div className="text-sm space-y-1">
              <div>Count: {results.portfolioCache?.count || 0}</div>
              {results.portfolioCache?.error && (
                <div className="text-red-500">Error: {results.portfolioCache.error}</div>
              )}
              {results.portfolioCache?.sample && (
                <pre className="bg-muted p-2 rounded text-xs overflow-auto">
                  {JSON.stringify(results.portfolioCache.sample, null, 2)}
                </pre>
              )}
            </div>
          </div>

          {/* Leaderboard Cache */}
          <div className="card-surface rounded-xl p-4">
            <h2 className="font-bold mb-2">Leaderboard Cache Table</h2>
            <div className="text-sm space-y-1">
              <div>Count: {results.leaderboardCache?.count || 0}</div>
              {results.leaderboardCache?.error && (
                <div className="text-red-500">Error: {results.leaderboardCache.error}</div>
              )}
              {results.leaderboardCache?.sample && (
                <pre className="bg-muted p-2 rounded text-xs overflow-auto">
                  {JSON.stringify(results.leaderboardCache.sample, null, 2)}
                </pre>
              )}
            </div>
          </div>

          {/* Transactions */}
          <div className="card-surface rounded-xl p-4">
            <h2 className="font-bold mb-2">Transactions Table</h2>
            <div className="text-sm space-y-1">
              <div>Count: {results.transactions?.count || 0}</div>
              {results.transactions?.error && (
                <div className="text-red-500">Error: {results.transactions.error}</div>
              )}
              {results.transactions?.sample && (
                <pre className="bg-muted p-2 rounded text-xs overflow-auto">
                  {JSON.stringify(results.transactions.sample, null, 2)}
                </pre>
              )}
            </div>
          </div>

          {/* Player Multipliers */}
          <div className="card-surface rounded-xl p-4">
            <h2 className="font-bold mb-2">Player Multipliers Table</h2>
            <div className="text-sm space-y-1">
              <div>Count: {results.playerMultipliers?.count || 0}</div>
              {results.playerMultipliers?.error && (
                <div className="text-red-500">Error: {results.playerMultipliers.error}</div>
              )}
              {results.playerMultipliers?.sample && (
                <pre className="bg-muted p-2 rounded text-xs overflow-auto">
                  {JSON.stringify(results.playerMultipliers.sample, null, 2)}
                </pre>
              )}
            </div>
          </div>

          {/* Global Error */}
          {results.globalError && (
            <div className="card-surface rounded-xl p-4 border-2 border-red-500">
              <h2 className="font-bold mb-2 text-red-500">Global Error</h2>
              <div className="text-sm text-red-500">{results.globalError}</div>
            </div>
          )}
        </div>
      )}

      <div className="mt-8 p-4 bg-muted/50 rounded-lg">
        <h3 className="font-bold mb-2">Instructions:</h3>
        <ol className="text-sm space-y-2 list-decimal list-inside">
          <li>Check if the connection URL and anon key are set correctly</li>
          <li>Verify that tables exist in your Supabase project</li>
          <li>Check if there's any data in the tables</li>
          <li>If tables are empty, you need to populate them with data from blockchain events</li>
          <li>Check the browser console for detailed logs</li>
        </ol>
      </div>
    </div>
  );
}
