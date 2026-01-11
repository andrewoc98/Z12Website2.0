import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Navbar from "../../../shared/components/Navbar/Navbar";
import type { EventDoc, EventCategory } from "../../events/types";
import type { BoatSize } from "../types";

import { createBoat, listBoatsForEvent } from "../api/boats";
import { parseBoatClassFromCategory, boatSizeFromBoatClass } from "../../events/lib/categories";

import { collection, doc, getDoc, getDocs, query, where, documentId } from "firebase/firestore";
import { db } from "../../../shared/lib/firebase";
import { useAuth } from "../../../providers/AuthProvider";

type Profile = {
    dateOfBirth?: string;
    primaryRole?: string;
    uuid?: string;
    email?: string;
    gender?: "male" | "female";
    roles?: { rower?: { club?: string; coach?: string } };
};

type UserDoc = {
    displayName?: string;
    fullName?: string;
    email?: string;
    uuid?: string;
};

function bestName(u?: UserDoc | null) {
    return u?.displayName?.trim() || u?.fullName?.trim() || "Unknown";
}

function parseCategoryParts(catName: string): { gender: string; division: string; boatClass: string } | null {
    const parts = catName.split("•").map((s) => s.trim());
    if (parts.length !== 3) return null;
    return { gender: parts[0], division: parts[1], boatClass: parts[2] };
}

function boatSizeLabel(size: number) {
    if (size === 1) return "Single";
    if (size === 2) return "Double";
    if (size === 4) return "Quad";
    if (size === 8) return "Eight";
    return String(size);
}

function todayYMD() {
    return new Date().toISOString().slice(0, 10);
}

function ageOnDate(dobYmd: string, onYmd: string) {
    const [y, m, d] = dobYmd.split("-").map(Number);
    const [yy, mm, dd] = onYmd.split("-").map(Number);

    let age = yy - y;
    const beforeBirthday = mm < m || (mm === m && dd < d);
    if (beforeBirthday) age -= 1;
    return age;
}

function juniorLimitFromDivision(division: string): number | null {
    const m = division.match(/^Junior\s+(\d{1,2})$/i);
    if (!m) return null;
    const limit = Number(m[1]);
    if (!Number.isFinite(limit)) return null;
    return limit;
}

function mastersBandFromDivision(division: string): { min: number; max: number | null } | null {
    const m = division.match(/^Masters(?:\s+([A-K]))?/i);
    if (!m) return null;

    const band = (m[1] ?? "").toUpperCase();
    const bands: Record<string, { min: number; max: number | null }> = {
        A: { min: 27, max: 35 },
        B: { min: 36, max: 42 },
        C: { min: 43, max: 49 },
        D: { min: 50, max: 54 },
        E: { min: 55, max: 59 },
        F: { min: 60, max: 64 },
        G: { min: 65, max: 69 },
        H: { min: 70, max: 74 },
        I: { min: 75, max: 79 },
        J: { min: 80, max: 84 },
        K: { min: 85, max: null },
    };

    if (!band) return { min: 27, max: null };
    return bands[band] ?? { min: 27, max: null };
}

function isEligibleForCategory(profile: Profile, catName: string) {
    const parts = parseCategoryParts(catName);
    if (!parts) return false;

    const pg = profile.gender;
    if (parts.gender === "Men") {
        if (!pg) return false;
        if (pg !== "male") return false;
    }
    if (parts.gender === "Women") {
        if (!pg) return false;
        if (pg !== "female") return false;
    }

    if (!profile.dateOfBirth) return false;

    const age = ageOnDate(profile.dateOfBirth, todayYMD());
    const div = parts.division;

    if (div.startsWith("U19") && age >= 19) return false;
    if (div.startsWith("U21") && age >= 21) return false;
    if (div.startsWith("U23") && age >= 23) return false;

    const juniorLimit = juniorLimitFromDivision(div);
    if (juniorLimit !== null) return age < juniorLimit;

    const mastersBand = mastersBandFromDivision(div);
    if (mastersBand) {
        if (age < mastersBand.min) return false;
        if (mastersBand.max !== null && age > mastersBand.max) return false;
    }

    return true;
}

function randomCode(len = 12) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let out = "";
    for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
}

async function getEventById(eventId: string): Promise<(EventDoc & { id: string }) | null> {
    const snap = await getDoc(doc(db, "events", eventId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as EventDoc) };
}

async function fetchUsersByUid(uids: string[]): Promise<Map<string, UserDoc>> {
    const out = new Map<string, UserDoc>();
    const unique = Array.from(new Set(uids.filter(Boolean)));
    if (unique.length === 0) return out;

    // Firestore "in" query limit = 10
    const chunks: string[][] = [];
    for (let i = 0; i < unique.length; i += 10) chunks.push(unique.slice(i, i + 10));

    for (const c of chunks) {
        const q = query(collection(db, "users"), where(documentId(), "in", c));
        const snap = await getDocs(q);
        snap.docs.forEach((d) => out.set(d.id, d.data() as any));
    }

    return out;
}

export default function EventPageSignUp() {
    const { eventId } = useParams<{ eventId: string }>();
    const { user, profile } = useAuth() as any;

    const p: Profile | null = (profile as any) ?? null;

    const [selectedEvent, setSelectedEvent] = useState<(EventDoc & { id: string }) | null>(null);
    const [boats, setBoats] = useState<any[]>([]);
    const [categoryId, setCategoryId] = useState("");

    const [loadingEvent, setLoadingEvent] = useState(true);
    const [loadingBoats, setLoadingBoats] = useState(false);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const [userByUid, setUserByUid] = useState<Map<string, UserDoc>>(new Map());

    const clubName = useMemo(() => (p?.roles?.rower?.club ?? "").trim(), [p]);

    const inviteLink = (eid: string, code: string) => `${window.location.origin}/invite/${eid}/${code}`;

    async function reloadBoats() {
        if (!eventId) return;
        setLoadingBoats(true);
        try {
            const b = await listBoatsForEvent(eventId);
            setBoats(b);
        } finally {
            setLoadingBoats(false);
        }
    }

    useEffect(() => {
        if (!eventId) return;
        (async () => {
            setLoadingEvent(true);
            setErr(null);
            try {
                setSelectedEvent(await getEventById(eventId));
            } catch (e: any) {
                setErr(e?.message ?? "Failed to load event");
            } finally {
                setLoadingEvent(false);
            }
        })();
    }, [eventId]);

    useEffect(() => {
        if (!eventId) return;
        void reloadBoats();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [eventId]);

    // Load user docs for all rower UIDs we see in boats (for display names)
    useEffect(() => {
        (async () => {
            const allUids = boats.flatMap((b) => (Array.isArray(b.rowerUids) ? b.rowerUids : []));
            const m = await fetchUsersByUid(allUids);
            setUserByUid(m);
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [boats.length, eventId]);

    const categoryById = useMemo(() => {
        const m = new Map<string, EventCategory>();
        (selectedEvent?.categories ?? []).forEach((c) => m.set(c.id, c));
        return m;
    }, [selectedEvent]);

    const selectedCategory = useMemo(() => {
        if (!categoryId) return null;
        return categoryById.get(categoryId) ?? null;
    }, [categoryId, categoryById]);

    const eligibleCategories = useMemo(() => {
        if (!selectedEvent || !p) return [];
        if (p.primaryRole && p.primaryRole !== "rower") return [];
        return selectedEvent.categories.filter((c) => isEligibleForCategory(p, c.name));
    }, [selectedEvent, p]);

    useEffect(() => {
        if (!selectedEvent) return;
        if (eligibleCategories.length === 0) return;

        if (!categoryId) {
            setCategoryId(eligibleCategories[0].id);
            return;
        }

        const stillExists = eligibleCategories.some((c) => c.id === categoryId);
        if (!stillExists) setCategoryId(eligibleCategories[0].id);
    }, [eligibleCategories, selectedEvent, categoryId]);

    const derivedBoatSize: BoatSize | null = useMemo(() => {
        if (!selectedCategory) return null;
        const bc = parseBoatClassFromCategory(selectedCategory.name);
        if (!bc) return null;
        return boatSizeFromBoatClass(bc) as BoatSize;
    }, [selectedCategory]);

    const alreadySignedUpForCategory = useMemo(() => {
        if (!user || !selectedCategory) return false;

        return boats.some((b) => {
            const rowers: string[] = b.rowerUids ?? [];
            if (!rowers.includes(user.uid)) return false;

            if (b.categoryId) return b.categoryId === selectedCategory.id;

            const name = b.categoryName ?? b.category ?? "";
            return name === selectedCategory.name;
        });
    }, [boats, user, selectedCategory]);

    const eligibility = useMemo(() => {
        if (!selectedCategory) return { ok: false, reason: "Pick a category." };
        if (!user) return { ok: false, reason: "Please sign in." };
        if (!p) return { ok: false, reason: "Missing profile data." };
        if (!p.roles?.rower) return { ok: false, reason: "You don’t have a rower profile yet." };
        if (!clubName) return { ok: false, reason: "Missing club on your profile." };

        const parts = parseCategoryParts(selectedCategory.name);
        if (!parts) return { ok: false, reason: "Invalid category format." };

        const cg = parts.gender;
        const pg = p.gender;
        if ((cg === "Men" || cg === "Women") && !pg) return { ok: false, reason: "Missing gender on your profile." };
        if (cg === "Men" && pg !== "male") return { ok: false, reason: "This category is Men only." };
        if (cg === "Women" && pg !== "female") return { ok: false, reason: "This category is Women only." };

        if (!p.dateOfBirth) return { ok: false, reason: "Missing date of birth on your profile." };

        const age = ageOnDate(p.dateOfBirth, todayYMD());
        const div = parts.division;

        if (div.startsWith("U19") && age >= 19) return { ok: false, reason: "U19 only." };
        if (div.startsWith("U21") && age >= 21) return { ok: false, reason: "U21 only." };
        if (div.startsWith("U23") && age >= 23) return { ok: false, reason: "U23 only." };

        const juniorLimit = juniorLimitFromDivision(div);
        if (juniorLimit !== null && age >= juniorLimit) return { ok: false, reason: `${div} only.` };

        const mastersBand = mastersBandFromDivision(div);
        if (mastersBand) {
            if (age < mastersBand.min) return { ok: false, reason: "Masters age requirement not met." };
            if (mastersBand.max !== null && age > mastersBand.max) return { ok: false, reason: "Masters age requirement not met." };
        }

        return { ok: true, reason: "" };
    }, [selectedCategory, user, p, clubName]);

    const canCreate =
        !!user &&
        !!p &&
        !!selectedEvent &&
        !!eventId &&
        !!selectedCategory &&
        derivedBoatSize !== null &&
        selectedEvent.status === "open" &&
        !alreadySignedUpForCategory &&
        eligibility.ok;

    const myPendingCrews = useMemo(() => {
        if (!user) return [];
        return boats
            .filter((b) => (b.status ?? "registered") === "pending_crew")
            .filter((b) => (b.rowerUids ?? []).includes(user.uid));
    }, [boats, user]);

    const registeredBoats = useMemo(() => {
        return boats.filter((b) => (b.status ?? "registered") === "registered");
    }, [boats]);

    function seatLabel(b: any) {
        const filled = b.rowerUids?.length ?? 0;
        const total = b.boatSize ?? 0;
        return `${filled}/${total}`;
    }

    function renderCrewNames(b: any) {
        const uids: string[] = Array.isArray(b.rowerUids) ? b.rowerUids : [];
        if (uids.length === 0) return <p className="muted">No crew yet.</p>;

        return (
            <ul className="crew-list">
                {uids.map((uid) => (
                    <li key={uid} className="muted">
                        {bestName(userByUid.get(uid))}
                        {user?.uid === uid ? " (you)" : ""}
                    </li>
                ))}
            </ul>
        );
    }

    async function onCreateBoat() {
        if (!user || !p || !selectedEvent || !eventId || derivedBoatSize === null || !selectedCategory) return;

        setErr(null);
        setBusy(true);

        try {
            if (alreadySignedUpForCategory) throw new Error("You’ve already signed up for this category.");
            if (!eligibility.ok) throw new Error(eligibility.reason || "Not eligible for this category.");

            const needsCrew = derivedBoatSize > 1;

            await createBoat({
                eventId,
                categoryId: selectedCategory.id,
                categoryName: selectedCategory.name,
                category: selectedCategory.name,
                clubName,
                boatSize: derivedBoatSize,
                rowerUids: [user.uid],
                inviteCode: needsCrew ? randomCode() : null,
                status: needsCrew ? "pending_crew" : "registered",
            } as any);

            await reloadBoats();
            alert(needsCrew ? "Crew created! Share the invite link with teammates." : "Registered!");
        } catch (e: any) {
            setErr(e?.message ?? "Failed to sign up");
        } finally {
            setBusy(false);
        }
    }

    return (
        <>
            <Navbar />
            <main>
                <div className="row">
                    <Link to="/rower/events">
                        <button type="button" className="btn-ghost">
                            ← Back to events
                        </button>
                    </Link>
                </div>

                {loadingEvent ? (
                    <div className="card auth-guard-loading">
                        <p className="muted">Loading event…</p>
                    </div>
                ) : err ? (
                    <div className="card auth-error">
                        <div className="auth-error-title">Something went wrong</div>
                        <div className="auth-error-msg">{err}</div>
                    </div>
                ) : !eventId ? (
                    <p className="muted">Missing event id.</p>
                ) : !selectedEvent ? (
                    <div className="card auth-card">
                        <h2>Event not found</h2>
                        <p className="muted">This event may have been removed or you may not have access.</p>
                        <div className="auth-actions">
                            <Link to="/rower/events">
                                <button type="button" className="btn-primary">
                                    Return to events
                                </button>
                            </Link>
                        </div>
                    </div>
                ) : (
                    <>
                        <h1>{selectedEvent.name}</h1>
                        <p className="muted">{selectedEvent.location}</p>
                        {selectedEvent.description && <p className="muted">{selectedEvent.description}</p>}

                        {myPendingCrews.length > 0 && (
                            <>
                                <h2>Your crews in progress</h2>
                                <p className="muted">These crews are not registered until every seat is filled.</p>

                                <ul className="boats-grid">
                                    {myPendingCrews.map((b) => {
                                        const catName = b.categoryName ?? b.category ?? "—";
                                        const filled = b.rowerUids?.length ?? 0;
                                        const total = b.boatSize ?? 0;
                                        const remaining = Math.max(0, total - filled);

                                        const isOnBoat = !!user && (b.rowerUids ?? []).includes(user.uid);
                                        const code: string | null = b.inviteCode ?? null;

                                        const url = code ? inviteLink(eventId, code) : null;

                                        return (
                                            <li key={b.id} className="card card--tight">
                                                <div className="space-between">
                                                    <b>
                                                        {b.clubName} • {catName}
                                                    </b>
                                                    <span className="badge badge--brand">Crew: {seatLabel(b)}</span>
                                                </div>

                                                <div className="muted">
                                                    Waiting for {remaining} rower{remaining === 1 ? "" : "s"}.
                                                </div>

                                                <hr />

                                                <div className="muted">Crew</div>
                                                {renderCrewNames(b)}

                                                {isOnBoat && url && (
                                                    <>
                                                        <hr />
                                                        <div className="space-between">
                                                            <div className="muted">Invite link</div>
                                                            <span className="badge">Share with teammates</span>
                                                        </div>

                                                        <div className="invite-link-row">
                                                            <a className="muted" href={url} target="_blank" rel="noreferrer">
                                                                {url}
                                                            </a>
                                                            <button
                                                                type="button"
                                                                className="btn-ghost"
                                                                onClick={async () => {
                                                                    try {
                                                                        await navigator.clipboard.writeText(url);
                                                                    } catch {
                                                                        window.prompt("Copy this invite link:", url);
                                                                    }
                                                                }}
                                                            >
                                                                Copy
                                                            </button>
                                                        </div>
                                                    </>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ul>

                                <hr />
                            </>
                        )}

                        <div className="card">
                            <div className="space-between">
                                <h3>Category</h3>
                            </div>

                            {eligibleCategories.length === 0 && (
                                <p className="muted">
                                    No eligible categories for your profile. Check your date of birth (and gender if required) in your profile.
                                </p>
                            )}

                            <label>
                                Pick a category
                                <select
                                    value={categoryId}
                                    onChange={(e) => setCategoryId(e.target.value)}
                                    disabled={eligibleCategories.length === 0 || selectedEvent.status !== "open"}
                                >
                                    {eligibleCategories.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.name}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <div className="row">
                                <span className="badge badge--brand">Boat: {derivedBoatSize ? boatSizeLabel(derivedBoatSize) : "—"}</span>

                                {alreadySignedUpForCategory ? (
                                    <span className="error-text">You’ve already signed up for this category.</span>
                                ) : !eligibility.ok ? (
                                    <span className="error-text">{eligibility.reason}</span>
                                ) : (
                                    <span className="muted">Boat size is derived from the boat class in the category.</span>
                                )}
                            </div>
                        </div>

                        <div className="card">
                            <div className="space-between">
                                <h3>Your details</h3>
                                <span className="badge">{clubName ? `Club: ${clubName}` : "Club missing"}</span>
                            </div>
                            {!clubName && <p className="error-text">Add your club to your rower profile to continue.</p>}
                        </div>

                        <div className="auth-actions">
                            <button className="btn-primary" disabled={!canCreate || busy} onClick={onCreateBoat}>
                                {busy ? "Signing up..." : derivedBoatSize && derivedBoatSize > 1 ? "Create crew + get invite link" : "Register"}
                            </button>
                        </div>

                        <hr />

                        <h2>Registered boats</h2>

                        {loadingBoats ? (
                            <p className="muted">Loading boats…</p>
                        ) : registeredBoats.length === 0 ? (
                            <p className="muted">No boats registered yet.</p>
                        ) : (
                            <ul className="boats-grid">
                                {registeredBoats.map((b) => {
                                    const catName = b.categoryName ?? b.category ?? "—";
                                    const bc = parseBoatClassFromCategory(catName);
                                    const derived = bc ? boatSizeFromBoatClass(bc) : null;

                                    return (
                                        <li key={b.id} className="card card--tight">
                                            <div className="space-between">
                                                <b>
                                                    {b.clubName} • {catName}
                                                </b>
                                                <span className="badge badge--brand">Crew: {seatLabel(b)}</span>
                                            </div>

                                            <div className="muted">Boat: {derived ? boatSizeLabel(derived) : b.boatSize ?? "—"}</div>

                                            <hr />

                                            <div className="muted">Crew</div>
                                            {renderCrewNames(b)}

                                            <hr />

                                            <div className="muted">Bow: {b.bowNumber ?? "Not assigned yet"}</div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </>
                )}
            </main>
        </>
    );
}
