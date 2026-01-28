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
    const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null)

    const [existingLinks, setExistingLinks] = useState<Record<string, string>>({}); // coachId -> status

    // Fetch existing links for this rower
    useEffect(() => {
        const uid = profile?.uid;
        if (!uid) return
        async function loadLinks() {
            const q = query(
                collection(db, "coachLinks"),
                where("rowerId", "==", uid)
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

        const uid = profile?.uid;
        if (!uid) return

        const existingStatus = existingLinks[coach.uid];
        if (existingStatus) {
            alert(`You already have a ${existingStatus} request with ${coach.fullName}`);
            return;
        }

        // Create pending link
        await addDoc(collection(db, "coachLinks"), {
            rowerId: uid,
            coachId: coach.uid,
            status: "pending",
            requestedAt: serverTimestamp(),
            approvedAt: null,
        });

        // Optimistically update UI
        setExistingLinks(prev => ({ ...prev, [coach.uid]: "pending" }));
    }

    return (
        <div className="search">
            <div className="search-head">
                <h4 className="search-title">Find coaches</h4>
            </div>

            <input
                type="text"
                value={queryStr}
                placeholder="Type a coach name…"
                onChange={(e) => setQueryStr(e.target.value)}
                className="input"
            />

            {loading && <p className="muted">Searching…</p>}

            {results.length > 0 && (
                <ul className="list">
                    {results.map((coach) => {
                        const status = existingLinks[coach.uid];
                        return (
                            <li key={coach.uid} className="list-item">
                                <div className="list-main">
                                    <div className="list-title">{coach.fullName}</div>
                                    <div className="muted">{coach.roles?.coach?.club ?? "No club info"}</div>
                                </div>

                                <button className="btn btn--brand" disabled={!!status} onClick={() => onAddCoach(coach)}>
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
