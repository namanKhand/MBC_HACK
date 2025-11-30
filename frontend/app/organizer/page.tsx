'use client';

import { useMemo, useState } from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { initializeEvent, type EventInitParams } from '../../src/lib/solana';

const defaultRules = {
  max_resale_markup_bps: 1000,
  transfer_lock_start: 48,
  max_tickets_per_wallet: 2,
};

export default function OrganizerPage() {
  const [form, setForm] = useState<EventInitParams>({
    name: '',
    date: '',
    venue: '',
    totalTickets: 0,
    price: 0,
    rules: defaultRules,
    polymarket: {
      market_id: '',
      refund_condition: '',
      refund_percentage: 50,
    },
  });
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isValid = useMemo(
    () => form.name.length > 2 && form.date.length > 3 && form.venue.length > 2 && form.totalTickets > 0,
    [form]
  );

  const handleChange = (key: keyof EventInitParams, value: unknown) => {
    setForm((prev) => ({ ...prev, [key]: value } as EventInitParams));
  };

  const handleRuleChange = (key: keyof EventInitParams['rules'], value: number) => {
    setForm((prev) => ({ ...prev, rules: { ...prev.rules, [key]: value } }));
  };

  const handlePolymarketChange = (key: keyof NonNullable<EventInitParams['polymarket']>, value: string | number) => {
    setForm((prev) => ({ ...prev, polymarket: { ...prev.polymarket, [key]: value } }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setIsLoading(true);
    setResult(null);
    setError(null);
    try {
      const address = await initializeEvent(form);
      setResult(address.toString());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="container-wide py-10 space-y-10">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-accent">Organizer Console</p>
          <h1 className="text-4xl font-bold text-white mt-1">Create an EventGuard drop</h1>
          <p className="text-slate-300 mt-3 max-w-2xl">
            Configure rules, set USDC pricing, and optionally attach a Polymarket protection to trigger automatic refunds.
          </p>
        </div>
        <WalletMultiButton className="cta-button !bg-indigo-600" />
      </div>

      <form onSubmit={onSubmit} className="card p-8 space-y-8">
        <div className="grid gap-6 md:grid-cols-3">
          <div className="space-y-2">
            <label className="text-sm text-slate-300">Event name</label>
            <input
              required
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-3 focus:border-indigo-400 focus:outline-none"
              placeholder="Coachella 2026"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-slate-300">Date</label>
            <input
              required
              value={form.date}
              onChange={(e) => handleChange('date', e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-3 focus:border-indigo-400 focus:outline-none"
              placeholder="April 10, 2026"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-slate-300">Venue</label>
            <input
              required
              value={form.venue}
              onChange={(e) => handleChange('venue', e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-3 focus:border-indigo-400 focus:outline-none"
              placeholder="Indio, CA"
            />
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <div className="space-y-2">
            <label className="text-sm text-slate-300">Total tickets</label>
            <input
              type="number"
              min={0}
              value={form.totalTickets}
              onChange={(e) => handleChange('totalTickets', Number(e.target.value))}
              className="w-full rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-3 focus:border-indigo-400 focus:outline-none"
              placeholder="5000"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-slate-300">Price (USDC)</label>
            <input
              type="number"
              min={0}
              value={form.price}
              onChange={(e) => handleChange('price', Number(e.target.value))}
              className="w-full rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-3 focus:border-indigo-400 focus:outline-none"
              placeholder="100"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-slate-300">Polymarket refund %</label>
            <input
              type="number"
              min={0}
              max={100}
              value={form.polymarket?.refund_percentage ?? 0}
              onChange={(e) => handlePolymarketChange('refund_percentage', Number(e.target.value))}
              className="w-full rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-3 focus:border-indigo-400 focus:outline-none"
              placeholder="50"
            />
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <div className="space-y-2">
            <label className="text-sm text-slate-300">Max resale markup (bps)</label>
            <input
              type="number"
              min={0}
              value={form.rules.max_resale_markup_bps}
              onChange={(e) => handleRuleChange('max_resale_markup_bps', Number(e.target.value))}
              className="w-full rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-3 focus:border-indigo-400 focus:outline-none"
              placeholder="1000"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-slate-300">Transfer lock (hours before)</label>
            <input
              type="number"
              min={0}
              value={form.rules.transfer_lock_start}
              onChange={(e) => handleRuleChange('transfer_lock_start', Number(e.target.value))}
              className="w-full rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-3 focus:border-indigo-400 focus:outline-none"
              placeholder="48"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-slate-300">Max tickets per wallet</label>
            <input
              type="number"
              min={1}
              value={form.rules.max_tickets_per_wallet}
              onChange={(e) => handleRuleChange('max_tickets_per_wallet', Number(e.target.value))}
              className="w-full rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-3 focus:border-indigo-400 focus:outline-none"
              placeholder="2"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm text-slate-300">Polymarket protection (optional)</label>
          <div className="grid gap-4 md:grid-cols-3">
            <input
              value={form.polymarket?.market_id ?? ''}
              onChange={(e) => handlePolymarketChange('market_id', e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-3 focus:border-indigo-400 focus:outline-none"
              placeholder="Market ID"
            />
            <input
              value={form.polymarket?.refund_condition ?? ''}
              onChange={(e) => handlePolymarketChange('refund_condition', e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-3 focus:border-indigo-400 focus:outline-none"
              placeholder="Refund condition (e.g. Rain)"
            />
            <input
              value={form.polymarket?.refund_percentage ?? ''}
              readOnly
              className="w-full rounded-xl border border-dashed border-slate-800 bg-slate-900/40 px-4 py-3 text-slate-500"
              placeholder="Refund % auto-applied"
            />
          </div>
          <p className="subtext">Oracle listens for Polymarket resolutions and submits proofs to the ticketing program.</p>
        </div>

        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <button type="submit" disabled={!isValid || isLoading} className="cta-button disabled:opacity-60">
            {isLoading ? 'Creating...' : 'Create event'}
          </button>
          {result && <p className="text-sm text-accent">Event created at address: {result}</p>}
          {error && <p className="text-sm text-rose-400">{error}</p>}
        </div>
      </form>
    </main>
  );
}
