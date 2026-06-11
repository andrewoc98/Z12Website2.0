import { useState } from "react";

export default function DangerZoneCard({ event, onDelete }: any) {
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    const [confirmText, setConfirmText] = useState("");
    const isMatch = confirmText === event?.name;

    const handleDelete = async () => {
        setLoading(true);
        try {
            await onDelete?.(event.id);
        } catch (e) {
            console.error("Failed to delete event", e);
        }
        setLoading(false);
        setConfirmOpen(false);
    };

    return (
        <div className="card border-[rgba(255,107,107,0.25)] bg-[rgba(255,107,107,0.05)]">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-[#ff6b6b]">Danger Zone</h3>
            </div>

            <p className="text-[14px] text-muted mb-[14px] leading-[1.4]">
                Deleting this event is permanent. All registrations, results,
                and associated data will be removed.
            </p>

            <button
                className="bg-[#b3261e] text-white border-none px-[14px] py-[10px] rounded-[8px] cursor-pointer font-semibold transition-[background,transform] hover:bg-[#d32f2f] hover:-translate-y-px"
                onClick={() => setConfirmOpen(true)}
            >
                Delete Event
            </button>

            {confirmOpen && (
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
                                onClick={() => setConfirmOpen(false)}
                                disabled={loading}
                            >
                                Cancel
                            </button>
                            <button
                                className="bg-[#b3261e] text-white border-none px-3 py-2 rounded-[6px] cursor-pointer font-semibold hover:bg-[#d32f2f] disabled:opacity-55 disabled:cursor-not-allowed"
                                onClick={handleDelete}
                                disabled={loading || !isMatch}
                            >
                                {loading ? "Deleting..." : "Yes, Delete"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
