import { useEffect, useState } from "react";
import { searchCoachesByName } from "../api/user";
import { useAuth } from "../../../providers/AuthProvider";
import { db } from "../../../shared/lib/firebase";
import { collection, addDoc, serverTimestamp, query, where, getDocs } from "firebase/firestore";

export default function CoachSearchBlock() {
    const { profile } = useAuth();
    const [queryStr, setQueryStr] = useState("");
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

    const [existingLinks, setExistingLinks] = useState<Record<string, string>>({}); // coachId -> status

    // Fetch existing links for this rower
    useEffect(() => {
        if (!profile?.uid) return;
        async function loadLinks() {
            const q = query(
                collection(db, "coachLinks"),
                where("rowerId", "==", profile.uid)
            );
            const snapshot = await getDocs(q);
            const map: Record<string, string> = {};
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                map[data.coachId] = data.status;
            });
            setExistingLinks(map);
        }
        loadLinks();
    }, [profile]);

    // Search coaches with debounce
    useEffect(() => {
        if (!queryStr.trim()) {
            setResults([]);
            return;
        }

        if (debounceTimer) clearTimeout(debounceTimer);

        const timer = setTimeout(async () => {
            setLoading(true);
            const data = await searchCoachesByName(queryStr.trim(), 5);
            setResults(data);
            setLoading(false);
        }, 300);

        setDebounceTimer(timer);

        return () => clearTimeout(timer);
    }, [queryStr]);

    // Request a coach
    async function onAddCoach(coach: any) {
        if (!profile?.uid) return;

        const existingStatus = existingLinks[coach.uid];
        if (existingStatus) {
            alert(`You already have a ${existingStatus} request with ${coach.fullName}`);
            return;
        }

        // Create pending link
        await addDoc(collection(db, "coachLinks"), {
            rowerId: profile.uid,
            coachId: coach.uid,
            status: "pending",
            requestedAt: serverTimestamp(),
            approvedAt: null,
        });

        // Optimistically update UI
        setExistingLinks(prev => ({ ...prev, [coach.uid]: "pending" }));
    }

    return (
        <div className="card card--tight profile-subcard">
            <h3>Find Coaches</h3>
            <input
                type="text"
                value={queryStr}
                placeholder="Type coach name..."
                onChange={(e) => setQueryStr(e.target.value)}
                className="input"
            />

            {loading && <p>Searching…</p>}

            {results.length > 0 && (
                <ul className="search-results">
                    {results.map((coach) => {
                        const status = existingLinks[coach.uid];
                        return (
                            <li key={coach.uid} className="search-result-item">
                                <div>
                                    <strong>{coach.fullName}</strong>
                                    <div className="muted">{coach.roles?.coach?.club ?? "No club info"}</div>
                                </div>
                                <button
                                    className="btn-primary"
                                    disabled={!!status}
                                    onClick={() => onAddCoach(coach)}
                                >
                                    {status === "pending" ? "Pending…" : status === "approved" ? "Approved" : "Add"}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}

            {!loading && results.length === 0 && queryStr.trim() && <p className="muted">No coaches found</p>}
        </div>
    );
}
