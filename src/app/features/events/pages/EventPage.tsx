import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import Navbar from "../../../shared/components/Navbar/Navbar";
import Footer from "../../../shared/components/Footer/Footer.tsx";
import type { EventDoc, EventCategory, FirestoreEventDoc } from "../types";
import type { BoatSize } from "../../signup/types";
import { createBoat, listBoatsForEvent } from "../../signup/api/boats";
import { parseBoatClassFromCategory, boatSizeFromBoatClass, formatDate } from "../lib/categories";
import { collection, doc, getDoc, getDocs, query, where, documentId } from "firebase/firestore";
import { db } from "../../../shared/lib/firebase";
import { useAuth } from "../../../providers/AuthProvider";
import { useTourMock } from "../../../providers/TourMockContext";
import { TOUR_ROWER_EVENTS, TOUR_TIMING_BOATS, TOUR_USER_PROFILES } from "../../home/components/tourMockData";
import { mapEvent } from "../lib/mapper.tsx";
import OverallResults from "../../results/components/OverallResults";
import CategoryResults from "../../results/components/CategoryResults";
import { useUserProfiles } from "../../timing/useUserProfiles";
import { useAthleteRoster } from "../../coaches/hooks/useAthleteRoster";

type Tab = "overview" | "entries" | "results";

type Profile = {
    dateOfBirth?: string;
    gender?: "male" | "female";
    roles?: {
        rower?: { clubMemberships?: Array<{ clubId: string; clubName: string }> };
        coach?: Record<string, unknown>;
    };
};

type UserDoc = {
    displayName?: string;
    fullName?: string;
};

// ---------- Utility functions ----------
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

function parseCategoryParts(catName: string) {
    const parts = catName.split("•").map((s) => s.trim());
    if (parts.length !== 3) return null;
    return { gender: parts[0], division: parts[1], boatClass: parts[2] };
}

function juniorLimitFromDivision(division: string): number | null {
    const m = division.match(/^Junior\s+(\d{1,2})$/i);
    return m ? Number(m[1]) : null;
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
        const band = mastersBandFromDivision(div);
        if (!band) return false;
        if (age < band.min) return false;
        if (band.max !== null && age > band.max) return false;
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

function toTimestamp(value: number | Date | string | null | undefined): number | null {
    if (!value) return null;
    if (typeof value === "number") return value;
    if (value instanceof Date) return value.getTime();
    const parsed = new Date(value as string);
    return isNaN(parsed.getTime()) ? null : parsed.getTime();
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

function EsuBoatCard({ b, userByUid, renderCrewNames, isOwn }: {
    b: any;
    userByUid: Map<string, UserDoc>;
    renderCrewNames: (b: any) => React.ReactNode;
    isOwn?: boolean;
}) {
    const bc = parseBoatClassFromCategory(b.categoryName ?? b.category ?? "");
    const derived = bc ? boatSizeFromBoatClass(bc) : null;
    const filled = b.rowerUids?.length ?? 0;
    const total = b.boatSize ?? 0;
    // userByUid used by renderCrewNames via closure
    void userByUid;

    return (
        <li className={`esu-card esu-card--tight esu-boat-card ${isOwn ? "esu-boat-card--own" : ""}`}>
            {isOwn && <div className="esu-own-ribbon">Your entry</div>}
            <div className="esu-boat-card-header">
                <div>
                    <div className="esu-boat-club">{b.clubName}</div>
                    <div className="esu-boat-category">{b.categoryName ?? b.category}</div>
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

// ---------- Main component ----------
export default function EventPage() {
    const { eventId } = useParams<{ eventId: string }>();
    const [searchParams, setSearchParams] = useSearchParams();
    const { user, profile } = useAuth() as any;
    const { isTourActive } = useTourMock();
    const p: Profile | null = profile ?? null;

    const activeTab: Tab = (searchParams.get("tab") as Tab) || "overview";
    function setTab(t: Tab) {
        setSearchParams(t === "overview" ? {} : { tab: t }, { replace: true });
    }

    // ── Shared state ──
    const [event, setEvent] = useState<(EventDoc & { id: string }) | null>(null);
    const [boats, setBoats] = useState<any[]>([]);
    const [userByUid, setUserByUid] = useState<Map<string, UserDoc>>(new Map());
    const [loadingEvent, setLoadingEvent] = useState(true);
    const [loadingBoats, setLoadingBoats] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    // ── Entries tab state ──
    const [categoryId, setCategoryId] = useState("");
    const [busy, setBusy] = useState(false);
    const [signupErr, setSignupErr] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [filterCategory, setFilterCategory] = useState("all");
    const [filterClub, setFilterClub] = useState("all");
    const [expandedBoats, setExpandedBoats] = useState<Set<string>>(new Set());

    // ── Results tab state ──
    const [resultsTab, setResultsTab] = useState<"overall" | "category">("overall");
    const [resultsCategory, setResultsCategory] = useState<string>("All");
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 10;

    // ── Hooks for results ──
    const allUids = useMemo(() => {
        const uids = new Set<string>();
        boats.forEach(b => (b.rowerUids ?? []).forEach((uid: string) => uids.add(uid)));
        return Array.from(uids);
    }, [boats]);

    const { profiles } = useUserProfiles(allUids);
    const isCoach = !!p?.roles?.coach;
    const { roster } = useAthleteRoster(isCoach ? (user?.uid ?? null) : null);
    const linkedAthleteUids = useMemo(() => {
        if (!isCoach) return undefined;
        return new Set(roster.filter((r: any) => r.status === "active").map((r: any) => r.rowerId));
    }, [isCoach, roster]);

    // ── Data loading ──
    async function loadEvent() {
        if (!eventId) return;
        setLoadingEvent(true);
        setErr(null);
        try {
            const snap = await getDoc(doc(db, "events", eventId));
            if (!snap.exists()) { setEvent(null); return; }
            setEvent(mapEvent(snap.id, snap.data() as FirestoreEventDoc));
        } catch (e: any) {
            setErr(e?.message ?? "Failed to load event");
        } finally {
            setLoadingEvent(false);
        }
    }

    useEffect(() => {
        if (!eventId) return;
        if (isTourActive) {
            const mock = TOUR_ROWER_EVENTS.find(e => e.id === eventId) ?? TOUR_ROWER_EVENTS[0];
            setEvent(mock as any);
            setLoadingEvent(false);
            return;
        }
        void loadEvent();
    }, [eventId, isTourActive]);

    const reloadBoats = async () => {
        if (!eventId) return;
        if (isTourActive) {
            setBoats(TOUR_TIMING_BOATS as any[]);
            return;
        }
        setLoadingBoats(true);
        try { setBoats(await listBoatsForEvent(eventId)); }
        finally { setLoadingBoats(false); }
    };

    useEffect(() => { void reloadBoats(); }, [eventId, isTourActive]);

    useEffect(() => {
        if (isTourActive) {
            setUserByUid(new Map(Object.entries(TOUR_USER_PROFILES) as [string, UserDoc][]));
            return;
        }
        const uids = boats.flatMap(b => b.rowerUids ?? []);
        if (!uids.length) return;
        fetchUsersByUid(uids).then(setUserByUid);
    }, [boats, isTourActive]);

    // ── Entries: derived state ──
    const clubName = useMemo(() => p?.roles?.rower?.clubMemberships?.[0]?.clubName ?? "", [p]);
    const inviteLink = (eid: string, code: string) => `${window.location.origin}/invite/${eid}/${code}`;

    const eligibleCategories = useMemo(() => {
        if (!event || !p?.roles?.rower) return [];
        return event.categories.filter(c => isEligibleForCategory(p, c.name));
    }, [event, p]);

    useEffect(() => {
        if (!event || !eligibleCategories.length) return;
        if (!categoryId || !eligibleCategories.some(c => c.id === categoryId)) {
            setCategoryId(eligibleCategories[0].id);
        }
    }, [eligibleCategories, event, categoryId]);

    const categoryById = useMemo(() => {
        const m = new Map<string, EventCategory>();
        event?.categories.forEach(c => m.set(c.id, c));
        return m;
    }, [event]);

    const selectedCategory = categoryId ? categoryById.get(categoryId) ?? null : null;

    const derivedBoatSize: BoatSize | null = useMemo(() => {
        if (!selectedCategory) return null;
        const bc = parseBoatClassFromCategory(selectedCategory.name);
        return bc ? boatSizeFromBoatClass(bc) as BoatSize : null;
    }, [selectedCategory]);

    const alreadySignedUp = useMemo(() => {
        if (!user || !selectedCategory) return false;
        return boats.some(b => {
            const rowers: string[] = b.rowerUids ?? [];
            if (!rowers.includes(user.uid)) return false;
            if (b.categoryId) return b.categoryId === selectedCategory.id;
            return (b.categoryName ?? b.category ?? "") === selectedCategory.name;
        });
    }, [boats, user, selectedCategory]);

    const canCreate = !!user && !!p?.roles?.rower && !!event && !!selectedCategory &&
        derivedBoatSize !== null && event.status === "open" && !alreadySignedUp && !!clubName;

    const myPendingCrews = useMemo(() =>
        !user ? [] : boats.filter(b => (b.status ?? "registered") === "pending_crew" && (b.rowerUids ?? []).includes(user.uid)),
    [boats, user]);

    const myRegisteredBoats = useMemo(() =>
        !user ? [] : boats.filter(b => (b.status ?? "registered") === "registered" && (b.rowerUids ?? []).includes(user.uid)),
    [boats, user]);

    const otherRegisteredBoats = useMemo(() =>
        !user
            ? boats.filter(b => (b.status ?? "registered") === "registered")
            : boats.filter(b => (b.status ?? "registered") === "registered" && !(b.rowerUids ?? []).includes(user.uid)),
    [boats, user]);

    const registeredBoats = useMemo(() =>
        boats.filter(b => (b.status ?? "registered") === "registered"),
    [boats]);

    const filteredBoats = useMemo(() => {
        const q = search.toLowerCase().trim();
        return registeredBoats.filter(b => {
            if (filterCategory !== "all" && (b.categoryName ?? b.category) !== filterCategory) return false;
            if (filterClub !== "all" && b.clubName !== filterClub) return false;
            if (q) {
                const cat = (b.categoryName ?? b.category ?? "").toLowerCase();
                const club = (b.clubName ?? "").toLowerCase();
                const rowers = (b.rowerUids ?? []).map((u: string) => bestName(userByUid.get(u)).toLowerCase()).join(" ");
                const bow = String(b.bowNumber ?? "");
                if (!cat.includes(q) && !club.includes(q) && !rowers.includes(q) && !bow.includes(q)) return false;
            }
            return true;
        });
    }, [registeredBoats, search, filterCategory, filterClub, userByUid]);

    const groupedBoats = useMemo(() => {
        const map = new Map<string, any[]>();
        filteredBoats.forEach(b => {
            const cat = b.categoryName ?? b.category ?? "Uncategorised";
            if (!map.has(cat)) map.set(cat, []);
            map.get(cat)!.push(b);
        });
        return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
    }, [filteredBoats]);

    const allEntryCategories = useMemo(() =>
        [...new Set(registeredBoats.map(b => b.categoryName ?? b.category).filter(Boolean))].sort(),
    [registeredBoats]);

    const allClubs = useMemo(() =>
        [...new Set(registeredBoats.map(b => b.clubName).filter(Boolean))].sort(),
    [registeredBoats]);

    // ── Results: derived state ──
    const inProgressBoats = useMemo(() =>
        boats.filter(b => b.startedAt && !b.finishedAt && b.status !== "dnf" && b.status !== "dns"),
    [boats]);

    const finishedBoats = useMemo(() => {
        return boats
            .map(b => {
                const startMs = toTimestamp(b.startedAt);
                const finishMs = toTimestamp(b.finishedAt);
                const status = b.status?.toLowerCase();
                if (status === "under_review") return null;
                const isResolved = (startMs != null && finishMs != null) || status === "dnf" || status === "dns";
                if (!isResolved) return null;
                return { ...b, startedAt: startMs, finishedAt: finishMs, elapsedMs: (startMs && finishMs) ? finishMs - startMs : Infinity };
            })
            .filter((b): b is any => b !== null)
            .sort((a, b) => {
                if (a.elapsedMs === Infinity && b.elapsedMs !== Infinity) return 1;
                if (a.elapsedMs !== Infinity && b.elapsedMs === Infinity) return -1;
                if (a.elapsedMs !== b.elapsedMs) return a.elapsedMs - b.elapsedMs;
                return (a.status || "").localeCompare(b.status || "");
            });
    }, [boats]);

    const byCategory = useMemo(() => {
        const map = new Map<string, any[]>();
        for (const b of finishedBoats) {
            const cat = b.categoryName ?? b.category ?? "—";
            const list = map.get(cat) ?? [];
            list.push(b);
            map.set(cat, list);
        }
        for (const [cat, list] of map.entries()) {
            map.set(cat, [...list].sort((a, b) => a.elapsedMs - b.elapsedMs));
        }
        return map;
    }, [finishedBoats]);

    const visibleBoats = useMemo(() => {
        const mode = event?.resultsPublishMode as any;
        if (!mode || mode === "Live") return finishedBoats;
        if (mode === "Category") {
            const result: any[] = [];
            for (const [, boatsInCat] of byCategory.entries()) {
                if (boatsInCat.every(b => toTimestamp(b.finishedAt) != null)) result.push(...boatsInCat);
            }
            return result;
        }
        if (mode === "Event") {
            return boats.every(b => toTimestamp(b.finishedAt) != null) ? finishedBoats : [];
        }
        return finishedBoats;
    }, [event?.resultsPublishMode, finishedBoats, byCategory, boats]);

    const paginatedBoats = useMemo(() => {
        const start = (page - 1) * PAGE_SIZE;
        const end = start + PAGE_SIZE;
        if (resultsTab === "overall") return visibleBoats.slice(start, end);
        const pool = resultsCategory === "All"
            ? Array.from(byCategory.values()).flat().filter(b => visibleBoats.includes(b))
            : (byCategory.get(resultsCategory) || []).filter(b => visibleBoats.includes(b));
        return pool.slice(start, end);
    }, [resultsTab, page, visibleBoats, byCategory, resultsCategory]);

    const totalPages = useMemo(() => {
        const total = resultsTab === "overall"
            ? visibleBoats.length
            : resultsCategory === "All"
                ? Array.from(byCategory.values()).flat().filter(b => visibleBoats.includes(b)).length
                : (byCategory.get(resultsCategory)?.filter(b => visibleBoats.includes(b)).length || 0);
        return Math.ceil(total / PAGE_SIZE);
    }, [resultsTab, byCategory, visibleBoats, resultsCategory]);

    // ── Helpers ──
    function renderCrewNames(b: any) {
        const uids: string[] = Array.isArray(b.rowerUids) ? b.rowerUids : [];
        if (!uids.length) return <p className="esu-muted">No crew yet.</p>;
        return (
            <ul className="esu-crew-list">
                {uids.map(uid => (
                    <li key={uid}>
                        <span className="esu-crew-avatar">{bestName(userByUid.get(uid)).charAt(0)}</span>
                        <span>{bestName(userByUid.get(uid))}</span>
                        {user?.uid === uid && <span className="esu-you-tag">you</span>}
                    </li>
                ))}
            </ul>
        );
    }

    async function onCreateBoat() {
        if (!canCreate || !selectedCategory || !derivedBoatSize || !eventId || !user) return;
        setSignupErr(null);
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
            setSignupErr(e?.message ?? "Failed to sign up");
        } finally {
            setBusy(false);
        }
    }

    // ── Tab renders ──
    function renderOverviewTab() {
        if (!event) return null;

        return (
            <div>
                <div className="esu-card">
                    <h3 className="esu-card-section-title">Event Details</h3>
                    <div className="esu-detail-grid">
                        <div className="esu-detail-row">
                            <span className="esu-detail-label">Location</span>
                            <span>{event.location}</span>
                        </div>
                        <div className="esu-detail-row">
                            <span className="esu-detail-label">Date</span>
                            <span>{formatDate(event.startDate)}</span>
                        </div>
                        <div className="esu-detail-row">
                            <span className="esu-detail-label">Course</span>
                            <span>{event.lengthMeters}m</span>
                        </div>
                        {event.closingDate && (
                            <div className="esu-detail-row">
                                <span className="esu-detail-label">Entries close</span>
                                <span>{formatDate(event.closingDate)}</span>
                            </div>
                        )}
                        <div className="esu-detail-row">
                            <span className="esu-detail-label">Status</span>
                            <EsuStatusPill status={event.status} />
                        </div>
                        {event.categories.length > 0 && (
                            <div className="esu-detail-row">
                                <span className="esu-detail-label">Categories</span>
                                <span>{event.categories.length}</span>
                            </div>
                        )}
                    </div>
                    {event.description && (
                        <p className="esu-event-description">{event.description}</p>
                    )}
                </div>
            </div>
        );
    }

    function renderEntriesTab() {
        if (!event) return null;
        return (
            <div>
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
                                Sign-up is available for rowers only. The start list is shown below.
                            </p>
                        </div>
                    </div>
                ) : event.status !== "open" ? (
                    <div className="esu-card esu-info-card">
                        <div className="esu-info-icon">🔒</div>
                        <div>
                            <strong>Registration is {event.status}</strong>
                            <p className="esu-muted" style={{ margin: "4px 0 0" }}>Sign-up is no longer available for this event.</p>
                        </div>
                    </div>
                ) : (
                    <div className="esu-card esu-signup-card" data-tour="signup-form">
                        <h3 className="esu-card-section-title">Enter a category</h3>
                        {eligibleCategories.length === 0 ? (
                            <p className="esu-muted">No eligible categories found for your profile.</p>
                        ) : (
                            <>
                                <label className="esu-field-label">
                                    Category
                                    <div className="esu-custom-select">
                                        <select value={categoryId} onChange={e => setCategoryId(e.target.value)}>
                                            {eligibleCategories.map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </label>
                                <div className="esu-signup-meta-row">
                                    {derivedBoatSize && (
                                        <span className="esu-badge esu-badge--brand">🚣 {boatSizeLabel(derivedBoatSize)}</span>
                                    )}
                                    {alreadySignedUp && <span className="esu-already-tag">✓ Already entered</span>}
                                    {!clubName && <span className="esu-error-text">⚠ No club set on your profile</span>}
                                </div>
                                {successMsg && <div className="esu-success-banner">{successMsg}</div>}
                                {signupErr && <div className="esu-error-banner">{signupErr}</div>}
                                <button className="esu-btn-primary esu-signup-btn" disabled={!canCreate || busy} onClick={onCreateBoat}>
                                    {busy ? <span className="esu-btn-loading">Signing up…</span>
                                        : derivedBoatSize && derivedBoatSize > 1 ? "Create crew & get invite link"
                                        : "Register →"}
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
                            {myPendingCrews.map(b => {
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
                                        <div className="esu-waiting-tag">⏳ Waiting for {waiting} more rower{waiting !== 1 ? "s" : ""}</div>
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
                <section className="esu-section" data-tour="signup-start-list">
                    <h2 className="esu-section-title">
                        <span>Start list</span>
                        {!loadingBoats && <span className="esu-section-count">{registeredBoats.length} entries</span>}
                    </h2>

                    {registeredBoats.length > 0 && (
                        <div className="esu-search-row">
                            <input
                                className="esu-search-input"
                                placeholder="Search club, category, rower, bow number"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                            <div className="esu-filter-selects">
                                <div className="esu-custom-select">
                                    <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
                                        <option value="all">All categories</option>
                                        {allEntryCategories.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div className="esu-custom-select">
                                    <select value={filterClub} onChange={e => setFilterClub(e.target.value)}>
                                        <option value="all">All clubs</option>
                                        {allClubs.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {loadingBoats ? (
                        <div className="esu-boats-grid">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="esu-card esu-card--tight esu-skeleton-card">
                                    <div className="esu-skeleton-bar" style={{ height: 18, width: "70%", marginBottom: 8 }} />
                                    <div className="esu-skeleton-bar" style={{ height: 14, width: "50%" }} />
                                </div>
                            ))}
                        </div>
                    ) : registeredBoats.length === 0 ? (
                        <p className="esu-muted esu-empty-state">No boats registered yet — be the first!</p>
                    ) : filteredBoats.length === 0 ? (
                        <p className="esu-muted esu-empty-state">No entries match your search.</p>
                    ) : user ? (
                        <>
                            {myRegisteredBoats.filter(b => filteredBoats.includes(b)).length > 0 && (
                                <>
                                    <div className="esu-subsection-label">Your entries</div>
                                    <ul className="esu-boats-grid">
                                        {myRegisteredBoats.filter(b => filteredBoats.includes(b)).map(b => (
                                            <EsuBoatCard key={b.id} b={b} userByUid={userByUid} renderCrewNames={renderCrewNames} isOwn />
                                        ))}
                                    </ul>
                                </>
                            )}
                            {otherRegisteredBoats.filter(b => filteredBoats.includes(b)).length > 0 && (
                                <>
                                    {myRegisteredBoats.length > 0 && <div className="esu-subsection-label">Other entries</div>}
                                    <ul className="esu-boats-grid">
                                        {otherRegisteredBoats.filter(b => filteredBoats.includes(b)).map(b => (
                                            <EsuBoatCard key={b.id} b={b} userByUid={userByUid} renderCrewNames={renderCrewNames} />
                                        ))}
                                    </ul>
                                </>
                            )}
                        </>
                    ) : (
                        groupedBoats.map(([category, catBoats]) => (
                            <div key={category} className="esu-category-group">
                                <div className="esu-category-group-label">{category}</div>
                                <ul className="esu-boats-grid">
                                    {catBoats.map(b => {
                                        const filled = b.rowerUids?.length ?? 0;
                                        const total = b.boatSize ?? 0;
                                        return (
                                            <li key={b.id} className="esu-card esu-card--tight esu-boat-card">
                                                <div className="esu-boat-card-header">
                                                    <div>
                                                        {b.bowNumber && <div className="esu-bow-number">#{b.bowNumber}</div>}
                                                        <div className="esu-boat-club">{b.clubName}</div>
                                                        <div className="esu-boat-category">{b.categoryName ?? b.category}</div>
                                                    </div>
                                                    <EsuSeatDots filled={filled} total={total} />
                                                </div>
                                                <button
                                                    className="esu-crew-toggle"
                                                    onClick={() => setExpandedBoats(prev => {
                                                        const next = new Set(prev);
                                                        next.has(b.id) ? next.delete(b.id) : next.add(b.id);
                                                        return next;
                                                    })}
                                                >
                                                    Crew ({filled}/{total})
                                                </button>
                                                {expandedBoats.has(b.id) && (
                                                    <ul className="esu-crew-list">
                                                        {(b.rowerUids ?? []).map((uid: string) => (
                                                            <li key={uid}>
                                                                <span className="esu-crew-avatar">{bestName(userByUid.get(uid)).charAt(0)}</span>
                                                                <span>{bestName(userByUid.get(uid))}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        ))
                    )}
                </section>
            </div>
        );
    }

    function renderResultsTab() {
        if (loadingBoats) return <p className="esu-muted esu-empty-state">Loading results…</p>;
        if (finishedBoats.length === 0) return (
            <div className="esu-card" style={{ textAlign: "center", padding: "2.5rem 1.5rem" }}>
                <div style={{ fontSize: "2rem", marginBottom: "0.75rem", opacity: 0.25 }}>⏱</div>
                <div style={{ fontWeight: 600, fontSize: "1rem", color: "rgba(255,255,255,0.7)", marginBottom: "0.4rem" }}>Results not yet published</div>
                <div style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.3)", maxWidth: 320, margin: "0 auto" }}>
                    Results will appear here once the event is underway. Check back closer to race day.
                </div>
            </div>
        );

        return (
            <div>
                <div className="esu-results-subtabs">
                    {(["overall", "category"] as const).map(t => (
                        <button
                            key={t}
                            className={`esu-results-subtab ${resultsTab === t ? "esu-results-subtab--active" : ""}`}
                            onClick={() => { setResultsTab(t); setPage(1); }}
                        >
                            {t === "overall" ? "Overall" : "By Category"}
                        </button>
                    ))}
                    <button className="esu-results-subtab esu-results-subtab--refresh" onClick={reloadBoats}>
                        Refresh
                    </button>
                </div>

                {resultsTab === "category" && (
                    <div className="esu-results-filter">
                        <span className="esu-muted">Filter by category:</span>
                        <div className="esu-custom-select">
                            <select value={resultsCategory} onChange={e => { setResultsCategory(e.target.value); setPage(1); }}>
                                <option value="All">All</option>
                                {Array.from(byCategory.keys()).map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                )}

                <hr className="esu-hr" />

                {resultsTab === "overall" ? (
                    <OverallResults
                        boats={paginatedBoats}
                        inProgressBoats={inProgressBoats}
                        profiles={profiles}
                        page={page}
                        pageSize={PAGE_SIZE}
                        currentUserUid={user?.uid}
                        linkedAthleteUids={linkedAthleteUids}
                    />
                ) : (
                    <CategoryResults
                        byCategory={byCategory}
                        selectedCategory={resultsCategory}
                        inProgressBoats={inProgressBoats}
                        profiles={profiles}
                        page={page}
                        pageSize={PAGE_SIZE}
                        currentUserUid={user?.uid}
                        linkedAthleteUids={linkedAthleteUids}
                    />
                )}

                {finishedBoats.length > PAGE_SIZE && resultsTab === "overall" && (
                    <div className="esu-pagination">
                        <button className="esu-btn-primary" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</button>
                        <span className="esu-muted">Page {page} of {totalPages}</span>
                        <button className="esu-btn-primary" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
                    </div>
                )}
            </div>
        );
    }

    // ── Render ──
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
                    ) : !event ? (
                        <div className="esu-card"><h2>Event not found</h2></div>
                    ) : (
                        <>
                            <div className="esu-event-header">
                                <div className="esu-header-top-row">
                                    <h1>{event.name}</h1>
                                    <EsuStatusPill status={event.status} />
                                </div>
                                <div className="esu-event-meta">
                                    <span className="esu-meta-item">{event.location}</span>
                                    <span className="esu-meta-item">{formatDate(event.startDate)}</span>
                                    <span className="esu-meta-item">{event.lengthMeters}m</span>
                                </div>
                            </div>

                            <div className="esu-tab-bar">
                                {(["overview", "entries", "results"] as Tab[]).map(t => (
                                    <button
                                        key={t}
                                        className={`esu-tab-btn ${activeTab === t ? "esu-tab-btn--active" : ""}`}
                                        onClick={() => setTab(t)}
                                    >
                                        {t === "overview" ? "Overview" : t === "entries" ? "Entries" : "Results"}
                                    </button>
                                ))}
                            </div>

                            {activeTab === "overview" && renderOverviewTab()}
                            {activeTab === "entries" && renderEntriesTab()}
                            {activeTab === "results" && renderResultsTab()}
                        </>
                    )}
                </div>
            </main>
            <Footer />
        </>
    );
}
