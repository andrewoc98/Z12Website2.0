import { useState } from "react";

export default function CrewRow({ boat }: any) {

    const [bow, setBow] = useState(boat.bowNumber || "");

    const saveBow = () => {
        // TODO: update bow number API
        console.log("update bow", bow);
    };

    return (
        <div className="crew-row">

            <input
                className={`bow-input ${!bow ? "missing" : ""}`}
                value={bow}
                placeholder="—"
                onChange={e => setBow(e.target.value)}
                onBlur={saveBow}
            />

            <span>{boat.clubName}</span>

            <span>{boat.categoryId}</span>

            <span className={`status-pill ${boat.status}`}>
                {boat.status}
            </span>

        </div>
    );
}