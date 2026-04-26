import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useEventBoats } from "../useEventBoats";
import { usePlaceholders } from "../usePlaceholders";
import StartTab from "../components/StartTab";
import InProgressTab from "../components/InProgressTab";
import FinishTab from "../components/FinishTab";
import ConnectionBadge from "../components/ConnectionBadge";
import "../styles/TimingPage.css";
import { useConnectionStatus } from "../useConnectionStatus";
import { usePreventUnload } from "../usePreventUnload";

export default function TimingPage() {
    const { eventId } = useParams<{ eventId: string }>();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<"start" | "in_progress" | "finish">("start");

    const { boats } = useEventBoats(eventId ?? null);
    const { placeholders } = usePlaceholders(eventId ?? null);
    const { isOnline, pendingCount } = useConnectionStatus();

    usePreventUnload(!isOnline || pendingCount > 0);

    if (!eventId) {
        navigate("/timing");
        return null;
    }

    return (
        <div className="timing-page page">
            <div className="timing-header">
                <div className="timing-header-left">
                    <button className="timing-back-btn" onClick={() => navigate("/timing")}>
                        ← Events
                    </button>
                </div>
                <ConnectionBadge />
            </div>

            <div className="timing-tabs">
                <button
                    className={activeTab === "start" ? "active" : ""}
                    onClick={() => setActiveTab("start")}
                >
                    Start · {boats.filter(b => b.status === "registered").length}
                </button>
                <button
                    className={activeTab === "in_progress" ? "active" : ""}
                    onClick={() => setActiveTab("in_progress")}
                >
                    In Progress · {boats.filter(b => b.status === "in_progress").length}
                </button>
                <button
                    className={activeTab === "finish" ? "active" : ""}
                    onClick={() => setActiveTab("finish")}
                >
                    Finish · {boats.filter(b => b.status === "finished").length}
                </button>
            </div>

            {activeTab === "start" && (
                <StartTab eventId={eventId} boats={boats} />
            )}
            {activeTab === "in_progress" && (
                <InProgressTab eventId={eventId} boats={boats} />
            )}
            {activeTab === "finish" && (
                <FinishTab eventId={eventId} boats={boats} placeholders={placeholders} />
            )}
        </div>
    );
}