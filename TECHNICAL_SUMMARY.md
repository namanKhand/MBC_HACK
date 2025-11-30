# Technical Summary

## Problem
Traditional ticketing suffers from:
- Rampant scalping with 10x markups
- No recourse for event cancellations
- No reward for loyal attendees

## Solution
EventGuard uses Solana smart contracts to:
1. Enforce anti-scalping rules on-chain
2. Enable parametric insurance via Polymarket
3. Build verifiable attendance reputation

## Architecture
### On-Chain (Solana)
- **Ticketing Program**: Core event/ticket logic, rules engine, Polymarket integration
- **Culture Passport Program**: Soulbound badges minted on check-in

### Off-Chain
- **Oracle Service**: Polls Polymarket, submits resolutions to Solana
- **Frontend**: Next.js dApp for organizers and users

## Key Technical Decisions
### Why Solana?
- Low fees enable mass ticket operations
- High throughput for real-time check-ins
- Native USDC integration

### Trust Model
- Rules enforced by smart contracts (trustless)
- Oracle verification: Polymarket resolution data stored on-chain for audit
- Soulbound badges prevent fake attendance

## Testing
Comprehensive test suite covering:
- Rule enforcement edge cases
- Refund claim logic
- Badge non-transferability
- Cross-program invocations
