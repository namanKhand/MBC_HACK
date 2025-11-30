use anchor_lang::prelude::*;

declare_id!("TickeT111111111111111111111111111111111111");

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
}
