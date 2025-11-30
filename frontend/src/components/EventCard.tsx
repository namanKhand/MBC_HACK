'use client';

import { useState } from 'react';
import { ArrowDownCircleIcon, ShieldCheckIcon, TicketIcon } from '@heroicons/react/24/outline';
import { mintTicket } from '../lib/solana';

export type EventInfo = {
  id: string;
  name: string;
  date: string;
  venue: string;
  price: number;
  totalTickets: number;
  protection: string;
  rules: string[];
};

export function EventCard({ event }: { event: EventInfo }) {
  const [status, setStatus] = useState<string>('');

  const handleBuy = async () => {
    setStatus('Processing...');
    try {
      await mintTicket(event.id);
      setStatus('Ticket minted! Check your wallet.');
    } catch (err) {
      setStatus((err as Error).message);
    }
  };

  return (
    <div className="card p-6 space-y-4 flex flex-col justify-between">
      <div className="space-y-1">
        <p className="text-sm text-slate-400">{event.date} · {event.venue}</p>
        <h3 className="text-xl font-semibold text-white">{event.name}</h3>
      </div>
      <div className="space-y-2 text-sm text-slate-300">
        <p className="flex items-center gap-2"><ShieldCheckIcon className="h-4 w-4 text-accent" />{event.protection}</p>
        <div className="space-y-1">
          {event.rules.map((rule) => (
            <p key={rule} className="flex items-center gap-2 text-slate-400">
              <ArrowDownCircleIcon className="h-4 w-4 text-primary" />
              {rule}
            </p>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-400">Price</p>
          <p className="text-lg font-semibold text-white">{event.price} USDC</p>
        </div>
        <button onClick={handleBuy} className="cta-button">
          <TicketIcon className="h-4 w-4" />
          Buy ticket
        </button>
      </div>
      {status && <p className="text-xs text-slate-400">{status}</p>}
    </div>
  );
}
