use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use culture_passport::program::CulturePassport;
use culture_passport::{self, CultureBadge, EventType as BadgeEventType};

declare_id!("Tktjg6i8KibGCQjB7UBPYfL5b87ZExPsg1p7u111111");

// Trusted oracle responsible for submitting Polymarket resolutions.
const ORACLE_PUBKEY: &str = "PolyMrktOracle111111111111111111111111111";

#[program]
pub mod ticketing {
    use super::*;

    pub fn create_event(
        ctx: Context<CreateEvent>,
        name: String,
        ticket_price: u64,
    ) -> Result<()> {
        let event = &mut ctx.accounts.event;
        event.authority = ctx.accounts.authority.key();
        event.name = name;
        event.ticket_price = ticket_price;
        event.protection_enabled = false;
        event.polymarket_market_id = String::new();
        event.refund_condition = RefundCondition::OnYes;
        event.refund_percentage = 0;
        event.market_resolved = false;
        event.resolution_triggered_refund = false;
        Ok(())
    }

    pub fn buy_ticket(ctx: Context<BuyTicket>) -> Result<()> {
        let ticket = &mut ctx.accounts.ticket;
        ticket.owner = ctx.accounts.buyer.key();
        ticket.event = ctx.accounts.event.key();
        ticket.purchase_price = ctx.accounts.event.ticket_price;
        ticket.checked_in = false;
        ticket.refund_claimed = false;
        ticket.bump = *ctx.bumps.get("ticket").unwrap();
        Ok(())
    }

    pub fn check_in_ticket(
        ctx: Context<CheckInTicket>,
        event_name: String,
        event_type: EventType,
        ticket_tier: String,
    ) -> Result<()> {
        require_keys_eq!(ctx.accounts.ticket.owner, ctx.accounts.authority.key());
        require!(!ctx.accounts.ticket.checked_in, TicketingError::AlreadyCheckedIn);

        ctx.accounts.ticket.checked_in = true;

        // CPI into culture passport to mint a non-transferable badge
        let cpi_program = ctx.accounts.culture_passport_program.to_account_info();
        let cpi_accounts = culture_passport::cpi::accounts::MintBadge {
            recipient: ctx.accounts.authority.to_account_info(),
            badge: ctx.accounts.badge.to_account_info(),
            event: ctx.accounts.event.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        culture_passport::cpi::mint_badge(
            cpi_ctx,
            event_name,
            event_type.into(),
            ticket_tier,
        )?;
        Ok(())
    }

    pub fn attach_polymarket_protection(
        ctx: Context<AttachPolymarketProtection>,
        market_id: String,
        refund_condition: RefundCondition,
        refund_percentage: u8,
    ) -> Result<()> {
        require_keys_eq!(ctx.accounts.event.authority, ctx.accounts.authority.key());
        require!(refund_percentage <= 100, TicketingError::InvalidRefundPercentage);

        let event = &mut ctx.accounts.event;
        event.protection_enabled = true;
        event.polymarket_market_id = market_id;
        event.refund_condition = refund_condition;
        event.refund_percentage = refund_percentage;
        event.market_resolved = false;
        event.resolution_triggered_refund = false;
        Ok(())
    }

    pub fn record_market_resolution(
        ctx: Context<RecordMarketResolution>,
        market_resolved_yes: bool,
    ) -> Result<()> {
        let expected_oracle: Pubkey = ORACLE_PUBKEY.parse().unwrap_or_default();
        require_keys_eq!(ctx.accounts.oracle.key(), expected_oracle, TicketingError::InvalidOracle);

        let event = &mut ctx.accounts.event;
        event.market_resolved = true;
        if (market_resolved_yes && event.refund_condition == RefundCondition::OnYes)
            || (!market_resolved_yes && event.refund_condition == RefundCondition::OnNo)
        {
            event.resolution_triggered_refund = true;
        }
        Ok(())
    }

    pub fn claim_refund(ctx: Context<ClaimRefund>) -> Result<()> {
        require_keys_eq!(ctx.accounts.ticket.owner, ctx.accounts.claimer.key());
        require!(ctx.accounts.event.resolution_triggered_refund, TicketingError::RefundNotAvailable);
        require!(!ctx.accounts.ticket.refund_claimed, TicketingError::RefundAlreadyClaimed);
        require_keys_eq!(ctx.accounts.event.authority, ctx.accounts.event_authority.key());

        let refund_amount = ctx.accounts.ticket.purchase_price
            .checked_mul(ctx.accounts.event.refund_percentage as u64)
            .ok_or(TicketingError::Overflow)?
            / 100;

        let seeds: &[&[&[u8]]] = &[];
        let cpi_accounts = Transfer {
            from: ctx.accounts.event_usdc_vault.to_account_info(),
            to: ctx.accounts.claimer_usdc.to_account_info(),
            authority: ctx.accounts.event_authority.clone(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
            seeds,
        );
        token::transfer(cpi_ctx, refund_amount)?;

        ctx.accounts.ticket.refund_claimed = true;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct CreateEvent<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(init, payer = authority, space = 8 + Event::MAX_SIZE)]
    pub event: Account<'info, Event>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct BuyTicket<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    pub event: Account<'info, Event>,
    #[account(
        init,
        payer = buyer,
        space = 8 + Ticket::MAX_SIZE,
        seeds = [b"ticket", event.key().as_ref(), buyer.key().as_ref()],
        bump
    )]
    pub ticket: Account<'info, Ticket>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CheckInTicket<'info> {
    pub authority: Signer<'info>,
    #[account(mut)]
    pub ticket: Account<'info, Ticket>,
    pub event: Account<'info, Event>,
    /// CHECK: PDA created in the CPI call
    #[account(mut)]
    pub badge: Account<'info, CultureBadge>,
    pub system_program: Program<'info, System>,
    pub culture_passport_program: Program<'info, CulturePassport>,
}

#[derive(Accounts)]
pub struct AttachPolymarketProtection<'info> {
    pub authority: Signer<'info>,
    #[account(mut)]
    pub event: Account<'info, Event>,
}

#[derive(Accounts)]
pub struct RecordMarketResolution<'info> {
    pub oracle: Signer<'info>,
    #[account(mut)]
    pub event: Account<'info, Event>,
}

#[derive(Accounts)]
pub struct ClaimRefund<'info> {
    pub claimer: Signer<'info>,
    #[account(mut)]
    pub ticket: Account<'info, Ticket>,
    #[account(mut)]
    pub event: Account<'info, Event>,
    #[account(mut)]
    pub event_usdc_vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub claimer_usdc: Account<'info, TokenAccount>,
    pub event_authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[account]
pub struct Event {
    pub authority: Pubkey,
    pub name: String,
    pub ticket_price: u64,
    // Polymarket protection
    pub protection_enabled: bool,
    pub polymarket_market_id: String,
    pub refund_condition: RefundCondition,
    pub refund_percentage: u8,
    pub market_resolved: bool,
    pub resolution_triggered_refund: bool,
}

impl Event {
    pub const MAX_SIZE: usize = 32 // authority
        + 4 + 100 // name
        + 8 // price
        + 1 // protection enabled
        + 4 + 100 // market id
        + 1 // refund condition enum
        + 1 // refund percentage
        + 1 // market_resolved
        + 1; // resolution_triggered_refund
}

#[account]
pub struct Ticket {
    pub owner: Pubkey,
    pub event: Pubkey,
    pub purchase_price: u64,
    pub checked_in: bool,
    pub refund_claimed: bool,
    pub bump: u8,
}

impl Ticket {
    pub const MAX_SIZE: usize = 32 // owner
        + 32 // event
        + 8 // purchase price
        + 1 // checked in
        + 1 // refund claimed
        + 1; // bump
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum EventType {
    Music,
    Sports,
    Conference,
    Festival,
    Other,
}

impl From<EventType> for BadgeEventType {
    fn from(value: EventType) -> Self {
        match value {
            EventType::Music => BadgeEventType::Music,
            EventType::Sports => BadgeEventType::Sports,
            EventType::Conference => BadgeEventType::Conference,
            EventType::Festival => BadgeEventType::Festival,
            EventType::Other => BadgeEventType::Other,
        }
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum RefundCondition {
    OnYes,
    OnNo,
}

#[error_code]
pub enum TicketingError {
    #[msg("Ticket already checked in")]
    AlreadyCheckedIn,
    #[msg("Invalid oracle signer")]
    InvalidOracle,
    #[msg("Refund percentage must be <= 100")]
    InvalidRefundPercentage,
    #[msg("Refund not available for this ticket")]
    RefundNotAvailable,
    #[msg("Refund already claimed")]
    RefundAlreadyClaimed,
    #[msg("Math overflow")] 
    Overflow,
}
