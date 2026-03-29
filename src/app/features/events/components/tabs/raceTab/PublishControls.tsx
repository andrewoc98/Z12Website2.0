import React, { useState } from "react";
import { updateEventPublishMode } from "../../../api/events.ts"; // import the helper

export default function PublishControls({ publishMode, setPublishMode, eventId }: any) {

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const mode = e.target.value as "Live" | "Category" | "Event";
        setPublishMode(mode); // update local state immediately
        setSaving(true);
        setError(null);

        try {
            await updateEventPublishMode(eventId, mode);
        } catch (err: any) {
            setError(err.message ?? "Failed to save");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="card publish-controls">
            <h3>Results Publishing</h3>
            <select value={publishMode} onChange={handleChange} disabled={saving}>
                <option value="Live">Live Results</option>
                <option value="Category">After Category Finished</option>
                <option value="Event">When Event is complete</option>
            </select>
            {saving && <span>Saving…</span>}
            {error && <span className="error">{error}</span>}
        </div>
    );
}