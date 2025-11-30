interface TicketCardProps {
  holder: string;
  seat: string;
  status: "active" | "scanned" | "void";
}

export function TicketCard({ holder, seat, status }: TicketCardProps) {
  const badgeColor = {
    active: "bg-emerald-500",
    scanned: "bg-amber-500",
    void: "bg-rose-500",
  }[status];

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400">Holder</p>
          <p className="font-semibold">{holder}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeColor} text-slate-950`}>
          {status.toUpperCase()}
        </span>
      </div>
      <p className="mt-2 text-sm text-slate-300">Seat: {seat}</p>
    </div>
  );
}
