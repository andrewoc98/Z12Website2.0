import ResultCard from "./ResultCard";

interface CategoryResultsProps {
    boats: any[];
    selectedCategory: string;
    rowerMap: Map<string, string>;
}

export default function CategoryResults({
                                            boats,
                                            rowerMap,
                                        }: CategoryResultsProps) {
    if (boats.length === 0) return <p>No boats finished yet.</p>;

    return (
        <section className="category-results">
            <ul className="results-list">
                {boats.map((boat, idx) => (
                    <ResultCard
                        key={boat.id}
                        boat={boat}
                        rank={idx + 1}
                        rowerMap={rowerMap}
                    />
                ))}
            </ul>
        </section>
    );
}