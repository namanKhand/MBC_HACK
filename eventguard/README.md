# EventGuard - Prediction-Powered NFT Ticketing

**Track:** Solana + Polymarket + Circle/USDC bounties

## Table of Contents
- [Overview](#overview)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Contracts](#contracts)
- [Oracle Service](#oracle-service)
- [Frontend](#frontend)
- [Demo Script](#demo-script)

## Overview
EventGuard combines on-chain ticketing with Polymarket oracle signals to gate entry, rewards, and pricing for live events. This repository initializes the Anchor workspace, oracle scaffolding, and Next.js dApp for the MBC 25 hackathon.

## Architecture
- **Anchor Programs:** Ticketing and culture passport programs for NFT ticket issuance and badge rewards.
- **Oracle Service:** Off-chain Polymarket listener that relays market outcomes to Solana.
- **Frontend:** Next.js app with wallet adapter for organizers and attendees.

## Quick Start
> TODO: Fill in detailed commands as the project matures.

- Anchor workspace
  - `cd anchor`
  - `anchor build`
  - `anchor test`

- Oracle service
  - `cd oracle-service`
  - `npm install`
  - `npm run dev`

- Frontend
  - `cd frontend`
  - `npm install`
  - `npm run dev`

## Contracts
- `anchor/programs/ticketing`: Ticket minting and validation logic scaffolded.
- `anchor/programs/culture_passport`: Badge issuance and culture passport logic scaffolded.

## Oracle Service
- `oracle-service/src/polymarket.ts`: Polymarket client configuration placeholder.
- `oracle-service/src/solana.ts`: Solana client configuration placeholder.
- `oracle-service/src/index.ts`: Wiring layer to sync oracle data to Solana programs.

## Frontend
- Next.js App Router with Tailwind and Solana wallet adapter.
- Organizer and attendee-focused routes under `src/app`.

## Demo Script
See [DEMO_SCRIPT.md](./DEMO_SCRIPT.md) for a walkthrough outline.
