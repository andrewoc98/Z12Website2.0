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

        return Object.entries(map);

    }, [boats]);

    const toggle = (cat: string) => {
        setOpenCategory(prev => (prev === cat ? null : cat));
    };

    return (

        <div>

            {/* QUICK NAV */}
            <div className="flex gap-[6px] overflow-x-auto pb-1">
                {grouped.map(([cat, list]) => (
                    <button
                        key={cat}
                        onClick={() => setOpenCategory(cat)}
                        className={`px-[10px] py-[6px] rounded-[6px] border border-border bg-surface text-text whitespace-nowrap cursor-pointer min-h-[unset] ${openCategory === cat ? "bg-brand-warm text-brand-ink border-transparent" : ""}`}
                    >
                        {cat} ({list.length})
                    </button>
                ))}
            </div>

            {/* CATEGORY ACCORDION */}
            {grouped.map(([cat, list]) => {

                const open = openCategory === cat;

                return (
                    <div key={cat} className="border border-border rounded-[12px] overflow-hidden bg-surface text-text mb-3">

                        <div
                            className="px-3 py-[10px] flex justify-between items-center cursor-pointer font-semibold bg-surface-2 rounded-t-[8px] transition-[background] hover:bg-surface"
                            onClick={() => toggle(cat)}
                        >
                            {open ? "▼" : "▶"} {cat} ({list.length})
                        </div>

                        {open && (
                            <div className="flex flex-col">
                                {list.map((b) => (
                                    <div
                                        key={b.id}
                                        className="flex gap-3 px-3 py-[10px] cursor-pointer rounded-[8px] transition-[background] hover:bg-surface-2"
                                    >
                                        <span className="bg-surface-2 px-[10px] py-[6px] rounded-[6px] font-semibold text-text">{b.bowNumber}</span>
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
