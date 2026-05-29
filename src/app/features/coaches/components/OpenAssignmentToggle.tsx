import { useState } from "react";
import { setOpenAssignment } from "../services/coachAssignmentService";
import "../coaches.css";

interface Props {
    initial: boolean;
}

export function OpenAssignmentToggle({ initial }: Props) {
    const [open, setOpen]       = useState(initial);
    const [saving, setSaving]   = useState(false);
    const [toast, setToast]     = useState<string | null>(null);

    function showToast(msg: string) {
        setToast(msg);
        setTimeout(() => setToast(null), 3000);
    }

    async function handleToggle() {
        const next = !open;
        setOpen(next);
        setSaving(true);
        try {
            await setOpenAssignment({ openAssignment: next });
            showToast(next ? "Rowers can now assign you directly." : "Assignments now require your approval.");
        } catch {
            setOpen(!next);
            showToast("Failed to save setting.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <>
            <div className="ca-toggle-row">
                <div className="ca-toggle-label">
                    <span className="ca-toggle-label__title">Open to assignment requests</span>
                    <span className="ca-toggle-label__sub">
                        {open
                            ? "Rowers can assign you directly"
                            : "You approve each request before it becomes active"}
                    </span>
                </div>
                <label className="ca-switch">
                    <input
                        type="checkbox"
                        checked={open}
                        onChange={handleToggle}
                        disabled={saving}
                    />
                    <span className="ca-switch__track" />
                </label>
            </div>
            {toast && <div className="ca-toast ca-toast--success">{toast}</div>}
        </>
    );
}
