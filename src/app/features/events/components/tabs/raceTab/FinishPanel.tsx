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
        <div className="card finish-panel">

            <h3>Finish Control</h3>

            <div className="finish-crew">
                <strong>{selectedBoat.clubName}</strong>
            </div>

            <button className="finish-btn" onClick={markFinish}>
                FINISH
            </button>

            <div className="secondary-actions">
                <button onClick={markDNF}>DNF</button>
                <button onClick={markDNS}>DNS</button>
            </div>

        </div>
    );
}