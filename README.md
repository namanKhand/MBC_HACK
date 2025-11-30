# EventGuard - Prediction-Powered NFT Ticketing

**Track:** Solana + Polymarket + Circle/USDC bounties

## Overview
EventGuard revolutionizes event ticketing with three core innovations:
1. **Anti-Scalping Rules**: On-chain price caps, transfer locks, wallet limits
2. **Prediction-Powered Refunds**: Automatic USDC refunds via Polymarket oracle
3. **Culture Passport**: Soulbound badges that build attendance reputation

## Table of Contents
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Demo Flow](#demo-flow)

## Architecture
```
+-----------------+        +----------------------+        +-----------------+
|  Next.js Frontend| <----> |  Oracle Service      | <----> |  Polymarket API |
+--------+--------+        +----------+-----------+        +--------+--------+
         |                            |                             |
         v                            v                             |
+--------+---------+       +----------+-----------+                 |
| Solana Programs  |       |  USDC Treasury / PDA |<----------------+
| - Ticketing      |       +----------------------+ 
| - Culture Badge  |
+------------------+
```

## Quick Start
### Prerequisites
- Node.js 18+
- Rust + Solana CLI
- Anchor 0.29+

### Installation
```bash
git clone [repo]
cd eventguard

# Install anchor programs
cd anchor && anchor build

# Install oracle service
cd ../oracle-service && npm install

# Install frontend
cd ../frontend && npm install
```

### Running Locally
```bash
# Terminal 1: Local validator
solana-test-validator

# Terminal 2: Deploy programs
cd anchor && anchor deploy

# Terminal 3: Oracle service
cd oracle-service && npm start

# Terminal 4: Frontend
cd frontend && npm run dev
```

## Features
### For Event Organizers
- Create events with configurable ticketing rules
- Set price caps to prevent scalping
- Enable transfer locks near event date
- Attach Polymarket protections for automatic refunds

### For Attendees  
- Buy tickets with USDC
- Receive automatic refunds if protection conditions met
- Build Culture Passport through attendance
- Earn reputation for early access

## Tech Stack
- **Blockchain:** Solana (Devnet)
- **Smart Contracts:** Anchor Framework (Rust)
- **Frontend:** Next.js 14, React, TypeScript
- **Wallet:** Solana Wallet Adapter (Phantom)
- **Oracle:** Node.js + Polymarket API
- **Token:** USDC (SPL Token)

## Demo Flow
[Include 3-minute walkthrough]

## Bounty Alignment
- **Solana Track:** Uses Anchor, deployed to devnet, leverages SPL tokens
- **Polymarket:** Oracle reads market resolutions, triggers parametric refunds
- **Circle/USDC:** Native USDC integration for ticket sales and refunds
