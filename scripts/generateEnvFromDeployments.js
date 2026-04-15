#!/usr/bin/env node

/**
 * Generate environment variables from deployments.json for Vercel deployment
 * Run this after deploying contracts to get the env vars to paste into Vercel
 */

import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const deploymentsPath = join(__dirname, '../deployments.json');

if (!existsSync(deploymentsPath)) {
  console.error('❌ deployments.json not found!');
  console.error('   Run: npm run deploy');
  process.exit(1);
}

const deployments = JSON.parse(readFileSync(deploymentsPath, 'utf8'));

console.log('');
console.log('📋 Environment Variables for Vercel');
console.log('===================================');
console.log('');
console.log('Copy these to your Vercel project settings:');
console.log('');
console.log('# Contract Addresses');
console.log(`NEXT_PUBLIC_PRIZE_POOL_ADDRESS=${deployments.prizePool}`);
console.log(`NEXT_PUBLIC_STAKING_CONTRACT_ADDRESS=${deployments.stakingContract}`);
console.log(`NEXT_PUBLIC_ORACLE_ADDRESS=${deployments.oracle}`);
console.log(`NEXT_PUBLIC_CHAMPION_NFT_ADDRESS=${deployments.championNFT}`);
console.log(`NEXT_PUBLIC_MARKET_CONTRACT_ADDRESS=${deployments.marketContract}`);
console.log(`NEXT_PUBLIC_PLAYER_TOKEN_FACTORY_ADDRESS=${deployments.playerTokenFactory}`);
console.log('');
console.log('# Player Tokens (as JSON string)');
console.log(`NEXT_PUBLIC_PLAYER_TOKENS='${JSON.stringify(deployments.playerTokens)}'`);
console.log('');
console.log('');
console.log('📝 Or add to your .env.local file:');
console.log('');
console.log('NEXT_PUBLIC_PRIZE_POOL_ADDRESS=' + deployments.prizePool);
console.log('NEXT_PUBLIC_STAKING_CONTRACT_ADDRESS=' + deployments.stakingContract);
console.log('NEXT_PUBLIC_ORACLE_ADDRESS=' + deployments.oracle);
console.log('NEXT_PUBLIC_CHAMPION_NFT_ADDRESS=' + deployments.championNFT);
console.log('NEXT_PUBLIC_MARKET_CONTRACT_ADDRESS=' + deployments.marketContract);
console.log('NEXT_PUBLIC_PLAYER_TOKEN_FACTORY_ADDRESS=' + deployments.playerTokenFactory);
console.log("NEXT_PUBLIC_PLAYER_TOKENS='" + JSON.stringify(deployments.playerTokens) + "'");
console.log('');
console.log('✅ Done! Add these to Vercel and redeploy.');
console.log('');
