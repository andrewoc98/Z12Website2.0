import { useAuth } from "../../../providers/AuthProvider.tsx";
import { useState } from "react";
import type { ClubRef, UserProfile } from "../../auth/types.ts";
import {
    saveCoreProfile,
    saveUserRole,
    removeUserRole,
} from "../api/user.ts";
import "../style/profile.css";
import DateOfBirthInput from "../../auth/components/DateOfBirthInput.tsx";
import { ClubSearchInput } from "../../../shared/components/ClubSearchInput/ClubSearchInput.tsx";

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

function detectTimeMistake(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed || trimmed.includes(":")) return null;
    const dotIdx = trimmed.indexOf(".");
    if (dotIdx === -1) return null;
    const intPart  = trimmed.slice(0, dotIdx);
    const fracPart = trimmed.slice(dotIdx + 1);
    if (fracPart.length !== 2) return null;
    const minutes = Number(intPart);
    const seconds = Number(fracPart);
    if (isNaN(minutes) || isNaN(seconds)) return null;
    if (minutes < 1) return null;
    if (seconds > 59) return null;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

const PERF_BOUNDS = {
    best100m:   { min: 12,   max: 60,    label: "100 m"   },
    best500m:   { min: 69,   max: 300,   label: "500 m"   },
    best2000m:  { min: 330,  max: 1200,  label: "2000 m"  },
    best6000m:  { min: 1080, max: 4200,  label: "6000 m"  },
    best10000m: { min: 1860, max: 7200,  label: "10000 m" },
};

type PerfKey = keyof typeof PERF_BOUNDS;

function validatePerf(key: PerfKey, value: string): { suggestion: string | null; warning: string | null } {
    const suggestion = detectTimeMistake(value);
    if (suggestion) return { suggestion, warning: null };
    const parsed = parseTime(value);
    if (parsed == null) return { suggestion: null, warning: null };
    const bounds = PERF_BOUNDS[key];
    if (parsed < bounds.min) {
        return { suggestion: null, warning: `${formatTime(parsed)} seems too fast for ${bounds.label} — did you mean a different distance or format?` };
    }
    if (parsed > bounds.max) {
        return { suggestion: null, warning: `${formatTime(parsed)} seems very slow for ${bounds.label} — please double-check.` };
    }
    return { suggestion: null, warning: null };
}

type RoleKey = "rower" | "coach" | "host";
type TabKey  = "personal" | RoleKey | "roles";

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
    role:     RoleKey;
    onSave:   (data: any) => Promise<void>;
    onCancel: () => void;
}) {
    const [location,    setLocation]    = useState("");
    const [dateOfBirth, setDateOfBirth] = useState("");
    const [gender,      setGender]      = useState("");
    const [saving,      setSaving]      = useState(false);
    const [err,         setErr]         = useState<string | null>(null);

    const canSubmit =
        (role === "host"  && location.trim().length >= 2) ||
        (role === "coach") ||
        (role === "rower" && dateOfBirth.trim().length > 0 && gender !== "");

    async function handleSave() {
        setErr(null);
        setSaving(true);
        try {
            const data =
                role === "host"  ? { location: location.trim() }
              : role === "rower" ? { gender, clubMemberships: [], dateOfBirth, stats: {}, performances: {} }
              :                    { clubMemberships: [] };
            await onSave(data);
        } catch (e: any) {
            setErr(e?.message ?? "Failed to add role.");
            setSaving(false);
        }
    }

    return (
        <div className="add-role-form">
            {role === "host" && (
                <Field label="Location">
                    <input
                        value={location}
                        onChange={e => setLocation(e.target.value)}
                        placeholder="Event location"
                    />
                </Field>
            )}

            {role === "rower" && (
                <>
                    <Field label="Date of birth">
                        <DateOfBirthInput value={dateOfBirth} onChange={setDateOfBirth} />
                    </Field>
                    <Field label="Gender">
                        <div className="radio-group">
                            {["male", "female"].map(g => (
                                <label key={g} className={`radio-option ${gender === g ? "radio-option--active" : ""}`}>
                                    <input
                                        type="radio"
                                        name="add-role-gender"
                                        value={g}
                                        checked={gender === g}
                                        onChange={() => setGender(g)}
                                    />
                                    {g.charAt(0).toUpperCase() + g.slice(1)}
                                </label>
                            ))}
                        </div>
                    </Field>
                </>
            )}

            {role === "coach" && (
                <p className="muted field-hint">You can search for and join clubs after adding the role.</p>
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
                <button type="button" className="btn" onClick={onCancel} disabled={saving}>
                    Cancel
                </button>
            </div>
        </div>
    );
}

// ─── Performance field with inline validation ─────────────────────────────────

function PerfField({ perfKey, label, value, onChange }: {
    perfKey:  PerfKey;
    label:    string;
    value:    string;
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

function RowerPanel({ rower, dob, uid, onSave, onRemove, onClubJoined, onClubLeft }: {
    rower:        NonNullable<UserProfile["roles"]["rower"]>;
    dob:          string;
    uid:          string;
    onSave:       (data: NonNullable<UserProfile["roles"]["rower"]>) => Promise<void>;
    onRemove:     () => Promise<void>;
    onClubJoined: (ref: ClubRef) => void;
    onClubLeft:   (clubId: string) => void;
}) {
    const [dateOfBirth, setDateOfBirth] = useState(dob ?? "");
    const [stats, setStats] = useState({
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

    const perfKeys       = Object.keys(perf) as PerfKey[];
    const hasSuggestions = perfKeys.some(k => detectTimeMistake(perf[k as PerfKey]) !== null);

    async function handleSave() {
        setSaving(true);
        try {
            if (dateOfBirth.trim()) await saveCoreProfile(uid, { dateOfBirth });
            await onSave({
                clubMemberships: rower.clubMemberships ?? [],
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
        ["best100m",   "100 m"],
        ["best500m",   "500 m"],
        ["best2000m",  "2000 m"],
        ["best6000m",  "6000 m"],
        ["best10000m", "10000 m"],
    ];

    return (
        <div className="role-panel">
            <Field label="Clubs">
                <ClubSearchInput
                    currentMemberships={rower.clubMemberships ?? []}
                    memberRole="rower"
                    onJoined={onClubJoined}
                    onLeft={onClubLeft}
                />
            </Field>

            <Field label="Date of birth">
                <DateOfBirthInput value={dateOfBirth} onChange={setDateOfBirth} />
            </Field>

            <div className="role-panel-section">
                <h4 className="role-panel-section-title">Physical stats</h4>
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
            </div>

            <div className="role-panel-section">
                <h4 className="role-panel-section-title">Best erg scores (mm:ss.s)</h4>
                {perfLabels.map(([key, label]) => (
                    <PerfField
                        key={key}
                        perfKey={key}
                        label={label}
                        value={perf[key as PerfKey]}
                        onChange={val => setPerf(p => ({ ...p, [key]: val }))}
                    />
                ))}
            </div>

            {msg && <Toast msg={msg} type={msgType} />}

            <div className="role-panel-actions">
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
                <button
                    type="button"
                    className="btn btn--danger btn--sm role-panel-remove"
                    onClick={handleRemove}
                    disabled={removing}
                >
                    {removing ? "Removing…" : "Remove role"}
                </button>
            </div>
        </div>
    );
}

function CoachPanel({ coach, onSave, onRemove, onClubJoined, onClubLeft }: {
    coach:        NonNullable<UserProfile["roles"]["coach"]>;
    onSave:       (data: NonNullable<UserProfile["roles"]["coach"]>) => Promise<void>;
    onRemove:     () => Promise<void>;
    onClubJoined: (ref: ClubRef) => void;
    onClubLeft:   (clubId: string) => void;
}) {
    const [saving,   setSaving]   = useState(false);
    const [removing, setRemoving] = useState(false);
    const { msg, msgType, notify } = useNotify();

    async function handleSave() {
        setSaving(true);
        try {
            await onSave({ clubMemberships: coach.clubMemberships ?? [] });
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
        <div className="role-panel">
            <Field label="Clubs">
                <ClubSearchInput
                    currentMemberships={coach.clubMemberships ?? []}
                    memberRole="coach"
                    onJoined={onClubJoined}
                    onLeft={onClubLeft}
                />
            </Field>

            {msg && <Toast msg={msg} type={msgType} />}
            <div className="role-panel-actions">
                <button type="button" className="btn btn--brand" onClick={handleSave} disabled={saving}>
                    {saving ? "Saving…" : "Save coach"}
                </button>
                <button
                    type="button"
                    className="btn btn--danger btn--sm role-panel-remove"
                    onClick={handleRemove}
                    disabled={removing}
                >
                    {removing ? "Removing…" : "Remove role"}
                </button>
            </div>
        </div>
    );
}

function HostPanel({ host, onSave, onRemove }: {
    host:     NonNullable<UserProfile["roles"]["host"]>;
    onSave:   (data: NonNullable<UserProfile["roles"]["host"]>) => Promise<void>;
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
        <div className="role-panel">
            <Field label="Location">
                <input value={location} onChange={e => setLocation(e.target.value)} placeholder="-" />
            </Field>
            {msg && <Toast msg={msg} type={msgType} />}
            <div className="role-panel-actions">
                <button type="button" className="btn btn--brand" onClick={handleSave} disabled={saving}>
                    {saving ? "Saving…" : "Save host"}
                </button>
                <button
                    type="button"
                    className="btn btn--danger btn--sm role-panel-remove"
                    onClick={handleRemove}
                    disabled={removing}
                >
                    {removing ? "Removing…" : "Remove role"}
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
        <div className="role-panel">
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
            <div className="role-panel-actions">
                <button type="button" className="btn btn--brand" onClick={handleSave} disabled={saving}>
                    {saving ? "Saving…" : "Save"}
                </button>
            </div>
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ProfileEditor({ profile, onProfileChange }: {
    profile:         UserProfile;
    onProfileChange: (updated: Partial<UserProfile>) => void;
}) {
    const { user }                    = useAuth();
    const [activeTab,  setActiveTab]  = useState<TabKey>("personal");
    const [addingRole, setAddingRole] = useState<RoleKey | null>(null);
    const { msg, msgType, notify }    = useNotify();

    if (!user) return null;

    const roles          = profile.roles ?? {};
    const availableRoles = ALL_ROLES.filter(r => !roles[r]);

    const tabs: { key: TabKey; label: string }[] = [
        { key: "personal", label: "Personal" },
        ...(roles.rower  ? [{ key: "rower"  as TabKey, label: "Rower"    }] : []),
        ...(roles.coach  ? [{ key: "coach"  as TabKey, label: "Coach"    }] : []),
        ...(roles.host   ? [{ key: "host"   as TabKey, label: "Host"     }] : []),
        ...(availableRoles.length > 0 ? [{ key: "roles" as TabKey, label: "Add Role" }] : []),
    ];

    // Guard against stale active tab after role removal
    const validTab = tabs.some(t => t.key === activeTab) ? activeTab : "personal";

    // ── Club join/leave handlers — optimistic local update ───────────────────

    function handleRowerClubJoined(ref: ClubRef) {
        const prev = profile.roles?.rower?.clubMemberships ?? [];
        onProfileChange({
            roles: {
                ...profile.roles,
                rower: { ...profile.roles?.rower!, clubMemberships: [...prev, ref] },
            },
        });
        notify(`Joined ${ref.clubName}.`);
    }

    function handleRowerClubLeft(clubId: string) {
        const prev = profile.roles?.rower?.clubMemberships ?? [];
        onProfileChange({
            roles: {
                ...profile.roles,
                rower: { ...profile.roles?.rower!, clubMemberships: prev.filter(m => m.clubId !== clubId) },
            },
        });
        notify("Left club.");
    }

    function handleCoachClubJoined(ref: ClubRef) {
        const prev = profile.roles?.coach?.clubMemberships ?? [];
        onProfileChange({
            roles: {
                ...profile.roles,
                coach: { ...profile.roles?.coach, clubMemberships: [...prev, ref] },
            },
        });
        notify(`Joined ${ref.clubName}.`);
    }

    function handleCoachClubLeft(clubId: string) {
        const prev = profile.roles?.coach?.clubMemberships ?? [];
        onProfileChange({
            roles: {
                ...profile.roles,
                coach: { ...profile.roles?.coach, clubMemberships: prev.filter(m => m.clubId !== clubId) },
            },
        });
        notify("Left club.");
    }

    // ── Role save / remove ───────────────────────────────────────────────────

    async function handleSaveRole(role: RoleKey, data: any) {
        if (!user) return;
        await saveUserRole(user.uid, role, data);
    }

    async function handleRemoveRole(role: RoleKey) {
        if (!user) return;
        await removeUserRole(role);
        const updatedRoles = { ...profile.roles };
        delete updatedRoles[role];
        onProfileChange({ roles: updatedRoles });
        setActiveTab("personal");
    }

    async function handleAddRole(role: RoleKey, data: any) {
        if (!user) return;
        try {
            const coreUpdates: Partial<UserProfile> = {};
            if (role === "rower") {
                await saveCoreProfile(user.uid, {
                    fullName:    profile.fullName    ?? "",
                    displayName: profile.displayName ?? profile.fullName ?? "",
                    ...(data.dateOfBirth ? { dateOfBirth: data.dateOfBirth } : {}),
                    ...(data.gender      ? { gender: data.gender }           : {}),
                });
                if (data.dateOfBirth) coreUpdates.dateOfBirth = data.dateOfBirth;
                if (data.gender)      coreUpdates.gender = data.gender as "male" | "female";
            }
            const { dateOfBirth: _dob, gender: _gender, ...roleData } = data;
            await saveUserRole(user.uid, role, roleData);
            onProfileChange({
                ...coreUpdates,
                roles: { ...profile.roles, [role]: roleData },
            });
            setAddingRole(null);
            setActiveTab(role);
            notify(`${role.charAt(0).toUpperCase() + role.slice(1)} role added.`);
        } catch (e: any) {
            notify(e?.message ?? "Failed to add role.", "error");
            throw e;
        }
    }

    // ── Render ───────────────────────────────────────────────────────────────

    return (
        <div className="profile-editor">
            <div className="editor-tabs" role="tablist">
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        type="button"
                        role="tab"
                        aria-selected={validTab === tab.key}
                        className={`editor-tab${validTab === tab.key ? " editor-tab--active" : ""}`}
                        onClick={() => { setActiveTab(tab.key); setAddingRole(null); }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="editor-tab-content" role="tabpanel">
                {validTab === "personal" && (
                    <CoreFields profile={profile} uid={user.uid} />
                )}

                {validTab === "rower" && roles.rower && (
                    <RowerPanel
                        rower={roles.rower}
                        dob={profile.dateOfBirth ?? ""}
                        uid={user.uid}
                        onSave={data => handleSaveRole("rower", data)}
                        onRemove={() => handleRemoveRole("rower")}
                        onClubJoined={handleRowerClubJoined}
                        onClubLeft={handleRowerClubLeft}
                    />
                )}

                {validTab === "coach" && roles.coach && (
                    <CoachPanel
                        coach={roles.coach}
                        onSave={data => handleSaveRole("coach", data)}
                        onRemove={() => handleRemoveRole("coach")}
                        onClubJoined={handleCoachClubJoined}
                        onClubLeft={handleCoachClubLeft}
                    />
                )}

                {validTab === "host" && roles.host && (
                    <HostPanel
                        host={roles.host}
                        onSave={data => handleSaveRole("host", data)}
                        onRemove={() => handleRemoveRole("host")}
                    />
                )}

                {validTab === "roles" && availableRoles.length > 0 && (
                    <div className="role-panel">
                        <p className="muted">Select a role to add to your account.</p>
                        {!addingRole ? (
                            <div className="add-role-grid">
                                {availableRoles.map(role => (
                                    <button
                                        key={role}
                                        type="button"
                                        className="add-role-card"
                                        onClick={() => setAddingRole(role)}
                                    >
                                        <span className="add-role-card-icon">+</span>
                                        <span>{role.charAt(0).toUpperCase() + role.slice(1)}</span>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div>
                                <p className="muted" style={{ marginBottom: "16px" }}>
                                    Adding: <strong>{addingRole.charAt(0).toUpperCase() + addingRole.slice(1)}</strong>
                                </p>
                                <AddRoleForm
                                    role={addingRole}
                                    onSave={data => handleAddRole(addingRole, data)}
                                    onCancel={() => setAddingRole(null)}
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>

            {msg && <Toast msg={msg} type={msgType} />}
        </div>
    );
}
