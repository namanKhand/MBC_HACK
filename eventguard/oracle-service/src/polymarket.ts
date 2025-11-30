export interface PolymarketOracleConfig {
  apiBase: string;
  apiKey?: string;
  trackedMarkets: string[];
}

export function configurePolymarketOracle(): PolymarketOracleConfig {
  // TODO: Replace with real configuration loader and market subscription logic
  return {
    apiBase: process.env.POLYMARKET_API ?? "https://clob.polymarket.com",
    apiKey: process.env.POLYMARKET_API_KEY,
    trackedMarkets: [],
  };
}
