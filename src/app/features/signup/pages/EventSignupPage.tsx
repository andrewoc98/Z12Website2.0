import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Navbar from "../../../shared/components/Navbar/Navbar";
import type { EventDoc, EventCategory, FirestoreEventDoc } from "../../events/types";
import type { BoatSize } from "../types";
import { createBoat, listBoatsForEvent } from "../api/boats";
import {parseBoatClassFromCategory, boatSizeFromBoatClass, formatDate} from "../../events/lib/categories";
import { collection, doc, getDoc, getDocs, query, where, documentId } from "firebase/firestore";
import { db } from "../../../shared/lib/firebase";
import { useAuth } from "../../../providers/AuthProvider";
import { mapEvent } from "../../events/lib/mapper.tsx";
import "../styles/eventSignUp.css";
import Footer from "../../../shared/components/Footer/Footer.tsx";

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
        A: { min: 27, max: 35 }, B: { min: 36, max: 42 }, C: { min: 43, max: 49 },
        D: { min: 50, max: 54 }, E: { min: 55, max: 59 }, F: { min: 60, max: 64 },
        G: { min: 65, max: 69 }, H: { min: 70, max: 74 }, I: { min: 75, max: 79 },
        J: { min: 80, max: 84 }, K: { min: 85, max: null },
    };
    return bands[band] ?? { min: 27, max: null };
}

function isEligibleForCategory(profile: Profile, catName: string) {
    const parts = parseCategoryParts(catName);
    if (!parts || !profile.dateOfBirth || !profile.gender) return false;
    const age = ageOnDate(profile.dateOfBirth, todayYMD());
    const div = parts.division;
    if (parts.gender === "Men" && profile.gender !== "male") return false;
    if (parts.gender === "Women" && profile.gender !== "female") return false;
    if (div.startsWith("U19") && age >= 19) return false;
    if (div.startsWith("U21") && age >= 21) return false;
    if (div.startsWith("U23") && age >= 23) return false;
    const juniorLimit = juniorLimitFromDivision(div);
    if (juniorLimit !== null && age >= juniorLimit) return false;
    if (div.startsWith("Masters")) {
        const mastersBand = mastersBandFromDivision(div);
        if (!mastersBand) return false;
        if (age < mastersBand.min) return false;
        if (mastersBand.max !== null && age > mastersBand.max) return false;
    }
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
    if (size === 1) return "Single (1x)";
    if (size === 2) return "Double (2x)";
    if (size === 4) return "Quad (4x)";
    if (size === 8) return "Eight (8+)";
    return String(size);
}

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

// ---------- Sub-components ----------

function EsuStatusPill({ status }: { status: string }) {
    const map: Record<string, { label: string; cls: string }> = {
        open:     { label: "Open",     cls: "esu-pill esu-pill--open"     },
        closed:   { label: "Closed",   cls: "esu-pill esu-pill--closed"   },
        draft:    { label: "Draft",    cls: "esu-pill esu-pill--draft"    },
        running:  { label: "Running",  cls: "esu-pill esu-pill--running"  },
        finished: { label: "Finished", cls: "esu-pill esu-pill--finished" },
    };
    const s = map[status] ?? { label: status, cls: "esu-pill" };
    return <span className={s.cls}>{s.label}</span>;
}

function EsuSeatDots({ filled, total }: { filled: number; total: number }) {
    return (
        <div className="esu-seat-dots" title={`${filled}/${total} seats filled`}>
            {Array.from({ length: total }).map((_, i) => (
                <span key={i} className={`esu-seat-dot ${i < filled ? "esu-seat-dot--filled" : "esu-seat-dot--empty"}`} />
            ))}
        </div>
    );
}

function EsuCopyInvite({ url }: { url: string }) {
    const [copied, setCopied] = useState(false);
    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            window.prompt("Copy this invite link:", url);
        }
    };
    return (
        <div className="esu-invite-box">
            <div className="esu-invite-label">🔗 Invite link</div>
            <div className="esu-invite-link-row">
                <a className="esu-invite-link" href={url} target="_blank" rel="noreferrer">{url}</a>
                <button type="button" className={`esu-copy-btn ${copied ? "esu-copy-btn--done" : ""}`} onClick={handleCopy}>
                    {copied ? "✓ Copied" : "Copy"}
                </button>
            </div>
        </div>
    );
}

// ---------- Main Component ----------
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
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    const clubName = useMemo(() => (p?.roles?.rower?.club ?? "").trim(), [p]);
    const inviteLink = (eid: string, code: string) => `${window.location.origin}/invite/${eid}/${code}`;

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

    const reloadBoats = async () => {
        if (!eventId) return;
        setLoadingBoats(true);
        try { setBoats(await listBoatsForEvent(eventId)); }
        finally { setLoadingBoats(false); }
    };
    useEffect(() => { void reloadBoats(); }, [eventId]);

    useEffect(() => {
        (async () => {
            const allUids = boats.flatMap((b) => b.rowerUids ?? []);
            if (!allUids.length) return;
            setUserByUid(await fetchUsersByUid(allUids));
        })();
    }, [boats]);

    const eligibleCategories = useMemo(() => {
        if (!selectedEvent || !p) return [];
        if (!p.roles?.rower) return [];
        return selectedEvent.categories.filter((c) => isEligibleForCategory(p, c.name));
    }, [selectedEvent, p]);

    useEffect(() => {
        if (!selectedEvent || !eligibleCategories.length) return;
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
            return (b.categoryName ?? b.category ?? "") === selectedCategory.name;
        });
    }, [boats, user, selectedCategory]);

    const canCreate = !!user && !!p?.roles?.rower && !!selectedEvent && !!selectedCategory &&
        derivedBoatSize !== null && selectedEvent.status === "open" &&
        !alreadySignedUpForCategory && !!clubName;

    const myPendingCrews = useMemo(() => {
        if (!user) return [];
        return boats.filter((b) => (b.status ?? "registered") === "pending_crew" && (b.rowerUids ?? []).includes(user.uid));
    }, [boats, user]);

    const myRegisteredBoats = useMemo(() => {
        if (!user) return [];
        return boats.filter((b) => (b.status ?? "registered") === "registered" && (b.rowerUids ?? []).includes(user.uid));
    }, [boats, user]);

    const otherRegisteredBoats = useMemo(() => {
        if (!user) return boats.filter((b) => (b.status ?? "registered") === "registered");
        return boats.filter((b) => (b.status ?? "registered") === "registered" && !(b.rowerUids ?? []).includes(user.uid));
    }, [boats, user]);

    async function onCreateBoat() {
        if (!canCreate || !selectedCategory || !derivedBoatSize || !eventId || !user) return;
        setErr(null);
        setSuccessMsg(null);
        setBusy(true);
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
            setSuccessMsg(derivedBoatSize > 1
                ? "Crew created! Share the invite link below with your crew."
                : "You're registered! See you at the start line.");
        } catch (e: any) {
            setErr(e?.message ?? "Failed to sign up");
        } finally {
            setBusy(false);
        }
    }

    function renderCrewNames(b: any) {
        const uids: string[] = Array.isArray(b.rowerUids) ? b.rowerUids : [];
        if (!uids.length) return <p className="esu-muted">No crew yet.</p>;
        return (
            <ul className="esu-crew-list">
                {uids.map((uid) => (
                    <li key={uid}>
                        <span className="esu-crew-avatar">{bestName(userByUid.get(uid)).charAt(0)}</span>
                        <span>{bestName(userByUid.get(uid))}</span>
                        {user?.uid === uid && <span className="esu-you-tag">you</span>}
                    </li>
                ))}
            </ul>
        );
    }

    // ---------- Render ----------
    return (
        <>
            <Navbar />
            <main className="esu-page">
                <div className="esu-container">
                    <Link to="/events" className="esu-back-btn">← Back to events</Link>

                    {loadingEvent ? (
                        <div className="esu-card esu-skeleton-state">
                            <div className="esu-skeleton-bar" style={{ height: 32, width: "60%", marginBottom: 12 }} />
                            <div className="esu-skeleton-bar" style={{ height: 16, width: "40%" }} />
                        </div>
                    ) : err ? (
                        <div className="esu-card esu-error-card">
                            <div className="esu-error-icon">⚠</div>
                            <div>
                                <div className="esu-error-title">Something went wrong</div>
                                <div className="esu-error-msg">{err}</div>
                            </div>
                        </div>
                    ) : !selectedEvent ? (
                        <div className="esu-card"><h2>Event not found</h2></div>
                    ) : (
                        <>
                            {/* ── Event Header ── */}
                            <div className="esu-event-header">
                                <div className="esu-header-top-row">
                                    <h1>{selectedEvent.name}</h1>
                                    <EsuStatusPill status={(selectedEvent as any).status ?? "closed"} />
                                </div>
                                <div className="esu-event-meta">
                                    <span className="esu-meta-item">{selectedEvent.location}</span>
                                    <span className="esu-meta-item">{formatDate(selectedEvent.startDate)}</span>
                                    <span className="esu-meta-item">{selectedEvent.lengthMeters}m</span>
                                </div>
                                {selectedEvent.description && <p className="esu-event-description">{selectedEvent.description}</p>}
                            </div>

                            {/* ── My Registrations summary ── */}
                            {myRegisteredBoats.length > 0 && (
                                <div className="esu-entries-banner">
                                    <span className="esu-banner-icon">✓</span>
                                    <span>You have <strong>{myRegisteredBoats.length}</strong> registered {myRegisteredBoats.length === 1 ? "entry" : "entries"} in this event.</span>
                                </div>
                            )}

                            {/* ── Sign-up card ── */}
                            {!p?.roles?.rower ? (
                                <div className="esu-card esu-info-card">
                                    <div className="esu-info-icon">ℹ</div>
                                    <div>
                                        <strong>Rower registration only</strong>
                                        <p className="esu-muted" style={{ margin: "4px 0 0" }}>
                                            Sign-up is available for rowers. Coaches and guardians can{" "}
                                            <Link to={`/events/${eventId}/view`} className="esu-inline-link">view the start list</Link>.
                                        </p>
                                    </div>
                                </div>
                            ) : selectedEvent.status !== "open" ? (
                                <div className="esu-card esu-info-card">
                                    <div className="esu-info-icon">🔒</div>
                                    <div>
                                        <strong>Registration is {selectedEvent.status}</strong>
                                        <p className="esu-muted" style={{ margin: "4px 0 0" }}>Sign-up is no longer available for this event.</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="esu-card esu-signup-card">
                                    <h3 className="esu-card-section-title">Enter a category</h3>

                                    {eligibleCategories.length === 0 ? (
                                        <p className="esu-muted">No eligible categories found for your profile.</p>
                                    ) : (
                                        <>
                                            <label className="esu-field-label">
                                                Category
                                                <div className="esu-custom-select">
                                                    <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                                                        {eligibleCategories.map((c) => (
                                                            <option key={c.id} value={c.id}>{c.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </label>

                                            <div className="esu-signup-meta-row">
                                                {derivedBoatSize && (
                                                    <span className="esu-badge esu-badge--brand">
                                                        🚣 {boatSizeLabel(derivedBoatSize)}
                                                    </span>
                                                )}
                                                {alreadySignedUpForCategory && (
                                                    <span className="esu-already-tag">✓ Already entered</span>
                                                )}
                                                {!clubName && (
                                                    <span className="esu-error-text">⚠ No club set on your profile</span>
                                                )}
                                            </div>

                                            {successMsg && (
                                                <div className="esu-success-banner">{successMsg}</div>
                                            )}

                                            <button
                                                className="esu-btn-primary esu-signup-btn"
                                                disabled={!canCreate || busy}
                                                onClick={onCreateBoat}
                                            >
                                                {busy ? (
                                                    <span className="esu-btn-loading">Signing up…</span>
                                                ) : derivedBoatSize && derivedBoatSize > 1 ? (
                                                    "Create crew & get invite link"
                                                ) : (
                                                    "Register →"
                                                )}
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* ── Pending crews ── */}
                            {myPendingCrews.length > 0 && (
                                <section className="esu-section">
                                    <h2 className="esu-section-title">
                                        <span>Your crews in progress</span>
                                        <span className="esu-section-count">{myPendingCrews.length}</span>
                                    </h2>
                                    <ul className="esu-boats-grid">
                                        {myPendingCrews.map((b) => {
                                            const url = b.inviteCode ? inviteLink(eventId!, b.inviteCode) : null;
                                            const filled = b.rowerUids?.length ?? 0;
                                            const total = b.boatSize ?? 0;
                                            const waiting = Math.max(0, total - filled);
                                            return (
                                                <li key={b.id} className="esu-card esu-card--tight esu-boat-card esu-boat-card--pending">
                                                    <div className="esu-boat-card-header">
                                                        <div>
                                                            <div className="esu-boat-club">{b.clubName}</div>
                                                            <div className="esu-boat-category">{b.categoryName}</div>
                                                        </div>
                                                        <EsuSeatDots filled={filled} total={total} />
                                                    </div>
                                                    <div className="esu-waiting-tag">
                                                        ⏳ Waiting for {waiting} more rower{waiting !== 1 ? "s" : ""}
                                                    </div>
                                                    <div className="esu-crew-section">
                                                        <div className="esu-crew-section-label">Crew</div>
                                                        {renderCrewNames(b)}
                                                    </div>
                                                    {url && <EsuCopyInvite url={url} />}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </section>
                            )}

                            {/* ── Start list ── */}
                            <section className="esu-section">
                                <h2 className="esu-section-title">
                                    <span>Start list</span>
                                    {!loadingBoats && (
                                        <span className="esu-section-count">
                                            {boats.filter((b) => (b.status ?? "registered") === "registered").length} entries
                                        </span>
                                    )}
                                </h2>

                                {loadingBoats ? (
                                    <div className="esu-boats-grid">
                                        {[1, 2, 3].map((i) => (
                                            <div key={i} className="esu-card esu-card--tight esu-skeleton-card">
                                                <div className="esu-skeleton-bar" style={{ height: 18, width: "70%", marginBottom: 8 }} />
                                                <div className="esu-skeleton-bar" style={{ height: 14, width: "50%" }} />
                                            </div>
                                        ))}
                                    </div>
                                ) : boats.filter((b) => (b.status ?? "registered") === "registered").length === 0 ? (
                                    <p className="esu-muted esu-empty-state">No boats registered yet — be the first!</p>
                                ) : (
                                    <>
                                        {myRegisteredBoats.length > 0 && (
                                            <>
                                                <div className="esu-subsection-label">Your entries</div>
                                                <ul className="esu-boats-grid">
                                                    {myRegisteredBoats.map((b) => <EsuBoatCard key={b.id} b={b} userByUid={userByUid} renderCrewNames={renderCrewNames} isOwn />)}
                                                </ul>
                                            </>
                                        )}
                                        {otherRegisteredBoats.length > 0 && (
                                            <>
                                                {myRegisteredBoats.length > 0 && <div className="esu-subsection-label">Other entries</div>}
                                                <ul className="esu-boats-grid">
                                                    {otherRegisteredBoats.map((b) => <EsuBoatCard key={b.id} b={b} userByUid={userByUid} renderCrewNames={renderCrewNames} />)}
                                                </ul>
                                            </>
                                        )}
                                    </>
                                )}
                            </section>
                        </>
                    )}
                </div>
            </main>
            <Footer />
        </>
    );
}

function EsuBoatCard({ b, renderCrewNames, isOwn }: {
    b: any;
    userByUid: Map<string, UserDoc>;
    renderCrewNames: (b: any) => React.ReactNode;
    isOwn?: boolean;
}) {
    const bc = parseBoatClassFromCategory(b.categoryName ?? b.category ?? "");
    const derived = bc ? boatSizeFromBoatClass(bc) : null;
    const filled = b.rowerUids?.length ?? 0;
    const total = b.boatSize ?? 0;

    function boatSizeLabel(size: number) {
        if (size === 1) return "Single (1x)";
        if (size === 2) return "Double (2x)";
        if (size === 4) return "Quad (4x)";
        if (size === 8) return "Eight (8+)";
        return String(size);
    }

    return (
        <li className={`esu-card esu-card--tight esu-boat-card ${isOwn ? "esu-boat-card--own" : ""}`}>
            {isOwn && <div className="esu-own-ribbon">Your entry</div>}
            <div className="esu-boat-card-header">
                <div>
                    <div className="esu-boat-club">{b.clubName}</div>
                    <div className="esu-boat-category">{b.categoryName}</div>
                </div>
                <EsuSeatDots filled={filled} total={total} />
            </div>
            <div className="esu-boat-detail-row">
                <span className="esu-boat-detail-label">Boat</span>
                <span>{derived ? boatSizeLabel(derived) : b.boatSize ?? "—"}</span>
            </div>
            {b.bowNumber ? (
                <div className="esu-boat-detail-row">
                    <span className="esu-boat-detail-label">Bow #</span>
                    <span className="esu-bow-number">#{b.bowNumber}</span>
                </div>
            ) : (
                <div className="esu-boat-detail-row">
                    <span className="esu-boat-detail-label">Bow #</span>
                    <span className="esu-muted">Not assigned yet</span>
                </div>
            )}
            <div className="esu-crew-section">
                <div className="esu-crew-section-label">Crew</div>
                {renderCrewNames(b)}
            </div>
        </li>
    );
}