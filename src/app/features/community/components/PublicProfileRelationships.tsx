import { useEffect, useState } from "react";
import { collection, query, where, getDocs, or, and } from "firebase/firestore";
import { db } from "../../../shared/lib/firebase";
import { getUserProfileByUid } from "../../profile/api/user";
import RelationshipCard from "../../profile/components/RelationshipCard";

type Props = {
    uid: string;
    roles?: any;
};

export default function PublicProfileRelationships({ uid, roles }: Props) {

    const [loading, setLoading] = useState(true);
    const [coaches, setCoaches] = useState<any[]>([]);
    const [athletes, setAthletes] = useState<any[]>([]);

    useEffect(() => {

        async function load() {

            setLoading(true);

            try {

                const q = query(
                    collection(db, "coachLinks"),
                    and(
                        where("status", "==", "approved"),
                        or(
                            where("coachId", "==", uid),
                            where("rowerId", "==", uid)
                        )
                    )
                );

                const snapshot = await getDocs(q);

                const rels = snapshot.docs.map(d => ({
                    id: d.id,
                    ...d.data()
                }));

                const coachIds: string[] = [];
                const athleteIds: string[] = [];

                rels.forEach((r:any) => {

                    if (r.coachId === uid) {
                        athleteIds.push(r.rowerId);
                    }

                    if (r.rowerId === uid) {
                        coachIds.push(r.coachId);
                    }

                });

                const coachProfiles = await Promise.all(
                    coachIds.map(id => getUserProfileByUid(id))
                );

                const athleteProfiles = await Promise.all(
                    athleteIds.map(id => getUserProfileByUid(id))
                );

                setCoaches(coachProfiles.filter(Boolean));
                setAthletes(athleteProfiles.filter(Boolean));

            } catch (e) {

                console.error("Failed loading relationships", e);

            } finally {

                setLoading(false);

            }

        }

        load();

    }, [uid]);

    if (loading) return null;

    if (!coaches.length && !athletes.length) return null;

    return (
        <section className="card profile-section">

            {roles?.rower && coaches.length > 0 && (
                <>
                    <h3 className="section-title">Coaches</h3>
                    {coaches.map((user:any) => (
                        <RelationshipCard
                            key={user.uid}
                            user={user}
                        />
                    ))}
                </>
            )}

            {roles?.coach && athletes.length > 0 && (
                <>
                    <h3 className="section-title">Athletes</h3>
                    {athletes.map((user:any) => (
                        <RelationshipCard
                            key={user.uid}
                            user={user}
                        />
                    ))}
                </>
            )}

        </section>
    );
}
