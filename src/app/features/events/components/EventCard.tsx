import type { EventDoc } from "../types";

export default function EventCard({ event }: { event: EventDoc }) {
    return (
        <article className="card">
            <div className="space-between">
                <h3>{event.name}</h3>
                <span className="badge badge--brand">{event.status}</span>
            </div>

            <div className="muted" style={{ marginTop: 6 }}>
                {event.location}
            </div>

            <div className="muted" style={{ marginTop: 6, fontSize: 14 }}>
                {event.startDate} → {event.endDate} • {event.lengthMeters}m
            </div>

            <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>
                Closes: {event.closingDate}
            </div>

            {event.description ? <p style={{ marginTop: 8 }}>{event.description}</p> : null}
        </article>
    );
}
