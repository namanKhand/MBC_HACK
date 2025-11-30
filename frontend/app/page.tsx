'use client';

import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { ArrowRightIcon, ShieldCheckIcon, TicketIcon } from '@heroicons/react/24/solid';
import { EventCard } from '../src/components/EventCard';

const demoEvents = [
  {
    id: 'coachella-2026',
    name: 'Coachella 2026',
    date: 'April 10, 2026',
    venue: 'Indio, CA',
    price: 100,
    totalTickets: 5000,
    protection: '50% refund if rain (Polymarket)',
    rules: ['Max 10% resale markup', 'Transfer lock 48h before show', 'Max 2 per wallet'],
  },
  {
    id: 'nyc-jazz',
    name: 'NYC Night Jazz',
    date: 'December 12, 2025',
    venue: 'Blue Note, NYC',
    price: 45,
    totalTickets: 320,
    protection: 'Full refund if headliner cancels',
    rules: ['No transfer after check-in window', 'Max 1 per wallet'],
  },
  {
    id: 'hackathon-finals',
    name: 'Hack the Planet Finals',
    date: 'January 20, 2026',
    venue: 'Solana Spaces, SF',
    price: 0,
    totalTickets: 400,
    protection: 'Badge-only entry, non-transferable',
    rules: ['Soulbound badge on attendance'],
  },
];

export default function HomePage() {
  return (
    <main className="container-wide py-10 space-y-12">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-accent">EventGuard · Devnet Demo</p>
          <h1 className="text-4xl font-bold text-white mt-1">Prediction-powered NFT ticketing</h1>
          <p className="text-slate-300 mt-3 max-w-2xl">
            Anti-scalping rules on-chain, USDC-powered payouts, and Polymarket-backed protection. Built
            for event organizers and fans who care about fairness.
          </p>
        </div>
        <WalletMultiButton className="cta-button !bg-indigo-600" />
      </header>

      <section className="card p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/10 px-3 py-1 text-indigo-200 text-sm">
              <ShieldCheckIcon className="h-5 w-5" />
              Protected by Polymarket + USDC
            </div>
            <h2 className="text-3xl font-semibold text-white">Let fans buy with confidence</h2>
            <p className="text-slate-300 max-w-3xl">
              EventGuard enforces your rules at the smart contract level. Price caps, transfer locks, and wallet limits
              stop scalpers before they start. If the market predicts trouble, automated USDC refunds keep fans safe.
            </p>
            <div className="flex flex-wrap gap-3 text-sm text-slate-200">
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-800 px-3 py-1">
                <TicketIcon className="h-4 w-4 text-accent" />
                Culture Passport badges on check-in
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-800 px-3 py-1">
                <ArrowRightIcon className="h-4 w-4 text-accent" />
                Instant USDC payouts on refunds
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-800 px-3 py-1">
                <ShieldCheckIcon className="h-4 w-4 text-accent" />
                Devnet-ready demo flow
              </span>
            </div>
          </div>
          <div className="card w-full md:w-96 p-6 space-y-3">
            <p className="text-sm uppercase text-slate-400">Demo steps</p>
            <ol className="space-y-2 text-slate-200 text-sm list-decimal list-inside">
              <li>Connect Phantom (Devnet)</li>
              <li>Create a protected event</li>
              <li>Buy ticket with USDC</li>
              <li>Simulate refund + mint badge</li>
            </ol>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="section-title">Available events</h3>
            <p className="subtext">Pre-seeded events ready for demo. Buying mints an NFT ticket and enforces rules.</p>
          </div>
          <a href="/organizer" className="cta-button">
            Create event
            <ArrowRightIcon className="h-4 w-4" />
          </a>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {demoEvents.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      </section>
    </main>
  );
}
