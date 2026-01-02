import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import Navbar from "../../../shared/components/Navbar/Navbar";
import { useAuth } from "../../../providers/AuthProvider";
import type { UserProfile } from "../../auth/types";
import { upsertUserProfile } from "../../auth/api/users";

function safeTrim(s: string) {
    return s.trim().replace(/\s+/g, " ");
}

export default function ProfilePage() {
    const { user, profile, loading } = useAuth();

    // Redirect if not signed in
    if (!loading && !user) return <Navigate to="/auth" replace />;

    if (loading) {
        return (
            <>
                <Navbar />
                <main>
                    <div className="card">
                        <h2>Profile</h2>
                        <p>Loading…</p>
                    </div>
                </main>
            </>
        );
    }

    // At this point user exists. Profile might still be null if Firestore doc hasn't loaded yet.
    const p = profile;

    return (
        <>
            <Navbar />
            <main>
                <div className="card profile-card">
                    <div className="space-between">
                        <div>
                            <h1 className="profile-title">Your profile</h1>
                            <p className="profile-subtitle">This is what we currently have stored for your account.</p>
                        </div>
                        <span className="badge badge--brand">Signed in</span>
                    </div>

                    <hr />

                    <div className="cp-wrap">
                        <div className="card card--tight">
                            <div className="space-between">
                                <h3>Account</h3>
                                <span className="badge">Firebase Auth</span>
                            </div>

                            <div className="profile-grid">
                                <div>
                                    <div className="muted profile-label">UID</div>
                                    <div className="profile-value">{user?.uid}</div>
                                </div>
                                <div>
                                    <div className="muted profile-label">Email</div>
                                    <div className="profile-value">{user?.email ?? "—"}</div>
                                </div>
                                <div>
                                    <div className="muted profile-label">Provider</div>
                                    <div className="profile-value">
                                        {user?.providerData?.[0]?.providerId ?? "—"}
                                    </div>
                                </div>
                                <div>
                                    <div className="muted profile-label">Auth display name</div>
                                    <div className="profile-value">{user?.displayName ?? "—"}</div>
                                </div>
                            </div>
                        </div>

                        <div className="card card--tight">
                            <div className="space-between">
                                <h3>Profile</h3>
                                <span className="badge">Firestore</span>
                            </div>

                            {!p ? (
                                <p className="muted profile-empty">
                                    No profile document found yet. (This should be created automatically after sign-in.)
                                </p>
                            ) : (
                                <ProfileDetails profile={p} />
                            )}
                        </div>

                        {p && <ProfileEditor profile={p} />}
                    </div>
                </div>

                <div className="muted profile-help">
                    <span>Need help?</span>{" "}
                    <a className="muted" href="mailto:support@example.com">
                        Contact support
                    </a>
                </div>
            </main>
        </>
    );
}

function ProfileDetails({ profile }: { profile: UserProfile }) {
    const roleBadges = useMemo(() => {
        const roles: string[] = [];
        if (profile.roles?.rower) roles.push("rower");
        if (profile.roles?.host) roles.push("host");
        if (profile.roles?.admin) roles.push("admin");
        return roles;
    }, [profile]);

    return (
        <>
            <div className="profile-grid">
                <div>
                    <div className="muted profile-label">Full name</div>
                    <div className="profile-value">{profile.fullName || "—"}</div>
                </div>
                <div>
                    <div className="muted profile-label">Display name</div>
                    <div className="profile-value">{profile.displayName || "—"}</div>
                </div>
                <div>
                    <div className="muted profile-label">Primary role</div>
                    <div className="profile-value">{profile.primaryRole || "—"}</div>
                </div>
                <div>
                    <div className="muted profile-label">Roles</div>
                    <div className="row">
                        {roleBadges.length === 0 ? (
                            <span className="muted">—</span>
                        ) : (
                            roleBadges.map((r) => (
                                <span key={r} className="badge">
                  {r}
                </span>
                            ))
                        )}
                    </div>
                </div>
            </div>

            <hr />

            <div className="cp-wrap">
                {profile.roles?.rower && (
                    <div className="card card--tight">
                        <div className="space-between">
                            <h3>Rower</h3>
                            <span className="badge">roles.rower</span>
                        </div>
                        <div className="profile-grid">
                            <div>
                                <div className="muted profile-label">Club</div>
                                <div className="profile-value">{profile.roles.rower.club || "—"}</div>
                            </div>
                            <div>
                                <div className="muted profile-label">Coach</div>
                                <div className="profile-value">{profile.roles.rower.coach || "—"}</div>
                            </div>
                        </div>
                    </div>
                )}

                {profile.roles?.host && (
                    <div className="card card--tight">
                        <div className="space-between">
                            <h3>Host</h3>
                            <span className="badge">roles.host</span>
                        </div>
                        <div className="profile-grid">
                            <div>
                                <div className="muted profile-label">Location</div>
                                <div className="profile-value">{profile.roles.host.location || "—"}</div>
                            </div>
                        </div>
                    </div>
                )}

                {profile.roles?.admin && (
                    <div className="card card--tight">
                        <div className="space-between">
                            <h3>Admin</h3>
                            <span className="badge">roles.admin</span>
                        </div>
                        <div className="profile-grid">
                            <div>
                                <div className="muted profile-label">Host ID</div>
                                <div className="profile-value">{profile.roles.admin.hostId || "—"}</div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

function ProfileEditor({ profile }: { profile: UserProfile }) {
    const { user } = useAuth();

    const [fullName, setFullName] = useState(profile.fullName ?? "");
    const [displayName, setDisplayName] = useState(profile.displayName ?? "");
    const [club, setClub] = useState(profile.roles?.rower?.club ?? "");
    const [coach, setCoach] = useState(profile.roles?.rower?.coach ?? "");
    const [location, setLocation] = useState(profile.roles?.host?.location ?? "");

    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);

    // Keep local form in sync if profile changes
    useEffect(() => {
        setFullName(profile.fullName ?? "");
        setDisplayName(profile.displayName ?? "");
        setClub(profile.roles?.rower?.club ?? "");
        setCoach(profile.roles?.rower?.coach ?? "");
        setLocation(profile.roles?.host?.location ?? "");
    }, [profile]);

    async function onSave() {
        if (!user) return;
        setMsg(null);
        setSaving(true);

        try {
            const next: UserProfile = {
                ...profile,
                fullName: safeTrim(fullName),
                displayName: safeTrim(displayName) || safeTrim(fullName),
                roles: {
                    ...profile.roles,
                    ...(profile.roles?.rower
                        ? { rower: { club: club.trim(), coach: coach.trim() ? coach.trim() : undefined } }
                        : {}),
                    ...(profile.roles?.host ? { host: { location: location.trim() } } : {}),
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
        <div className="card card--tight">
            <div className="space-between">
                <h3>Edit profile</h3>
                <span className="badge">Basic</span>
            </div>

            <p className="muted profile-note">
                This edits your Firestore profile document. (We’re not updating Firebase Auth displayName here yet.)
            </p>

            <label>
                Full name
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" />
            </label>

            <label>
                Display name
                <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Shown in UI (defaults to full name)" />
            </label>

            {profile.roles?.rower && (
                <div className="card card--tight profile-subcard">
                    <div className="space-between">
                        <h3>Rower fields</h3>
                        <span className="badge">roles.rower</span>
                    </div>

                    <label>
                        Club
                        <input value={club} onChange={(e) => setClub(e.target.value)} placeholder="Club" />
                    </label>

                    <label>
                        Coach (optional)
                        <input value={coach} onChange={(e) => setCoach(e.target.value)} placeholder="Coach" />
                    </label>
                </div>
            )}

            {profile.roles?.host && (
                <div className="card card--tight profile-subcard">
                    <div className="space-between">
                        <h3>Host fields</h3>
                        <span className="badge">roles.host</span>
                    </div>

                    <label>
                        Location
                        <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location" />
                    </label>
                </div>
            )}

            {msg && (
                <div className="card card--tight profile-message">
                    <div className="muted">{msg}</div>
                </div>
            )}

            <div className="row profile-actions">
                <button type="button" className="btn-primary" onClick={onSave} disabled={saving}>
                    {saving ? "Saving…" : "Save"}
                </button>
            </div>
        </div>
    );
}
