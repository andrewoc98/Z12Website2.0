import { useState } from "react";
import dayjs from "dayjs";
import { saveBoatAdjustment } from "../../../api/events";

export default function ResultsEditor({ event, boats }: any) {
    const [adjustments, setAdjustments] = useState<{ [id: string]: number }>(() => {
        const initial: any = {};
        boats.forEach((b: any) => {
            if (b.adjustmentSeconds) initial[b.id] = b.adjustmentSeconds;
        });
        return initial;
    });

    const [saving, setSaving] = useState<{ [id: string]: boolean }>({});

    const handleChange = (boatId: string, value: string) => {
        setAdjustments(prev => ({
            ...prev,
            [boatId]: Number(value)
        }));
    };

    const handleSave = async (boatId: string) => {
        console.log(event)
        const newValue = adjustments[boatId] ?? 0;
        const boat = boats.find((b: any) => b.id === boatId);

        if (!event.id || !boatId) {
            console.error("Missing eventId or boatId", { event, boatId });
            return;
        }

        if ((boat?.adjustmentSeconds ?? 0) === newValue) return;

        try {
            setSaving(prev => ({ ...prev, [boatId]: true }));
            console.log("Saving adjustment", { event, boatId, newValue });
            await saveBoatAdjustment(event.id, boatId, newValue);
        } catch (err) {
            console.error("Failed to save adjustment", err);
        } finally {
            setSaving(prev => ({ ...prev, [boatId]: false }));
        }
    };

    const formatTime = (timestamp: number | null) => {
        if (!timestamp) return "—";
        return dayjs(timestamp).format("HH:mm:ss.SSS");
    };

    const formatElapsed = (elapsedMs: number | null) => {
        if (elapsedMs == null) return "—";

        const totalSeconds = elapsedMs / 1000;

        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        const secondsFormatted = seconds.toFixed(1).padStart(4, "0");

        if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${secondsFormatted}`;
        if (minutes > 0) return `${minutes}:${secondsFormatted}`;
        return `${secondsFormatted}s`;
    };

    return (
        <div className="card results-editor">
            <h3>Results & Times</h3>

            <div className="results-header">
                <span>Bow</span>
                <span>Club</span>
                <span>Start Time</span>
                <span>Finish Time</span>
                <span>Elapsed</span>
                <span>Adjust (s)</span>
            </div>

            {boats.map((b: any) => {
                const startMs = b.startedAt ?? null;  // already epoch
                const finishMs = b.finishedAt ?? null; // already epoch

                const adjustmentMs = (adjustments[b.id] || 0) * 1000;
                const elapsed = startMs && finishMs ? finishMs - startMs + adjustmentMs : null;

                return (
                    <div key={b.id} className="result-row">
                        <span>{b.bowNumber}</span>
                        <span>{b.clubName}</span>
                        <span>{formatTime(startMs)}</span>
                        <span>{formatTime(finishMs)}</span>
                        <span>{formatElapsed(elapsed)}</span>
                        <input
                            type="number"
                            value={adjustments[b.id] ?? ""}
                            placeholder="0"
                            disabled={saving[b.id]}
                            onChange={e => handleChange(b.id, e.target.value)}
                            onBlur={() => handleSave(b.id)}
                        />
                    </div>
                );
            })}
        </div>
    );
}