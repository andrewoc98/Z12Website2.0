import { useState } from "react";
import { cancelEvent } from "../../../../../features/admin/services/stripeService";

export default function DangerZoneCard({ event, onDelete }: any) {
    const [deleteOpen,  setDeleteOpen]  = useState(false);
    const [cancelOpen,  setCancelOpen]  = useState(false);
    const [loadingDel,  setLoadingDel]  = useState(false);
    const [loadingCan,  setLoadingCan]  = useState(false);
    const [cancelMsg,   setCancelMsg]   = useState<string | null>(null);
    const [cancelErr,   setCancelErr]   = useState<string | null>(null);
    const [reason,      setReason]      = useState("");

    const [confirmText, setConfirmText] = useState("");
    const isMatch = confirmText === event?.name;

    const handleDelete = async () => {
        setLoadingDel(true);
        try {
            await onDelete?.(event.id);
        } catch (e) {
            console.error("Failed to delete event", e);
        }
        setLoadingDel(false);
        setDeleteOpen(false);
    };

    const handleCancel = async () => {
        if (!event?.id) return;
        setLoadingCan(true);
        setCancelErr(null);
        try {
            const res = await cancelEvent({ eventId: event.id, reason: reason.trim() });
            setCancelMsg(
                res.failedCount > 0
                    ? `Event cancelled. ${res.refundedCount} refunds issued; ${res.failedCount} failed — check Stripe dashboard.`
                    : `Event cancelled. ${res.refundedCount} refund${res.refundedCount !== 1 ? "s" : ""} issued.`
            );
            setCancelOpen(false);
        } catch (e: any) {
            setCancelErr(e?.message ?? "Failed to cancel event.");
        } finally {
            setLoadingCan(false);
        }
    };

    if (event?.status === "cancelled") {
        return (
            <div className="card border-[rgba(255,107,107,0.25)] bg-[rgba(255,107,107,0.05)]">
                <h3 className="text-[#ff6b6b]">Danger Zone</h3>
                <p className="text-[14px] text-muted mt-[10px]">This event has been cancelled.</p>
            </div>
        );
    }

    return (
        <div className="card border-[rgba(255,107,107,0.25)] bg-[rgba(255,107,107,0.05)]">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-[#ff6b6b]">Danger Zone</h3>
            </div>

            {cancelMsg && (
                <div style={{
                    background: "rgba(72,199,142,0.1)", border: "1px solid rgba(72,199,142,0.3)",
                    borderRadius: 8, padding: "10px 14px", marginBottom: 16,
                    color: "#48c78e", fontSize: 13,
                }}>
                    {cancelMsg}
                </div>
            )}

            {/* Cancel Event */}
            <div style={{ marginBottom: 20, paddingBottom: 20, borderBottom: "1px solid rgba(255,107,107,0.15)" }}>
                <p className="text-[14px] text-muted mb-[10px] leading-[1.4]">
                    Cancelling this event will issue automatic Stripe refunds to all registered athletes.
                    The event will be marked as cancelled and no further registrations will be accepted.
                </p>
                <button
                    className="bg-[#7a3a00] text-[#FEB959] border border-[rgba(254,185,89,0.3)] px-[14px] py-[10px] rounded-[8px] cursor-pointer font-semibold transition-[background,transform] hover:bg-[#9a4a00] hover:-translate-y-px"
                    onClick={() => { setCancelOpen(true); setCancelErr(null); }}
                >
                    Cancel Event & Refund Athletes
                </button>
            </div>

            {/* Delete Event */}
            <p className="text-[14px] text-muted mb-[14px] leading-[1.4]">
                Deleting this event is permanent. All registrations, results,
                and associated data will be removed.
            </p>
            <button
                className="bg-[#b3261e] text-white border-none px-[14px] py-[10px] rounded-[8px] cursor-pointer font-semibold transition-[background,transform] hover:bg-[#d32f2f] hover:-translate-y-px"
                onClick={() => setDeleteOpen(true)}
            >
                Delete Event
            </button>

            {/* Cancel confirmation modal */}
            {cancelOpen && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[999]">
                    <div className="bg-surface border border-border p-5 rounded-[12px] w-[min(440px,90%)] text-text">
                        <h4 className="mb-[10px] text-[#FEB959]">Cancel Event</h4>
                        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.65)", marginBottom: 12 }}>
                            All athletes with confirmed or pending-crew bookings will receive an automatic Stripe
                            refund for the full amount charged. This cannot be undone.
                        </p>
                        <label style={{ display: "block", fontSize: 13, marginBottom: 4, color: "rgba(255,255,255,0.55)" }}>
                            Reason (shown to athletes, optional)
                        </label>
                        <textarea
                            rows={3}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="e.g. Adverse weather conditions"
                            style={{
                                width: "100%", boxSizing: "border-box",
                                padding: 10, borderRadius: 6,
                                border: "1px solid var(--border)",
                                background: "var(--surface-2)", color: "var(--text)",
                                fontSize: 13, resize: "vertical",
                            }}
                        />
                        {cancelErr && (
                            <p style={{ color: "#ff6b6b", fontSize: 13, marginTop: 8 }}>{cancelErr}</p>
                        )}
                        <div className="flex justify-end gap-[10px] mt-4">
                            <button
                                className="bg-surface-2 text-text border border-border px-3 py-2 rounded-[6px] cursor-pointer hover:bg-surface"
                                onClick={() => setCancelOpen(false)}
                                disabled={loadingCan}
                            >
                                Back
                            </button>
                            <button
                                style={{
                                    background: "#7a3a00", color: "#FEB959",
                                    border: "1px solid rgba(254,185,89,0.3)",
                                    padding: "8px 14px", borderRadius: 6,
                                    cursor: loadingCan ? "not-allowed" : "pointer",
                                    fontWeight: 600, opacity: loadingCan ? 0.6 : 1,
                                }}
                                onClick={handleCancel}
                                disabled={loadingCan}
                            >
                                {loadingCan ? "Cancelling…" : "Yes, Cancel & Refund"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete confirmation modal */}
            {deleteOpen && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[999]">
                    <div className="bg-surface border border-border p-5 rounded-[12px] w-[min(420px,90%)] text-text">
                        <h4 className="mb-[10px] text-[#ff6b6b]">Confirm Deletion</h4>
                        <p>
                            Are you sure you want to delete <b>{event?.name}</b>?
                            This action cannot be undone.
                        </p>
                        <p>
                            Type <b>{event?.name}</b> to confirm deletion.
                        </p>

                        <input
                            type="text"
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value)}
                            placeholder="Enter event name"
                            className="w-full mt-[10px] p-[10px] rounded-[6px] border border-border bg-surface-2 text-text"
                        />

                        <div className="flex justify-end gap-[10px] mt-4">
                            <button
                                className="bg-surface-2 text-text border border-border px-3 py-2 rounded-[6px] cursor-pointer hover:bg-surface"
                                onClick={() => setDeleteOpen(false)}
                                disabled={loadingDel}
                            >
                                Cancel
                            </button>
                            <button
                                className="bg-[#b3261e] text-white border-none px-3 py-2 rounded-[6px] cursor-pointer font-semibold hover:bg-[#d32f2f] disabled:opacity-55 disabled:cursor-not-allowed"
                                onClick={handleDelete}
                                disabled={loadingDel || !isMatch}
                            >
                                {loadingDel ? "Deleting..." : "Yes, Delete"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
