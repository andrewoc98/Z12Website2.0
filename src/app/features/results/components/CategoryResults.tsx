import React, { useMemo, useState } from "react";
import ResultCard from "./ResultCard";

interface CategoryResultsProps {
    byCategory: Map<string, any[]>;
    selectedCategory: string | "All";
    pageSize?: number;
}

export default function CategoryResults({
                                            byCategory,
                                            selectedCategory,
                                            pageSize = 10,
                                        }: CategoryResultsProps) {

    const [page, setPage] = useState(1);

    // Flatten list based on selection
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

    // Reset page when category changes
    React.useEffect(() => {
        setPage(1);
    }, [selectedCategory]);

    return (
        <section className="category-results">

            {boats.length === 0 ? (
                <p>No boats finished yet.</p>
            ) : (
                <>
                    <ul className="results-list">
                        {paginatedBoats.map((boat, idx) => (
                            <ResultCard
                                key={boat.id}
                                boat={boat}
                                rank={(page - 1) * pageSize + idx + 1}
                            />
                        ))}
                    </ul>

                    {totalPages > 1 && (
                        <div className="pagination">
                            <button
                                className="btn-primary"
                                disabled={page === 1}
                                onClick={() => setPage(p => p - 1)}
                            >
                                Previous
                            </button>

                            <span>
                                Page {page} of {totalPages}
                            </span>

                            <button
                                className="btn-primary"
                                disabled={page === totalPages}
                                onClick={() => setPage(p => p + 1)}
                            >
                                Next
                            </button>
                        </div>
                    )}
                </>
            )}
        </section>
    );
}
