import { clusterApiUrl, Connection } from "@solana/web3.js";

export function getConnection(): Connection {
  const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC ?? clusterApiUrl("devnet");
  return new Connection(endpoint, "confirmed");
}
