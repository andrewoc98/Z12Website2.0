import ResultCard from "./ResultCard";

interface OverallResultsProps {
    boats: any[];
}

export default function OverallResults({ boats }: OverallResultsProps) {
    if (boats.length === 0) return <p>No boats finished yet.</p>;

    return (
        <section className="overall-results">
            <ul className="results-list">
                {boats.map((boat, idx) => (
                    <ResultCard key={boat.id} boat={boat} rank={idx + 1} />
                ))}
            </ul>
        </section>
    );
}