import { useState } from "react";
import { approveAssignment, declineAssignment } from "../services/coachAssignmentService";
import { useAthleteRoster } from "../hooks/useAthleteRoster";
import { COACH_ROLE_LABELS } from "../constants/coachRoles";
import type { RosterEntry } from "../types/coachAssignment";
import "../coaches.css";

interface Props {
    coachId: string;
    clubId: string;
    onToast: (msg: string, type?: "success" | "error") => void;
}

export function AthleteRosterList({ coachId, clubId, onToast }: Props) {
    const { roster, loading } = useAthleteRoster(coachId);
    const [acting, setActing] = useState<string | null>(null);

    const filtered = roster.filter(r => r.clubId === clubId);
    const pending  = filtered.filter(r => r.status === "pending");
    const active   = filtered.filter(r => r.status === "active");

    async function handleApprove(entry: RosterEntry) {
        setActing(entry.id);
        try {
            await approveAssignment({ rowerId: entry.rowerId, assignmentId: entry.assignmentId });
            onToast(`${entry.rowerDisplayName} added to your roster.`);
        } catch {
            onToast("Failed to approve. Please try again.", "error");
        } finally {
            setActing(null);
        }
    }

    async function handleDecline(entry: RosterEntry) {
        setActing(entry.id);
        try {
            await declineAssignment({ rowerId: entry.rowerId, assignmentId: entry.assignmentId });
            onToast(`Request from ${entry.rowerDisplayName} declined.`);
        } catch {
            onToast("Failed to decline. Please try again.", "error");
        } finally {
            setActing(null);
        }
    }

    function initials(name: string) {
        return name.split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2);
    }

    if (loading) return <p className="muted" style={{ fontSize: "0.875rem" }}>Loading…</p>;

    if (filtered.length === 0) {
        return (
            <div className="ca-empty">
                <div className="ca-empty__icon">🏋️</div>
                <p className="ca-empty__text">
                    No athletes yet. Rowers in your club can assign you as their coach.
                </p>
            </div>
        );
    }

    const AthleteCard = ({ entry }: { entry: RosterEntry }) => (
        <div className={`ca-athlete-card${entry.status === "pending" ? " ca-athlete-card--pending" : ""}`}>
            <div className="ca-athlete-card__avatar">{initials(entry.rowerDisplayName)}</div>
            <div className="ca-athlete-card__body">
                <div className="ca-athlete-card__name">{entry.rowerDisplayName}</div>
                <div className="ca-athlete-card__roles">
                    {entry.roles.map(r => (
                        <span key={r} className="ca-badge ca-badge--role">
                            {COACH_ROLE_LABELS[r]}
                        </span>
                    ))}
                </div>
            </div>
            {entry.status === "pending" && (
                <div className="ca-athlete-card__actions">
                    <button
                        className="ca-btn ca-btn--primary"
                        disabled={acting === entry.id}
                        onClick={() => handleApprove(entry)}
                    >
                        Accept
                    </button>
                    <button
                        className="ca-btn ca-btn--danger"
                        disabled={acting === entry.id}
                        onClick={() => handleDecline(entry)}
                    >
                        Decline
                    </button>
                </div>
            )}
        </div>
    );

    return (
        <>
            {pending.length > 0 && (
                <div className="ca-roster-section">
                    <span className="ca-roster-section-label">Pending ({pending.length})</span>
                    {pending.map(e => <AthleteCard key={e.id} entry={e} />)}
                </div>
            )}
            {active.length > 0 && (
                <div className="ca-roster-section">
                    {pending.length > 0 && (
                        <span className="ca-roster-section-label">Active ({active.length})</span>
                    )}
                    {active.map(e => <AthleteCard key={e.id} entry={e} />)}
                </div>
            )}
        </>
    );
}
