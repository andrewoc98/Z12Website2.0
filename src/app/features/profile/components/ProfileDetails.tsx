import { useEffect, useState } from "react";
import { useAuth } from "../../../providers/AuthProvider";
import { db } from "../../../shared/lib/firebase";
import { or } from "firebase/firestore";
import "../style/profile.css"

import {
    collection,
    query,
    where,
    onSnapshot,
    updateDoc,
    doc
} from "firebase/firestore";

import RelationshipCard from "../components/RelationshipCard";
import { getUserProfileByUid } from "../api/user";
import CoachSearchBlock from "../pages/CoachSearchBlock.tsx";

export default function ProfileDetails() {

    const { profile } = useAuth();

    const [coachLinks, setCoachLinks] = useState<any[]>([]);
    const [usersMap, setUsersMap] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(true);

    /*
    =============================
    REAL-TIME RELATIONSHIPS
    =============================
    */

    useEffect(() => {

        if (!profile?.uid) return;

        setLoading(true);


        const coachQuery = query(
            collection(db, "coachLinks"),
            or(where("coachId", "==", profile.uid),
                where("rowerId", "==", profile.uid))
        );

        const unsubscribe = onSnapshot(coachQuery, async (snapshot) => {

            const rels = snapshot.docs.map(d => ({
                id: d.id,
                ...d.data()
            }));

            setCoachLinks(rels);

            /*
            =============================
            LOAD USER PROFILES
            =============================
            */

            const ids = new Set<string>();

            rels.forEach((r:any) => {
                ids.add(r.coachId);
                ids.add(r.rowerId);
            });

            const map: Record<string,any> = {};

            await Promise.all(
                Array.from(ids).map(async (uid) => {

                    if (uid === profile.uid) return;

                    const user = await getUserProfileByUid(uid);
                    if (user) map[uid] = user;

                })
            );

            setUsersMap(map);
            setLoading(false);

        });

        return () => unsubscribe();

    }, [profile?.uid]);



    /*
    =============================
    ACTIONS
    =============================
    */

    async function approveRelationship(rel:any) {

        await updateDoc(doc(db,"coachLinks",rel.id),{
            status:"approved"
        });

    }

    async function rejectRelationship(rel:any) {

        await updateDoc(doc(db,"coachLinks",rel.id),{
            status:"rejected"
        });

    }



    /*
    =============================
    FILTER DATA
    =============================
    */

    const coaches = coachLinks.filter(r =>
        r.coachId !== profile?.uid &&
        (profile?.roles?.rower)
    );

    const athletes = coachLinks.filter(r =>
        r.rowerId !== profile?.uid &&
        (profile?.roles?.coach)
    );



    /*
    =============================
    RENDER
    =============================
    */

    if (!profile) return null;

    return (

        <section className="profile-details">

            {/* =============================
          COACHES (for athlete)
      ============================= */}

            {profile.roles?.rower && (

                <div className="profile-section">
                    <CoachSearchBlock/>

                    <h3 className="section-title">Coaches</h3>

                    {loading && <p className="muted">Loading…</p>}

                    {!loading && coaches.length === 0 && (
                        <p className="muted">No coaches connected</p>
                    )}

                    {coaches.map((rel:any) => {

                        const coachUser = usersMap[rel.coachId];

                        if (!coachUser) return null;

                        return (
                            <RelationshipCard
                                key={rel.id}
                                user={coachUser}
                                relationship={rel}
                                currentUser={profile}
                                onApprove={approveRelationship}
                                onReject={rejectRelationship}
                            />
                        );

                    })}

                </div>

            )}



            {/* =============================
          ATHLETES (for coach)
      ============================= */}

            {profile.roles?.coach && (

                <div className="profile-section">

                    <h3 className="section-title">Athletes</h3>

                    {loading && <p className="muted">Loading…</p>}

                    {!loading && athletes.length === 0 && (
                        <p className="muted">No athletes connected</p>
                    )}

                    {athletes.map((rel:any) => {

                        const athleteUser = usersMap[rel.rowerId];

                        if (!athleteUser) return null;

                        return (
                            <RelationshipCard
                                key={rel.id}
                                user={athleteUser}
                                relationship={rel}
                                currentUser={profile}
                                onApprove={approveRelationship}
                                onReject={rejectRelationship}
                            />
                        );

                    })}

                </div>

            )}

        </section>

    );
}
