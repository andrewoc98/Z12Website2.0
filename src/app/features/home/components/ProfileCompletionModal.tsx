import { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../../shared/lib/firebase";
import { useAuth } from "../../../providers/AuthProvider";
import "../styles/ProfileCompletionModal.css";

type Props = {
    missingFields: string[];
};

const FIELD_LABELS: Record<string, string> = {
    gender: "Gender",
    dateOfBirth: "Date of birth",
    club: "Club name",
};

export default function ProfileCompletionModal({ missingFields }: Props) {
    const { user, } = useAuth() as any;
    const [dismissed, setDismissed] = useState(false);
    const [values, setValues] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    if (dismissed) return null;

    const set = (field: string, value: string) =>
        setValues((prev) => ({ ...prev, [field]: value }));

    const allFilled = missingFields.every((f) => (values[f] ?? "").trim());

    async function handleSave() {
        if (!user || !allFilled) return;
        setSaving(true);
        setErr(null);
        try {
            const updates: Record<string, any> = {};
            if (values.gender) updates.gender = values.gender;
            if (values.dateOfBirth) updates.dateOfBirth = values.dateOfBirth;
            if (values.club) updates["roles.rower.club"] = values.club.trim();
            await updateDoc(doc(db, "users", user.uid), updates);
            setDismissed(true);
        } catch (e: any) {
            setErr(e?.message ?? "Failed to save. Please try again.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="pcm-overlay">
            <div className="pcm-modal" role="dialog" aria-modal="true" aria-labelledby="pcm-title">
                <div className="pcm-header">
                    <div className="pcm-icon">⚠</div>
                    <div>
                        <h2 id="pcm-title">Complete your profile</h2>
                        <p>You need to fill in a few details before you can enter races.</p>
                    </div>
                </div>

                <div className="pcm-fields">
                    {missingFields.map((field) => (
                        <div key={field} className="pcm-field">
                            <label htmlFor={`pcm-${field}`}>{FIELD_LABELS[field] ?? field}</label>

                            {field === "gender" && (
                                <div className="pcm-radio-group">
                                    {["male", "female"].map((g) => (
                                        <label key={g} className={`pcm-radio ${values.gender === g ? "pcm-radio--active" : ""}`}>
                                            <input
                                                type="radio"
                                                name="gender"
                                                value={g}
                                                checked={values.gender === g}
                                                onChange={() => set("gender", g)}
                                            />
                                            {g.charAt(0).toUpperCase() + g.slice(1)}
                                        </label>
                                    ))}
                                </div>
                            )}

                            {field === "dateOfBirth" && (
                                <input
                                    id="pcm-dateOfBirth"
                                    type="date"
                                    max={new Date().toISOString().slice(0, 10)}
                                    value={values.dateOfBirth ?? ""}
                                    onChange={(e) => set("dateOfBirth", e.target.value)}
                                />
                            )}

                            {field === "club" && (
                                <input
                                    id="pcm-club"
                                    type="text"
                                    placeholder="e.g. Neptun Rowing Club"
                                    value={values.club ?? ""}
                                    onChange={(e) => set("club", e.target.value)}
                                />
                            )}
                        </div>
                    ))}
                </div>

                {err && <p className="pcm-error">{err}</p>}

                <div className="pcm-actions">
                    <button className="pcm-btn-primary" onClick={handleSave} disabled={!allFilled || saving}>
                        {saving ? "Saving…" : "Save & continue"}
                    </button>
                </div>
            </div>
        </div>
    );
}