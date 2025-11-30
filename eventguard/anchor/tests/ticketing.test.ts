import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Ticketing } from "../target/types/ticketing";

describe("ticketing program", () => {
  // Configure the client to use the local cluster for now; override via Anchor.toml
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Ticketing as Program<Ticketing>;

  it("initializes", async () => {
    // TODO: add proper initialize instruction invocation when accounts are defined
    await program.provider.connection.getLatestBlockhash();
  });
});
