import { useState } from "react";
import { removeAssignment } from "../services/coachAssignmentService";
import { useCoachAssignments } from "../hooks/useCoachAssignments";
import { COACH_ROLE_LABELS } from "../constants/coachRoles";
import type { CoachAssignment } from "../types/coachAssignment";
import Modal from "../../../shared/components/Modal/Modal";
import "../coaches.css";

interface Props {
    rowerId: string;
    clubId: string;
    onToast: (msg: string, type?: "success" | "error") => void;
}

export function CoachAssignmentList({ rowerId, clubId, onToast }: Props) {
    const { assignments, loading } = useCoachAssignments(rowerId);
    const [confirming, setConfirming] = useState<CoachAssignment | null>(null);
    const [removing, setRemoving]     = useState<string | null>(null);

    const filtered = assignments.filter(a => a.clubId === clubId);

    async function handleRemove() {
        if (!confirming) return;
        setRemoving(confirming.id);
        setConfirming(null);
        try {
            await removeAssignment({ assignmentId: confirming.id });
            onToast("Coach removed.");
        } catch {
            onToast("Failed to remove coach. Please try again.", "error");
        } finally {
            setRemoving(null);
        }
    }

    function initials(name: string) {
        return name.split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2);
    }

    if (loading) return <p className="muted" style={{ fontSize: "0.875rem" }}>Loading…</p>;

    return (
        <>
            <div className="ca-list">
                {filtered.map(a => (
                    <div
                        key={a.id}
                        className={`ca-coach-card${a.status === "pending" ? " ca-coach-card--pending" : ""}`}
                    >
                        <div className="ca-coach-card__avatar">
                            {initials(a.coachDisplayName)}
                        </div>
                        <div className="ca-coach-card__body">
                            <div className="ca-coach-card__name">{a.coachDisplayName}</div>
                            <div className="ca-coach-card__roles">
                                {a.status === "pending" && (
                                    <span className="ca-badge ca-badge--pending">Awaiting Approval</span>
                                )}
                                {a.roles.map(r => (
                                    <span key={r} className="ca-badge ca-badge--role">
                                        {COACH_ROLE_LABELS[r]}
                                    </span>
                                ))}
                            </div>
                        </div>
                        <div className="ca-coach-card__actions">
                            <button
                                className="ca-btn ca-btn--danger"
                                disabled={removing === a.id}
                                onClick={() => setConfirming(a)}
                            >
                                Remove
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {confirming && (
                <Modal
                    title="Remove coach"
                    message={`Remove ${confirming.coachDisplayName} as your coach? This cannot be undone.`}
                    onClose={() => setConfirming(null)}
                    actions={[
                        { label: "Cancel", onClick: () => setConfirming(null), variant: "secondary" },
                        { label: "Remove",  onClick: handleRemove,              variant: "primary"   },
                    ]}
                />
            )}
        </>
    );
}
