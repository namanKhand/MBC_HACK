import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { Connection, PublicKey } from '@solana/web3.js';
import { useAnchorWallet } from '@solana/wallet-adapter-react';

export type EventInitParams = {
  name: string;
  date: string;
  venue: string;
  totalTickets: number;
  price: number;
  rules: {
    max_resale_markup_bps: number;
    transfer_lock_start: number;
    max_tickets_per_wallet: number;
  };
  polymarket?: {
    market_id: string;
    refund_condition: string;
    refund_percentage: number;
  };
};

export type Ticket = {
  eventName: string;
  date: string;
  venue: string;
  price: number;
  checkedIn: boolean;
  refundEligible: boolean;
  transferLocked: boolean;
  mint: PublicKey;
};

export type Badge = {
  eventName: string;
  category: string;
  venue: string;
  timestamp: number;
};

// Placeholder program + provider bootstrapping
export function useAnchorProgram() {
  const wallet = useAnchorWallet();
  const connection = new Connection(anchor.web3.clusterApiUrl('devnet'));
  const provider = wallet ? new anchor.AnchorProvider(connection, wallet, {}) : null;
  const program = provider ? new Program({} as anchor.Idl, PublicKey.default, provider) : null;
  return { wallet, provider, program };
}

export async function initializeEvent(params: EventInitParams) {
  // Placeholder for Anchor call to initialize_event
  const mockAddress = anchor.web3.Keypair.generate().publicKey;
  console.log('Initialize event with params', params);
  return mockAddress;
}

export async function mintTicket(eventPubkey: PublicKey | string) {
  // Placeholder for Anchor call to mint_ticket
  console.log('Mint ticket for', eventPubkey.toString());
  return true;
}

export async function getUserTickets(walletPubkey: PublicKey): Promise<Ticket[]> {
  // Placeholder: return mock tickets for demo UI
  const demoMint = anchor.web3.Keypair.generate().publicKey;
  return [
    {
      eventName: 'Coachella 2026',
      date: 'April 10, 2026',
      venue: 'Indio, CA',
      price: 100,
      checkedIn: false,
      refundEligible: true,
      transferLocked: false,
      mint: demoMint,
    },
  ];
}

export async function getUserBadges(walletPubkey: PublicKey): Promise<Badge[]> {
  // Placeholder: return mock badges for demo UI
  return [
    {
      eventName: 'NYC Night Jazz',
      category: 'music',
      venue: 'Blue Note, NYC',
      timestamp: Date.now() - 1000 * 60 * 60 * 24,
    },
    {
      eventName: 'Hack the Planet Finals',
      category: 'tech',
      venue: 'Solana Spaces, SF',
      timestamp: Date.now() - 1000 * 60 * 60 * 12,
    },
  ];
}
