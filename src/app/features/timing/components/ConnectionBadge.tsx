import { useState, useRef, useEffect } from "react";
import { useConnectionStatus } from "../useConnectionStatus";

const TYPE_LABELS: Record<string, string> = {
    start: "Start",
    stop: "Stop",
    placeholder: "Placeholder",
    assign_placeholder: "Assign Placeholder",
};

const TYPE_COLORS: Record<string, string> = {
    start:               "bg-[#10b981]/15 text-[#10b981]",
    stop:                "bg-[#ef4444]/15 text-[#ef4444]",
    placeholder:         "bg-[#fbbf24]/15 text-[#fbbf24]",
    assign_placeholder:  "bg-[#8b5cf6]/15 text-[#a78bfa]",
};

function formatTime(ts: number): string {
    return new Date(ts).toLocaleTimeString("en-IE", {
        hour: "2-digit", minute: "2-digit", second: "2-digit",
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
        <div className="relative" ref={drawerRef}>
            <button
                className="flex items-center gap-2 px-[14px] py-2 rounded-[20px] bg-surface border border-border text-[0.85rem] font-semibold text-text cursor-pointer transition-[border-color,box-shadow] duration-150 min-h-[unset] hover:border-brand-warm hover:shadow-[0_0_0_3px_rgba(254,185,89,0.1)]"
                onClick={() => setOpen(o => !o)}
            >
                <span className={`w-2 h-2 rounded-full ${isOnline ? "animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite] bg-[#10b981]" : "bg-[#ef4444]"}`} />
                <span>{isOnline ? "Online" : "Offline"}</span>
                {pendingCount > 0 && (
                    <span className="inline-flex items-center justify-center min-w-5 h-5 px-[6px] bg-[#fbbf24] text-[#1f2937] rounded-[10px] font-bold text-[0.75rem]">
                        {pendingCount}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute top-[calc(100%+10px)] right-0 w-[340px] bg-bg border-2 border-brand-warm rounded-DEFAULT overflow-hidden z-[999] shadow-DEFAULT animate-[cb-slide-in_0.18s_ease] max-sm:w-[calc(100vw-32px)] max-sm:-right-[14px]">
                    <div className="px-[18px] pb-3 pt-4 border-b border-border flex flex-col gap-[2px]">
                        <span className="font-condensed text-[20px] tracking-[1px] text-brand-warm">Pending Queue</span>
                        <span className="text-[12px] text-muted">
                            {pendingCount === 0 ? "All synced" : `${pendingCount} action${pendingCount !== 1 ? "s" : ""} awaiting sync`}
                        </span>
                    </div>

                    <div className="flex items-center gap-2 px-[18px] py-[10px] border-b border-border text-[12px] text-muted">
                        <span className={`w-[7px] h-[7px] rounded-full shrink-0 ${isOnline ? "bg-[#10b981]" : "bg-[#ef4444]"}`} />
                        <span>{isOnline ? "Connected" : "No connection — actions will sync when back online"}</span>
                    </div>

                    {pendingQueue.length === 0 ? (
                        <div className="flex flex-col items-center gap-[6px] px-[18px] py-7 text-muted text-[13px]">
                            <span className="text-[22px] text-[#10b981]">✓</span>
                            <span>Nothing pending</span>
                        </div>
                    ) : (
                        <ul className="list-none m-0 py-2 max-h-[320px] overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-surface-2 [&::-webkit-scrollbar-thumb]:rounded-sm">
                            {pendingQueue.map(action => (
                                <li key={action.id} className="flex items-center justify-between gap-3 px-[18px] py-[10px] border-b border-border last:border-b-0 transition-[background] duration-100 hover:bg-surface">
                                    <div className="flex flex-col gap-[3px] min-w-0">
                                        <span className={`text-[12px] font-bold tracking-[0.5px] px-2 py-[2px] rounded-md w-fit ${TYPE_COLORS[action.type] ?? "bg-white/10 text-white"}`}>
                                            {TYPE_LABELS[action.type] ?? action.type}
                                        </span>
                                        <span className="text-[11px] text-muted tabular-nums">{formatTime(action.timestamp)}</span>
                                        {action.boatId && (
                                            <span className="text-[11px] text-muted whitespace-nowrap overflow-hidden text-ellipsis">
                                                Boat: {action.boatId.slice(0, 8)}…
                                            </span>
                                        )}
                                    </div>
                                    <button
                                        className="shrink-0 w-7 h-7 rounded-lg border border-border bg-transparent text-muted text-[12px] cursor-pointer flex items-center justify-center min-h-[unset] transition-[background,color,border-color] duration-100 hover:bg-[#ef4444]/10 hover:border-[#ef4444] hover:text-[#ef4444] hover:shadow-none"
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
