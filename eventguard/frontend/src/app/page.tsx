import { EventCard } from "../components/EventCard";
import { TicketCard } from "../components/TicketCard";

const sampleEvents = [
  {
    name: "Hackathon Live Show",
    date: "Oct 12, 2025",
    venue: "MBC Arena",
    description: "Prediction markets secure entry and pricing for every seat.",
  },
  {
    name: "Culture Lab",
    date: "Oct 13, 2025",
    venue: "Innovation Hall",
    description: "Earn culture passports for curated on-chain experiences.",
  },
];

export default function HomePage() {
  return (
    <div className="grid gap-8 md:grid-cols-2">
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Events</h2>
          <p className="text-sm text-slate-400">
            Mint on-chain tickets that react to Polymarket oracle signals.
          </p>
        </div>
        <div className="space-y-3">
          {sampleEvents.map((event) => (
            <EventCard key={event.name} {...event} />
          ))}
        </div>
      </section>
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Your Tickets</h2>
          <p className="text-sm text-slate-400">Connected wallet tickets appear here.</p>
        </div>
        <div className="space-y-3">
          <TicketCard holder="demo.sol" seat="Floor A12" status="active" />
          <TicketCard holder="demo.sol" seat="Balcony B08" status="scanned" />
        </div>
      </section>
    </div>
  );
}
