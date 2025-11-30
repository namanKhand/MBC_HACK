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
import {
  TOKEN_PROGRAM_ID,
  createAccount,
  createMint,
  getAccount,
  mintTo,
} from "@solana/spl-token";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram } from "@solana/web3.js";
import { expect } from "chai";
import { Ticketing } from "../target/types/ticketing";

describe("ticketing", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Ticketing as Program<Ticketing>;
  const wallet = provider.wallet as anchor.Wallet;

  const ticketPrice = new anchor.BN(1_000_000); // 1 USDC with 6 decimals
  const defaultDate = Math.floor(Date.now() / 1000) + 3600; // 1 hour in the future
  const defaultVenue = "Event Hall";

  const randomName = () => `Event-${Keypair.generate().publicKey.toBase58().slice(0, 6)}`;

  const deriveEventPda = (authority: PublicKey, name: string) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("event"), authority.toBuffer(), Buffer.from(name)],
      program.programId,
    );

  const deriveVaultPda = (eventKey: PublicKey) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), eventKey.toBuffer()],
      program.programId,
    );

  const deriveTicketPda = (eventKey: PublicKey, ticketId: number) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("ticket"), eventKey.toBuffer(), Buffer.from(new Uint8Array(new Uint32Array([ticketId]).buffer))],
      program.programId,
    );

  const airdropSol = async (pubkey: PublicKey) => {
    const sig = await provider.connection.requestAirdrop(pubkey, 2 * LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(sig);
  };

  const setupUsdcMint = async () =>
    createMint(provider.connection, wallet.payer, wallet.publicKey, null, 6);

  const createUserUsdcAccount = async (mint: PublicKey, owner: Keypair, amount: anchor.BN) => {
    await airdropSol(owner.publicKey);
    const tokenAccount = await createAccount(provider.connection, wallet.payer, mint, owner.publicKey);
    await mintTo(provider.connection, wallet.payer, mint, tokenAccount, wallet.publicKey, amount.toNumber());
    return tokenAccount;
  };

  it("test_initialize_event", async () => {
    const name = randomName();
    const usdcMint = await setupUsdcMint();
    const [eventPda] = deriveEventPda(wallet.publicKey, name);
    const [vaultPda] = deriveVaultPda(eventPda);

    await program.methods
      .initializeEvent(name, new anchor.BN(defaultDate), defaultVenue, 100, ticketPrice)
      .accounts({
        authority: wallet.publicKey,
        event: eventPda,
        usdcMint,
        usdcVault: vaultPda,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    const eventAccount = await program.account.event.fetch(eventPda);
    expect(eventAccount.authority.toBase58()).to.equal(wallet.publicKey.toBase58());
    expect(eventAccount.name).to.equal(name);
    expect(eventAccount.eventDate.toNumber()).to.equal(defaultDate);
    expect(eventAccount.venue).to.equal(defaultVenue);
    expect(eventAccount.totalTickets).to.equal(100);
    expect(eventAccount.ticketsSold).to.equal(0);
    expect(eventAccount.ticketPrice.toNumber()).to.equal(ticketPrice.toNumber());
    expect(eventAccount.usdcMint.toBase58()).to.equal(usdcMint.toBase58());
    expect(eventAccount.usdcVault.toBase58()).to.equal(vaultPda.toBase58());

    // Ensure vault token account exists with expected mint/authority.
    const vaultAccount = await getAccount(provider.connection, vaultPda);
    expect(vaultAccount.mint.toBase58()).to.equal(usdcMint.toBase58());
    expect(vaultAccount.owner.toBase58()).to.equal(eventPda.toBase58());
  });

  it("test_mint_ticket", async () => {
    const name = randomName();
    const usdcMint = await setupUsdcMint();
    const [eventPda] = deriveEventPda(wallet.publicKey, name);
    const [vaultPda] = deriveVaultPda(eventPda);

    await program.methods
      .initializeEvent(name, new anchor.BN(defaultDate), defaultVenue, 2, ticketPrice)
      .accounts({
        authority: wallet.publicKey,
        event: eventPda,
        usdcMint,
        usdcVault: vaultPda,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    const buyer = Keypair.generate();
    const buyerUsdc = await createUserUsdcAccount(usdcMint, buyer, ticketPrice);

    const eventAccount = await program.account.event.fetch(eventPda);
    const [ticketPda] = deriveTicketPda(eventPda, eventAccount.ticketsSold);

    await program.methods
      .mintTicket()
      .accounts({
        buyer: buyer.publicKey,
        event: eventPda,
        ticket: ticketPda,
        buyerUsdc,
        eventUsdcVault: vaultPda,
        usdcMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();

    const ticketAccount = await program.account.ticket.fetch(ticketPda);
    expect(ticketAccount.event.toBase58()).to.equal(eventPda.toBase58());
    expect(ticketAccount.owner.toBase58()).to.equal(buyer.publicKey.toBase58());
    expect(ticketAccount.ticketId).to.equal(0);
    expect(ticketAccount.purchasePrice.toNumber()).to.equal(ticketPrice.toNumber());
    expect(ticketAccount.checkedIn).to.equal(false);

    const buyerAccount = await getAccount(provider.connection, buyerUsdc);
    const vaultAccount = await getAccount(provider.connection, vaultPda);
    expect(Number(buyerAccount.amount)).to.equal(0);
    expect(Number(vaultAccount.amount)).to.equal(ticketPrice.toNumber());

    const updatedEvent = await program.account.event.fetch(eventPda);
    expect(updatedEvent.ticketsSold).to.equal(1);
  });

  it("test_mint_multiple_tickets", async () => {
    const name = randomName();
    const usdcMint = await setupUsdcMint();
    const [eventPda] = deriveEventPda(wallet.publicKey, name);
    const [vaultPda] = deriveVaultPda(eventPda);
    const maxTickets = 3;

    await program.methods
      .initializeEvent(name, new anchor.BN(defaultDate), defaultVenue, maxTickets, ticketPrice)
      .accounts({
        authority: wallet.publicKey,
        event: eventPda,
        usdcMint,
        usdcVault: vaultPda,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    const buyers = [Keypair.generate(), Keypair.generate(), Keypair.generate()];
    const buyerAccounts = await Promise.all(
      buyers.map((buyer) => createUserUsdcAccount(usdcMint, buyer, ticketPrice)),
    );

    for (let i = 0; i < buyers.length; i++) {
      const [ticketPda] = deriveTicketPda(eventPda, i);
      await program.methods
        .mintTicket()
        .accounts({
          buyer: buyers[i].publicKey,
          event: eventPda,
          ticket: ticketPda,
          buyerUsdc: buyerAccounts[i],
          eventUsdcVault: vaultPda,
          usdcMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([buyers[i]])
        .rpc();
    }

    const eventAfter = await program.account.event.fetch(eventPda);
    expect(eventAfter.ticketsSold).to.equal(maxTickets);

    const extraBuyer = Keypair.generate();
    const extraBuyerUsdc = await createUserUsdcAccount(usdcMint, extraBuyer, ticketPrice);
    const [soldOutTicketPda] = deriveTicketPda(eventPda, maxTickets);

    let threw = false;
    try {
      await program.methods
        .mintTicket()
        .accounts({
          buyer: extraBuyer.publicKey,
          event: eventPda,
          ticket: soldOutTicketPda,
          buyerUsdc: extraBuyerUsdc,
          eventUsdcVault: vaultPda,
          usdcMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([extraBuyer])
        .rpc();
    } catch (err) {
      const anchorErr = err as anchor.AnchorError;
      expect(anchorErr.error.errorCode.code).to.equal("SoldOut");
      threw = true;
    }

    expect(threw).to.equal(true);
  });
});
