import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import Navbar from "../../../shared/components/Navbar/Navbar";
import { useAuth } from "../../../providers/AuthProvider";
import type { UserProfile } from "../../auth/types";
import { upsertUserProfile } from "../../auth/api/users";
import {addCoachLink, fetchUserProfileByEmail, getCoachesForRower, getRowersForCoach} from "../api/user.ts";
import CoachSearchBlock from "./CoachSearchBlock.tsx";
import CoachDashboard from "./CoachDashBoard.tsx";
import HostAdminInvite from "../../auth/pages/AdminHostInvite.tsx";

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

    const p = profile;

    return (
        <>
            <Navbar />
            <main className="page">
                <section className="shell">
                    <div className="stack">

                        <section className="card section">
                            <div className="section-head">
                                <h2 className="section-title">Profile</h2>
                            </div>

                            {!p ? (
                                <p className="muted">
                                    No profile document found yet. (This should be created automatically after sign-in.)
                                </p>
                            ) : (
                                <ProfileDetails profile={p} />
                            )}
                        </section>

                        {p && (
                            <section className="card section">
                                <div className="section-head">
                                    <h2 className="section-title">Edit</h2>
                                    <span className="pill">Basic</span>
                                </div>
                                <ProfileEditor profile={p} />
                            </section>
                        )}

                        <footer className="help">
                            <span className="muted">Need help?</span>{" "}
                            <a href="andrewdarraghoconnor@gmail.com">Contact support</a>
                        </footer>
                    </div>
                </section>
            </main>
        </>
    );
}
function ProfileDetails({ profile }: { profile: UserProfile }) {


    const [coaches, setCoaches] = useState<UserProfile[]>([]);
    const [loadingCoaches, setLoadingCoaches] = useState(false);

    const [rowers, setRowers] = useState<UserProfile[]>([]);
    const [loadingRowers, setLoadingRowers] = useState(false);

    useEffect(() => {
        let alive = true;

        async function run() {
            setLoadingCoaches(false);
            setLoadingRowers(false);

            if (profile.roles?.rower) {
                setLoadingCoaches(true);
                const data = await getCoachesForRower(profile.uid);
                if (alive) setCoaches(data);
                if (alive) setLoadingCoaches(false);
            }

            if (profile.roles?.coach) {
                setLoadingRowers(true);
                const data = await getRowersForCoach(profile.uid);
                if (alive) setRowers(data);
                if (alive) setLoadingRowers(false);
            }
        }

        run();
        return () => {
            alive = false;
        };
    }, [profile.uid, profile.roles]);


        async function loadRowers() {
            if (profile.roles?.coach) {
                setLoadingRowers(true);
                setLoadingRowers(false);
            }
        }


    async function onAddCoach() {
        const coachEmail = prompt("Enter your coach's email:");
        if (!coachEmail) return;

        // Here you would look up the coach UID by email
        const coachProfile = await fetchUserProfileByEmail(coachEmail.trim());
        if (!coachProfile || !coachProfile.roles?.coach) {
            alert("No coach found with that email.");
            return;
        }

        // Create a link in Firestore
        await addCoachLink(profile.uid, coachProfile.uid);

        // Refresh coaches list
        const data = await getCoachesForRower(profile.uid);
        setCoaches(data);
    }


    const roleBadges = useMemo(() => {
        const roles: string[] = [];
        if (profile.roles?.rower) roles.push("Rower");
        if (profile.roles?.host) roles.push("Host");
        if (profile.roles?.admin) roles.push("Admin");
        if(profile.roles?.coach) roles.push("Coach")
        return roles;
    }, [profile]);

return (
    <>
        <dl className="kv">
            <div className="kv-row">
                <dt>Full name</dt>
                <dd>{profile.fullName || "—"}</dd>
            </div>
            <div className="kv-row">
                <dt>Display name</dt>
                <dd>{profile.displayName || "—"}</dd>
            </div>
            <div className="kv-row">
                <dt>Primary role</dt>
                <dd>
                    {profile.primaryRole
                        ? profile.primaryRole.charAt(0).toUpperCase() + profile.primaryRole.slice(1)
                        : "—"}
                </dd>
            </div>
            <div className="kv-row">
                <dt>Roles</dt>
                <dd className="chips">
                    {roleBadges.length === 0 ? (
                        <span className="muted">—</span>
                    ) : (
                        roleBadges.map((r) => (
                            <span key={r} className="chip">
                {r}
              </span>
                        ))
                    )}
                </dd>
            </div>
        </dl>

        <div className="divider" />
        {profile.roles?.host && (
            <section className="subsection">
                <HostAdminInvite />
            </section>
        )}
        <div className="stack-sm">
            {profile.roles?.rower && (
                <section className="subsection">
                    <div className="subhead">
                        <h3 className="subhead-title">Coaches</h3>
                    </div>

                    <CoachSearchBlock />

                    {loadingCoaches ? (
                        <p className="muted">Loading…</p>
                    ) : coaches.length === 0 ? (
                        <p className="muted">No coaches assigned</p>
                    ) : (
                        <ul className="list">
                            {coaches.map((c) => (
                                <li key={c.uid} className="list-item">
                                    <div className="list-main">
                                        <div className="list-title">{c.fullName}</div>
                                        <div className="muted">{c.roles?.coach?.club ?? "—"}</div>
                                    </div>
                                    <span className="chip chip--soft">Coach</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            )}

            {profile.roles?.coach && (
                <section className="subsection">
                    <div className="subhead">
                        <h3 className="subhead-title">Athletes</h3>
                    </div>
                    <CoachDashboard />
                </section>
            )}

            {profile.roles?.host && (
                <section className="subsection">
                    <div className="subhead">
                        <h3 className="subhead-title">Host</h3>
                        <span className="chip chip--soft">roles.host</span>
                    </div>

                    <dl className="kv">
                        <div className="kv-row">
                            <dt>Location</dt>
                            <dd>{profile.roles.host.location || "—"}</dd>
                        </div>
                    </dl>
                </section>
            )}

            {profile.roles?.admin && (
                <section className="subsection">
                    <div className="subhead">
                        <h3 className="subhead-title">Admin</h3>
                        <span className="chip chip--soft">roles.admin</span>
                    </div>

                    <dl className="kv">
                        <div className="kv-row">
                            <dt>Host ID</dt>
                            <dd>{profile.roles.admin.hostId || "—"}</dd>
                        </div>
                    </dl>
                </section>
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
    const [location, setLocation] = useState(profile.roles?.host?.location ?? "");

    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);

    // Keep local form in sync if profile changes
    useEffect(() => {
        setFullName(profile.fullName ?? "");
        setDisplayName(profile.displayName ?? "");
        setClub(profile.roles?.rower?.club ?? "");
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
                        ? { rower: { club: club.trim()} }
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
        <form className="form" onSubmit={(e) => e.preventDefault()}>
            <div className="field">
                <label>Full name</label>
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" />
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
                    <div className="subhead">
                        <h3 className="subhead-title">Rower</h3>
                        <span className="chip chip--soft">roles.rower</span>
                    </div>

                    <div className="field">
                        <label>Club</label>
                        <input value={club} onChange={(e) => setClub(e.target.value)} placeholder="Club" />
                    </div>
                </div>
            )}

            {profile.roles?.host && (
                <div className="panel">
                    <div className="subhead">
                        <h3 className="subhead-title">Host</h3>
                        <span className="chip chip--soft">roles.host</span>
                    </div>

                    <div className="field">
                        <label>Location</label>
                        <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location" />
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
