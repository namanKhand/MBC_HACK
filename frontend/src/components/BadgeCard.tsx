'use client';

import { SparklesIcon } from '@heroicons/react/24/solid';
import type { Badge } from '../lib/solana';

export function BadgeCard({ badge }: { badge: Badge }) {
  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400">{badge.eventName}</p>
          <p className="text-lg font-semibold text-white capitalize">{badge.category}</p>
        </div>
        <SparklesIcon className="h-6 w-6 text-accent" />
      </div>
      <p className="text-sm text-slate-300">Checked in at {badge.venue}</p>
      <p className="text-xs text-slate-500">{new Date(badge.timestamp).toLocaleString()}</p>
    </div>
  );
}
