import { fetchMarketResolution } from './polymarket';
import { submitResolution } from './solana';

async function pollMarkets() {
  // TODO: Read event list from on-chain
  // For each event with protection_enabled && !market_resolved:
  //   - Fetch resolution from Polymarket
  //   - If resolved, call submitResolution
}

setInterval(pollMarkets, 60000); // Poll every minute
