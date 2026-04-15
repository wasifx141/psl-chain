const { ethers } = require("ethers");
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
require("dotenv").config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const deployments = JSON.parse(fs.readFileSync("./deployments.json", "utf8"));
const provider = new ethers.JsonRpcProvider(
  process.env.NEXT_PUBLIC_RPC_URL || "http://127.0.0.1:8545",
);

const MARKET_ABI = [
  "event TokenBought(address indexed buyer, address indexed playerToken, uint256 amount, uint256 cost, uint256 newSupply)",
  "event TokenSold(address indexed seller, address indexed playerToken, uint256 amount, uint256 refund, uint256 newSupply)",
];

async function main() {
  const marketContract = new ethers.Contract(
    deployments.marketContract,
    MARKET_ABI,
    provider,
  );

  console.log("Fetching TokenBought events...");
  const buyEvents = await marketContract.queryFilter(
    marketContract.getEvent("TokenBought"),
    0,
    "latest",
  );
  for (const event of buyEvents) {
    const args = event.args;
    await supabase.from("transactions").upsert(
      {
        tx_hash: event.transactionHash,
        block_number: event.blockNumber,
        action: "buy",
        wallet: args.buyer,
        player_token: args.playerToken,
        amount: Number(args.amount),
        cost_wc: ethers.formatEther(args.cost),
        timestamp: new Date().toISOString(),
      },
      { onConflict: "tx_hash, action" },
    );
  }

  console.log(`Synced ${buyEvents.length} buys.`);

  console.log("Fetching TokenSold events...");
  const sellEvents = await marketContract.queryFilter(
    marketContract.getEvent("TokenSold"),
    0,
    "latest",
  );
  for (const event of sellEvents) {
    const args = event.args;
    await supabase.from("transactions").upsert(
      {
        tx_hash: event.transactionHash,
        block_number: event.blockNumber,
        action: "sell",
        wallet: args.seller,
        player_token: args.playerToken,
        amount: Number(args.amount),
        cost_wc: ethers.formatEther(args.refund),
        timestamp: new Date().toISOString(),
      },
      { onConflict: "tx_hash, action" },
    );
  }
  console.log(`Synced ${sellEvents.length} sells.`);
  console.log("Done syncing transactions.");
}
main().catch(console.error);
