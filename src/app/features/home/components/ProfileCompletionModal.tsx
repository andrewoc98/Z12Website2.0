import { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../../shared/lib/firebase";
import { useAuth } from "../../../providers/AuthProvider";

type Props = {
    missingFields: string[];
};

const FIELD_LABELS: Record<string, string> = {
    gender: "Gender",
    dateOfBirth: "Date of birth",
};

export default function ProfileCompletionModal({ missingFields }: Props) {
    const { user } = useAuth() as any;
    const [dismissed, setDismissed] = useState(false);
    const [values, setValues] = useState<Record<string, string>>(() => {
        const initial: Record<string, string> = {};
        if (missingFields.includes("gender")) {
            initial.gender = user?.gender === "unknown" ? "" : (user?.gender ?? "");
        }
        return initial;
    });
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    if (dismissed) return null;

    const set = (field: string, value: string) =>
        setValues((prev) => ({ ...prev, [field]: value }));

    const allFilled = missingFields.every((f) => {
        const val = (values[f] ?? "").trim();
        if (f === "gender") return val !== "" && val !== "unknown";
        return val !== "";
    });

    async function handleSave() {
        if (!user || !allFilled) return;
        setSaving(true);
        setErr(null);
        try {
            const updates: Record<string, any> = {};
            if (values.gender) updates.gender = values.gender;
            if (values.dateOfBirth) updates.dateOfBirth = values.dateOfBirth;
            await updateDoc(doc(db, "users", user.uid), updates);
            setDismissed(true);
        } catch (e: any) {
            setErr(e?.message ?? "Failed to save. Please try again.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1000] p-4">
            <div className="bg-surface border border-white/10 rounded-xl p-8 w-full max-w-[440px] flex flex-col gap-6" role="dialog" aria-modal="true" aria-labelledby="pcm-title">

                <div className="flex gap-4 items-start">
                    <div className="text-[1.25rem] leading-none mt-[2px] shrink-0">⚠</div>
                    <div>
                        <h2 id="pcm-title" className="mb-1 text-[1.1rem] font-semibold text-white m-0">Complete your profile</h2>
                        <p className="text-[0.875rem] text-white/55 leading-[1.5] m-0">You need to fill in a few details before you can enter races.</p>
                    </div>
                </div>

                <div className="flex flex-col gap-5">
                    {missingFields.map((field) => (
                        <div key={field} className="flex flex-col gap-2">
                            <label htmlFor={`pcm-${field}`} className="text-[0.8rem] font-semibold tracking-[0.06em] uppercase text-white/55">
                                {FIELD_LABELS[field] ?? field}
                            </label>

                            {field === "gender" && (
                                <div className="flex gap-3">
                                    {["male", "female"].map((g) => (
                                        <label key={g} className={`flex-1 flex items-center justify-center gap-2 px-4 py-[0.6rem] border rounded-lg text-[0.9rem] cursor-pointer transition-[border-color,background] duration-150 text-white ${values.gender === g ? "border-white/45 bg-white/10" : "border-white/12 bg-white/4"}`}>
                                            <input
                                                type="radio"
                                                name="gender"
                                                value={g}
                                                checked={values.gender === g}
                                                onChange={() => set("gender", g)}
                                                className="hidden"
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
                                    className="!bg-white/6 !border-white/12 !rounded-lg !py-[0.6rem] !px-[0.875rem] !text-[0.9rem] !text-white focus:!border-white/35"
                                />
                            )}
                        </div>
                    ))}
                </div>

                {err && <p className="text-[0.85rem] text-[#f87171] m-0">{err}</p>}

                <div className="flex justify-end gap-3 pt-1">
                    <button
                        className="bg-white border-0 rounded-lg px-5 py-[0.6rem] text-[0.875rem] font-semibold text-black cursor-pointer transition-opacity duration-150 disabled:opacity-35 disabled:cursor-not-allowed [&:hover:not(:disabled)]:opacity-[0.88]"
                        onClick={handleSave}
                        disabled={!allFilled || saving}
                    >
                        {saving ? "Saving…" : "Save & continue"}
                    </button>
                </div>
            </div>
        </div>
    );
}
