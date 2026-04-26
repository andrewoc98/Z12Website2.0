import { useMemo } from "react";
import { groupBoatsByCategory, sortBoatsByBowNumber, formatRowerNames } from "../lib/utils";
import { useUserProfiles } from "../useUserProfiles";
import type { BoatTimingDoc } from "../types";
import { startBoatTiming } from "../api/timing";

interface StartTabProps {
    eventId: string;
    boats: BoatTimingDoc[];
}

export default function StartTab({ eventId, boats }: StartTabProps) {
    const allUids = useMemo(() => {
        const uids = new Set<string>();
        boats.forEach(boat => boat.rowerUids.forEach(uid => uids.add(uid)));
        return Array.from(uids);
    }, [boats]);

    const { profiles } = useUserProfiles(allUids);

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
                            <div key={boat.id} className="boat-item">
                                <span>{boat.bowNumber}# {boat.clubName} {formatRowerNames(boat.rowerUids, profiles, boat.boatSize)}</span>
                                <button
                                    className="btn-primary"
                                    onClick={() => handleStart(boat.id)}
                                >
                                    Start
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}