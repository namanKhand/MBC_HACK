import { Connection, clusterApiUrl } from "@solana/web3.js";

export function configureSolanaClient(): Connection {
  const endpoint = process.env.SOLANA_RPC ?? clusterApiUrl("devnet");
  // TODO: Add wallet loading and Anchor provider wiring
  return new Connection(endpoint, "confirmed");
}
