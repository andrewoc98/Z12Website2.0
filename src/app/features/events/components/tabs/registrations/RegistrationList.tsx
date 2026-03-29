import CrewRow from "./CrewRow";

export default function RegistrationList({
                                             boats,
                                             page,
                                             totalPages,
                                             setPage
                                         }: any) {

    return (
        <div className="card registration-list">

            <div className="list-header">
                <span>Bow</span>
                <span>Club</span>
                <span>Category</span>
                <span>Status</span>
            </div>

            {boats.map((boat:any) => (
                <CrewRow key={boat.id} boat={boat} />
            ))}

            <div className="card card--tight registration-pagination">
                <div className="space-between">
                    <button
                        className="btn-ghost"
                        disabled={page === 1}
                        onClick={() => setPage((p: number) => Math.max(1, p - 1))}
                    >
                        ← Prev
                    </button>

                    <span className="badge">
            Page {page} / {totalPages}
        </span>

                    <button
                        className="btn-ghost"
                        disabled={page === totalPages}
                        onClick={() => setPage((p: number) => Math.min(totalPages, p + 1))}
                    >
                        Next →
                    </button>
                </div>
            </div>
        </div>
    );
}