import { useEffect, useMemo, useState } from "react";
import { collection, documentId, getDocs, query, where } from "firebase/firestore";
import { db } from "../../../../../shared/lib/firebase";
import { useAuth } from "../../../../../providers/AuthProvider";

type BoatResult = {
    id: string;
    categoryId: string;
    categoryName: string;
    clubName: string;
    bowNumber: number | null;
    rowerUids: string[];
    status: string;
    elapsedMs: number | null;
    adjustmentMs?: number;
};

type Props = {
    event: any;
    eventId: string;
};

function formatElapsed(ms: number | null | undefined): string {
    if (!ms) return "—";
    const total = Math.floor(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    const tenths = Math.floor((ms % 1000) / 100);
    return `${m}:${String(s).padStart(2, "0")}.${tenths}`;
}

const PLACE_LABEL: Record<number, string> = { 1: "1st", 2: "2nd", 3: "3rd" };

export default function ResultsTab({ event, eventId }: Props) {
    const { user } = useAuth() as any;

    const [boats, setBoats] = useState<BoatResult[]>([]);
    const [userByUid, setUserByUid] = useState<Map<string, string>>(new Map());
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                const snap = await getDocs(collection(db, "events", eventId, "boats"));
                setBoats(snap.docs.map((d) => ({ id: d.id, ...d.data() } as BoatResult)));
            } finally {
                setLoading(false);
            }
        })();
    }, [eventId]);

    // Batch-fetch rower display names
    useEffect(() => {
        const uids = Array.from(new Set(boats.flatMap((b) => b.rowerUids ?? [])));
        if (!uids.length) return;
        (async () => {
            const m = new Map<string, string>();
            for (let i = 0; i < uids.length; i += 10) {
                const snap = await getDocs(
                    query(collection(db, "users"), where(documentId(), "in", uids.slice(i, i + 10)))
                );
                snap.docs.forEach((d) => {
                    const data = d.data();
                    m.set(d.id, data.displayName ?? data.fullName ?? "Rower");
                });
            }
            setUserByUid(m);
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [boats]);

    // Boats that have a recorded result (finished, dnf, or have elapsedMs)
    const resolvedBoats = useMemo(
        () => boats.filter((b) => b.status === "finished" || b.status === "dnf" || typeof b.elapsedMs === "number"),
        [boats]
    );

    // Apply resultsPublishMode — mirrors the old EventResultsPage logic
    const visibleResults = useMemo(() => {
        const mode: string = event.resultsPublishMode ?? "Live";
        if (mode === "Category") {
            const catMap = new Map<string, BoatResult[]>();
            for (const b of boats) {
                const key = b.categoryId ?? b.categoryName;
                if (!catMap.has(key)) catMap.set(key, []);
                catMap.get(key)!.push(b);
            }
            const releasedKeys = new Set<string>();
            for (const [key, catBoats] of catMap) {
                if (catBoats.every((b) => resolvedBoats.some((r) => r.id === b.id))) releasedKeys.add(key);
            }
            return resolvedBoats.filter((b) => releasedKeys.has(b.categoryId ?? b.categoryName));
        }
        if (mode === "Event") {
            return boats.every((b) => resolvedBoats.some((r) => r.id === b.id)) ? resolvedBoats : [];
        }
        return resolvedBoats;
    }, [event.resultsPublishMode, boats, resolvedBoats]);

    const hasResults = visibleResults.length > 0;
    const resultsPending = resolvedBoats.length > 0 && !hasResults;

    // Group boats by category and sort
    const categoryGroups = useMemo(() => {
        const source = hasResults ? visibleResults : boats;
        const groups = new Map<string, { name: string; boats: BoatResult[] }>();
        for (const b of source) {
            const key = b.categoryId ?? b.categoryName;
            if (!groups.has(key)) groups.set(key, { name: b.categoryName ?? key, boats: [] });
            groups.get(key)!.boats.push(b);
        }
        for (const grp of groups.values()) {
            grp.boats.sort((a, b) => {
                if (hasResults) {
                    if (a.elapsedMs && b.elapsedMs) return a.elapsedMs - b.elapsedMs;
                    if (a.elapsedMs) return -1;
                    if (b.elapsedMs) return 1;
                }
                return (a.bowNumber ?? 999) - (b.bowNumber ?? 999);
            });
        }
        return Array.from(groups.entries());
    }, [boats, hasResults, visibleResults]);

    if (loading) {
        return (
            <div>
                <div className="ep-skeleton-bar" style={{ height: 20, width: "35%", marginBottom: 12 }} />
                <div className="ep-skeleton-bar" style={{ height: 52, marginBottom: 6 }} />
                <div className="ep-skeleton-bar" style={{ height: 52, marginBottom: 6 }} />
                <div className="ep-skeleton-bar" style={{ height: 52 }} />
            </div>
        );
    }

    if (!boats.length) {
        return <p className="ep-muted">No entries yet for this event.</p>;
    }

    return (
        <div>
            <div className="ep-section-title">
                {hasResults ? "Race Results" : "Start List"}
            </div>

            {resultsPending && (
                <div className="ep-info-box" style={{ marginBottom: "1rem" }}>
                    Results will be published once{" "}
                    {event.resultsPublishMode === "Event"
                        ? "all boats have finished."
                        : "all boats in each category have finished."}
                </div>
            )}

            {categoryGroups.map(([catKey, { name, boats: catBoats }]) => (
                <div key={catKey} className="ep-results-category">
                    <div className="ep-results-cat-title">{name}</div>
                    <ul className="ep-results-list">
                        {catBoats.map((b, idx) => {
                            const isFinished = b.status === "finished" || typeof b.elapsedMs === "number";
                            const isDnf = b.status === "dnf";
                            const isMyBoat = user && (b.rowerUids ?? []).includes(user.uid);
                            const place = hasResults && isFinished ? idx + 1 : null;
                            const crewNames = (b.rowerUids ?? []).map(
                                (uid) => userByUid.get(uid) ?? uid.slice(0, 6)
                            );
                            const placeClass =
                                place === 1 ? " ep-result-row--gold"
                                : place === 2 ? " ep-result-row--silver"
                                : place === 3 ? " ep-result-row--bronze"
                                : "";

                            return (
                                <li
                                    key={b.id}
                                    className={`ep-result-row${placeClass}${isMyBoat ? " ep-result-row--own" : ""}`}
                                >
                                    <div className="ep-result-place">
                                        {place
                                            ? (PLACE_LABEL[place] ?? `${place}th`)
                                            : b.bowNumber
                                            ? `#${b.bowNumber}`
                                            : "—"}
                                    </div>
                                    <div className="ep-result-crew">
                                        <div className="ep-result-names">
                                            {crewNames.join(" / ")}
                                            {isMyBoat && <span className="ep-you-tag" style={{ marginLeft: "0.4rem" }}>you</span>}
                                        </div>
                                        <div className="ep-result-club">{b.clubName}</div>
                                    </div>
                                    <div className="ep-result-time">
                                        {isDnf ? (
                                            <span className="ep-dnf-badge">DNF</span>
                                        ) : (
                                            formatElapsed(b.elapsedMs)
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            ))}
        </div>
    );
}
