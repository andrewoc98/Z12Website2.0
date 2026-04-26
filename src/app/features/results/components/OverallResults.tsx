import ResultCard from "./ResultCard";

interface OverallResultsProps {
    boats: any[];
    inProgressBoats: any[];
    profiles: Record<string, any>;
}

export default function OverallResults({ boats, inProgressBoats, profiles }: OverallResultsProps) {
    return (
        <section className="overall-results">
            <div className="results-section">
                <h3 className="results-section-heading">Finished</h3>
                {boats.length === 0
                    ? <p className="results-empty">No finished results yet.</p>
                    : <ul className="results-list">
                        {boats.map((boat, idx) => (
                            <ResultCard key={boat.id} boat={boat} rank={idx + 1} profiles={profiles} />
                        ))}
                    </ul>
                }
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
            </div>
        </section>
    );
}