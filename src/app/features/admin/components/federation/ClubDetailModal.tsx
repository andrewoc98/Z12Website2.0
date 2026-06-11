import { useState } from "react";
import type { Club } from "../../../auth/club";
import { suspendClub, reactivateClub, inviteClubAdmin } from "../../services/clubAdminService";

type Tab = "details" | "invite" | "status";

type Props = {
    club:     Club;
    onClose:  () => void;
    onAction: (msg: string, type?: "success" | "error") => void;
    onReload: () => void;
};

function friendlyError(msg: string): string {
    const m = msg.toLowerCase();
    if (m.includes("already-exists"))        return "A pending invite already exists for that email, or they are already an admin.";
    if (m.includes("already suspended"))     return "Club is already suspended.";
    if (m.includes("not currently suspended")) return "Club is not currently suspended.";
    if (m.includes("email"))                 return "Please enter a valid email address.";
    return "Something went wrong. Please try again.";
}

export default function ClubDetailModal({ club, onClose, onAction, onReload }: Props) {
    const [tab, setTab] = useState<Tab>("details");

    return (
        <div className="pa-overlay" onClick={onClose}>
            <div className="pa-modal fa-club-modal" onClick={e => e.stopPropagation()}>

                <div className="pa-modal__header">
                    <div className="fa-club-modal__title-block">
                        <h3 className="pa-modal__title">{club.name}</h3>
                        {club.location?.city && (
                            <span className="fa-club-modal__subtitle">
                                {club.location.city}
                                {club.location.country ? `, ${club.location.country}` : ""}
                            </span>
                        )}
                    </div>
                    <div className="fa-club-modal__header-right">
                        <span className={`pa-status pa-status--${club.status === "pending_approval" ? "pending" : club.status}`}>
                            {club.status === "pending_approval" ? "pending" : club.status}
                        </span>
                        <button className="pa-modal__close" onClick={onClose} aria-label="Close">✕</button>
                    </div>
                </div>

                <div className="editor-tabs">
                    {(["details", "invite", "status"] as Tab[]).map(t => (
                        <button
                            key={t}
                            className={`editor-tab${tab === t ? " editor-tab--active" : ""}`}
                            onClick={() => setTab(t)}
                        >
                            {t === "details" ? "Details"
                             : t === "invite" ? "Invite Admin"
                             : "Status"}
                        </button>
                    ))}
                </div>

                <div className="pa-modal__body">
                    {tab === "details" && <DetailsTab club={club} />}
                    {tab === "invite"  && <InviteTab  club={club} onClose={onClose} onAction={onAction} onReload={onReload} />}
                    {tab === "status"  && <StatusTab  club={club} onClose={onClose} onAction={onAction} onReload={onReload} />}
                </div>

            </div>
        </div>
    );
}

// ── Details tab ───────────────────────────────────────────────────────────────

function DetailsTab({ club }: { club: Club }) {
    return (
        <div className="fa-club-modal__details">

            <div className="fa-club-modal__stats">
                <Stat label="Rowers"  value={club.rowerCount} />
                <Stat label="Coaches" value={club.coachCount} />
                <Stat label="Members" value={club.memberCount} />
                <Stat label="Admins"  value={club.adminUids.length} />
            </div>

            <div className="fa-club-modal__info-grid">
                {club.contactEmail && (
                    <InfoRow label="Contact email" value={club.contactEmail} />
                )}
                {club.websiteUrl && (
                    <InfoRow label="Website" value={
                        <a href={club.websiteUrl} target="_blank" rel="noreferrer" className="fa-club-modal__link">
                            {club.websiteUrl}
                        </a>
                    } />
                )}
                {club.location?.addressLine1 && (
                    <InfoRow label="Address" value={club.location.addressLine1} />
                )}
                {club.location?.county && (
                    <InfoRow label="County" value={club.location.county} />
                )}
                {club.location?.postCode && (
                    <InfoRow label="Post code" value={club.location.postCode} />
                )}
                <InfoRow label="Open membership" value={club.openMembership ? "Yes" : "No"} />
                <InfoRow label="Sport" value={club.sport} />
                {club.approvedAt && (
                    <InfoRow label="Approved" value={new Date(club.approvedAt).toLocaleDateString()} />
                )}
                <InfoRow label="Created" value={new Date(club.createdAt).toLocaleDateString()} />
            </div>

        </div>
    );
}

function Stat({ label, value }: { label: string; value: number }) {
    return (
        <div className="fa-club-modal__stat">
            <div className="fa-club-card__count-val">{value}</div>
            <div className="fa-club-card__count-label">{label}</div>
        </div>
    );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="fa-club-modal__info-row">
            <span className="fa-club-modal__info-label">{label}</span>
            <span className="fa-club-modal__info-value">{value}</span>
        </div>
    );
}

// ── Invite admin tab ──────────────────────────────────────────────────────────

function InviteTab({ club, onClose, onAction, onReload }: Omit<Props, "club"> & { club: Club }) {
    const [email, setEmail] = useState("");
    const [busy,  setBusy]  = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (busy || !email.trim()) return;
        setBusy(true);
        setError(null);
        try {
            const result = await inviteClubAdmin({ clubId: club.id, targetEmail: email.trim() });
            onReload();
            const msg = result.isExistingUser
                ? `${email.trim()} has been appointed as an admin of ${club.name}.`
                : `Invite sent to ${email.trim()}. They'll receive an email to sign up and claim the role.`;
            onAction(msg);
            onClose();
        } catch (err: any) {
            setError(friendlyError(err?.message ?? ""));
            setBusy(false);
        }
    }

    return (
        <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p className="muted" style={{ fontSize: 13, margin: 0 }}>
                Enter an email address. If the person already has a Z12 account they'll be
                appointed immediately. If not, they'll receive a signup invitation and their
                admin role will activate once they register.
            </p>

            <label>
                Email address *
                <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="admin@club.org"
                    required
                    autoFocus
                />
            </label>

            {error && <div className="pa-error">{error}</div>}

            <div className="pa-modal__footer" style={{ padding: 0 }}>
                <button className="pa-btn pa-btn--ghost" type="button" onClick={onClose} disabled={busy}>
                    Cancel
                </button>
                <button className="pa-btn pa-btn--primary" type="submit" disabled={busy || !email.trim()}>
                    {busy ? "Appointing…" : "Appoint admin"}
                </button>
            </div>
        </form>
    );
}

// ── Status tab ────────────────────────────────────────────────────────────────

function StatusTab({ club, onClose, onAction, onReload }: Omit<Props, "club"> & { club: Club }) {
    const isSuspended = club.status === "suspended";
    const [reason, setReason] = useState("");
    const [busy,   setBusy]   = useState(false);
    const [error,  setError]  = useState<string | null>(null);

    async function handleSuspend(e: React.FormEvent) {
        e.preventDefault();
        if (busy || !reason.trim()) return;
        setBusy(true);
        setError(null);
        try {
            await suspendClub({ clubId: club.id, reason: reason.trim() });
            onReload();
            onAction(`${club.name} has been suspended.`);
            onClose();
        } catch (err: any) {
            setError(friendlyError(err?.message ?? ""));
            setBusy(false);
        }
    }

    async function handleReactivate() {
        if (busy) return;
        setBusy(true);
        setError(null);
        try {
            await reactivateClub({ clubId: club.id });
            onReload();
            onAction(`${club.name} has been reactivated.`);
            onClose();
        } catch (err: any) {
            setError(friendlyError(err?.message ?? ""));
            setBusy(false);
        }
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {isSuspended ? (
                <>
                    <div className="fa-club-modal__status-info fa-club-modal__status-info--suspended">
                        <strong>This club is currently suspended.</strong>
                        <span>Members retain their accounts but the club is inactive on the platform.</span>
                    </div>
                    {error && <div className="pa-error">{error}</div>}
                    <div className="pa-modal__footer" style={{ padding: 0 }}>
                        <button className="pa-btn pa-btn--ghost" onClick={onClose} disabled={busy}>
                            Cancel
                        </button>
                        <button className="pa-btn pa-btn--primary" onClick={handleReactivate} disabled={busy}>
                            {busy ? "Reactivating…" : "Reactivate club"}
                        </button>
                    </div>
                </>
            ) : (
                <form onSubmit={handleSuspend} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div className="fa-club-modal__status-info">
                        <strong>Suspend this club</strong>
                        <span>
                            Members will keep their accounts. The club will be marked as suspended
                            and club admins will be notified.
                        </span>
                    </div>

                    <label>
                        Reason for suspension *
                        <textarea
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            placeholder="Provide a reason that will be shared with club admins…"
                            rows={3}
                            required
                            style={{ resize: "vertical" }}
                        />
                    </label>

                    {error && <div className="pa-error">{error}</div>}

                    <div className="pa-modal__footer" style={{ padding: 0 }}>
                        <button className="pa-btn pa-btn--ghost" type="button" onClick={onClose} disabled={busy}>
                            Cancel
                        </button>
                        <button
                            className="pa-btn pa-btn--danger"
                            type="submit"
                            disabled={busy || !reason.trim()}
                        >
                            {busy ? "Suspending…" : "Suspend club"}
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}
