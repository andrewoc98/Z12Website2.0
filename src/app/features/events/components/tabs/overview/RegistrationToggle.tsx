import { useState } from "react";
import { updateEvent } from "../../../api/events";
import { formatDate } from "../../../lib/categories";
import {
    eventHasEnded,
    isRegistrationOpen,
    registrationCloseSummary,
} from "../../../lib/registration";
import type { EventDoc } from "../../../types";

type Props = {
    event: EventDoc;
    onSaved?: (updated: EventDoc) => void;
};

/**
 * The host's manual registration switch.
 *
 * It is the only control that can close entries early, or keep them open past a
 * closing date. The one thing it cannot do is take entries after the event has
 * been held — once the end date passes the switch locks, whatever it was set to.
 */
export default function RegistrationToggle({ event, onSaved }: Props) {
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    // A cancelled event is settled by the danger zone, not by this switch.
    const locked = eventHasEnded(event) || event.status === "cancelled" || event.status === "draft";
    const ended = eventHasEnded(event);
    const open = isRegistrationOpen(event);

    const setOpen = async (next: boolean) => {
        if (busy || locked) return;
        setErr(null);
        setBusy(true);
        try {
            // Writing the derived status too keeps the Cloud Functions that gate
            // paid entries on `status` in step with the switch.
            const now = Date.now();
            const start = event.startDate ? new Date(event.startDate).getTime() : null;
            const status = start != null && now >= start
                ? "running"
                : next ? "open" : "closed";

            await updateEvent(event.id, { registrationOpen: next, status });
            onSaved?.({ ...event, registrationOpen: next, status });
        } catch (e) {
            setErr(e instanceof Error ? e.message : "Could not change registration.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className="card">
            <div className="flex justify-between items-center gap-4 flex-wrap">
                <div>
                    <h2 className="m-0">Registration</h2>
                    <p className="text-muted text-[13px] mt-2 mb-0 max-w-[62ch]">
                        {ended
                            ? "The event has been held — entries are closed for good."
                            : event.status === "cancelled"
                                ? "This event is cancelled."
                                : registrationCloseSummary(event, formatDate)}
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <span
                        className={`px-[10px] py-1 rounded-full text-[12px] ${
                            open ? "bg-[#22c55e] text-brand-ink" : "bg-[#ff6b6b] text-brand-ink"
                        }`}
                    >
                        {open ? "Open" : "Closed"}
                    </span>

                    <button
                        type="button"
                        role="switch"
                        aria-checked={open}
                        aria-label="Registration open"
                        disabled={busy || locked}
                        onClick={() => setOpen(!open)}
                        className={`relative w-[56px] h-[30px] rounded-full border border-border cursor-pointer transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${
                            open ? "bg-[#22c55e]" : "bg-surface-2"
                        }`}
                    >
                        <span
                            aria-hidden="true"
                            className={`absolute top-[3px] w-[22px] h-[22px] rounded-full bg-white transition-[left] duration-150 ${
                                open ? "left-[30px]" : "left-[3px]"
                            }`}
                        />
                    </button>
                </div>
            </div>

            {err && <p className="text-danger mt-2">{err}</p>}
        </section>
    );
}
