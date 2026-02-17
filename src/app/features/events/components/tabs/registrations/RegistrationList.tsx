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

            <div className="pagination">

                <button
                    disabled={page === 1}
                    onClick={()=>setPage((p:number)=>p-1)}
                >
                    Prev
                </button>

                <span>
                    Page {page} / {totalPages}
                </span>

                <button
                    disabled={page === totalPages}
                    onClick={()=>setPage((p:number)=>p+1)}
                >
                    Next
                </button>

            </div>

        </div>
    );
}