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
        <div className="card danger-card">
            <div className="card-header">
                <h3>Danger Zone</h3>
            </div>

            <p className="danger-text">
                Deleting this event is permanent. All registrations, results,
                and associated data will be removed.
            </p>

            <button
                className="danger-delete-btn"
                onClick={() => setConfirmOpen(true)}
            >
                Delete Event
            </button>

            {confirmOpen && (
                <div className="danger-modal-overlay">
                    <div className="danger-modal">
                        <h4>Confirm Deletion</h4>
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
                            className="danger-confirm-input"
                        />

                        <div className="danger-modal-actions">
                            <button
                                className="btn-cancel"
                                onClick={() => setConfirmOpen(false)}
                                disabled={loading}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn-delete"
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
