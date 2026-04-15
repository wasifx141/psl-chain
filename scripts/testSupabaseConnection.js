#!/usr/bin/env node

// Quick test to verify Supabase connection and check for existing data

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function testConnection() {
  console.log('🔍 Testing Supabase connection...\n');
  
  try {
    // Test 1: Check transactions table
    const { data: txData, error: txError, count: txCount } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: false })
      .limit(5);
    
    if (txError) {
      console.error('❌ Error querying transactions:', txError.message);
    } else {
      console.log(`✅ Transactions table: ${txCount || 0} total records`);
      if (txData && txData.length > 0) {
        console.log('   Latest transaction:', txData[0]);
      }
    }

    // Test 2: Check portfolio_cache table
    const { data: portfolioData, error: portfolioError, count: portfolioCount } = await supabase
      .from('portfolio_cache')
      .select('*', { count: 'exact', head: false })
      .limit(5);
    
    if (portfolioError) {
      console.error('❌ Error querying portfolio_cache:', portfolioError.message);
    } else {
      console.log(`✅ Portfolio cache: ${portfolioCount || 0} total records`);
    }

    // Test 3: Check staking_positions table
    const { data: stakingData, error: stakingError, count: stakingCount } = await supabase
      .from('staking_positions')
      .select('*', { count: 'exact', head: false })
      .limit(5);
    
    if (stakingError) {
      console.error('❌ Error querying staking_positions:', stakingError.message);
    } else {
      console.log(`✅ Staking positions: ${stakingCount || 0} total records`);
    }

    console.log('\n📊 Summary:');
    console.log(`   Total transactions: ${txCount || 0}`);
    console.log(`   Total portfolios: ${portfolioCount || 0}`);
    console.log(`   Total staking positions: ${stakingCount || 0}`);
    
    if ((txCount || 0) === 0) {
      console.log('\n⚠️  No transaction data found!');
      console.log('   This is normal if no one has traded yet.');
      console.log('   Make a buy/sell transaction to populate the database.');
    }

  } catch (error) {
    console.error('❌ Connection test failed:', error.message);
  }
}

testConnection();
