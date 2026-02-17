import EventHeaderEditor from "./EventHeaderEditor";
import RegistrationStats from "./RegistrationStats";
import CategoryBreakdown from "./CategoryBreakdown";
import "./overview.css";
import {assignBowNumbersForEvent} from "../../../../signup/api/boats.ts";
import {useState} from "react";

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

        </div>
    );
}