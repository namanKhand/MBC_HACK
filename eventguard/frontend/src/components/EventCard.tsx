interface EventCardProps {
  name: string;
  date: string;
  venue: string;
  description: string;
}

export function EventCard({ name, date, venue, description }: EventCardProps) {
  return (
    <div className="rounded-xl bg-slate-900 border border-slate-800 p-4 shadow-lg">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{name}</h3>
        <span className="text-xs text-slate-400">{date}</span>
      </div>
      <p className="text-sm text-slate-400">{venue}</p>
      <p className="mt-3 text-sm text-slate-300">{description}</p>
    </div>
  );
}
