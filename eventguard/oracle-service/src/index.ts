import dotenv from "dotenv";
import { configurePolymarketOracle } from "./polymarket.js";
import { configureSolanaClient } from "./solana.js";

dotenv.config();

async function main() {
  // TODO: Wire Polymarket oracle feeds to Solana program accounts
  const connection = configureSolanaClient();
  const oracle = configurePolymarketOracle();

  console.log("Oracle connection ready", { rpc: connection.rpcEndpoint, markets: oracle.trackedMarkets.length });
}

main().catch((err) => {
  console.error("Oracle service failed", err);
  process.exit(1);
});
