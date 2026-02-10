import {useUserResults} from "../../results/hooks/useUserResults.ts";

type Props = { uid: string };

export default function PublicProfileResults({ uid }: Props) {
    const { results, loading } = useUserResults(uid);

    if (loading) return <p className="muted">Loading results…</p>;
    if (!results.length) return <p className="muted">No race results yet</p>;
    // Sort by most recent and limit to last 5 results
    const lastFive = [...results]
        .sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0))
        .slice(0, 5);

    return (
        <section className="card profile-section results-section">
            <h3 className="section-title">Recent Race Results</h3>

            <ul className="results-list">
                {lastFive.map((r, idx) => {
                    const place = calculatePlace(r, results);

                    return (
                        <li
                            key={`${r.id}-${r.eventId}-${r.categoryId}-${idx}`} // composite key
                            className="result-card"
                        >
                            <div className="result-main">
                                <div className="result-time">{formatTime(r.finishedAt - r.startedAt)}</div>
                                <div className="result-info">
                                    <div className="result-event">
                                        {r.eventName ?? "Unknown Event"}
                                        {r.location ? ` • ${r.location}` : ""}
                                    </div>
                                    <div className="result-category">
                                        {r.categoryName ?? r.category ?? "—"} •{" "}
                                        <span className={`badge ${badgeColor(place)}`}>
                                            {formatPlace(place)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}

/* ORDINAL + BADGE LOGIC */
function formatPlace(n?: number) {
    if (!n) return "—";

    if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`;

    switch (n % 10) {
        case 1: return `${n}st`;
        case 2: return `${n}nd`;
        case 3: return `${n}rd`;
        default: return `${n}th`;
    }
}

function badgeColor(n?: number) {
    switch (n) {
        case 1: return "badge-gold";
        case 2: return "badge-silver";
        case 3: return "badge-bronze";
        default: return "badge-soft";
    }
}

/* TIME FORMAT: mm:ss.s, omit 0: for <1 minute */
function formatTime(milliseconds: number) {
    const seconds = milliseconds / 1000;
    if (seconds < 60) return seconds.toFixed(1);

    const m = Math.floor(seconds / 60);
    const s = (seconds % 60).toFixed(1).padStart(4, "0");
    return `${m}:${s}`;
}

/* CALCULATE PLACE BASED ON BOAT CATEGORY & EVENT */
function calculatePlace(boat: any, allBoats: any[]) {
    if (!boat.eventId || !boat.categoryId) return undefined;

    // Only boats in same event & category
    const group = allBoats.filter(
        b => b.eventId === boat.eventId && b.categoryId === boat.categoryId
    );

    // Sort ascending by finishedAt (fastest first)
    const sorted = [...group].sort((a, b) => a.finishedAt - b.finishedAt);

    const idx = sorted.findIndex(b => b.id === boat.id);
    return idx >= 0 ? idx + 1 : undefined;
}