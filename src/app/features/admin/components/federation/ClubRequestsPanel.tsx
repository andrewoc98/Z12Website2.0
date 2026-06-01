import { useState } from "react";
import type { ClubCreationRequest } from "../../types/admin.types";
import {
    approveClubCreationRequest,
    rejectClubCreationRequest,
} from "../../services/clubAdminService";
import "../../styles/platformAdmin.css";
import "../../styles/federationAdmin.css";

type Props = {
    requests: ClubCreationRequest[];
    onAction: (msg: string, type?: "success" | "error") => void;
    onReload: () => void;
};

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString("en-IE", {
        day: "numeric", month: "short", year: "numeric",
    });
}

export default function ClubRequestsPanel({ requests, onAction, onReload }: Props) {
    const [busyId,       setBusyId]       = useState<string | null>(null);
    const [rejectingId,  setRejectingId]  = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState("");

    async function handleApprove(requestId: string) {
        setBusyId(requestId);
        try {
            await approveClubCreationRequest({ requestId });
            onAction("Club approved. The requester is now a club admin.");
            onReload();
        } catch (err: any) {
            onAction(err?.message ?? "Failed to approve.", "error");
        } finally {
            setBusyId(null);
        }
    }

    async function handleReject(requestId: string) {
        if (!rejectReason.trim()) return;
        setBusyId(requestId);
        try {
            await rejectClubCreationRequest({ requestId, rejectionReason: rejectReason.trim() });
            onAction("Request rejected.");
            setRejectingId(null);
            setRejectReason("");
            onReload();
        } catch (err: any) {
            onAction(err?.message ?? "Failed to reject.", "error");
        } finally {
            setBusyId(null);
        }
    }

    if (requests.length === 0) {
        return (
            <div className="pa-empty">
                <div className="pa-empty__icon">📋</div>
                <p className="pa-empty__text">No pending club creation requests.</p>
            </div>
        );
    }

    return (
        <div className="stack">
            {requests.map(req => {
                const isRejecting = rejectingId === req.id;
                const isBusy      = busyId === req.id;

                return (
                    <div key={req.id} className="fa-req-row">

                        <div className="fa-req-row__main">
                            <div className="fa-req-row__body">
                                <div className="fa-req-row__club">{req.proposedClubName}</div>
                                <div className="fa-req-row__meta">
                                    <span>{req.requesterDisplayName}</span>
                                    <span>·</span>
                                    <span>{req.proposedClubLocation}</span>
                                    <span>·</span>
                                    <span>Submitted {formatDate(req.submittedAt)}</span>
                                </div>
                                {req.proposedClubDescription && (
                                    <div className="fa-req-row__description">
                                        {req.proposedClubDescription}
                                    </div>
                                )}
                                {req.supportingInfo && (
                                    <div className="fa-req-row__description" style={{ fontStyle: "italic" }}>
                                        "{req.supportingInfo}"
                                    </div>
                                )}
                            </div>

                            {!isRejecting && (
                                <div className="fa-req-row__actions">
                                    <button
                                        className="pa-btn pa-btn--primary"
                                        onClick={() => handleApprove(req.id)}
                                        disabled={isBusy}
                                    >
                                        {isBusy ? "Approving…" : "Approve"}
                                    </button>
                                    <button
                                        className="pa-btn"
                                        style={{ color: "var(--danger)", borderColor: "rgba(255,77,109,0.25)" }}
                                        onClick={() => {
                                            setRejectingId(req.id);
                                            setRejectReason("");
                                        }}
                                        disabled={isBusy}
                                    >
                                        Reject
                                    </button>
                                </div>
                            )}
                        </div>

                        {isRejecting && (
                            <div className="fa-req-row__reject-form">
                                <label style={{ marginTop: 0 }}>
                                    Reason for rejection *
                                    <textarea
                                        value={rejectReason}
                                        onChange={e => setRejectReason(e.target.value)}
                                        placeholder="Explain why the request is not approved. This message will be sent to the requester."
                                        autoFocus
                                    />
                                </label>
                                <div className="fa-req-row__reject-actions">
                                    <button
                                        className="pa-btn pa-btn--ghost"
                                        onClick={() => { setRejectingId(null); setRejectReason(""); }}
                                        disabled={isBusy}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        className="pa-btn"
                                        style={{ color: "var(--danger)", borderColor: "rgba(255,77,109,0.25)" }}
                                        onClick={() => handleReject(req.id)}
                                        disabled={isBusy || !rejectReason.trim()}
                                    >
                                        {isBusy ? "Rejecting…" : "Confirm rejection"}
                                    </button>
                                </div>
                            </div>
                        )}

                    </div>
                );
            })}
        </div>
    );
}
