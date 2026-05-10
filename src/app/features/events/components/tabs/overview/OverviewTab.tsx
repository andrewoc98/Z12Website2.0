import EventHeaderEditor from "./EventHeaderEditor";
import RegistrationStats from "./RegistrationStats";
import CategoryBreakdown from "./CategoryBreakdown";
import "./overview.css";
import {assignBowNumbersForEvent} from "../../../../signup/api/boats.ts";
import {useState} from "react";
import DangerZoneCard from "./DangerZoneCard.tsx";
import {deleteEvent} from "../../../../../shared/lib/firebase.ts";
import HostAdminInvite from "../../../../auth/pages/AdminHostInvite.tsx";

export default function OverviewTab({ event, boats = [] }: any) {
    const [busy, setBusy] = useState(false);
    const assignBows = async () => {
        setBusy(true);
        try {
            await assignBowNumbersForEvent(
                event.id,
                (event.categories ?? []).map((c:any)=>c.id)
            );
        } catch(e) {
            console.error("Failed to assign bows", e);
        }
        setBusy(false);
    }

    const deleteEventHandler = async (eventId: string) => {
        try {
            await deleteEvent(eventId);

            window.location.href = "/host/events";
        } catch (e) {
            console.error("Failed to delete event", e);
        }
    };

    return (
        <div className="overview-container">

            <EventHeaderEditor event={event} />

            <div className="overview-actions">
                <button
                    className={`assign-bows-btn ${busy ? "busy" : ""}`}
                    onClick={assignBows}
                    disabled={busy}
                >
                    {busy ? "Assigning..." : "Assign Bow Numbers"}
                </button>
            </div>

            <RegistrationStats boats={boats} />

            <CategoryBreakdown
                boats={boats}
                categories={event.categories}
            />
            <HostAdminInvite/>
            <DangerZoneCard
                event={event}
                onDelete={deleteEventHandler}
            />
        </div>
    );
}