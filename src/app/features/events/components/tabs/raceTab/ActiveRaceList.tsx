import { useState, useMemo } from "react";
import type {BoatDoc} from "../../../../signup/types.ts";

interface ActiveCrewListProps {
    boats: BoatDoc[];
}

export default function ActiveCrewList({ boats }: ActiveCrewListProps) {

    const [openCategory, setOpenCategory] = useState<string | null>(null);

    const grouped = useMemo(() => {

        const map: Record<string, BoatDoc[]> = {};

        for (const b of boats) {
            (map[b.categoryId] ??= []).push(b);
        }

        return Object.entries(map); // [string, BoatDoc[]][]

    }, [boats]);

    const toggle = (cat: string) => {
        setOpenCategory(prev => (prev === cat ? null : cat));
    };

    return (

        <div className="active-crew-container">

            {/* QUICK NAV */}
            <div className="category-nav">
                {grouped.map(([cat, list]) => (
                    <button
                        key={cat}
                        onClick={() => setOpenCategory(cat)}
                        className={openCategory === cat ? "active" : ""}
                    >
                        {cat} ({list.length})
                    </button>
                ))}
            </div>

            {/* CATEGORY ACCORDION */}
            {grouped.map(([cat, list]) => {

                const open = openCategory === cat;

                return (
                    <div key={cat} className="category-section">

                        <div
                            className="category-header"
                            onClick={() => toggle(cat)}
                        >
                            {open ? "▼" : "▶"} {cat} ({list.length})
                        </div>

                        {open && (
                            <div className="crew-list">
                                {list.map((b) => (
                                    <div
                                        key={b.id}
                                        className="crew-row"
                                    >
                                        <span className="bow">{b.bowNumber}</span>
                                        <span>{b.clubName}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                    </div>
                );

            })}

        </div>
    );
}
