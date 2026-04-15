#!/usr/bin/env node

/**
 * Quick check script to verify if the Supabase listener is needed and running
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔍 PSL Chain - Listener Status Check');
console.log('=====================================\n');

// Check 1: Environment variables
console.log('1️⃣ Checking environment variables...');
const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'WIREFLUID_RPC_URL'];
const missingEnvVars = requiredEnvVars.filter(v => !process.env[v]);

if (missingEnvVars.length > 0) {
  console.log('   ❌ Missing environment variables:', missingEnvVars.join(', '));
  console.log('   → Add these to your .env file\n');
  process.exit(1);
} else {
  console.log('   ✅ All required environment variables present\n');
}

// Check 2: Deployments file
console.log('2️⃣ Checking deployments.json...');
const deploymentsPath = join(__dirname, '../deployments.json');
if (!existsSync(deploymentsPath)) {
  console.log('   ❌ deployments.json not found');
  console.log('   → Run: npm run deploy\n');
  process.exit(1);
} else {
  const deployments = JSON.parse(readFileSync(deploymentsPath, 'utf8'));
  console.log('   ✅ Deployments file found');
  console.log(`   → Market: ${deployments.marketContract}`);
  console.log(`   → Player tokens: ${Object.keys(deployments.playerTokens).length}\n`);
}

// Check 3: Supabase connection
console.log('3️⃣ Checking Supabase connection...');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

try {
  // Check if tables exist
  const { data: portfolioData, error: portfolioError } = await supabase
    .from('portfolio_cache')
    .select('count')
    .limit(1);

  const { data: txData, error: txError } = await supabase
    .from('transactions')
    .select('count')
    .limit(1);

  if (portfolioError || txError) {
    console.log('   ❌ Cannot access Supabase tables');
    console.log('   → Error:', portfolioError?.message || txError?.message);
    console.log('   → Run the schema setup: psql < supabase-schema.sql\n');
    process.exit(1);
  }

  console.log('   ✅ Supabase connection successful\n');

  // Check 4: Data freshness
  console.log('4️⃣ Checking data freshness...');
  
  const { data: recentTx } = await supabase
    .from('transactions')
    .select('timestamp')
    .order('timestamp', { ascending: false })
    .limit(1);

  if (!recentTx || recentTx.length === 0) {
    console.log('   ⚠️  No transactions in database');
    console.log('   → This is normal for a fresh deployment');
    console.log('   → The listener will populate data as transactions occur\n');
  } else {
    const lastTxTime = new Date(recentTx[0].timestamp);
    const now = new Date();
    const minutesAgo = Math.floor((now - lastTxTime) / 60000);

    if (minutesAgo < 5) {
      console.log(`   ✅ Recent transaction found (${minutesAgo} minutes ago)`);
      console.log('   → Listener appears to be working!\n');
    } else if (minutesAgo < 60) {
      console.log(`   ⚠️  Last transaction was ${minutesAgo} minutes ago`);
      console.log('   → Listener might not be running or no recent activity\n');
    } else {
      console.log(`   ❌ Last transaction was ${Math.floor(minutesAgo / 60)} hours ago`);
      console.log('   → Listener is likely not running\n');
    }
  }

  // Check 5: Portfolio cache
  console.log('5️⃣ Checking portfolio cache...');
  
  const { data: portfolios, count } = await supabase
    .from('portfolio_cache')
    .select('*', { count: 'exact' });

  if (!portfolios || portfolios.length === 0) {
    console.log('   ⚠️  No portfolios cached');
    console.log('   → This is normal if no one has traded yet');
    console.log('   → Make a test trade to populate the cache\n');
  } else {
    console.log(`   ✅ ${count} portfolios cached`);
    
    // Check for stale data
    const oldestUpdate = portfolios.reduce((oldest, p) => {
      const updated = new Date(p.updated_at);
      return updated < oldest ? updated : oldest;
    }, new Date());
    
    const minutesSinceUpdate = Math.floor((new Date() - oldestUpdate) / 60000);
    
    if (minutesSinceUpdate > 60) {
      console.log(`   ⚠️  Oldest cache entry is ${Math.floor(minutesSinceUpdate / 60)} hours old`);
      console.log('   → Consider running: npm run sync-portfolio <wallet>\n');
    } else {
      console.log(`   → Most recent update: ${minutesSinceUpdate} minutes ago\n`);
    }
  }

} catch (error) {
  console.log('   ❌ Error checking Supabase:', error.message);
  process.exit(1);
}

// Summary
console.log('📋 Summary');
console.log('==========');
console.log('');
console.log('To start the listener:');
console.log('  npm run listener');
console.log('');
console.log('To run in background (Linux/Mac):');
console.log('  nohup npm run listener > listener.log 2>&1 &');
console.log('');
console.log('To run with PM2 (recommended):');
console.log('  npm install -g pm2');
console.log('  pm2 start npm --name "psl-listener" -- run listener');
console.log('  pm2 logs psl-listener');
console.log('');
console.log('To manually sync a wallet:');
console.log('  npm run sync-portfolio <wallet_address>');
console.log('');
console.log('For more details, see: LISTENER_SETUP.md');
console.log('');

process.exit(0);
