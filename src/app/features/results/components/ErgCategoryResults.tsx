import ErgResults from "./ErgResults";
import type { ErgEntry, LeaderboardProfile } from "./ErgResultCard";

interface Props {
    byCategory: Map<string, ErgEntry[]>;   // each bucket already sorted fastest-first
    distanceMeters: number;
    profiles: Record<string, LeaderboardProfile>;
    currentUserUid?: string;
    linkedAthleteUids?: Set<string>;
}

/** Erg leaderboard grouped by category. Mirrors CategoryResults for open water. */
export default function ErgCategoryResults({
    byCategory,
    distanceMeters,
    profiles,
    currentUserUid,
    linkedAthleteUids,
}: Props) {
    const categories = Array.from(byCategory.entries()).sort((a, b) => a[0].localeCompare(b[0]));

    if (categories.length === 0) {
        return (
            <div className="card">
                <p className="muted" style={{ fontSize: 13, margin: 0 }}>No verified scores yet.</p>
            </div>
        );
    }

    return (
        <div className="grid gap-4">
            {categories.map(([name, entries]) => (
                <div key={name}>
                    <h4 className="mb-2">{name}</h4>
                    <ErgResults
                        entries={entries}
                        distanceMeters={distanceMeters}
                        profiles={profiles}
                        currentUserUid={currentUserUid}
                        linkedAthleteUids={linkedAthleteUids}
                    />
                </div>
            ))}
        </div>
    );
}
