import * as anchor from '@coral-xyz/anchor';
import { Connection, PublicKey } from '@solana/web3.js';

export async function submitResolution(
  eventPubkey: PublicKey,
  resolvedYes: boolean
) {
  // TODO: Connect to Solana, call record_market_resolution
  console.log(`Submitting resolution for event ${eventPubkey.toBase58()}: ${resolvedYes}`);
}
