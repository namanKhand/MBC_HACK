use anchor_lang::prelude::*;

declare_id!("Cul3iuoYiNw4UsVTNff7kwh28ykVfoCkbKzjLx11111");

#[program]
pub mod culture_passport {
    use super::*;

    pub fn mint_badge(
        ctx: Context<MintBadge>,
        event_name: String,
        event_type: EventType,
        ticket_tier: String,
    ) -> Result<()> {
        let badge = &mut ctx.accounts.badge;
        badge.owner = ctx.accounts.recipient.key();
        badge.event = ctx.accounts.event.key();
        badge.event_name = event_name;
        badge.event_type = event_type;
        badge.ticket_tier = ticket_tier;
        badge.check_in_time = Clock::get()?.unix_timestamp;
        badge.bump = *ctx.bumps.get("badge").unwrap();
        Ok(())
    }
}

#[derive(Accounts)]
pub struct MintBadge<'info> {
    /// The wallet that will hold the culture badge
    pub recipient: Signer<'info>,
    /// PDA storing the non-transferable badge data
    #[account(
        init,
        payer = recipient,
        space = 8 + CultureBadge::MAX_SIZE,
        seeds = [b"badge", event.key().as_ref(), recipient.key().as_ref()],
        bump
    )]
    pub badge: Account<'info, CultureBadge>,
    /// Event the badge references. Provided by the ticketing program CPI caller.
    pub event: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct CultureBadge {
    pub owner: Pubkey,
    pub event: Pubkey,
    pub event_name: String,
    pub event_type: EventType,
    pub ticket_tier: String,
    pub check_in_time: i64,
    pub bump: u8,
}

impl CultureBadge {
    pub const MAX_SIZE: usize = 32 // owner
        + 32 // event
        + 4 + 100 // event_name
        + 1 // event_type enum
        + 4 + 50 // ticket tier (allowing room for typical tiers)
        + 8 // timestamp
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
