import { useAuth } from "../../../providers/AuthProvider.tsx";
import { useEffect, useState } from "react";
import type { UserProfile } from "../../auth/types.ts";
import { upsertUserProfile } from "../../auth/api/users.ts";

function parseTime(value: string): number | undefined {
    if (!value) return undefined;
    const parts = value.split(":").map(Number);
    if (parts.length === 1) {
        // just seconds
        return parts[0];
    } else if (parts.length === 2) {
        // minutes:seconds
        return parts[0] * 60 + parts[1];
    }
    return undefined;
}

// Helper: convert total seconds → mm:ss.s string
function formatTime(seconds?: number): string {
    if (seconds == null) return "";
    if (seconds < 60) {
        return seconds.toFixed(1); // just seconds
    } else {
        const m = Math.floor(seconds / 60);
        const s = (seconds % 60).toFixed(1).padStart(4, "0"); // ensures "1:05.0"
        return `${m}:${s}`;
    }
}

export function ProfileEditor({ profile }: { profile: UserProfile }) {
    const { user } = useAuth();
    const [fullName, setFullName] = useState(profile.fullName ?? "");
    const [displayName, setDisplayName] = useState(profile.displayName ?? "");
    const [club, setClub] = useState(profile.roles?.rower?.club ?? "");
    const [stats, setStats] = useState({
        heightCm: profile.roles?.rower?.stats?.heightCm ?? "",
        wingspanCm: profile.roles?.rower?.stats?.wingspanCm ?? "",
        weightKg: profile.roles?.rower?.stats?.weightKg ?? "",
    });
    const [performances, setPerformances] = useState({
        best100m: formatTime(profile.roles?.rower?.performances?.best100m),
        best500m: formatTime(profile.roles?.rower?.performances?.best500m),
        best2000m: formatTime(profile.roles?.rower?.performances?.best2000m),
        best6000m: formatTime(profile.roles?.rower?.performances?.best6000m),
    });
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);

    useEffect(() => {
        setFullName(profile.fullName ?? "");
        setDisplayName(profile.displayName ?? "");
        setClub(profile.roles?.rower?.club ?? "");
        setStats({
            heightCm: profile.roles?.rower?.stats?.heightCm ?? "",
            wingspanCm: profile.roles?.rower?.stats?.wingspanCm ?? "",
            weightKg: profile.roles?.rower?.stats?.weightKg ?? "",
        });
        setPerformances({
            best100m: formatTime(profile.roles?.rower?.performances?.best100m),
            best500m: formatTime(profile.roles?.rower?.performances?.best500m),
            best2000m: formatTime(profile.roles?.rower?.performances?.best2000m),
            best6000m: formatTime(profile.roles?.rower?.performances?.best6000m),
        });
    }, [profile]);

    async function onSave() {
        if (!user) return;
        setMsg(null);
        setSaving(true);

        try {
            const next: UserProfile = {
                ...profile,
                fullName: fullName.trim(),
                displayName: displayName.trim() || fullName.trim(),
                roles: {
                    ...profile.roles,
                    ...(profile.roles?.rower
                        ? {
                            rower: {
                                club: club.trim(),
                                stats: {
                                    heightCm: Number(stats.heightCm) || 0,
                                    wingspanCm: Number(stats.wingspanCm) || 0,
                                    weightKg: Number(stats.weightKg) || 0,
                                },
                                performances: {
                                    best100m: parseTime(performances.best100m),
                                    best500m: parseTime(performances.best500m),
                                    best2000m: parseTime(performances.best2000m),
                                    best6000m: parseTime(performances.best6000m),
                                },
                            },
                        }
                        : {}),
                },
            };
            await upsertUserProfile(user.uid, next);
            setMsg("Saved.");
        } catch (e: any) {
            setMsg(e?.message ?? "Save failed.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <form className="form" onSubmit={(e) => e.preventDefault()}>
            <div className="field">
                <label>Full name</label>
                <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your full name"
                />
            </div>
            <div className="field">
                <label>Display name</label>
                <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Shown in UI (defaults to full name)"
                />
            </div>

            {profile.roles?.rower && (
                <div className="panel">
                    <h3>Rower</h3>
                    <div className="field">
                        <label>Club</label>
                        <input
                            value={club}
                            onChange={(e) => setClub(e.target.value)}
                            placeholder="-"
                        />
                    </div>

                    <div className="field">
                        <label>Height (cm)</label>
                        <input
                            type="number"
                            value={stats.heightCm}
                            onChange={(e) => setStats({ ...stats, heightCm: e.target.value })}
                            placeholder="-"
                        />
                    </div>
                    <div className="field">
                        <label>Wingspan (cm)</label>
                        <input
                            type="number"
                            value={stats.wingspanCm}
                            onChange={(e) => setStats({ ...stats, wingspanCm: e.target.value })}
                            placeholder="-"
                        />
                    </div>
                    <div className="field">
                        <label>Weight (kg)</label>
                        <input
                            type="number"
                            value={stats.weightKg}
                            onChange={(e) => setStats({ ...stats, weightKg: e.target.value })}
                            placeholder="-"
                        />
                    </div>

                    <h4>Performance Times (mm:ss.s)</h4>
                    <div className="field">
                        <label>100m</label>
                        <input
                            value={performances.best100m}
                            onChange={(e) =>
                                setPerformances({ ...performances, best100m: e.target.value })
                            }
                            placeholder="-"
                        />
                    </div>
                    <div className="field">
                        <label>500m</label>
                        <input
                            value={performances.best500m}
                            onChange={(e) =>
                                setPerformances({ ...performances, best500m: e.target.value })
                            }
                            placeholder="-"
                        />
                    </div>
                    <div className="field">
                        <label>2000m</label>
                        <input
                            value={performances.best2000m}
                            onChange={(e) =>
                                setPerformances({ ...performances, best2000m: e.target.value })
                            }
                            placeholder="-"
                        />
                    </div>
                    <div className="field">
                        <label>6000m</label>
                        <input
                            value={performances.best6000m}
                            onChange={(e) =>
                                setPerformances({ ...performances, best6000m: e.target.value })
                            }
                            placeholder="-"
                        />
                    </div>
                </div>
            )}

            {msg && <div className="toast">{msg}</div>}

            <div className="sticky-actions">
                <button type="button" className="btn btn--brand" onClick={onSave} disabled={saving}>
                    {saving ? "Saving…" : "Save changes"}
                </button>
            </div>
        </form>
    );
}
