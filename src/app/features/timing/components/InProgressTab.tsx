import { useMemo, useEffect, useState } from "react";
import { sortBoatsByBowNumber, getLiveElapsed, formatElapsedTime, formatRowerNames } from "../lib/utils";
import { useUserProfiles } from "../useUserProfiles";
import type { BoatTimingDoc } from "../types";
import { stopBoatTiming, addPlaceholderFinish } from "../api/timing";

interface InProgressTabProps {
    eventId: string;
    boats: BoatTimingDoc[];
}

export default function InProgressTab({ eventId, boats }: InProgressTabProps) {
    const [, setTick] = useState(0);
    const [placeholderLoading, setPlaceholderLoading] = useState(false);
    const [placeholderMsg, setPlaceholderMsg] = useState<string | null>(null);

    // Force re-render every 100ms to update timers
    useEffect(() => {
        const interval = setInterval(() => {
            setTick(t => t + 1);
        }, 100);
        return () => clearInterval(interval);
    }, []);

    const inProgressBoats = useMemo(() => {
        return sortBoatsByBowNumber(boats.filter(b => b.status === "in_progress"));
    }, [boats]);

    const allUids = useMemo(() => {
        const uids = new Set<string>();
        inProgressBoats.forEach((boat) => boat.rowerUids.forEach((uid: string) => uids.add(uid)));
        return Array.from(uids);
    }, [inProgressBoats]);

    const { profiles } = useUserProfiles(allUids);

    const handleStop = async (boatId: string) => {
        try {
            await stopBoatTiming(eventId, boatId);
        } catch (error) {
            console.error("Failed to stop timing:", error);
        }
    };

    const handleAddPlaceholder = async () => {
        setPlaceholderLoading(true);
        setPlaceholderMsg(null);
        const now = Date.now();
        try {
            await addPlaceholderFinish(eventId, now);
            setPlaceholderMsg("Placeholder finish added!");
        } catch (error) {
            setPlaceholderMsg("Failed to add placeholder");
            console.error("Failed to add placeholder:", error);
        } finally {
            setPlaceholderLoading(false);
            setTimeout(() => setPlaceholderMsg(null), 2000);
        }
    };

    if (inProgressBoats.length === 0) {
        return <div className="in-progress-tab"><p style={{ color: "var(--muted)" }}>No boats in progress</p></div>;
    }

    return (
        <div className="in-progress-tab">
            <div style={{ marginBottom: "16px" }}>
                <button className="btn-primary" onClick={handleAddPlaceholder} disabled={placeholderLoading}>
                    {placeholderLoading ? "Adding..." : "Add Placeholder Finish"}
                </button>
                {placeholderMsg && (
                    <span style={{ marginLeft: 12, color: placeholderMsg.startsWith("Failed") ? "#ef4444" : "#10b981" }}>
                        {placeholderMsg}
                    </span>
                )}
            </div>
            {inProgressBoats.map((boat) => (
                <div key={boat.id} className="boat-item">
                    <span>{boat.bowNumber}# {boat.clubName} {formatRowerNames(boat.rowerUids, profiles, boat.boatSize)}</span>
                    <span className="timer">
                        {boat.startedAt ? formatElapsedTime(getLiveElapsed(boat.startedAt)) : "00:00.00"}
                    </span>
                    <button className="btn-primary" onClick={() => handleStop(boat.id)}>Stop</button>
                </div>
            ))}
        </div>
    );
}