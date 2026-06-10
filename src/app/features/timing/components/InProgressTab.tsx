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
    reviewThresholdMs?: number;
}

export default function InProgressTab({ eventId, boats, reviewThresholdMs }: InProgressTabProps) {
    const [, setTick] = useState(0);
    const [placeholderLoading, setPlaceholderLoading] = useState(false);
    const [placeholderFlash, setPlaceholderFlash] = useState<{ kind: 'success'; time: string } | { kind: 'error' } | null>(null);
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
        const boat = inProgressBoats.find(b => b.id === boatId);
        try {
            await stopBoatTiming(eventId, boatId, boat?.startedAt, reviewThresholdMs);
        } catch (error) {
            console.error("Failed to stop timing:", error);
        }
    };

    const handleAddPlaceholder = async () => {
        setPlaceholderLoading(true);
        setPlaceholderFlash(null);
        const now = Date.now();
        try {
            await addPlaceholderFinish(eventId, now);
            const time = new Date(now).toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
            setPlaceholderFlash({ kind: 'success', time });
        } catch (error) {
            setPlaceholderFlash({ kind: 'error' });
            console.error("Failed to add placeholder:", error);
        } finally {
            setPlaceholderLoading(false);
            setTimeout(() => setPlaceholderFlash(null), 2200);
        }
    };

    const sheetActions: { key: BoatAction; label: string; onClick: () => void }[] = sheetBoat
        ? [
            {
                key: "stop" as BoatAction,
                label: "Stop Boat",
                onClick: async () => {
                    const boatId = sheetBoat.id;
                    const startedAt = sheetBoat.startedAt;
                    setSheetBoat(null);
                    triggerFeedback("start");
                    try {
                        await stopBoatTiming(eventId, boatId, startedAt, reviewThresholdMs);
                    } catch (error) {
                        console.error("Failed to stop timing:", error);
                    }
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
        return (
            <div className="in-progress-tab">
                <div className="timing-placeholder-bar">
                    <button
                        className={`timing-placeholder-btn${placeholderFlash?.kind === 'success' ? ' timing-placeholder-btn--success' : placeholderFlash?.kind === 'error' ? ' timing-placeholder-btn--error' : ''}`}
                        onClick={handleAddPlaceholder}
                        disabled={placeholderLoading || !!placeholderFlash}
                    >
                        {placeholderLoading && 'Recording…'}
                        {!placeholderLoading && !placeholderFlash && '+ Placeholder Finish'}
                        {placeholderFlash?.kind === 'success' && `✓ Recorded · ${placeholderFlash.time}`}
                        {placeholderFlash?.kind === 'error' && '✕ Failed — tap to retry'}
                    </button>
                </div>
                <p className="timing-empty">No boats in progress</p>
            </div>
        );
    }

    return (
        <div className="in-progress-tab">
            <div className="timing-placeholder-bar">
                <button className="timing-placeholder-btn" onClick={handleAddPlaceholder} disabled={placeholderLoading}>
                    {placeholderLoading ? "Adding…" : "+ Placeholder Finish"}
                </button>
            </div>
            <div className="boats-list">
                {inProgressBoats.map((boat) => (
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
                ))}
            </div>
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