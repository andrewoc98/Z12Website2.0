import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Navbar from "../../../shared/components/Navbar/Navbar";
import type { EventDoc, EventCategory, FirestoreEventDoc } from "../../events/types";
import type { BoatSize } from "../types";
import { createBoat, listBoatsForEvent } from "../api/boats";
import { parseBoatClassFromCategory, boatSizeFromBoatClass } from "../../events/lib/categories";
import { collection, doc, getDoc, getDocs, query, where, documentId } from "firebase/firestore";
import { db } from "../../../shared/lib/firebase";
import { useAuth } from "../../../providers/AuthProvider";
import { mapEvent } from "../../events/lib/mapper.tsx";
import "../styles/eventSignUp.css";

// ---------- Types ----------
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

// ---------- Utility Functions ----------
function todayYMD() {
    return new Date().toISOString().slice(0, 10);
}

function ageOnDate(dobYmd: string, onYmd: string) {
    const [y, m, d] = dobYmd.split("-").map(Number);
    const [yy, mm, dd] = onYmd.split("-").map(Number);
    let age = yy - y;
    if (mm < m || (mm === m && dd < d)) age -= 1;
    return age;
}

function parseCategoryParts(catName: string): { gender: string; division: string; boatClass: string } | null {
    const parts = catName.split("•").map((s) => s.trim());
    if (parts.length !== 3) return null;
    return { gender: parts[0], division: parts[1], boatClass: parts[2] };
}

function juniorLimitFromDivision(division: string): number | null {
    const m = division.match(/^Junior\s+(\d{1,2})$/i);
    if (!m) return null;
    return Number(m[1]);
}

function mastersBandFromDivision(division: string): { min: number; max: number | null } | null {
    const m = division.match(/^Masters(?:\s+([A-K]))?/i);
    if (!m) return { min: 27, max: null };
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
    return bands[band] ?? { min: 27, max: null };
}

function isEligibleForCategory(profile: Profile, catName: string) {
    const parts = parseCategoryParts(catName);
    if (!parts || !profile.dateOfBirth || !profile.gender) return false;

    const age = ageOnDate(profile.dateOfBirth, todayYMD());
    const div = parts.division;

    // Gender check
    if (parts.gender === "Men" && profile.gender !== "male") return false;
    if (parts.gender === "Women" && profile.gender !== "female") return false;

    // Junior limits
    if (div.startsWith("U19") && age >= 19) return false;
    if (div.startsWith("U21") && age >= 21) return false;
    if (div.startsWith("U23") && age >= 23) return false;

    const juniorLimit = juniorLimitFromDivision(div);
    if (juniorLimit !== null && age >= juniorLimit) return false;

    // Masters limits (only apply to Masters divisions)
    if (div.startsWith("Masters")) {
        const mastersBand = mastersBandFromDivision(div);
        if (!mastersBand) return false;
        if (age < mastersBand.min) return false;
        if (mastersBand.max !== null && age > mastersBand.max) return false;
    }

    // All other divisions (Senior/Open) have no minimum age
    return true;
}

function randomCode(len = 12) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function bestName(u?: UserDoc | null) {
    return u?.displayName?.trim() || u?.fullName?.trim() || "Unknown";
}

function boatSizeLabel(size: number) {
    if (size === 1) return "Single";
    if (size === 2) return "Double";
    if (size === 4) return "Quad";
    if (size === 8) return "Eight";
    return String(size);
}

// Fetch users by UIDs in chunks
async function fetchUsersByUid(uids: string[]): Promise<Map<string, UserDoc>> {
    const out = new Map<string, UserDoc>();
    const unique = Array.from(new Set(uids.filter(Boolean)));
    if (!unique.length) return out;
    for (let i = 0; i < unique.length; i += 10) {
        const q = query(collection(db, "users"), where(documentId(), "in", unique.slice(i, i + 10)));
        const snap = await getDocs(q);
        snap.docs.forEach((d) => out.set(d.id, d.data() as UserDoc));
    }
    return out;
}

// ---------- Component ----------
export default function EventPageSignUp() {
    const { eventId } = useParams<{ eventId: string }>();
    const { user, profile } = useAuth() as any;
    const p: Profile | null = profile ?? null;

    const [selectedEvent, setSelectedEvent] = useState<(EventDoc & { id: string }) | null>(null);
    const [boats, setBoats] = useState<any[]>([]);
    const [categoryId, setCategoryId] = useState("");
    const [userByUid, setUserByUid] = useState<Map<string, UserDoc>>(new Map());
    const [loadingEvent, setLoadingEvent] = useState(true);
    const [loadingBoats, setLoadingBoats] = useState(false);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const clubName = useMemo(() => (p?.roles?.rower?.club ?? "").trim(), [p]);
    const inviteLink = (eid: string, code: string) => `${window.location.origin}/invite/${eid}/${code}`;

    // ---------- Fetch Event ----------
    useEffect(() => {
        if (!eventId) return;
        (async () => {
            setLoadingEvent(true);
            setErr(null);
            try {
                const snap = await getDoc(doc(db, "events", eventId));
                if (!snap.exists()) return setSelectedEvent(null);
                setSelectedEvent(mapEvent(snap.id, snap.data() as FirestoreEventDoc));
            } catch (e: any) {
                setErr(e?.message ?? "Failed to load event");
            } finally {
                setLoadingEvent(false);
            }
        })();
    }, [eventId]);

    // ---------- Fetch Boats ----------
    const reloadBoats = async () => {
        if (!eventId) return;
        setLoadingBoats(true);
        try {
            setBoats(await listBoatsForEvent(eventId));
        } finally {
            setLoadingBoats(false);
        }
    };
    useEffect(() => { void reloadBoats(); }, [eventId]);

    // ---------- Fetch User Docs ----------
    useEffect(() => {
        (async () => {
            const allUids = boats.flatMap((b) => b.rowerUids ?? []);
            if (!allUids.length) return;
            const m = await fetchUsersByUid(allUids);
            setUserByUid(m);
        })();
    }, [boats]);

    // ---------- Eligible Categories ----------
    const eligibleCategories = useMemo(() => {
        if (!selectedEvent || !p) return [];
        if (p.primaryRole && p.primaryRole !== "rower") return [];
        return selectedEvent.categories.filter((c) => isEligibleForCategory(p, c.name));
    }, [selectedEvent, p]);

    useEffect(() => {
        if (!selectedEvent || !eligibleCategories.length) return;

        // If no category selected or previously selected one is now ineligible, select first eligible
        if (!categoryId || !eligibleCategories.some((c) => c.id === categoryId)) {
            setCategoryId(eligibleCategories[0].id);
        }
    }, [eligibleCategories, selectedEvent, categoryId]);

    const categoryById = useMemo(() => {
        const m = new Map<string, EventCategory>();
        selectedEvent?.categories.forEach((c) => m.set(c.id, c));
        return m;
    }, [selectedEvent]);

    const selectedCategory = categoryId ? categoryById.get(categoryId) ?? null : null;

    const derivedBoatSize: BoatSize | null = useMemo(() => {
        if (!selectedCategory) return null;
        const bc = parseBoatClassFromCategory(selectedCategory.name);
        return bc ? boatSizeFromBoatClass(bc) as BoatSize : null;
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
        if (!selectedCategory || !user || !p || !clubName) return { ok: false, reason: "Not eligible." };
        return { ok: true, reason: "" };
    }, [selectedCategory, user, p, clubName]);

    const canCreate = !!user && !!p && !!selectedEvent && !!selectedCategory &&
        derivedBoatSize !== null && selectedEvent.status === "open" &&
        !alreadySignedUpForCategory && eligibility.ok;

    // ---------- Pending & Registered Boats ----------
    const myPendingCrews = useMemo(() => {
        if (!user) return [];
        return boats.filter((b) => (b.status ?? "registered") === "pending_crew" && (b.rowerUids ?? []).includes(user.uid));
    }, [boats, user]);

    const registeredBoats = useMemo(() => boats.filter((b) => (b.status ?? "registered") === "registered"), [boats]);

    // ---------- Create Boat ----------
    async function onCreateBoat() {
        if (!canCreate || !selectedCategory || !derivedBoatSize || !eventId || !user) return;
        setErr(null); setBusy(true);
        try {
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

                invitedEmails: [],
                adjustmentMs: 0,
            });
            await reloadBoats();
        } catch (e: any) { setErr(e?.message ?? "Failed to sign up"); }
        finally { setBusy(false); }
    }

    function seatLabel(b: any) {
        const filled = b.rowerUids?.length ?? 0;
        const total = b.boatSize ?? 0;
        return `${filled}/${total}`;
    }

    function renderCrewNames(b: any) {
        const uids: string[] = Array.isArray(b.rowerUids) ? b.rowerUids : [];
        if (!uids.length) return <p className="muted">No crew yet.</p>;
        return (
            <ul className="crew-list">
                {uids.map((uid) => (
                    <li key={uid} className="muted">{bestName(userByUid.get(uid))}{user?.uid === uid ? " (you)" : ""}</li>
                ))}
            </ul>
        );
    }

    // ---------- Render ----------
    return (
        <>
            <Navbar />
            <main className="event-signup-page">
                <div className="page-container">
                    <Link to="/events" className="back-btn">← Back to events</Link>

                    {loadingEvent ? <div className="card auth-guard-loading"><p className="muted">Loading event…</p></div> :
                        err ? <div className="card auth-error"><div className="auth-error-title">Something went wrong</div><div className="auth-error-msg">{err}</div></div> :
                            !selectedEvent ? <div className="card auth-card"><h2>Event not found</h2></div> :
                                <>
                                    <div className="signup-event-header">
                                        <h1>{selectedEvent.name}</h1>
                                        <div className="event-meta">{selectedEvent.location}</div>
                                        {selectedEvent.description && <p className="event-description">{selectedEvent.description}</p>}
                                    </div>

                                    <div className="card">
                                        <label>
                                            Pick a category
                                            <div className="custom-select">
                                                <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
                                                        disabled={eligibleCategories.length === 0 || selectedEvent.status !== "open"}>
                                                    {eligibleCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                </select>
                                            </div>
                                        </label>
                                        <div className="row">
                                            <span className="badge badge--brand">Boat: {derivedBoatSize ? boatSizeLabel(derivedBoatSize) : "—"}</span>
                                            {alreadySignedUpForCategory && <span className="error-text">Already signed up</span>}
                                        </div>
                                    </div>

                                    <div className="auth-actions">
                                        <button className="btn-primary" disabled={!canCreate || busy} onClick={onCreateBoat}>
                                            {busy ? "Signing up…" : derivedBoatSize && derivedBoatSize > 1 ? "Create crew + get invite link" : "Register"}
                                        </button>
                                    </div>

                                    {myPendingCrews.length > 0 && (
                                        <>
                                            <h2>Your crews in progress</h2>
                                            <ul className="boats-grid">
                                                {myPendingCrews.map((b) => {
                                                    const url = b.inviteCode ? inviteLink(eventId!, b.inviteCode) : null;
                                                    return (
                                                        <li key={b.id} className="card card--tight">
                                                            <div className="space-between">
                                                                <b>{b.clubName} • {b.categoryName}</b>
                                                                <span className="badge badge--brand">Crew: {seatLabel(b)}</span>
                                                            </div>
                                                            <div className="muted">Waiting for {Math.max(0, (b.boatSize ?? 0) - (b.rowerUids?.length ?? 0))} rower(s).</div>
                                                            <hr />
                                                            <div className="muted">Crew</div>
                                                            {renderCrewNames(b)}
                                                            {url && <CopyInvite url={url} />}
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        </>
                                    )}

                                    <h2>Registered boats</h2>
                                    {loadingBoats ? <p className="muted">Loading boats…</p> :
                                        registeredBoats.length === 0 ? <p className="muted">No boats registered yet.</p> :
                                            <ul className="boats-grid">
                                                {registeredBoats.map((b) => {
                                                    const bc = parseBoatClassFromCategory(b.categoryName ?? b.category ?? "");
                                                    const derived = bc ? boatSizeFromBoatClass(bc) : null;
                                                    return (
                                                        <li key={b.id} className="card card--tight">
                                                            <div className="space-between">
                                                                <b>{b.clubName} • {b.categoryName}</b>
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
                                            </ul>}
                                </>}
                </div>
            </main>
        </>
    );
}

function CopyInvite({ url }: { url: string }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1000);
        } catch {
            window.prompt("Copy this invite link:", url);
        }
    };

    return (
        <div className="invite-link-row">
            <a className="muted invite-link" href={url} target="_blank" rel="noreferrer">{url}</a>
            <button type="button" className="btn-ghost" onClick={handleCopy}>
                {copied ? "Copied!" : "Copy"}
            </button>
        </div>
    );
}