import { useMemo, useEffect, useState } from "react";
import {sortBoatsByBowNumber, triggerFeedback} from "../lib/utils";
import { useUserProfiles } from "../useUserProfiles";
import type { BoatTimingDoc } from "../types";
import {stopBoatTiming, addPlaceholderFinish, markBoatDNF} from "../api/timing";
import RaceActionSheet, {type BoatAction} from "../RaceActionSheet.tsx";
import {StopBoatItem} from "./StopBoatItem.tsx";

interface InProgressTabProps {
    eventId: string;
    boats: BoatTimingDoc[];
}

export default function InProgressTab({ eventId, boats }: InProgressTabProps) {
    const [, setTick] = useState(0);
    const [placeholderLoading, setPlaceholderLoading] = useState(false);
    const [placeholderMsg, setPlaceholderMsg] = useState<string | null>(null);
    const [sheetBoat, setSheetBoat] = useState<BoatTimingDoc | null>(null);

    // Force re-render every 100ms to update timers
    useEffect(() => {
        const interval = setInterval(() => {
            setTick(t => t + 1);
        }, 70);
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

    const sheetActions: { key: BoatAction; label: string; onClick: () => void }[] = sheetBoat
        ? [
            {
                key: "stop" as BoatAction, // Cast to the specific union type
                label: "Stop Boat",
                onClick: async () => {
                    const boatId = sheetBoat.id;
                    setSheetBoat(null);
                    triggerFeedback("start");
                    await handleStop(boatId);
                }
            },
            {
                key: "dnf" as BoatAction, // Corrected from "dns" to match context if needed, or keep as "dns"
                label: "Mark DNF",
                onClick: async () => {
                    const boatId = sheetBoat.id;
                    setSheetBoat(null);
                    triggerFeedback("stop");
                    try {
                        await markBoatDNF(eventId, boatId);
                    } catch (error) {
                        console.error("Failed to mark DNF:", error);
                    }
                }
            }
        ]
        : [];

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
                    <StopBoatItem
                        key={boat.id}
                        profiles={profiles}
                        boat={boat}
                        onLongPress={setSheetBoat}
                        onStop={(id) => {
                            triggerFeedback("stop");
                            handleStop(id);
                        }}
                    />
                </div>
            ))}
            <RaceActionSheet
                open={!!sheetBoat}
                title={
                    sheetBoat
                        ? `${sheetBoat.bowNumber}# ${sheetBoat.clubName}`
                        : ""
                }
                actions={sheetActions}
                onClose={() => setSheetBoat(null)}
            />
        </div>
    );
}