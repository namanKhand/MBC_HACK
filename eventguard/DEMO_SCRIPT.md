# Demo Script

## Setup
- Install dependencies (Anchor, oracle service, frontend)
- Configure devnet wallet and environment variables

## Flow
1. Organizer deploys ticketing + culture passport programs (mock for demo).
2. Organizer lists an event and mints ticket supply.
3. User connects wallet in the frontend and claims/purchases a ticket.
4. Oracle ingests a Polymarket market and updates the program state.
5. Ticket validation reacts to oracle result (e.g., refunds, perks, or access control).
6. Culture passport issues a badge after attendance/outcome verification.

## Notes
- Highlight where prediction markets influence ticketing logic.
- Emphasize Circle/USDC settlement potential.
