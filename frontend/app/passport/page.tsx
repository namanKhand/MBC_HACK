'use client';

import { useEffect, useMemo, useState } from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useWallet } from '@solana/wallet-adapter-react';
import { getUserBadges, getUserTickets, type Badge, type Ticket } from '../../src/lib/solana';
import { TicketCard } from '../../src/components/TicketCard';
import { BadgeCard } from '../../src/components/BadgeCard';

export default function PassportPage() {
  const { publicKey } = useWallet();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!publicKey) return;
      setLoading(true);
      const [userTickets, userBadges] = await Promise.all([
        getUserTickets(publicKey),
        getUserBadges(publicKey),
      ]);
      setTickets(userTickets);
      setBadges(userBadges);
      setLoading(false);
    };
    fetchData();
  }, [publicKey]);

  const stats = useMemo(() => {
    const totals = badges.reduce<Record<string, number>>((acc, badge) => {
      acc[badge.category] = (acc[badge.category] || 0) + 1;
      return acc;
    }, {});
    return totals;
  }, [badges]);

  return (
    <main className="container-wide py-10 space-y-10">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-accent">Culture Passport</p>
          <h1 className="text-4xl font-bold text-white mt-1">Your verified attendance record</h1>
          <p className="text-slate-300 mt-3 max-w-3xl">
            Tickets and badges are minted on Solana. Share your Passport to unlock VIP access, whitelist spots, and early drops.
          </p>
        </div>
        <WalletMultiButton className="cta-button !bg-indigo-600" />
      </div>

      {!publicKey && (
        <div className="card p-6 text-slate-200">
          Connect your wallet to load tickets and badges.
        </div>
      )}

      {publicKey && (
        <div className="space-y-6">
          <div className="card p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <p className="text-sm text-slate-400">Connected wallet</p>
                <p className="font-mono text-lg text-white">{publicKey.toBase58()}</p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="card p-4">
                  <p className="text-slate-400">Total events</p>
                  <p className="text-2xl font-semibold">{badges.length}</p>
                </div>
                <div className="card p-4">
                  <p className="text-slate-400">Tickets</p>
                  <p className="text-2xl font-semibold">{tickets.length}</p>
                </div>
              </div>
            </div>
          </div>

          <section className="space-y-3">
            <h2 className="section-title">Tickets</h2>
            {loading ? (
              <p className="subtext">Loading tickets...</p>
            ) : tickets.length === 0 ? (
              <p className="subtext">No tickets yet. Buy from the home page to mint one.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {tickets.map((ticket) => (
                  <TicketCard key={ticket.mint.toBase58()} ticket={ticket} />
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="section-title">Culture badges</h2>
            {loading ? (
              <p className="subtext">Loading badges...</p>
            ) : badges.length === 0 ? (
              <p className="subtext">Check in at events to mint your first badge.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                {badges.map((badge) => (
                  <BadgeCard key={`${badge.eventName}-${badge.timestamp}`} badge={badge} />
                ))}
              </div>
            )}
          </section>

          {badges.length > 0 && (
            <section className="card p-6 space-y-3">
              <h3 className="section-title">Attendance breakdown</h3>
              <div className="grid gap-4 md:grid-cols-3">
                {Object.entries(stats).map(([category, count]) => (
                  <div key={category} className="card p-4">
                    <p className="text-slate-400 capitalize">{category}</p>
                    <p className="text-2xl font-semibold">{count}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </main>
  );
}
