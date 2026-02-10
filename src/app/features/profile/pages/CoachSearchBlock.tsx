import { useEffect, useState } from "react";
import { searchCoachesByName } from "../api/user";
import { db } from "../../../shared/lib/firebase";
import { collection, addDoc, serverTimestamp, query, where, getDocs } from "firebase/firestore";
import { useAuth } from "../../../providers/AuthProvider";

export default function CoachSearchBlock() {
    const { profile } = useAuth();
    const [queryStr, setQueryStr] = useState("");
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [existingLinks, setExistingLinks] = useState<Record<string, string>>({});

    // Fetch existing links
    useEffect(() => {
        if (!profile?.uid) return;
        async function loadLinks() {
            // @ts-ignore
            const q = query(collection(db, "coachLinks"), where("rowerId", "==", profile.uid));
            const snapshot = await getDocs(q);
            const map: Record<string, string> = {};
            snapshot.docs.forEach((doc) => {
                const data = doc.data();
                map[data.coachId] = data.status;
            });
            setExistingLinks(map);
        }
        loadLinks();
    }, [profile]);

    // Search coaches with debounce
    useEffect(() => {
        if (!queryStr.trim()) return setResults([]);
        const timer = setTimeout(async () => {
            setLoading(true);
            const data = await searchCoachesByName(queryStr.trim(), 5);
            setResults(data);
            setLoading(false);
        }, 300);

        return () => clearTimeout(timer);
    }, [queryStr]);

    async function onAddCoach(coach: any) {
        if (!profile?.uid) return;
        const status = existingLinks[coach.uid];
        if (status) {
            alert(`You already have a ${status} request with ${coach.fullName}`);
            return;
        }
        await addDoc(collection(db, "coachLinks"), {
            rowerId: profile.uid,
            coachId: coach.uid,
            status: "pending",
            requestedAt: serverTimestamp(),
            approvedAt: null,
        });
        setExistingLinks((prev) => ({ ...prev, [coach.uid]: "pending" }));
    }

    return (
        <div className="card profile-section coach-search">
            <h4 className="section-title">Find Coaches</h4>
            <input
                type="text"
                className="input"
                placeholder="Type a coach name…"
                value={queryStr}
                onChange={(e) => setQueryStr(e.target.value)}
            />
            {loading && <p className="muted">Searching…</p>}
            <ul className="list search-results">
                {results.map((coach) => {
                    const status = existingLinks[coach.uid];
                    return (
                        <li key={coach.uid} className="card search-card">
                            <div className="list-main">
                                <div className="list-title">{coach.fullName}</div>
                                <div className="muted">{coach.roles?.coach?.club ?? "No club info"}</div>
                            </div>
                            <button
                                className="btn btn--brand"
                                disabled={!!status}
                                onClick={() => onAddCoach(coach)}
                            >
                                {status === "pending" ? "Pending…" : status === "approved" ? "Approved" : "Add"}
                            </button>
                        </li>
                    );
                })}
            </ul>
            {!loading && results.length === 0 && queryStr.trim() && <p className="muted">No coaches found</p>}
        </div>
    );
}
