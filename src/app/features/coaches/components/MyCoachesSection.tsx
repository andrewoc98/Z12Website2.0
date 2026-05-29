import { useState } from "react";
import type { UserProfile, ClubRef } from "../../auth/types";
import { useCoachAssignments } from "../hooks/useCoachAssignments";
import { CoachAssignmentList } from "./CoachAssignmentList";
import { CoachBrowseModal } from "./CoachBrowseModal";
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

export function MyCoachesSection({ profile }: Props) {
    const { toast, notify } = useToast();
    const { assignments }   = useCoachAssignments(profile.uid);

    const clubs: ClubRef[] = (profile.roles?.rower?.clubMemberships ?? [])
        .filter(m => m.membershipStatus === "active");

    const [selectedClubId, setSelectedClubId] = useState<string>(clubs[0]?.clubId ?? "");
    const [showBrowse, setShowBrowse]          = useState(false);

    if (clubs.length === 0) return null;

    const activeClub = clubs.find(c => c.clubId === selectedClubId) ?? clubs[0];
    if (!activeClub) return null;

    const clubAssignments = assignments.filter(a => a.clubId === activeClub.clubId);

    return (
        <section className="card profile-section ca-section">
            <div className="ca-section__header">
                <h3 className="ca-section__title">My Coaches</h3>
                <button
                    className="ca-btn ca-btn--primary"
                    onClick={() => setShowBrowse(true)}
                >
                    + Add Coach
                </button>
            </div>

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

            {clubAssignments.length === 0 ? (
                <div className="ca-empty">
                    <div className="ca-empty__icon">🏅</div>
                    <p className="ca-empty__text">
                        You haven't assigned any coaches in {activeClub.clubName} yet.
                    </p>
                    <button className="ca-btn ca-btn--primary ca-empty__cta" onClick={() => setShowBrowse(true)}>
                        Browse Coaches →
                    </button>
                </div>
            ) : (
                <CoachAssignmentList
                    rowerId={profile.uid}
                    clubId={activeClub.clubId}
                    onToast={notify}
                />
            )}

            {showBrowse && (
                <CoachBrowseModal
                    rowerId={profile.uid}
                    clubId={activeClub.clubId}
                    clubName={activeClub.clubName}
                    existing={clubAssignments}
                    onClose={() => setShowBrowse(false)}
                    onAssigned={(msg) => { setShowBrowse(false); notify(msg); }}
                />
            )}

            {toast && <Toast msg={toast.msg} type={toast.type} />}
        </section>
    );
}
