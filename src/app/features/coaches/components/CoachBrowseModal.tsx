import { useState } from "react";
import { useClubCoaches } from "../hooks/useClubCoaches";
import { assignCoach } from "../services/coachAssignmentService";
import { CoachRolePicker } from "./CoachRolePicker";
import type { CoachAssignment, CoachProfile } from "../types/coachAssignment";
import type { CoachRole } from "../constants/coachRoles";
import "../coaches.css";

interface Props {
    rowerId: string;
    clubId: string;
    clubName: string;
    existing: CoachAssignment[];
    onClose: () => void;
    onAssigned: (msg: string) => void;
}

export function CoachBrowseModal({ rowerId, clubId, clubName, existing, onClose, onAssigned }: Props) {
    const { coaches, loading, error } = useClubCoaches(clubId);
    const [selectedUid, setSelectedUid] = useState<string | null>(null);
    const [roles, setRoles]             = useState<CoachRole[]>([]);
    const [assigning, setAssigning]     = useState(false);
    const [assignErr, setAssignErr]     = useState<string | null>(null);

    const assignedCoachIds = new Set(existing.map(a => a.coachId));

    function selectCoach(uid: string) {
        if (assignedCoachIds.has(uid)) return;
        if (selectedUid === uid) {
            setSelectedUid(null);
            setRoles([]);
        } else {
            setSelectedUid(uid);
            setRoles([]);
            setAssignErr(null);
        }
    }

    async function handleAssign(coach: CoachProfile) {
        if (roles.length === 0) return;
        setAssigning(true);
        setAssignErr(null);
        try {
            const result = await assignCoach({ coachId: coach.uid, clubId, roles });
            const msg = result.status === "pending"
                ? `Request sent to ${coach.displayName} — awaiting approval.`
                : `${coach.displayName} has been added as your coach.`;
            setSelectedUid(null);
            setRoles([]);
            onAssigned(msg);
        } catch (e: unknown) {
            const msg = (e as { message?: string })?.message;
            setAssignErr(
                msg?.includes("already-exists")
                    ? "You have already assigned this coach."
                    : "Something went wrong. Please try again.",
            );
        } finally {
            setAssigning(false);
        }
    }

    function initials(name: string) {
        return name.split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2);
    }

    return (
        <div className="ca-browse-overlay" onClick={onClose}>
            <div className="ca-browse-modal" onClick={e => e.stopPropagation()}>
                <div className="ca-browse-modal__header">
                    <div>
                        <h3 className="ca-browse-modal__title">Find a Coach</h3>
                        <p className="ca-browse-modal__subtitle">{clubName}</p>
                    </div>
                    <button className="ca-browse-modal__close" onClick={onClose} aria-label="Close">✕</button>
                </div>

                <div className="ca-browse-modal__body">
                    {loading && (
                        <div className="ca-empty">
                            <p className="ca-empty__text">Loading coaches…</p>
                        </div>
                    )}

                    {!loading && error && (
                        <div className="ca-empty">
                            <p className="ca-empty__text">{error}</p>
                        </div>
                    )}

                    {!loading && !error && coaches.length === 0 && (
                        <div className="ca-empty">
                            <div className="ca-empty__icon">🏅</div>
                            <p className="ca-empty__text">
                                No coaches are listed in {clubName} yet.
                            </p>
                        </div>
                    )}

                    {!loading && coaches.map(coach => {
                        const isAssigned = assignedCoachIds.has(coach.uid);
                        const isSelected = selectedUid === coach.uid;
                        const isYou      = coach.uid === rowerId;
                        if (isYou) return null;

                        return (
                            <div
                                key={coach.uid}
                                className={[
                                    "ca-browse-card",
                                    isSelected  ? "ca-browse-card--selected"  : "",
                                    isAssigned  ? "ca-browse-card--assigned"  : "",
                                ].join(" ")}
                            >
                                <div
                                    className="ca-browse-card__row"
                                    onClick={() => selectCoach(coach.uid)}
                                >
                                    <div className="ca-browse-card__avatar">
                                        {initials(coach.displayName)}
                                    </div>
                                    <div className="ca-browse-card__info">
                                        <div className="ca-browse-card__name">{coach.displayName}</div>
                                        <div className="ca-browse-card__sub">
                                            {!coach.openAssignment && !isAssigned
                                                ? "Requires approval"
                                                : "Coach"}
                                        </div>
                                    </div>
                                    <div className="ca-browse-card__right">
                                        {isAssigned
                                            ? <span className="ca-badge ca-badge--active">Assigned ✓</span>
                                            : <span className="ca-browse-card__expand-icon">▾</span>
                                        }
                                    </div>
                                </div>

                                {isSelected && (
                                    <div className="ca-browse-card__picker">
                                        <CoachRolePicker selected={roles} onChange={setRoles} />
                                        {assignErr && (
                                            <p style={{ color: "var(--danger)", fontSize: "0.8rem", margin: "0 0 8px" }}>
                                                {assignErr}
                                            </p>
                                        )}
                                        <div className="ca-browse-card__assign-row">
                                            <button
                                                className="ca-btn ca-btn--primary"
                                                disabled={roles.length === 0 || assigning}
                                                onClick={() => handleAssign(coach)}
                                            >
                                                {assigning
                                                    ? "Sending…"
                                                    : coach.openAssignment
                                                        ? "Assign Coach"
                                                        : "Send Request"}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
