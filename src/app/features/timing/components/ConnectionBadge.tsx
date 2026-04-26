import { useState, useRef, useEffect } from "react";
import { useConnectionStatus } from "../useConnectionStatus";
import "../styles/ConnectionBadge.css";

const TYPE_LABELS: Record<string, string> = {
    start: "Start",
    stop: "Stop",
    placeholder: "Placeholder",
    assign_placeholder: "Assign Placeholder",
};

function formatTime(ts: number): string {
    return new Date(ts).toLocaleTimeString("en-IE", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
}

export default function ConnectionBadge() {
    const { isOnline, pendingCount, pendingQueue, removeAction } = useConnectionStatus();
    const [open, setOpen] = useState(false);
    const drawerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    return (
        <div className="cb-wrapper" ref={drawerRef}>
            <button
                className={`connection-badge ${isOnline ? "online" : "offline"}`}
                onClick={() => setOpen(o => !o)}
            >
                <span className="connection-badge__dot" />
                <span className="connection-badge__text">
                    {isOnline ? "Online" : "Offline"}
                </span>
                {pendingCount > 0 && (
                    <span className="connection-badge__pending">{pendingCount}</span>
                )}
            </button>

            {open && (
                <div className="cb-drawer">
                    <div className="cb-drawer__header">
                        <span className="cb-drawer__title">Pending Queue</span>
                        <span className="cb-drawer__subtitle">
                            {pendingCount === 0
                                ? "All synced"
                                : `${pendingCount} action${pendingCount !== 1 ? "s" : ""} awaiting sync`}
                        </span>
                    </div>

                    <div className="cb-drawer__status">
                        <span className={`cb-drawer__dot ${isOnline ? "online" : "offline"}`} />
                        <span>{isOnline ? "Connected" : "No connection — actions will sync when back online"}</span>
                    </div>

                    {pendingQueue.length === 0 ? (
                        <div className="cb-drawer__empty">
                            <span className="cb-drawer__empty-icon">✓</span>
                            <span>Nothing pending</span>
                        </div>
                    ) : (
                        <ul className="cb-drawer__list">
                            {pendingQueue.map(action => (
                                <li key={action.id} className="cb-drawer__item">
                                    <div className="cb-drawer__item-left">
                                        <span className={`cb-drawer__type cb-drawer__type--${action.type}`}>
                                            {TYPE_LABELS[action.type] ?? action.type}
                                        </span>
                                        <span className="cb-drawer__time">
                                            {formatTime(action.timestamp)}
                                        </span>
                                        {action.boatId && (
                                            <span className="cb-drawer__meta">
                                                Boat: {action.boatId.slice(0, 8)}…
                                            </span>
                                        )}
                                    </div>
                                    <button
                                        className="cb-drawer__delete"
                                        onClick={() => removeAction(action.id)}
                                        title="Remove from queue"
                                    >
                                        ✕
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}