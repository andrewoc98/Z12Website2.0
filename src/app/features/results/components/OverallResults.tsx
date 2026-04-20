import ResultCard from "./ResultCard";

interface OverallResultsProps {
    boats: any[];
    rowerMap: Map<string, string>;
}

export default function OverallResults({ boats, rowerMap }: OverallResultsProps) {
    if (boats.length === 0) return <p>No boats finished yet.</p>;

    return (
        <section className="overall-results">
            <ul className="results-list">
                {boats.map((boat, idx) => (
                    <ResultCard key={boat.id} boat={boat} rank={idx + 1} rowerMap={rowerMap} />
                ))}
            </ul>
        </section>
    );
}