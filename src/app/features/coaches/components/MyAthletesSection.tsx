import { useState } from "react";
import type { UserProfile, ClubRef } from "../../auth/types";
import { AthleteRosterList } from "./AthleteRosterList";
import { OpenAssignmentToggle } from "./OpenAssignmentToggle";
import "../coaches.css";

interface Props {
    profile: UserProfile;
}

function Toast({ msg, type }: { msg: string; type: "success" | "error" }) {
    return (
        <div className={`ca-toast${type === "error" ? " ca-toast--error" : " ca-toast--success"}`}>
            {msg}
        </div>
    );
}

function useToast() {
    const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
    function notify(msg: string, type: "success" | "error" = "success") {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    }
    return { toast, notify };
}

export function MyAthletesSection({ profile }: Props) {
    const { toast, notify } = useToast();

    const clubs: ClubRef[] = (profile.roles?.coach?.clubMemberships ?? [])
        .filter(m => m.membershipStatus === "active");

    const [selectedClubId, setSelectedClubId] = useState<string>(clubs[0]?.clubId ?? "");

    if (clubs.length === 0) return null;

    const activeClub = clubs.find(c => c.clubId === selectedClubId) ?? clubs[0];
    if (!activeClub) return null;

    const openAssignment = profile.roles?.coach?.openAssignment ?? true;

    return (
        <section className="card profile-section ca-section" data-tour="my-athletes">
            <div className="ca-section__header">
                <h3 className="ca-section__title">My Athletes</h3>
            </div>

            <OpenAssignmentToggle initial={openAssignment} />

            {clubs.length > 1 && (
                <div className="ca-club-tabs">
                    {clubs.map(c => (
                        <button
                            key={c.clubId}
                            className={`ca-club-tab${c.clubId === activeClub.clubId ? " ca-club-tab--active" : ""}`}
                            onClick={() => setSelectedClubId(c.clubId)}
                        >
                            {c.clubShortName ?? c.clubName}
                        </button>
                    ))}
                </div>
            )}

            <AthleteRosterList
                coachId={profile.uid}
                clubId={activeClub.clubId}
                onToast={notify}
            />

            {toast && <Toast msg={toast.msg} type={toast.type} />}
        </section>
    );
}
