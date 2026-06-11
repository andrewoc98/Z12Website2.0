export default function FinishPanel({ selectedBoat }: any) {

    if (!selectedBoat) {
        return (
            <div className="card">
                <h3>Finish Control</h3>
                <p>Select a crew to record finish.</p>
            </div>
        );
    }

    const markFinish = () => {
        console.log("finish", selectedBoat.id);
    };

    const markDNF = () => {
        console.log("dnf", selectedBoat.id);
    };

    const markDNS = () => {
        console.log("dns", selectedBoat.id);
    };

    return (
        <div className="card text-center">

            <h3>Finish Control</h3>

            <div>
                <strong>{selectedBoat.clubName}</strong>
            </div>

            <button
                className="w-full py-[18px] text-[20px] font-bold bg-[#22c55e] border-none rounded-[10px] text-white mt-[10px] transition-[filter] hover:brightness-110 hover:shadow-none"
                onClick={markFinish}
            >
                FINISH
            </button>

            <div className="flex gap-[10px] mt-[10px]">
                <button
                    className="flex-1 py-3 bg-surface-2 border-none text-text rounded-[6px] cursor-pointer hover:bg-surface"
                    onClick={markDNF}
                >DNF</button>
                <button
                    className="flex-1 py-3 bg-surface-2 border-none text-text rounded-[6px] cursor-pointer hover:bg-surface"
                    onClick={markDNS}
                >DNS</button>
            </div>

        </div>
    );
}
