import {useMemo, useState} from "react";
import {groupBoatsByCategory, sortBoatsByBowNumber,triggerFeedback} from "../lib/utils";
import type { BoatTimingDoc } from "../types";
import {markBoatDNS, startBoatTiming} from "../api/timing";
import {StartBoatItem} from "./StartBoatItem.tsx";
import RaceActionSheet, {type BoatAction} from "../RaceActionSheet.tsx";

interface StartTabProps {
    eventId: string;
    boats: BoatTimingDoc[];
}

export default function StartTab({ eventId, boats }: StartTabProps) {
    const [sheetBoat, setSheetBoat] = useState<BoatTimingDoc | null>(null);

const categories = useMemo(() => {
    const registeredBoats = boats.filter(b => b.status === "registered");
    const grouped = groupBoatsByCategory(registeredBoats);
    return Object.entries(grouped)
        .map(([catId, catBoats]) => ({
            id: catId,
            name: catBoats[0]?.categoryName || catId,
            boats: sortBoatsByBowNumber(catBoats)
        }))
        .sort((a, b) => {
            const minA = a.boats[0]?.bowNumber ?? Infinity;
            const minB = b.boats[0]?.bowNumber ?? Infinity;
            return minA - minB;
        });
}, [boats]);

    const sheetActions: { key: BoatAction; label: string; onClick: () => void }[] = sheetBoat
        ? [
            {
                key: "start" as BoatAction,
                label: "Start Boat",
                onClick: async () => {
                    const boatId = sheetBoat.id;
                    setSheetBoat(null);
                    triggerFeedback("start");
                    await handleStart(boatId);
                }
            },
            {
                key: "dns" as BoatAction,
                label: "Mark DNS",
                onClick: async () => {
                    const boatId = sheetBoat.id;
                    setSheetBoat(null);
                    triggerFeedback("stop");
                    try {
                        await markBoatDNS(eventId, boatId);
                    } catch (error) {
                        console.error("Failed to mark DNS:", error);
                    }
                }
            }
        ]
        : [];

    const handleStart = async (boatId: string) => {
        try {
            await startBoatTiming(eventId, boatId);
        } catch (error) {
            console.error("Failed to start timing:", error);
        }
    };

    return (
        <div className="start-tab">
            {categories.map((category) => (
                <div key={category.id} className="category-section">
                    <h3>{category.name}</h3>
                    <div className="boats-list">
                        {category.boats.map((boat) => (
                            <StartBoatItem
                                key={boat.id}
                                boat={boat}
                                onLongPress={setSheetBoat}
                                onStart={(id) => {
                                    triggerFeedback("start");
                                    handleStart(id);
                                }}
                            />
                        ))}
                    </div>
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