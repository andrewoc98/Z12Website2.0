import { useEffect, useState } from "react";
import { useAuth } from "../../../providers/AuthProvider";
import { db } from "../../../shared/lib/firebase";
import { collection, query, where, getDocs, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { getUserProfileByUid } from "../api/user.ts";
import AthleteRow from "../components/AthleteRow.tsx";

export default function CoachDashboard() {
    const { profile } = useAuth();
    const [pendingRowers, setPendingRowers] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!profile?.uid) return;
        let alive = true;

        async function loadPending() {
            setLoading(true);
            try {
                const q = query(
                    collection(db, "coachLinks"),
                    where("coachId", "==", profile?.uid),
                    where("status", "==", "pending")
                );

                const snapshot = await getDocs(q);
                const links = snapshot.docs.map(doc => ({
                    linkId: doc.id,
                    rowerId: doc.data().rowerId,
                    requestedAt: doc.data().requestedAt,
                }));

                const rowerProfiles = await Promise.all(
                    links.map(async (link) => {
                        const rowerProfile = await getUserProfileByUid(link.rowerId);
                        if (!rowerProfile) return null;
                        return {
                            ...link,
                            displayName: rowerProfile.displayName || rowerProfile.fullName,
                            roles: rowerProfile.roles,
                        };
                    })
                );

                if (alive) setPendingRowers(rowerProfiles.filter(Boolean));
            } catch (err) {
                console.error("Failed to load pending rowers", err);
            } finally {
                if (alive) setLoading(false);
            }
        }

        loadPending();
        return () => { alive = false; };
    }, [profile?.uid]);

    async function approveRower(linkId: string) {
        const linkRef = doc(db, "coachLinks", linkId);
        await updateDoc(linkRef, { status: "approved", approvedAt: serverTimestamp() });
        setPendingRowers(prev => prev.filter(r => r.linkId !== linkId));
    }

    async function rejectRower(linkId: string) {
        const linkRef = doc(db, "coachLinks", linkId);
        await updateDoc(linkRef, { status: "rejected" });
        setPendingRowers(prev => prev.filter(r => r.linkId !== linkId));
    }

    if (!profile?.roles?.coach) return null;

    return (
        <section className="profile-section">
            <div className="subhead">
                <h3 className="subhead-title">Pending Athlete Requests</h3>
                <span className="pill">Coach</span>
            </div>

            {loading && <p className="muted">Loading requests…</p>}
            {!loading && pendingRowers.length === 0 && <p className="muted">No pending requests</p>}

                <div className="coach-list">
                    {pendingRowers.map((r) => (
                        <AthleteRow
                            key={r.linkId}
                            athlete={r}
                            onApprove={() => approveRower(r.linkId)}
                            onReject={() => rejectRower(r.linkId)}
                        />
                    ))}
                </div>

        </section>
    );
}
