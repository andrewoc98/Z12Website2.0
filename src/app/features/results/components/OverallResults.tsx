import ResultCard from "./ResultCard";

interface OverallResultsProps {
    boats: any[];
    inProgressBoats: any[];
    profiles: Record<string, any>;
    page: number;
    pageSize: number;
    currentUserUid?: string;
    linkedAthleteUids?: Set<string>;
}

const sectionHeading = "text-[0.8rem] font-bold tracking-[0.1em] uppercase text-muted m-0 mb-3";

export default function OverallResults({ boats, inProgressBoats, profiles, page, pageSize, currentUserUid, linkedAthleteUids }: OverallResultsProps) {
    return (
        <section>
            <div className="mb-7">
                <h3 className={sectionHeading}>Finished</h3>
                {boats.length === 0
                    ? <p className="text-muted">No finished results yet.</p>
                    : <ul className="list-none p-0 m-0 grid gap-2">
                        {boats.map((boat, idx) => (
                            <ResultCard key={boat.id} boat={boat} rank={(idx + 1)+((page-1)*pageSize)} profiles={profiles} currentUserUid={currentUserUid} linkedAthleteUids={linkedAthleteUids} />
                        ))}
                    </ul>
                }
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
            </div>
        </section>
    );
}
