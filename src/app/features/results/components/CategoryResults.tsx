import React, { useMemo, useState } from "react";
import ResultCard from "./ResultCard";

interface CategoryResultsProps {
    byCategory: Map<string, any[]>;
    selectedCategory: string | "All";
    inProgressBoats: any[];
    profiles: Record<string, any>;
    pageSize: number;
    page: number;
    currentUserUid?: string;
    linkedAthleteUids?: Set<string>;
}

const sectionHeading = "text-[0.8rem] font-bold tracking-[0.1em] uppercase text-muted m-0 mb-3";

export default function CategoryResults({ byCategory, selectedCategory, inProgressBoats, profiles, pageSize, currentUserUid, linkedAthleteUids }: CategoryResultsProps) {
    const [page, setPage] = useState(1);

    const boats = useMemo(() => {
        if (selectedCategory === "All") return Array.from(byCategory.values()).flat();
        return byCategory.get(selectedCategory) ?? [];
    }, [byCategory, selectedCategory]);

    const totalPages = Math.ceil(boats.length / pageSize);

    const paginatedBoats = useMemo(() => {
        const start = (page - 1) * pageSize;
        return boats.slice(start, start + pageSize);
    }, [boats, page, pageSize]);

    React.useEffect(() => { setPage(1); }, [selectedCategory]);

    return (
        <section>
            {boats.length === 0 ? (
                <p className="text-muted">No boats finished yet.</p>
            ) : (
                <>
                    <ul className="list-none p-0 m-0 grid gap-2">
                        {paginatedBoats.map((boat, idx) => (
                            <ResultCard key={boat.id+((page-1)*pageSize)} boat={boat} rank={(page - 1) * pageSize + idx + 1} profiles={profiles} currentUserUid={currentUserUid} linkedAthleteUids={linkedAthleteUids} />
                        ))}
                    </ul>
                    {totalPages > 1 && (
                        <div className="flex justify-center items-center gap-3 mt-6 text-muted text-[0.9rem]">
                            <button className="btn-primary" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</button>
                            <span>Page {page} of {totalPages}</span>
                            <button className="btn-primary" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
                        </div>
                    )}
                </>
            )}

            {inProgressBoats.length > 0 && (
                <div className="mt-7">
                    <h3 className={sectionHeading}>On Course</h3>
                    <ul className="list-none p-0 m-0 grid gap-2">
                        {inProgressBoats.map(boat => (
                            <ResultCard key={boat.id} boat={boat} inProgress profiles={profiles} currentUserUid={currentUserUid} linkedAthleteUids={linkedAthleteUids} />
                        ))}
                    </ul>
                </div>
            )}
        </section>
    );
}
