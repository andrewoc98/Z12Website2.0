import { useState } from "react";
import { useAuth } from "../../../providers/AuthProvider";
import { saveConsentSettings } from "../api/user";
import type { UserProfile } from "../../auth/types";
import "../style/profile.css";

type Props = {
    profile: UserProfile;
    onProfileChange: (updated: Partial<UserProfile>) => void;
};

function ToggleRow({ id, label, checked, onChange }: {
    id: string;
    label: string;
    checked: boolean;
    onChange: (val: boolean) => void;
}) {
    return (
        <label className="consent-row" htmlFor={id}>
            <span className="consent-row__label">{label}</span>
            <span className="consent-toggle">
                <input
                    id={id}
                    type="checkbox"
                    className="consent-toggle__input"
                    checked={checked}
                    onChange={e => onChange(e.target.checked)}
                />
                <span className="consent-toggle__track" />
            </span>
        </label>
    );
}

export function ConsentSettings({ profile, onProfileChange }: Props) {
    const { user } = useAuth();
    const isRower = !!profile.roles?.rower;

    const [dataSharing,           setDataSharing]           = useState(profile.consent?.dataSharingAccepted         ?? false);
    const [nationalFederation,    setNationalFederation]    = useState(profile.nationalSelectionVisible             ?? false);

    const [saving, setSaving] = useState(false);
    const [msg,    setMsg]    = useState<{ text: string; type: "success" | "error" } | null>(null);

    async function handleSave() {
        if (!user) return;
        setSaving(true);
        try {
            await saveConsentSettings(user.uid, {
                dataSharingAccepted: dataSharing,
                ...(isRower ? {
                    nationalSelectionVisible:    nationalFederation,
                } : {}),
            });
            onProfileChange({
                consent: {
                    ...profile.consent,
                    dataSharingAccepted: dataSharing,
                    updatedAt: new Date().toISOString(),
                },
                ...(isRower ? { nationalSelectionVisible: nationalFederation } : {}),
            });
            setMsg({ text: "Saved.", type: "success" });
        } catch (e: any) {
            setMsg({ text: e?.message ?? "Save failed.", type: "error" });
        } finally {
            setSaving(false);
            setTimeout(() => setMsg(null), 3000);
        }
    }

    return (
        <div className="role-panel">
            <ToggleRow
                id="consent-data-sharing"
                label="I agree to share my data with coaches/universities"
                checked={dataSharing}
                onChange={setDataSharing}
            />
            {isRower && (
                <>
                    <ToggleRow
                        id="consent-national-federation"
                        label="I agree to share my data with my national federation"
                        checked={nationalFederation}
                        onChange={setNationalFederation}
                    />
                </>
            )}

            {msg && (
                <div className={`toast${msg.type === "error" ? " toast--error" : ""}`}>
                    {msg.text}
                </div>
            )}

            <div className="role-panel-actions">
                <button
                    type="button"
                    className="btn btn--brand"
                    onClick={handleSave}
                    disabled={saving}
                >
                    {saving ? "Saving…" : "Save"}
                </button>
            </div>
        </div>
    );
}
