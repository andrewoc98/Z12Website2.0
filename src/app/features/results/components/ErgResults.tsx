import ErgResultCard, { type ErgEntry, type LeaderboardProfile } from "./ErgResultCard";

interface Props {
    entries: ErgEntry[];          // already sorted fastest-first
    distanceMeters: number;
    profiles: Record<string, LeaderboardProfile>;
    currentUserUid?: string;
    linkedAthleteUids?: Set<string>;
    /** Rank offset for paginated pages, so page 2 starts at 11 rather than 1. */
    rankOffset?: number;
    pendingCount?: number;
}

/** Flat, fastest-first erg leaderboard. Mirrors OverallResults for open water. */
export default function ErgResults({
    entries,
    distanceMeters,
    profiles,
    currentUserUid,
    linkedAthleteUids,
    rankOffset = 0,
    pendingCount = 0,
}: Props) {
    if (entries.length === 0) {
        return (
            <div className="card">
                <p className="muted" style={{ fontSize: 13, margin: 0 }}>
                    No verified scores yet.
                    {pendingCount > 0 &&
                        ` ${pendingCount} ${pendingCount === 1 ? "athlete has" : "athletes have"} entered but not yet posted a valid 2k.`}
                </p>
            </div>
        );
    }

    return (
        <ul className="grid gap-2 list-none p-0 m-0">
            {entries.map((entry, idx) => (
                <ErgResultCard
                    key={entry.id}
                    entry={entry}
                    rank={rankOffset + idx + 1}
                    distanceMeters={distanceMeters}
                    profiles={profiles}
                    currentUserUid={currentUserUid}
                    linkedAthleteUids={linkedAthleteUids}
                />
            ))}
        </ul>
    );
}
