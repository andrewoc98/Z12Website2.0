import { useAuth } from "../../../providers/AuthProvider.tsx";
import { useState } from "react";
import type { UserProfile } from "../../auth/types.ts";
import {
    saveCoreProfile,
    saveUserRole,
    removeUserRole,
} from "../api/user.ts";
import "../style/profile.css";
import DateOfBirthInput from "../../auth/components/DateOfBirthInput.tsx";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseTime(value: string): number | undefined {
    if (!value.trim()) return undefined;
    const parts = value.split(":").map(Number);
    if (parts.some(isNaN)) return undefined;
    if (parts.length === 1) return parts[0];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return undefined;
}

function formatTime(seconds?: number): string {
    if (seconds == null) return "";
    if (seconds < 60) return seconds.toFixed(1);
    const m = Math.floor(seconds / 60);
    const s = (seconds % 60).toFixed(1).padStart(4, "0");
    return `${m}:${s}`;
}

type RoleKey = "rower" | "coach" | "host";
const ALL_ROLES: RoleKey[] = ["rower", "coach", "host"];

// ─── Small shared components ──────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="field">
            <label>{label}</label>
            {children}
        </div>
    );
}

function Toast({ msg, type }: { msg: string; type: "success" | "error" }) {
    return (
        <div className={`toast ${type === "error" ? "toast--error" : ""}`}>
            {msg}
        </div>
    );
}

function useNotify() {
    const [msg,     setMsg]     = useState<string | null>(null);
    const [msgType, setMsgType] = useState<"success" | "error">("success");

    function notify(text: string, type: "success" | "error" = "success") {
        setMsgType(type);
        setMsg(text);
        setTimeout(() => setMsg(null), 3000);
    }

    return { msg, msgType, notify };
}

// ─── Add-role form ────────────────────────────────────────────────────────────

function AddRoleForm({ role, onSave, onCancel }: {
    role: RoleKey;
    onSave: (data: any) => Promise<void>;
    onCancel: () => void;
}) {
    const [club,     setClub]     = useState("");
    const [location, setLocation] = useState("");
    const [saving,   setSaving]   = useState(false);
    const [err,      setErr]      = useState<string | null>(null);

    const canSubmit =
        (role !== "host" && club.trim().length >= 2) ||
        (role === "host" && location.trim().length >= 2);

    async function handleSave() {
        setErr(null);
        setSaving(true);
        try {
            const data = role === "host"
                ? { location: location.trim() }
                : { club: club.trim(), stats: {}, performances: {} };
            await onSave(data);
        } catch (e: any) {
            setErr(e?.message ?? "Failed to add role.");
            setSaving(false);
        }
    }

    return (
        <div className="add-role-form">
            {role !== "host" ? (
                <Field label="Club">
                    <input
                        value={club}
                        onChange={e => setClub(e.target.value)}
                        placeholder={role === "coach" ? "Club you coach at" : "Your rowing club"}
                    />
                </Field>
            ) : (
                <Field label="Location">
                    <input
                        value={location}
                        onChange={e => setLocation(e.target.value)}
                        placeholder="Event location"
                    />
                </Field>
            )}

            {err && <p className="error">{err}</p>}

            <div className="add-role-actions">
                <button
                    type="button"
                    className="btn btn--brand"
                    disabled={!canSubmit || saving}
                    onClick={handleSave}
                >
                    {saving ? "Adding…" : `Add ${role} role`}
                </button>
                <button
                    type="button"
                    className="btn"
                    onClick={onCancel}
                    disabled={saving}
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}

// ─── Role panels ──────────────────────────────────────────────────────────────

function RowerPanel({ rower, onSave, onRemove }: {
    rower: NonNullable<UserProfile["roles"]["rower"]>;
    onSave: (data: NonNullable<UserProfile["roles"]["rower"]>) => Promise<void>;
    onRemove: () => Promise<void>;
}) {
    const [club,   setClub]   = useState(rower.club ?? "");
    const [stats,  setStats]  = useState({
        heightCm:   String(rower.stats?.heightCm   ?? ""),
        wingspanCm: String(rower.stats?.wingspanCm ?? ""),
        weightKg:   String(rower.stats?.weightKg   ?? ""),
    });
    const [perf, setPerf] = useState({
        best100m:   formatTime(rower.performances?.best100m),
        best500m:   formatTime(rower.performances?.best500m),
        best2000m:  formatTime(rower.performances?.best2000m),
        best6000m:  formatTime(rower.performances?.best6000m),
        best10000m: formatTime(rower.performances?.best10000m),
    });
    const [saving,   setSaving]   = useState(false);
    const [removing, setRemoving] = useState(false);
    const { msg, msgType, notify } = useNotify();

    async function handleSave() {
        setSaving(true);
        try {
            const rawStats = {
                heightCm:   Number(stats.heightCm)   || undefined,
                wingspanCm: Number(stats.wingspanCm) || undefined,
                weightKg:   Number(stats.weightKg)   || undefined,
            };
            const rawPerf = {
                best100m:   parseTime(perf.best100m),
                best500m:   parseTime(perf.best500m),
                best2000m:  parseTime(perf.best2000m),
                best6000m:  parseTime(perf.best6000m),
                best10000m: parseTime(perf.best10000m),
            };

            // Remove undefined keys so Firestore/your API doesn't choke on them
            const cleanedStats = Object.fromEntries(
                Object.entries(rawStats).filter(([, v]) => v !== undefined)
            );
            const cleanedPerf = Object.fromEntries(
                Object.entries(rawPerf).filter(([, v]) => v !== undefined)
            );

            await onSave({
                club: club.trim(),
                stats: cleanedStats,
                performances: cleanedPerf,
            });
            notify("Rower saved.");
        } catch (e: any) {
            notify(e?.message ?? "Save failed.", "error");
        } finally {
            setSaving(false);
        }
    }

    async function handleRemove() {
        if (!confirm("Remove rower role? This cannot be undone.")) return;
        setRemoving(true);
        try {
            await onRemove();
        } catch (e: any) {
            notify(e?.message ?? "Remove failed.", "error");
            setRemoving(false);
        }
    }

    const perfLabels: [keyof typeof perf, string][] = [
        ["best100m", "100 m"],
        ["best500m", "500 m"],
        ["best2000m", "2000 m"],
        ["best6000m", "6000 m"],
        ["best10000m", "10000 m"],
    ];

    return (
        <div className="panel">
            <div className="panel-header">
                <h3>Rower</h3>
                <button
                    type="button"
                    className="btn btn--danger btn--sm"
                    onClick={handleRemove}
                    disabled={removing}
                >
                    {removing ? "Removing…" : "Remove role"}
                </button>
            </div>

            <Field label="Club">
                <input value={club} onChange={e => setClub(e.target.value)} placeholder="-" />
            </Field>

            <h4>Physical stats</h4>
            <Field label="Height (cm)">
                <input
                    type="number"
                    value={stats.heightCm}
                    onChange={e => setStats(s => ({ ...s, heightCm: e.target.value }))}
                    placeholder="-"
                />
            </Field>
            <Field label="Wingspan (cm)">
                <input
                    type="number"
                    value={stats.wingspanCm}
                    onChange={e => setStats(s => ({ ...s, wingspanCm: e.target.value }))}
                    placeholder="-"
                />
            </Field>
            <Field label="Weight (kg)">
                <input
                    type="number"
                    value={stats.weightKg}
                    onChange={e => setStats(s => ({ ...s, weightKg: e.target.value }))}
                    placeholder="-"
                />
            </Field>

            <h4>Best erg scores (mm:ss.s)</h4>
            {perfLabels.map(([key, label]) => (
                <Field key={key} label={label}>
                    <input
                        value={perf[key]}
                        onChange={e => setPerf(p => ({ ...p, [key]: e.target.value }))}
                        placeholder="-"
                    />
                </Field>
            ))}

            {msg && <Toast msg={msg} type={msgType} />}

            <div className="panel-actions">
                <button
                    type="button"
                    className="btn btn--brand"
                    onClick={handleSave}
                    disabled={saving}
                >
                    {saving ? "Saving…" : "Save rower"}
                </button>
            </div>
        </div>
    );
}

function CoachPanel({ coach, onSave, onRemove }: {
    coach: NonNullable<UserProfile["roles"]["coach"]>;
    onSave: (data: NonNullable<UserProfile["roles"]["coach"]>) => Promise<void>;
    onRemove: () => Promise<void>;
}) {
    const [club,     setClub]     = useState(coach.club ?? "");
    const [saving,   setSaving]   = useState(false);
    const [removing, setRemoving] = useState(false);
    const { msg, msgType, notify } = useNotify();

    async function handleSave() {
        setSaving(true);
        try {
            await onSave({ club: club.trim() });
            notify("Coach saved.");
        } catch (e: any) {
            notify(e?.message ?? "Save failed.", "error");
        } finally {
            setSaving(false);
        }
    }

    async function handleRemove() {
        if (!confirm("Remove coach role?")) return;
        setRemoving(true);
        try {
            await onRemove();
        } catch (e: any) {
            notify(e?.message ?? "Remove failed.", "error");
            setRemoving(false);
        }
    }

    return (
        <div className="panel">
            <div className="panel-header">
                <h3>Coach</h3>
                <button
                    type="button"
                    className="btn btn--danger btn--sm"
                    onClick={handleRemove}
                    disabled={removing}
                >
                    {removing ? "Removing…" : "Remove role"}
                </button>
            </div>
            <Field label="Club">
                <input value={club} onChange={e => setClub(e.target.value)} placeholder="-" />
            </Field>
            {msg && <Toast msg={msg} type={msgType} />}
            <div className="panel-actions">
                <button
                    type="button"
                    className="btn btn--brand"
                    onClick={handleSave}
                    disabled={saving}
                >
                    {saving ? "Saving…" : "Save coach"}
                </button>
            </div>
        </div>
    );
}

function HostPanel({ host, onSave, onRemove }: {
    host: NonNullable<UserProfile["roles"]["host"]>;
    onSave: (data: NonNullable<UserProfile["roles"]["host"]>) => Promise<void>;
    onRemove: () => Promise<void>;
}) {
    const [location, setLocation] = useState(host.location ?? "");
    const [saving,   setSaving]   = useState(false);
    const [removing, setRemoving] = useState(false);
    const { msg, msgType, notify } = useNotify();

    async function handleSave() {
        setSaving(true);
        try {
            await onSave({ location: location.trim() });
            notify("Host saved.");
        } catch (e: any) {
            notify(e?.message ?? "Save failed.", "error");
        } finally {
            setSaving(false);
        }
    }

    async function handleRemove() {
        if (!confirm("Remove host role?")) return;
        setRemoving(true);
        try {
            await onRemove();
        } catch (e: any) {
            notify(e?.message ?? "Remove failed.", "error");
            setRemoving(false);
        }
    }

    return (
        <div className="panel">
            <div className="panel-header">
                <h3>Host</h3>
                <button
                    type="button"
                    className="btn btn--danger btn--sm"
                    onClick={handleRemove}
                    disabled={removing}
                >
                    {removing ? "Removing…" : "Remove role"}
                </button>
            </div>
            <Field label="Location">
                <input value={location} onChange={e => setLocation(e.target.value)} placeholder="-" />
            </Field>
            {msg && <Toast msg={msg} type={msgType} />}
            <div className="panel-actions">
                <button
                    type="button"
                    className="btn btn--brand"
                    onClick={handleSave}
                    disabled={saving}
                >
                    {saving ? "Saving…" : "Save host"}
                </button>
            </div>
        </div>
    );
}

// ─── Core fields panel ────────────────────────────────────────────────────────

function CoreFields({ profile, uid }: { profile: UserProfile; uid: string }) {
    const [fullName,    setFullName]    = useState(profile.fullName    ?? "");
    const [displayName, setDisplayName] = useState(profile.displayName ?? "");
    const [dateOfBirth, setDateOfBirth] = useState(profile.dateOfBirth ?? "");
    const [saving, setSaving] = useState(false);
    const { msg, msgType, notify } = useNotify();

    async function handleSave() {
        setSaving(true);
        try {
            await saveCoreProfile(uid, {
                fullName:    fullName.trim(),
                displayName: displayName.trim() || fullName.trim(),
                dateOfBirth,
            });
            notify("Saved.");
        } catch (e: any) {
            notify(e?.message ?? "Save failed.", "error");
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="panel">
            <h3>Personal info</h3>
            <Field label="Full name">
                <input
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="Your full name"
                />
            </Field>
            <Field label="Display name">
                <input
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    placeholder="Shown in UI (defaults to full name)"
                />
            </Field>
            {profile.roles.rower && (
            <Field label="Date of birth">
                <DateOfBirthInput
                    value={dateOfBirth}
                    onChange={(date) => setDateOfBirth(date)}
                />
            </Field>)}
            {msg && <Toast msg={msg} type={msgType} />}
            <div className="panel-actions">
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

// ─── Main component ───────────────────────────────────────────────────────────

export function ProfileEditor({ profile }: { profile: UserProfile }) {
    const { user } = useAuth();
    const [addingRole, setAddingRole] = useState<RoleKey | null>(null);
    const { msg, msgType, notify }    = useNotify();

    if (!user) return null;

    const roles          = profile.roles ?? {};
    const availableRoles = ALL_ROLES.filter(r => !roles[r]);


    async function handleSaveRole(role: RoleKey, data: any) {
        if (!user) return;
        try {
            await saveUserRole(user.uid, role, data);
        } catch (e: any) {
            throw e;
        }
    }

    async function handleRemoveRole(role: RoleKey) {
        if (!user) return;
        await removeUserRole(user.uid, role);
    }

    async function handleAddRole(role: RoleKey, data: any) {
        if (!user) return;
        try {
            await saveUserRole(user.uid, role, data);
            setAddingRole(null);
            notify(`${role.charAt(0).toUpperCase() + role.slice(1)} role added.`);
        } catch (e: any) {
            notify(e?.message ?? "Failed to add role.", "error");
            throw e;
        }
    }

    return (
        <div className="profile-editor">
            <CoreFields profile={profile} uid={user.uid} />

            {roles.rower && (
                <RowerPanel
                    key="rower"
                    rower={roles.rower}
                    onSave={data => handleSaveRole("rower", data)}
                    onRemove={() => handleRemoveRole("rower")}
                />
            )}

            {roles.coach && (
                <CoachPanel
                    key="coach"
                    coach={roles.coach}
                    onSave={data => handleSaveRole("coach", data)}
                    onRemove={() => handleRemoveRole("coach")}
                />
            )}

            {roles.host && (
                <HostPanel
                    key="host"
                    host={roles.host}
                    onSave={data => handleSaveRole("host", data)}
                    onRemove={() => handleRemoveRole("host")}
                />
            )}

            {/* ── Add a role ────────────────────────────────────────────── */}
            {availableRoles.length > 0 && (
                <div className="panel add-role-panel">
                    <h3>Add a role</h3>
                    <p className="muted">Expand your account by adding another role.</p>

                    {!addingRole ? (
                        <div className="add-role-chips">
                            {availableRoles.map(role => (
                                <button
                                    key={role}
                                    type="button"
                                    className="btn add-role-chip"
                                    onClick={() => setAddingRole(role)}
                                >
                                    + {role.charAt(0).toUpperCase() + role.slice(1)}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <>
                            <p className="add-role-selected-label">
                                Adding: <strong>
                                {addingRole.charAt(0).toUpperCase() + addingRole.slice(1)}
                            </strong>
                            </p>
                            <AddRoleForm
                                role={addingRole}
                                onSave={data => handleAddRole(addingRole, data)}
                                onCancel={() => setAddingRole(null)}
                            />
                        </>
                    )}
                </div>
            )}

            {msg && <Toast msg={msg} type={msgType} />}
        </div>
    );
}