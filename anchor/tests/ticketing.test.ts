import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { expect } from "chai";
import BN from "bn.js";

const TICKET_SEED = "ticket";

type TicketAccount = {
  owner: anchor.web3.PublicKey;
  event: anchor.web3.PublicKey;
  ticketId: BN;
  purchasePrice: BN;
  bump: number;
};

describe("ticketing program", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Ticketing as Program;

  const airdrop = async (pubkey: anchor.web3.PublicKey, lamports = 2 * anchor.web3.LAMPORTS_PER_SOL) => {
    const sig = await provider.connection.requestAirdrop(pubkey, lamports);
    await provider.connection.confirmTransaction(sig);
  };

  const deriveTicketPda = (
    eventKey: anchor.web3.PublicKey,
    ticketId: number
  ): [anchor.web3.PublicKey, number] => {
    return anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from(TICKET_SEED), eventKey.toBuffer(), new BN(ticketId).toArrayLike(Buffer, "le", 8)],
      program.programId
    );
  };

  const initializeEvent = async (config: {
    ticketPrice: number;
    maxTickets: number;
    maxResaleMarkupBps: number;
    transferLockStart: number;
    maxTicketsPerWallet: number;
    transfersEnabled: boolean;
    organizer?: anchor.web3.Keypair;
  }) => {
    const organizer = config.organizer ?? anchor.web3.Keypair.generate();
    await airdrop(organizer.publicKey);

    const event = anchor.web3.Keypair.generate();
    await program.methods
      .initializeEvent(
        new BN(config.ticketPrice),
        new BN(config.maxTickets),
        config.maxResaleMarkupBps,
        new BN(config.transferLockStart),
        config.maxTicketsPerWallet,
        config.transfersEnabled
      )
      .accounts({
        organizer: organizer.publicKey,
        event: event.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([organizer, event])
      .rpc();

    return { organizer, event: event.publicKey };
  };

  const buyTicket = async (event: anchor.web3.PublicKey, buyer: anchor.web3.Keypair) => {
    const eventAccount = await program.account.event.fetch(event);
    const ticketId = eventAccount.ticketsSold.toNumber();
    const [ticketPda] = deriveTicketPda(event, ticketId);

    await program.methods
      .buyTicket()
      .accounts({
        buyer: buyer.publicKey,
        event,
        ticket: ticketPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();

    return ticketPda;
  };

  const fetchTicket = async (ticket: anchor.web3.PublicKey) => {
    return (await program.account.ticket.fetch(ticket)) as TicketAccount;
  };

  it("test_transfer_gift", async () => {
    const { event } = await initializeEvent({
      ticketPrice: 100,
      maxTickets: 10,
      maxResaleMarkupBps: 1500,
      transferLockStart: 0,
      maxTicketsPerWallet: 5,
      transfersEnabled: true,
    });

    const user1 = anchor.web3.Keypair.generate();
    const user2 = anchor.web3.Keypair.generate();
    await airdrop(user1.publicKey);
    await airdrop(user2.publicKey);

    const ticketPda = await buyTicket(event, user1);
    const beforeTicket = await fetchTicket(ticketPda);

    await program.methods
      .transferTicket(null)
      .accounts({
        currentOwner: user1.publicKey,
        newOwner: user2.publicKey,
        ticket: ticketPda,
        event,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([user1])
      .rpc();

    const updatedTicket = await fetchTicket(ticketPda);
    expect(updatedTicket.owner.toBase58()).to.equal(user2.publicKey.toBase58());
    expect(updatedTicket.purchasePrice.toNumber()).to.equal(beforeTicket.purchasePrice.toNumber());
  });

  it("test_transfer_with_valid_markup", async () => {
    const { event } = await initializeEvent({
      ticketPrice: 100,
      maxTickets: 10,
      maxResaleMarkupBps: 1000,
      transferLockStart: 0,
      maxTicketsPerWallet: 5,
      transfersEnabled: true,
    });

    const user1 = anchor.web3.Keypair.generate();
    const user2 = anchor.web3.Keypair.generate();
    await airdrop(user1.publicKey);
    await airdrop(user2.publicKey);

    const ticketPda = await buyTicket(event, user1);

    await program.methods
      .transferTicket(new BN(110))
      .accounts({
        currentOwner: user1.publicKey,
        newOwner: user2.publicKey,
        ticket: ticketPda,
        event,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([user1])
      .rpc();

    const updatedTicket = await fetchTicket(ticketPda);
    expect(updatedTicket.purchasePrice.toNumber()).to.equal(110);
    expect(updatedTicket.owner.toBase58()).to.equal(user2.publicKey.toBase58());
  });

  it("test_transfer_exceeds_price_cap", async () => {
    const { event } = await initializeEvent({
      ticketPrice: 100,
      maxTickets: 10,
      maxResaleMarkupBps: 1000,
      transferLockStart: 0,
      maxTicketsPerWallet: 5,
      transfersEnabled: true,
    });

    const user1 = anchor.web3.Keypair.generate();
    const user2 = anchor.web3.Keypair.generate();
    await airdrop(user1.publicKey);
    await airdrop(user2.publicKey);

    const ticketPda = await buyTicket(event, user1);

    try {
      await program.methods
        .transferTicket(new BN(120))
        .accounts({
          currentOwner: user1.publicKey,
          newOwner: user2.publicKey,
          ticket: ticketPda,
          event,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([user1])
        .rpc();
      expect.fail("transfer should have failed due to price cap");
    } catch (err) {
      expect(err.toString()).to.include("PriceCapExceeded");
    }
  });

  it("test_transfer_during_lock_period", async () => {
    const now = Math.floor(Date.now() / 1000);
    const lockTime = now + 10;

    const { event } = await initializeEvent({
      ticketPrice: 100,
      maxTickets: 10,
      maxResaleMarkupBps: 1000,
      transferLockStart: lockTime,
      maxTicketsPerWallet: 5,
      transfersEnabled: true,
    });

    const user1 = anchor.web3.Keypair.generate();
    const user2 = anchor.web3.Keypair.generate();
    await airdrop(user1.publicKey);
    await airdrop(user2.publicKey);

    const ticketPda = await buyTicket(event, user1);

    await new Promise((resolve) => setTimeout(resolve, 11_000));

    try {
      await program.methods
        .transferTicket(null)
        .accounts({
          currentOwner: user1.publicKey,
          newOwner: user2.publicKey,
          ticket: ticketPda,
          event,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([user1])
        .rpc();
      expect.fail("transfer should have failed due to lock period");
    } catch (err) {
      expect(err.toString()).to.include("TransferLocked");
    }
  });

  it("test_wallet_limit_exceeded", async () => {
    const { event } = await initializeEvent({
      ticketPrice: 100,
      maxTickets: 10,
      maxResaleMarkupBps: 1500,
      transferLockStart: 0,
      maxTicketsPerWallet: 2,
      transfersEnabled: true,
    });

    const user1 = anchor.web3.Keypair.generate();
    const user2 = anchor.web3.Keypair.generate();
    await airdrop(user1.publicKey);
    await airdrop(user2.publicKey);

    // Preload the recipient with tickets to hit the wallet limit.
    const firstOwned = await buyTicket(event, user2);
    const secondOwned = await buyTicket(event, user2);

    // Current owner purchases a ticket to transfer.
    const transferableTicket = await buyTicket(event, user1);

    // Provide remaining accounts for the recipient's currently owned tickets.
    const remainingAccounts = [firstOwned, secondOwned].map((pubkey) => ({
      pubkey,
      isSigner: false,
      isWritable: false,
    }));

    try {
      await program.methods
        .transferTicket(null)
        .accounts({
          currentOwner: user1.publicKey,
          newOwner: user2.publicKey,
          ticket: transferableTicket,
          event,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .remainingAccounts(remainingAccounts)
        .signers([user1])
        .rpc();
      expect.fail("transfer should have failed due to wallet limit");
    } catch (err) {
      expect(err.toString()).to.include("WalletLimitExceeded");
    }
  });
});
