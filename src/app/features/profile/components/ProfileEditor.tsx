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

/**
 * Returns a suggested correction if the value looks like the user typed
 * a decimal when they meant a colon-separated time.
 *
 * e.g. "6.02"  → "6:02"   (minutes.seconds, seconds part looks like clock seconds)
 *      "1.302" → "1:30.2" is ambiguous — leave alone
 *      "0.5"   → fine as a raw decimal (half a second)
 *
 * Rule: value has no ":" and has exactly one ".", the integer part is >= 1,
 * and the fractional digits (treated as an integer) are 0-59.
 */
function detectTimeMistake(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed || trimmed.includes(":")) return null;

    const dotIdx = trimmed.indexOf(".");
    if (dotIdx === -1) return null;

    const intPart  = trimmed.slice(0, dotIdx);
    const fracPart = trimmed.slice(dotIdx + 1);

    // Only act when there are exactly 2 fractional digits (classic clock-seconds pattern)
    if (fracPart.length !== 2) return null;

    const minutes = Number(intPart);
    const seconds = Number(fracPart);

    if (isNaN(minutes) || isNaN(seconds)) return null;
    if (minutes < 1) return null;           // sub-minute, decimal is fine
    if (seconds > 59) return null;          // not valid clock seconds

    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Reasonable bounds for erg distances (seconds).
 * World records give the lower bound; ~4× WR gives a generous upper.
 */
const PERF_BOUNDS ={
    best100m:   { min: 12,   max: 60,    label: "100 m"   },
    best500m:   { min: 69,   max: 300,   label: "500 m"   },
    best2000m:  { min: 330,  max: 1200,  label: "2000 m"  },
    best6000m:  { min: 1080, max: 4200,  label: "6000 m"  },
    best10000m: { min: 1860, max: 7200,  label: "10000 m" },
};

type PerfKey = keyof typeof PERF_BOUNDS;

interface PerfValidation {
    suggestion: string | null;   // auto-correctable decimal mistake
    warning:    string | null;   // out-of-bounds after parsing
}

function validatePerf(key: PerfKey, value: string): PerfValidation {
    const suggestion = detectTimeMistake(value);
    if (suggestion) {
        return { suggestion, warning: null };
    }
    const parsed = parseTime(value);
    if (parsed == null) return { suggestion: null, warning: null };

    const bounds = PERF_BOUNDS[key];
    if (parsed < bounds.min) {
        return {
            suggestion: null,
            warning: `${formatTime(parsed)} seems too fast for ${bounds.label} — did you mean a different distance or format?`,
        };
    }
    if (parsed > bounds.max) {
        return {
            suggestion: null,
            warning: `${formatTime(parsed)} seems very slow for ${bounds.label} — please double-check.`,
        };
    }
    return { suggestion: null, warning: null };
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
    const [club,        setClub]        = useState("");
    const [location,    setLocation]    = useState("");
    const [dateOfBirth, setDateOfBirth] = useState("");
    const [saving,      setSaving]      = useState(false);
    const [err,         setErr]         = useState<string | null>(null);

    const canSubmit =
        (role === "host"  && location.trim().length >= 2) ||
        (role === "coach" && club.trim().length >= 2) ||
        (role === "rower" && club.trim().length >= 2 && dateOfBirth.trim().length > 0);

    async function handleSave() {
        setErr(null);
        setSaving(true);
        try {
            const data = role === "host"
                ? { location: location.trim() }
                : { club: club.trim(), dateOfBirth, stats: {}, performances: {} };
            await onSave(data);
        } catch (e: any) {
            setErr(e?.message ?? "Failed to add role.");
            setSaving(false);
        }
    }

    return (
        <div className="add-role-form">
            {role === "host" ? (
                <Field label="Location">
                    <input
                        value={location}
                        onChange={e => setLocation(e.target.value)}
                        placeholder="Event location"
                    />
                </Field>
            ) : (
                <Field label="Club">
                    <input
                        value={club}
                        onChange={e => setClub(e.target.value)}
                        placeholder={role === "coach" ? "Club you coach at" : "Your rowing club"}
                    />
                </Field>
            )}

            {role === "rower" && (
                <Field label="Date of birth">
                    <DateOfBirthInput
                        value={dateOfBirth}
                        onChange={setDateOfBirth}
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

// ─── Performance field with inline validation ─────────────────────────────────

function PerfField({ perfKey, label, value, onChange }: {
    perfKey: PerfKey;
    label:   string;
    value:   string;
    onChange: (val: string) => void;
}) {
    const { suggestion, warning } = validatePerf(perfKey, value);

    return (
        <div className="field">
            <label>{label}</label>
            <input
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder="-"
                className={suggestion || warning ? "input--warn" : undefined}
            />
            {suggestion && (
                <span className="field-hint field-hint--warn">
                    Did you mean{" "}
                    <button
                        type="button"
                        className="btn-inline-fix"
                        onClick={() => onChange(suggestion)}
                    >
                        {suggestion}
                    </button>
                    ?
                </span>
            )}
            {warning && !suggestion && (
                <span className="field-hint field-hint--warn">{warning}</span>
            )}
        </div>
    );
}

// ─── Role panels ──────────────────────────────────────────────────────────────

function RowerPanel({ rower, dob, uid, onSave, onRemove }: {
    rower: NonNullable<UserProfile["roles"]["rower"]>;
    dob: string;
    uid: string;
    onSave: (data: NonNullable<UserProfile["roles"]["rower"]>) => Promise<void>;
    onRemove: () => Promise<void>;
}) {
    const [club,        setClub]        = useState(rower.club ?? "");
    const [dateOfBirth, setDateOfBirth] = useState(dob ?? "");
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

    // Block save only if there are unresolved decimal-mistake suggestions
    const perfKeys = Object.keys(perf) as PerfKey[];
    const hasSuggestions = perfKeys.some(k => detectTimeMistake(perf[k as PerfKey]) !== null);

    async function handleSave() {
        setSaving(true);
        try {
            if (dateOfBirth.trim()) {
                await saveCoreProfile(uid, { dateOfBirth });
            }
            await onSave({
                // Save empty string as undefined so optional fields don't error
                club: club.trim() || undefined,
                stats: {
                    heightCm:   Number(stats.heightCm)   || undefined,
                    wingspanCm: Number(stats.wingspanCm) || undefined,
                    weightKg:   Number(stats.weightKg)   || undefined,
                },
                performances: {
                    best100m:   parseTime(perf.best100m),
                    best500m:   parseTime(perf.best500m),
                    best2000m:  parseTime(perf.best2000m),
                    best6000m:  parseTime(perf.best6000m),
                    best10000m: parseTime(perf.best10000m),
                },
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

    const perfLabels: [PerfKey, string][] = [
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

            <Field label="Date of birth">
                <DateOfBirthInput value={dateOfBirth} onChange={setDateOfBirth} />
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
                <PerfField
                    key={key}
                    perfKey={key}
                    label={label}
                    value={perf[key as PerfKey]}
                    onChange={val => setPerf(p => ({ ...p, [key]: val }))}
                />
            ))}

            {msg && <Toast msg={msg} type={msgType} />}

            <div className="panel-actions">
                <button
                    type="button"
                    className="btn btn--brand"
                    onClick={handleSave}
                    disabled={saving || hasSuggestions}
                    title={hasSuggestions ? "Fix the time format suggestions before saving" : undefined}
                >
                    {saving ? "Saving…" : "Save rower"}
                </button>
                {hasSuggestions && (
                    <span className="field-hint field-hint--warn">
                        Please review the time format suggestions above.
                    </span>
                )}
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
    const [saving, setSaving] = useState(false);
    const { msg, msgType, notify } = useNotify();

    async function handleSave() {
        setSaving(true);
        try {
            await saveCoreProfile(uid, {
                fullName:    fullName.trim(),
                displayName: displayName.trim() || fullName.trim(),
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
            if (role === "rower" && data.dateOfBirth) {
                await saveCoreProfile(user.uid, {
                    fullName:    profile.fullName    ?? "",
                    displayName: profile.displayName ?? profile.fullName ?? "",
                    dateOfBirth: data.dateOfBirth,
                });
            }
            const { dateOfBirth: _dob, ...roleData } = data;
            await saveUserRole(user.uid, role, roleData);
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
                    dob={profile.dateOfBirth ?? ""}
                    uid={user.uid}
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