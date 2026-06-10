import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useEventBoats } from "../useEventBoats";
import { usePlaceholders } from "../usePlaceholders";
import { useTourMock } from "../../../providers/TourMockContext";
import { getEvent } from "../../events/api/events";
import { TOUR_TIMING_EVENTS } from "../../home/components/tourMockData";
import StartTab from "../components/StartTab";
import InProgressTab from "../components/InProgressTab";
import FinishTab from "../components/FinishTab";
import ReviewTab from "../components/ReviewTab";
import ConnectionBadge from "../components/ConnectionBadge";
import "../styles/TimingPage.css";
import { useConnectionStatus } from "../useConnectionStatus";
import { usePreventUnload } from "../usePreventUnload";

type TimingTab = "start" | "in_progress" | "finish" | "review";

export default function TimingPage() {
    const { eventId } = useParams<{ eventId: string }>();
    const navigate = useNavigate();
    const { isTourActive } = useTourMock();
    const [activeTab, setActiveTab] = useState<TimingTab>("start");
    const [eventData, setEventData] = useState<any>(null);

    const { boats } = useEventBoats(eventId ?? null);
    const { placeholders } = usePlaceholders(eventId ?? null);
    const { isOnline, pendingCount } = useConnectionStatus();

    usePreventUnload(!isOnline || pendingCount > 0);

    useEffect(() => {
        if (!eventId) return;
        if (isTourActive) {
            const mock = TOUR_TIMING_EVENTS.find(e => e.id === eventId) ?? TOUR_TIMING_EVENTS[0];
            setEventData(mock);
            return;
        }
        getEvent(eventId).then(setEventData);
    }, [eventId, isTourActive]);

    // Minimum plausible elapsed time for the course:  1:20 per 500m.
    // Any finish recorded faster than this gets sent to the Review tab.
    const reviewThresholdMs = eventData?.lengthMeters
        ? Math.max(60_000, eventData.lengthMeters * 160)
        : undefined;

    const reviewCount = boats.filter(b => b.status === "under_review").length;

    if (!eventId) {
        navigate("/timing");
        return null;
    }

    return (
        <div className="timing-page">
            <div className="timing-header">
                <button className="timing-back-btn" onClick={() => navigate("/timing")}>
                    ← Events
                </button>
                <ConnectionBadge />
            </div>

            <div className="timing-tabs" data-tour="timing-tabs">
                <button
                    data-tour="timing-tab-start"
                    className={activeTab === "start" ? "active" : ""}
                    onClick={() => setActiveTab("start")}
                >
                    Start
                    <span className="timing-tab-count">{boats.filter(b => b.status === "registered").length}</span>
                </button>
                <button
                    data-tour="timing-tab-in-progress"
                    className={activeTab === "in_progress" ? "active" : ""}
                    onClick={() => setActiveTab("in_progress")}
                >
                    In Progress
                    <span className="timing-tab-count">{boats.filter(b => b.status === "in_progress").length}</span>
                </button>
                <button
                    className={activeTab === "finish" ? "active" : ""}
                    onClick={() => setActiveTab("finish")}
                >
                    Finish
                    <span className="timing-tab-count">{boats.filter(b => ["finished", "dns", "dnf"].includes(b.status)).length}</span>
                </button>
                {reviewCount > 0 && (
                    <button
                        className={`timing-tab-review ${activeTab === "review" ? "active" : ""}`}
                        onClick={() => setActiveTab("review")}
                    >
                        Review
                        <span className="timing-tab-count">{reviewCount}</span>
                    </button>
                )}
            </div>

            <div className="timing-content">
                {activeTab === "start" && (
                    <StartTab eventId={eventId} boats={boats} />
                )}
                {activeTab === "in_progress" && (
                    <InProgressTab
                        eventId={eventId}
                        boats={boats}
                        reviewThresholdMs={reviewThresholdMs}
                    />
                )}
                {activeTab === "finish" && (
                    <FinishTab eventId={eventId} boats={boats} placeholders={placeholders} />
                )}
                {activeTab === "review" && (
                    <ReviewTab eventId={eventId} boats={boats} />
                )}

                {isTourActive && (
                    <div className="timing-action-demo" data-tour="timing-dnf-demo">
                        <p className="timing-action-demo-hint">Long-press any boat card to open the action menu</p>
                        <div className="timing-demo-sheet">
                            <div className="timing-demo-sheet-title">3# Fermoy RC</div>
                            <div className="timing-demo-action">Stop Boat</div>
                            <div className="timing-demo-action timing-demo-action--danger">Mark DNF</div>
                            <div className="timing-demo-cancel">Cancel</div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
