import { configurePolymarketOracle } from "../src/polymarket.js";
import { configureSolanaClient } from "../src/solana.js";

describe("oracle bootstrap", () => {
  it("loads configs", () => {
    const oracle = configurePolymarketOracle();
    const solana = configureSolanaClient();

    expect(oracle.apiBase).toBeDefined();
    expect(solana).toBeDefined();
  });
});
