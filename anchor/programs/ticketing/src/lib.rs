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

    /// Initialize a new event with pricing and anti-scalping rules.
    pub fn initialize_event(
        ctx: Context<InitializeEvent>,
        ticket_price: u64,
        max_tickets: u64,
        max_resale_markup_bps: u16,
        transfer_lock_start: i64,
        max_tickets_per_wallet: u8,
        transfers_enabled: bool,
    ) -> Result<()> {
        let event = &mut ctx.accounts.event;

        event.organizer = ctx.accounts.organizer.key();
        event.ticket_price = ticket_price;
        event.max_tickets = max_tickets;
        event.tickets_sold = 0;
        event.max_resale_markup_bps = max_resale_markup_bps;
        event.transfer_lock_start = transfer_lock_start;
        event.max_tickets_per_wallet = max_tickets_per_wallet;
        event.transfers_enabled = transfers_enabled;

        Ok(())
    }

    /// Simple ticket purchase that mints sequential ticket accounts.
    pub fn buy_ticket(ctx: Context<BuyTicket>) -> Result<()> {
        let event = &mut ctx.accounts.event;

        // Ensure we still have inventory before minting a ticket.
        if event.tickets_sold >= event.max_tickets {
            return Err(error!(TicketingError::EventSoldOut));
        }

        let ticket_id = event.tickets_sold;
        event.tickets_sold = event
            .tickets_sold
            .checked_add(1)
            .ok_or(TicketingError::Overflow)?;

        let ticket = &mut ctx.accounts.ticket;
        ticket.owner = ctx.accounts.buyer.key();
        ticket.event = event.key();
        ticket.ticket_id = ticket_id;
        ticket.purchase_price = event.ticket_price;
        ticket.bump = *ctx.bumps.get("ticket").unwrap();

        Ok(())
    }

    /// Transfer a ticket to a new owner while enforcing configured rules.
    pub fn transfer_ticket(
        ctx: Context<TransferTicket>,
        sale_price: Option<u64>,
    ) -> Result<()> {
        let ticket = &mut ctx.accounts.ticket;
        let event = &ctx.accounts.event;

        // 1) Ownership check to ensure only the current owner can transfer.
        require_keys_eq!(
            ticket.owner,
            ctx.accounts.current_owner.key(),
            TicketingError::TicketOwnershipMismatch
        );

        // 2) Transfer window lock validation.
        let current_time = Clock::get()?.unix_timestamp;
        if event.transfer_lock_start > 0 && current_time >= event.transfer_lock_start {
            return Err(error!(TicketingError::TransferLocked));
        }

        // 3) Global transfers toggle check.
        if !event.transfers_enabled {
            return Err(error!(TicketingError::TransfersDisabled));
        }

        // 4) Resale price cap enforcement when a sale price is provided.
        if let Some(price) = sale_price {
            let allowed_markup = ticket
                .purchase_price
                .checked_mul(event.max_resale_markup_bps as u64)
                .ok_or(TicketingError::Overflow)?
                .checked_div(10_000)
                .ok_or(TicketingError::Overflow)?;

            let max_allowed_price = ticket
                .purchase_price
                .checked_add(allowed_markup)
                .ok_or(TicketingError::Overflow)?;

            if price > max_allowed_price {
                return Err(error!(TicketingError::PriceCapExceeded));
            }
        }

        // 5) Enforce wallet holding limits using provided remaining accounts.
        let mut existing_count: u8 = 0;
        for account_info in ctx.remaining_accounts.iter() {
            if let Ok(other_ticket) = Account::<Ticket>::try_from(account_info) {
                if other_ticket.event == event.key()
                    && other_ticket.owner == ctx.accounts.new_owner.key()
                {
                    existing_count = existing_count.saturating_add(1);
                }
            }
        }

        if existing_count >= event.max_tickets_per_wallet {
            return Err(error!(TicketingError::WalletLimitExceeded));
        }

        // 6) Execute transfer and optionally update the purchase price if sold.
        ticket.owner = ctx.accounts.new_owner.key();
        if let Some(price) = sale_price {
            ticket.purchase_price = price;
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

#[derive(Accounts)]
pub struct InitializeEvent<'info> {
    #[account(mut)]
    pub organizer: Signer<'info>,
    #[account(init, payer = organizer, space = 8 + Event::LEN)]
    pub event: Account<'info, Event>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct BuyTicket<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    #[account(mut)]
    pub event: Account<'info, Event>,
    #[account(
        init,
        payer = buyer,
        space = 8 + Ticket::LEN,
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
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct TransferTicket<'info> {
    #[account(mut)]
    pub current_owner: Signer<'info>,
    #[account(mut)]
    pub new_owner: SystemAccount<'info>,
    #[account(
        mut,
        has_one = event,
        seeds = [b"ticket", ticket.event.as_ref(), &ticket.ticket_id.to_le_bytes()],
        bump = ticket.bump
    )]
    pub ticket: Account<'info, Ticket>,
    pub event: Account<'info, Event>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct Event {
    pub organizer: Pubkey,
    pub ticket_price: u64,
    pub max_tickets: u64,
    pub tickets_sold: u64,
    // Rules configuration
    pub max_resale_markup_bps: u16,
    pub transfer_lock_start: i64,
    pub max_tickets_per_wallet: u8,
    pub transfers_enabled: bool,
}

impl Event {
    pub const LEN: usize = 32 + 8 + 8 + 8 + 2 + 8 + 1 + 1;
}

#[account]
pub struct Ticket {
    pub owner: Pubkey,
    pub event: Pubkey,
    pub ticket_id: u64,
    pub purchase_price: u64,
    pub bump: u8,
}

impl Ticket {
    pub const LEN: usize = 32 + 32 + 8 + 8 + 1;
}

#[error_code]
pub enum TicketingError {
    #[msg("Event has sold out")]
    EventSoldOut,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Caller is not the ticket owner")]
    TicketOwnershipMismatch,
    #[msg("Transfers are currently disabled")]
    TransfersDisabled,
    #[msg("Transfer window is locked")]
    TransferLocked,
    #[msg("Resale price exceeds maximum allowed markup")]
    PriceCapExceeded,
    #[msg("Wallet has reached maximum ticket limit for this event")]
    WalletLimitExceeded,
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
