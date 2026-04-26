import React, { useMemo, useState } from "react";
import ResultCard from "./ResultCard";

interface CategoryResultsProps {
    byCategory: Map<string, any[]>;
    selectedCategory: string | "All";
    inProgressBoats: any[];
    profiles: Record<string, any>;
    pageSize?: number;
}

export default function CategoryResults({ byCategory, selectedCategory, inProgressBoats, profiles, pageSize = 10 }: CategoryResultsProps) {
    const [page, setPage] = useState(1);

    const boats = useMemo(() => {
        if (selectedCategory === "All") {
            return Array.from(byCategory.values()).flat();
        }
        return byCategory.get(selectedCategory) ?? [];
    }, [byCategory, selectedCategory]);

    const totalPages = Math.ceil(boats.length / pageSize);

    const paginatedBoats = useMemo(() => {
        const start = (page - 1) * pageSize;
        return boats.slice(start, start + pageSize);
    }, [boats, page, pageSize]);

    React.useEffect(() => {
        setPage(1);
    }, [selectedCategory]);

    return (
        <section className="category-results">
            {boats.length === 0 ? (
                <p className="results-empty">No boats finished yet.</p>
            ) : (
                <>
                    <ul className="results-list">
                        {paginatedBoats.map((boat, idx) => (
                            <ResultCard key={boat.id} boat={boat} rank={(page - 1) * pageSize + idx + 1} profiles={profiles} />
                        ))}
                    </ul>
                    {totalPages > 1 && (
                        <div className="pagination">
                            <button className="btn-primary" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</button>
                            <span>Page {page} of {totalPages}</span>
                            <button className="btn-primary" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
                        </div>
                    )}
                </>
            )}

             {inProgressBoats.length > 0 && (
                <div className="results-section">
                    <h3 className="results-section-heading">On Course</h3>
                    <ul className="results-list">
                        {inProgressBoats.map(boat => (
                            <ResultCard key={boat.id} boat={boat} inProgress profiles={profiles} />
                        ))}
                    </ul>
                </div>
            )}
        </section>
    );
}