'use client';

import { ArrowPathIcon, CheckBadgeIcon, ClockIcon } from '@heroicons/react/24/outline';
import type { Ticket } from '../lib/solana';

export function TicketCard({ ticket }: { ticket: Ticket }) {
  return (
    <div className="card p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400">{ticket.date} · {ticket.venue}</p>
          <p className="text-lg font-semibold text-white">{ticket.eventName}</p>
        </div>
        <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-200">{ticket.price} USDC</span>
      </div>
      <div className="flex items-center gap-3 text-sm text-slate-300">
        <CheckBadgeIcon className={`h-5 w-5 ${ticket.checkedIn ? 'text-accent' : 'text-slate-500'}`} />
        {ticket.checkedIn ? 'Checked in' : 'Not checked in'}
        <ClockIcon className="h-4 w-4 text-slate-500" />
        Refund eligible: {ticket.refundEligible ? 'Yes' : 'No'}
        <ArrowPathIcon className="h-4 w-4 text-slate-500" />
        Transfer locked: {ticket.transferLocked ? 'Yes' : 'No'}
      </div>
      <p className="text-xs text-slate-500">Mint: {ticket.mint.toBase58()}</p>
    </div>
  );
}
