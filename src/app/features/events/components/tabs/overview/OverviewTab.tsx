import EventHeaderEditor from "./EventHeaderEditor";
import RegistrationStats from "./RegistrationStats";
import CategoryBreakdown from "./CategoryBreakdown";
import { assignBowNumbersForEvent } from "../../../../signup/api/boats.ts";
import { useState } from "react";
import DangerZoneCard from "./DangerZoneCard.tsx";
import RegistrationToggle from "./RegistrationToggle";
import { isRegistrationClosed, hasClosingDate } from "../../../lib/registration";
import HostAdminInvite from "../../../../auth/pages/AdminHostInvite.tsx";

export default function OverviewTab({ event, boats = [], onEventChange }: any) {
    const [busy, setBusy] = useState(false);
    const [assignErr, setAssignErr] = useState<string | null>(null);
    const [assignOk, setAssignOk] = useState(false);

    // Bulk assignment waits until nobody can still enter — which is now the
    // manual switch as much as the closing date. See lib/registration.ts.
    const closingDate: Date | null = hasClosingDate(event) && event.closingDate
        ? new Date(event.closingDate)
        : null;
    const isAfterClosing = isRegistrationClosed(event);

    const assignBows = async () => {
        setBusy(true);
        setAssignErr(null);
        setAssignOk(false);
        try {
            await assignBowNumbersForEvent(
                event.id,
                (event.categories ?? []).map((c: any) => c.id)
            );
            setAssignOk(true);
            setTimeout(() => setAssignOk(false), 3000);
        } catch (e: any) {
            setAssignErr(e?.message ?? "Failed to assign bow numbers.");
        }
        setBusy(false);
    };

    return (
        <div className="flex flex-col gap-5 bg-bg text-text">

            <EventHeaderEditor event={event} onSaved={onEventChange} />

            <RegistrationToggle event={event} onSaved={onEventChange} />

            <div>
                <button
                    className="btn-primary"
                    onClick={assignBows}
                    disabled={busy || !isAfterClosing}
                >
                    {busy ? "Assigning…" : assignOk ? "Assigned ✓" : "Assign Bow Numbers"}
                </button>
                {assignErr && (
                    <p className="text-[#ff6b6b] text-[13px] mt-2">{assignErr}</p>
                )}
                {!isAfterClosing && (
                    <p className="text-muted text-[13px] mt-2">
                        {closingDate
                            ? `Available after registration closes (${closingDate.toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" })}).`
                            : "Available once registration closes — close it above, or set a closing date."}
                    </p>
                )}
            </div>

            <RegistrationStats boats={boats} />

            <CategoryBreakdown
                boats={boats}
                categories={event.categories}
            />
            <HostAdminInvite />
            <DangerZoneCard event={event} />
        </div>
    );
}
