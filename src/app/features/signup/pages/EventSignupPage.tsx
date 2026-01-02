import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import Navbar from "../../../shared/components/Navbar/Navbar";
import type { EventDoc, EventCategory } from "../../events/types";

import { DEV_MODE } from "../../../shared/lib/config";

// DEV auth
import { useMockAuth } from "../../../providers/MockAuthProvider";

// Firebase auth
import { useAuth } from "../../../providers/AuthProvider";

import type { BoatSize } from "../types";
import { createBoat, listBoatsForEvent } from "../api/boats";
import { parseBoatClassFromCategory, boatSizeFromBoatClass} from "../../events/lib/categories";

// Firestore event read (for non-dev mode)
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../shared/lib/firebase";


// This is the shape we need from "profile" for restrictions.
// In DEV_MODE we’ll treat mock.user as this.
// In real mode we’ll use useAuth().profile.
type RowerProfileLike = {
    uid: string;
    primaryRole?: "rower" | "host" | "admin";
    gender?: "male" | "female";
    dateOfBirth?: string; // YYYY-MM-DD
};

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
function juniorLimitFromDivision(division: string): number | null {
    // Matches: "Junior 15", "Junior 16", etc (case-insensitive)
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

    // "Masters" without a band: allow any masters-age athlete
    if (!band) return { min: 27, max: null };

    return bands[band] ?? { min: 27, max: null };
}

function isEligibleForCategory(
    profile: { gender?: "male" | "female"; dateOfBirth?: string },
    catName: string
) {
    const parts = parseCategoryParts(catName);
    if (!parts) return false;

    if (parts.gender === "Men" && profile.gender !== "male") return false;
    if (parts.gender === "Women" && profile.gender !== "female") return false;

    if (!profile.dateOfBirth) return false;

    const age = ageOnDate(profile.dateOfBirth, todayYMD());
    const div = parts.division;

    if (div.startsWith("U19") && age >= 19) return false;
    if (div.startsWith("U21") && age >= 21) return false;
    if (div.startsWith("U23") && age >= 23) return false;

    const juniorLimit = juniorLimitFromDivision(div);
    if (juniorLimit !== null) {
        if (age >= juniorLimit) return false;
        return true; // junior rule is decisive
    }


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

function inviteUrlFromCode(code: string) {
    return `${window.location.origin}/invite/${code}`;
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

// ✅ fetch a single event by id
async function getEventById(eventId: string): Promise<(EventDoc & { id: string }) | null> {
    if (DEV_MODE) {
        // If you have mock events, wire them here later.
        return null;
    }

    const snap = await getDoc(doc(db, "events", eventId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as EventDoc) };
}

export default function EventSignupPage() {
    const { eventId } = useParams<{ eventId: string }>();

    // Auth: DEV_MODE uses mock, otherwise firebase
    const mock = DEV_MODE ? useMockAuth() : null;
    const real = !DEV_MODE ? useAuth() : null;

    const user = DEV_MODE ? mock?.user ?? null : real?.user ?? null;

    const profile: RowerProfileLike | null = DEV_MODE
        ? ((mock?.user as any) ?? null)
        : ((real?.profile as any) ?? null);

    const [selectedEvent, setSelectedEvent] = useState<(EventDoc & { id: string }) | null>(null);
    const [boats, setBoats] = useState<any[]>([]);

    const [clubName, setClubName] = useState("Z12 RC");

    const [categoryId, setCategoryId] = useState("");
    const [inviteLinks, setInviteLinks] = useState<string[]>([]);

    const [loadingEvent, setLoadingEvent] = useState(true);
    const [loadingBoats, setLoadingBoats] = useState(false);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    // Load single event
    useEffect(() => {
        if (!eventId) return;

        (async () => {
            setLoadingEvent(true);
            setErr(null);
            try {
                const e = await getEventById(eventId);
                setSelectedEvent(e);
            } catch (e: any) {
                setErr(e?.message ?? "Failed to load event");
            } finally {
                setLoadingEvent(false);
            }
        })();
    }, [eventId]);

    // Load boats for this event
    useEffect(() => {
        if (!eventId) return;
        (async () => {
            setLoadingBoats(true);
            try {
                const b = await listBoatsForEvent(eventId);
                setBoats(b);
            } finally {
                setLoadingBoats(false);
            }
        })();
    }, [eventId]);

    // Map categories
    const categoryById = useMemo(() => {
        const m = new Map<string, EventCategory>();
        (selectedEvent?.categories ?? []).forEach((c) => m.set(c.id, c));
        return m;
    }, [selectedEvent]);

    const selectedCategory = useMemo(() => {
        if (!categoryId) return null;
        return categoryById.get(categoryId) ?? null;
    }, [categoryId, categoryById]);


    const eligibleCategories: EventCategory[] = useMemo(() => {
        if (!selectedEvent) return [];
        // If not signed in / no profile yet, show none (or show all if you prefer)
        if (!profile) return [];

        // Only rowers should be on this page, but if a host/admin lands here, show none.
        if (profile.primaryRole && profile.primaryRole !== "rower") return [];

        return selectedEvent.categories.filter((c) => isEligibleForCategory(profile, c.name));
    }, [selectedEvent, profile]);

    useEffect(() => {
        if (!selectedEvent) return;
        if (!categoryId) return;
        if (eligibleCategories.length === 0) return;

        const stillExists = eligibleCategories.some((c) => c.id === categoryId);
        if (!stillExists) setCategoryId(eligibleCategories[0].id);
    }, [eligibleCategories, selectedEvent, categoryId]);

    const derivedBoatSize: BoatSize | null = useMemo(() => {
        if (!selectedCategory) return null;
        const bc = parseBoatClassFromCategory(selectedCategory.name);
        if (!bc) return null;
        return boatSizeFromBoatClass(bc) as BoatSize;
    }, [selectedCategory]);

    // Already signed up check
    const alreadySignedUpForCategory = useMemo(() => {
        if (!user || !categoryId || !selectedCategory) return false;

        return boats.some((b) => {
            const rowers: string[] = b.rowerUids ?? [];
            if (!rowers.includes(user.uid)) return false;

            if (b.categoryId) return b.categoryId === categoryId;

            const name = b.categoryName ?? b.category ?? "";
            return name === selectedCategory.name;
        });
    }, [boats, user, categoryId, selectedCategory]);

    const eligibility = useMemo(() => {
        if (!selectedCategory) return { ok: false, reason: "Pick a category." };

        // Must be signed in
        if (!user) return { ok: false, reason: "Please sign in." };

        // We only restrict rowers (hosts/admin shouldn’t be on this page anyway)
        if (!profile) return { ok: false, reason: "Missing profile data." };

        const parts = parseCategoryParts(selectedCategory.name);
        if (!parts) return { ok: false, reason: "Invalid category format." };

        // Gender match (Men/Women/Mixed)
        const cg = parts.gender;
        const pg = profile.gender; // "male" | "female"
        if (cg === "Men" && pg !== "male") return { ok: false, reason: "This category is Men only." };
        if (cg === "Women" && pg !== "female") return { ok: false, reason: "This category is Women only." };
        // Mixed: allow both

        // Age group match (best-effort)
        // If you want to use event date instead of today, we can compute from selectedEvent.startAt later.
        if (profile.dateOfBirth) {
            const on = todayYMD();
            const age = ageOnDate(profile.dateOfBirth, on);

            const div = parts.division;
            if (div.startsWith("U19") && age >= 19) return { ok: false, reason: "U19 only." };
            if (div.startsWith("U21") && age >= 21) return { ok: false, reason: "U21 only." };
            if (div.startsWith("U23") && age >= 23) return { ok: false, reason: "U23 only." };
        } else {
            // If they're rower and missing DOB, block (your register collects it)
            return { ok: false, reason: "Missing date of birth on your profile." };
        }

        return { ok: true, reason: "" };
    }, [selectedCategory, user, profile]);

    const canCreate =
        !!user &&
        !!selectedEvent &&
        !!eventId &&
        clubName.trim().length > 1 &&
        !!selectedCategory &&
        derivedBoatSize !== null &&
        selectedEvent.status === "open" &&
        !alreadySignedUpForCategory &&
        eligibility.ok;

    function buildInviteCodes(size: number) {
        const remaining = Math.max(0, size - 1);
        const codes: string[] = [];
        for (let i = 0; i < remaining; i++) codes.push(randomCode());
        return codes;
    }


    async function onCreateBoat() {
        if (!user || !selectedEvent || !eventId || derivedBoatSize === null || !selectedCategory) return;

        setErr(null);
        setBusy(true);

        try {
            if (alreadySignedUpForCategory) throw new Error("You’ve already signed up for this category.");
            if (!eligibility.ok) throw new Error(eligibility.reason || "Not eligible for this category.");

            const inviteCodes = buildInviteCodes(derivedBoatSize);
            const links = inviteCodes.map(inviteUrlFromCode);

            await createBoat({
                eventId,
                categoryId: selectedCategory.id,
                categoryName: selectedCategory.name,
                category: selectedCategory.name, // back-compat display
                clubName,
                boatSize: derivedBoatSize,
                rowerUids: [user.uid],
                invitedEmails: [], // placeholder
                inviteCodes,
            } as any);

            const b = await listBoatsForEvent(eventId);
            setBoats(b);

            setInviteLinks(links);
            alert("Signed up boat!");
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
                <div className="row" style={{ marginBottom: 10 }}>
                    <Link to="/rower/events">
                        <button type="button" className="btn-ghost">
                            ← Back to events
                        </button>
                    </Link>
                </div>

                {loadingEvent ? (
                    <p>Loading event…</p>
                ) : err ? (
                    <p style={{ color: "crimson" }}>{err}</p>
                ) : !eventId ? (
                    <p>Missing event id.</p>
                ) : !selectedEvent ? (
                    <div className="card">
                        <h2>Event not found</h2>
                        <p className="muted">This event may have been removed or you may not have access.</p>
                        <Link to="/rower/events">
                            <button type="button" className="btn-primary">
                                Return to events
                            </button>
                        </Link>
                    </div>
                ) : (
                    <>
                        <h1>{selectedEvent.name}</h1>
                        <p className="muted">{selectedEvent.location}</p>
                        {selectedEvent.description && <p className="muted">{selectedEvent.description}</p>}

                        {selectedEvent.status !== "open" && (
                            <div className="card" style={{ marginTop: 12 }}>
                                <div className="space-between">
                                    <h3>Sign up closed</h3>
                                    <span className="badge">Status: {selectedEvent.status}</span>
                                </div>
                                <p className="muted">You can still view registered boats below.</p>
                            </div>
                        )}

                        <div className="card" style={{ marginTop: 12 }}>
                            <div className="space-between">
                                <h3>Category</h3>
                                {eligibleCategories.length === 0 ? (
                                    <p className="muted" style={{ marginTop: 10 }}>
                                        No eligible categories for your profile (gender/age). Update your profile details or choose a different event.
                                    </p>
                                ) : eligibleCategories.length === 0 ? (
                                    <p className="muted" style={{ marginTop: 10 }}>
                                        No eligible categories match your filters.
                                    </p>
                                ) : null}
                            </div>

                            <label style={{ marginTop: 10 }}>
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

                            <div className="row" style={{ marginTop: 10 }}>
                                <span className="badge badge--brand">Boat: {derivedBoatSize ? boatSizeLabel(derivedBoatSize) : "—"}</span>

                                {alreadySignedUpForCategory ? (
                                    <span className="muted" style={{ color: "#9f1239", fontWeight: 800 }}>
                    You’ve already signed up for this category.
                  </span>
                                ) : !eligibility.ok ? (
                                    <span className="muted" style={{ color: "#9f1239", fontWeight: 800 }}>
                    {eligibility.reason}
                  </span>
                                ) : (
                                    <span className="muted">Boat size is derived from the boat class in the category.</span>
                                )}
                            </div>

                            {eligibleCategories.length === 0 && <p className="muted">You don't qualify for any categories in this event</p>}
                        </div>

                        <label>
                            Club Name
                            <input value={clubName} onChange={(e) => setClubName(e.target.value)} />
                        </label>

                        {err && <p style={{ color: "crimson" }}>{err}</p>}

                        <button disabled={!canCreate || busy} onClick={onCreateBoat} style={{ marginTop: 12 }}>
                            {busy ? "Signing up..." : "Register Boat"}
                        </button>

                        {inviteLinks.length > 0 && (
                            <div className="card" style={{ marginTop: 12 }}>
                                <div className="space-between">
                                    <h3>Invite links</h3>
                                    <span className="badge">{inviteLinks.length}</span>
                                </div>
                                <p className="muted" style={{ marginTop: 6 }}>
                                    Share these links with your teammates. Each link can be used once.
                                </p>

                                <ul style={{ marginTop: 10, paddingLeft: 18 }}>
                                    {inviteLinks.map((u) => (
                                        <li key={u} className="muted" style={{ marginBottom: 8 }}>
                                            <a href={u} target="_blank" rel="noreferrer" className="muted">
                                                {u}
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <hr />

                        <h2>Registered Boats</h2>

                        {loadingBoats ? (
                            <p>Loading boats…</p>
                        ) : boats.length === 0 ? (
                            <p>No boats registered yet.</p>
                        ) : (
                            <ul style={{ display: "grid", gap: 10, padding: 0, listStyle: "none" }}>
                                {boats.map((b) => {
                                    const catName = b.categoryName ?? b.category ?? "—";
                                    const bc = parseBoatClassFromCategory(catName);
                                    const derived = bc ? boatSizeFromBoatClass(bc) : null;

                                    return (
                                        <li key={b.id} className="card card--tight">
                                            <b>
                                                {b.clubName} • {catName}
                                            </b>
                                            <div className="muted" style={{ marginTop: 6 }}>
                                                Boat: {derived ? boatSizeLabel(derived) : b.boatSize ?? "—"}
                                            </div>
                                            <div className="muted">
                                                Invites:{" "}
                                                {b.inviteCodes?.length
                                                    ? b.inviteCodes.length
                                                    : b.invitedEmails?.length
                                                        ? b.invitedEmails.length
                                                        : "None"}
                                            </div>
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
