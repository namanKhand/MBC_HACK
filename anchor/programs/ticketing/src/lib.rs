use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("Fg6PaFpoGXkYsidMpWxTWqkQhvgLNvZx2dVYUx1mDLk");

/// Fixed maximum sizes for string fields to derive account space.
const MAX_NAME_LEN: usize = 100;
const MAX_VENUE_LEN: usize = 100;

/// Account discriminator (8) + serialized fields.
pub const EVENT_SIZE: usize = 8
    + 32 // authority
    + 4 + MAX_NAME_LEN // name (Anchor string prefix + bytes)
    + 8 // event_date
    + 4 + MAX_VENUE_LEN // venue
    + 4 // total_tickets
    + 4 // tickets_sold
    + 8 // ticket_price
    + 32 // usdc_mint
    + 32 // usdc_vault
    + 1; // bump

pub const TICKET_SIZE: usize = 8
    + 32 // event
    + 32 // owner
    + 4 // ticket_id
    + 8 // purchase_price
    + 8 // purchase_time
    + 1 // checked_in
    + 1; // bump

#[program]
pub mod ticketing {
    use super::*;

    /// Initialize a new event PDA with metadata and a USDC vault.
    pub fn initialize_event(
        ctx: Context<InitializeEvent>,
        name: String,
        event_date: i64,
        venue: String,
        total_tickets: u32,
        ticket_price: u64,
    ) -> Result<()> {
        // Populate the event account with provided parameters and derived accounts.
        let event = &mut ctx.accounts.event;
        event.authority = ctx.accounts.authority.key();
        event.name = name.clone();
        event.event_date = event_date;
        event.venue = venue;
        event.total_tickets = total_tickets;
        event.tickets_sold = 0;
        event.ticket_price = ticket_price;
        event.usdc_mint = ctx.accounts.usdc_mint.key();
        event.usdc_vault = ctx.accounts.usdc_vault.key();
        event.bump = *ctx.bumps.get("event").expect("event bump set");

        Ok(())
    }

    /// Mint a primary-sale ticket by transferring USDC and creating a ticket PDA.
    pub fn mint_ticket(ctx: Context<MintTicket>) -> Result<()> {
        let event = &mut ctx.accounts.event;

        // Ensure supply remains within event limits.
        require!(event.tickets_sold < event.total_tickets, TicketingError::SoldOut);

        // Transfer USDC from buyer to the event vault.
        let transfer_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.buyer_usdc.to_account_info(),
                to: ctx.accounts.event_usdc_vault.to_account_info(),
                authority: ctx.accounts.buyer.to_account_info(),
            },
        );
        token::transfer(transfer_ctx, event.ticket_price)?;

        // Initialize the ticket metadata.
        let ticket = &mut ctx.accounts.ticket;
        ticket.event = event.key();
        ticket.owner = ctx.accounts.buyer.key();
        ticket.ticket_id = event.tickets_sold;
        ticket.purchase_price = event.ticket_price;
        ticket.purchase_time = Clock::get()?.unix_timestamp;
        ticket.checked_in = false;
        ticket.bump = *ctx.bumps.get("ticket").expect("ticket bump set");

        // Update event supply tracker.
        event.tickets_sold += 1;

        Ok(())
    }
}

/// Accounts for initializing an event.
#[derive(Accounts)]
pub struct InitializeEvent<'info> {
    /// Event organizer paying for account creations.
    #[account(mut)]
    pub authority: Signer<'info>,
    /// Event account PDA derived from organizer and event name for uniqueness.
    #[account(
        init,
        payer = authority,
        space = EVENT_SIZE,
        seeds = [b"event", authority.key().as_ref(), name.as_bytes()],
        bump
    )]
    pub event: Account<'info, Event>,
    /// USDC mint used for ticket pricing.
    pub usdc_mint: Account<'info, Mint>,
    /// USDC vault PDA owned by the event account to collect proceeds.
    #[account(
        init,
        payer = authority,
        seeds = [b"vault", event.key().as_ref()],
        bump,
        token::mint = usdc_mint,
        token::authority = event
    )]
    pub usdc_vault: Account<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

/// Accounts for minting a primary-sale ticket.
#[derive(Accounts)]
pub struct MintTicket<'info> {
    /// Ticket buyer supplying USDC and fees.
    #[account(mut)]
    pub buyer: Signer<'info>,
    /// Event being purchased against.
    #[account(mut)]
    pub event: Account<'info, Event>,
    /// Ticket PDA keyed by the event and sequential ticket id.
    #[account(
        init,
        payer = buyer,
        space = TICKET_SIZE,
        seeds = [b"ticket", event.key().as_ref(), &event.tickets_sold.to_le_bytes()],
        bump
    )]
    pub ticket: Account<'info, Ticket>,
    /// Buyer's USDC token account used to pay for the ticket.
    #[account(mut, constraint = buyer_usdc.owner == buyer.key(), constraint = buyer_usdc.mint == event.usdc_mint)]
    pub buyer_usdc: Account<'info, TokenAccount>,
    /// Event's USDC vault PDA receiving the proceeds.
    #[account(mut, constraint = event_usdc_vault.key() == event.usdc_vault, constraint = event_usdc_vault.mint == event.usdc_mint)]
    pub event_usdc_vault: Account<'info, TokenAccount>,
    pub usdc_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

/// Event metadata and financial configuration.
#[account]
pub struct Event {
    pub authority: Pubkey,      // Event organizer
    pub name: String,           // Event name (max 100 chars)
    pub event_date: i64,        // Unix timestamp
    pub venue: String,          // Venue name (max 100 chars)
    pub total_tickets: u32,     // Total ticket supply
    pub tickets_sold: u32,      // Current tickets sold
    pub ticket_price: u64,      // Price in USDC (lamports)
    pub usdc_mint: Pubkey,      // USDC token mint
    pub usdc_vault: Pubkey,     // Event's USDC vault PDA
    pub bump: u8,               // PDA bump seed
}

/// Ticket instance tying ownership to an event.
#[account]
pub struct Ticket {
    pub event: Pubkey,          // Reference to event
    pub owner: Pubkey,          // Current owner
    pub ticket_id: u32,         // Unique ticket ID within event
    pub purchase_price: u64,    // Original purchase price
    pub purchase_time: i64,     // Unix timestamp of purchase
    pub checked_in: bool,       // Check-in status
    pub bump: u8,               // PDA bump seed
}

/// Custom error codes for ticketing operations.
#[error_code]
pub enum TicketingError {
    #[msg("Event is sold out")]
    SoldOut,
    #[msg("Invalid ticket owner")]
    InvalidOwner,
    #[msg("Ticket already checked in")]
    AlreadyCheckedIn,
}
