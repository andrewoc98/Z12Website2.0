import { useEffect, useState } from "react";
import { useAuth } from "../../../providers/AuthProvider";
import { db } from "../../../shared/lib/firebase";
import {
    collection,
    query,
    where,
    getDocs,
    updateDoc,
    doc,
    serverTimestamp
} from "firebase/firestore";
import { getUserProfileByUid } from "../api/user.ts";

export default function CoachDashboard() {
    const { profile } = useAuth();
    const [pendingRowers, setPendingRowers] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // Load pending rowers
    useEffect(() => {
        if (!profile?.uid) return;

        async function loadPending() {
            setLoading(true);

            try {
                const q = query(
                    collection(db, "coachLinks"),
                    where("coachId", "==", profile.uid),
                    where("status", "==", "pending")
                );
                const snapshot = await getDocs(q);

                // Map each link to include rowerId & link id
                const links = snapshot.docs.map(doc => ({
                    linkId: doc.id,
                    rowerId: doc.data().rowerId
                }));

                // Fetch full profiles in parallel
                const rowerProfiles = await Promise.all(
                    links.map(async (link) => {
                        const profile = await getUserProfileByUid(link.rowerId);
                        return {
                            ...link,
                            ...profile
                        };
                    })
                );

                setPendingRowers(rowerProfiles.filter(Boolean)); // remove nulls
            } catch (err) {
                console.error("Failed to load pending rowers", err);
            } finally {
                setLoading(false);
            }
        }

        loadPending();
    }, [profile]);

    // Approve a rower request
    async function approveRower(linkId: string) {
        try {
            const linkRef = doc(db, "coachLinks", linkId);
            await updateDoc(linkRef, {
                status: "approved",
                approvedAt: serverTimestamp()
            });

            // Optimistic UI update
            setPendingRowers(prev => prev.filter(r => r.linkId !== linkId));
        } catch (err) {
            console.error("Failed to approve rower", err);
        }
    }

    // Reject a rower request
    async function rejectRower(linkId: string) {
        try {
            const linkRef = doc(db, "coachLinks", linkId);
            await updateDoc(linkRef, { status: "rejected" });

            // Optimistic UI update
            setPendingRowers(prev => prev.filter(r => r.linkId !== linkId));
        } catch (err) {
            console.error("Failed to reject rower", err);
        }
    }

    if (!profile?.roles?.coach) return null;

    return (
        <>
            <div className="subhead" style={{ marginTop: 8 }}>
                <h3 className="subhead-title">Pending requests</h3>
                <span className="pill">Coach</span>
            </div>

            {loading && <p className="muted">Loading requests…</p>}
            {!loading && pendingRowers.length === 0 && <p className="muted">No pending requests</p>}

            {pendingRowers.length > 0 && (
                <ul className="list">
                    {pendingRowers.map((r) => (
                        <li key={r.linkId} className="list-item">
                            <div className="list-main">
                                <div className="list-title">{r.displayName ?? r.rowerId}</div>
                                <div className="muted">{r.roles?.rower?.club ?? "No club info"}</div>
                            </div>

                            <div className="actions">
                                <button className="btn btn--ok" onClick={() => approveRower(r.linkId)}>
                                    Approve
                                </button>
                                <button className="btn btn--danger" onClick={() => rejectRower(r.linkId)}>
                                    Reject
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </>
    );
}
