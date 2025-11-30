import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { TOKEN_PROGRAM_ID, createMint, getOrCreateAssociatedTokenAccount, mintTo, getAccount } from '@solana/spl-token';
import { Keypair, PublicKey, SystemProgram } from '@solana/web3.js';
import { expect } from 'chai';

// These types are lightly typed because IDL generation is not part of this scaffolded repo.
const provider = anchor.AnchorProvider.local();
anchor.setProvider(provider);

const ticketing = anchor.workspace.Ticketing as Program;
const culturePassport = anchor.workspace.CulturePassport as Program;

const enumConverters = {
  eventType: {
    music: {} as any,
    sports: {} as any,
    conference: {} as any,
    festival: {} as any,
    other: {} as any,
  },
  refundCondition: {
    onYes: {} as any,
    onNo: {} as any,
  },
};

async function createEvent(authority: Keypair, name: string, price: number) {
  const event = Keypair.generate();
  await ticketing.methods
    .createEvent(name, new anchor.BN(price))
    .accounts({
      authority: authority.publicKey,
      event: event.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .signers([authority, event])
    .rpc();
  return event;
}

async function buyTicket(event: PublicKey, buyer: Keypair) {
  const [ticketPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('ticket'), event.toBuffer(), buyer.publicKey.toBuffer()],
    ticketing.programId,
  );
  await ticketing.methods
    .buyTicket()
    .accounts({
      buyer: buyer.publicKey,
      event,
      ticket: ticketPda,
      systemProgram: SystemProgram.programId,
    })
    .signers([buyer])
    .rpc();
  return ticketPda;
}

async function deriveBadge(event: PublicKey, user: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('badge'), event.toBuffer(), user.toBuffer()],
    culturePassport.programId,
  )[0];
}

async function setupTokenMint(authority: Keypair) {
  const mint = await createMint(provider.connection, authority, authority.publicKey, null, 6);
  const eventVault = await getOrCreateAssociatedTokenAccount(
    provider.connection,
    authority,
    mint,
    authority.publicKey,
  );
  const userAta = await getOrCreateAssociatedTokenAccount(
    provider.connection,
    authority,
    mint,
    provider.wallet.publicKey,
  );
  await mintTo(provider.connection, authority, mint, eventVault.address, authority, 1_000_000_000);
  return { mint, eventVault, userAta };
}

describe('Culture passport + polymarket', () => {
  it('test_check_in_and_mint_badge', async () => {
    const authority = Keypair.generate();
    await provider.connection.requestAirdrop(authority.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
    const event = await createEvent(authority, 'Concert', 100);
    const ticket = await buyTicket(event.publicKey, authority);
    const badge = await deriveBadge(event.publicKey, authority.publicKey);

    await ticketing.methods
      .checkInTicket('Concert', enumConverters.eventType.music, 'VIP')
      .accounts({
        authority: authority.publicKey,
        ticket,
        event: event.publicKey,
        badge,
        systemProgram: SystemProgram.programId,
        culturePassportProgram: culturePassport.programId,
      })
      .signers([authority])
      .rpc();

    const ticketAccount: any = await ticketing.account.ticket.fetch(ticket);
    expect(ticketAccount.checkedIn).to.be.true;

    const badgeAccount: any = await culturePassport.account.cultureBadge.fetch(badge);
    expect(badgeAccount.owner.toBase58()).to.equal(authority.publicKey.toBase58());
    expect(badgeAccount.event.toBase58()).to.equal(event.publicKey.toBase58());
  });

  it('test_double_check_in_fails', async () => {
    const authority = Keypair.generate();
    await provider.connection.requestAirdrop(authority.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
    const event = await createEvent(authority, 'Summit', 50);
    const ticket = await buyTicket(event.publicKey, authority);
    const badge = await deriveBadge(event.publicKey, authority.publicKey);

    await ticketing.methods
      .checkInTicket('Summit', enumConverters.eventType.conference, 'GA')
      .accounts({
        authority: authority.publicKey,
        ticket,
        event: event.publicKey,
        badge,
        systemProgram: SystemProgram.programId,
        culturePassportProgram: culturePassport.programId,
      })
      .signers([authority])
      .rpc();

    await expect(
      ticketing.methods
        .checkInTicket('Summit', enumConverters.eventType.conference, 'GA')
        .accounts({
          authority: authority.publicKey,
          ticket,
          event: event.publicKey,
          badge,
          systemProgram: SystemProgram.programId,
          culturePassportProgram: culturePassport.programId,
        })
        .signers([authority])
        .rpc(),
    ).to.be.rejected;
  });

  it('test_badge_non_transferable', async () => {
    // Non-transferable by design: the program exposes no transfer instruction and badges are PDAs.
    const ix = culturePassport.idl.instructions.find((i: any) => i.name.toLowerCase().includes('transfer'));
    expect(ix).to.be.undefined;
  });

  it('test_attach_polymarket_protection', async () => {
    const authority = Keypair.generate();
    await provider.connection.requestAirdrop(authority.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
    const event = await createEvent(authority, 'Sports', 75);

    await ticketing.methods
      .attachPolymarketProtection('market-123', enumConverters.refundCondition.onYes, 50)
      .accounts({
        authority: authority.publicKey,
        event: event.publicKey,
      })
      .signers([authority])
      .rpc();

    const eventAccount: any = await ticketing.account.event.fetch(event.publicKey);
    expect(eventAccount.protectionEnabled).to.be.true;
    expect(eventAccount.polymarketMarketId).to.equal('market-123');
    expect(eventAccount.refundCondition.onYes).to.not.be.undefined;
    expect(eventAccount.refundPercentage).to.equal(50);
  });

  it('test_record_resolution_and_claim_refund', async () => {
    const authority = Keypair.generate();
    await provider.connection.requestAirdrop(authority.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
    const event = await createEvent(authority, 'Festival', 100);
    await ticketing.methods
      .attachPolymarketProtection('market-yes', enumConverters.refundCondition.onYes, 50)
      .accounts({ authority: authority.publicKey, event: event.publicKey })
      .signers([authority])
      .rpc();

    const ticket = await buyTicket(event.publicKey, provider.wallet.payer as Keypair);
    const { mint, eventVault, userAta } = await setupTokenMint(authority);

    await ticketing.methods
      .recordMarketResolution(true)
      .accounts({
        oracle: new PublicKey('PolyMrktOracle111111111111111111111111111'),
        event: event.publicKey,
      })
      .signers([])
      .rpc();

    const before = await getAccount(provider.connection, userAta.address);

    await ticketing.methods
      .claimRefund()
      .accounts({
        claimer: provider.wallet.publicKey,
        ticket,
        event: event.publicKey,
        eventUsdcVault: eventVault.address,
        claimerUsdc: userAta.address,
        eventAuthority: authority.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([authority])
      .rpc();

    const after = await getAccount(provider.connection, userAta.address);
    const diff = Number(after.amount - before.amount);
    expect(diff).to.equal(50 * 1_000_000); // 50% refund with 6 decimals
  });

  it('test_refund_only_when_condition_matches', async () => {
    const authority = Keypair.generate();
    await provider.connection.requestAirdrop(authority.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
    const event = await createEvent(authority, 'Conference', 120);
    await ticketing.methods
      .attachPolymarketProtection('market-no', enumConverters.refundCondition.onNo, 50)
      .accounts({ authority: authority.publicKey, event: event.publicKey })
      .signers([authority])
      .rpc();

    const ticket = await buyTicket(event.publicKey, provider.wallet.payer as Keypair);
    const { mint, eventVault, userAta } = await setupTokenMint(authority);

    await ticketing.methods
      .recordMarketResolution(true)
      .accounts({
        oracle: new PublicKey('PolyMrktOracle111111111111111111111111111'),
        event: event.publicKey,
      })
      .signers([])
      .rpc();

    await expect(
      ticketing.methods
        .claimRefund()
        .accounts({
          claimer: provider.wallet.publicKey,
          ticket,
          event: event.publicKey,
          eventUsdcVault: eventVault.address,
          claimerUsdc: userAta.address,
          eventAuthority: authority.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([authority])
        .rpc(),
    ).to.be.rejected;
  });
});
