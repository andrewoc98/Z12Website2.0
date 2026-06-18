import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

const StripeCheckoutModal = lazy(() => import("../../signup/components/StripeCheckoutModal"));
import Navbar from "../../../shared/components/Navbar/Navbar";
import Footer from "../../../shared/components/Footer/Footer.tsx";
import type { EventDoc, EventCategory, FirestoreEventDoc, EventSeriesType } from "../types";
import type { BoatSize } from "../../signup/types";
import { createBoat, createBoatAsCoach, listBoatsForEvent } from "../../signup/api/boats";
import { parseBoatClassFromCategory, boatSizeFromBoatClass, formatDate } from "../lib/categories";
import { collection, doc, getDoc, getDocs, query, where, documentId, onSnapshot } from "firebase/firestore";
import { db } from "../../../shared/lib/firebase";
import { useAuth } from "../../../providers/AuthProvider";
import { useTourMock } from "../../../providers/TourMockContext";
import { TOUR_ROWER_EVENTS, TOUR_TIMING_BOATS, TOUR_USER_PROFILES } from "../../home/components/tourMockData";
import { mapEvent } from "../lib/mapper.tsx";
import OverallResults from "../../results/components/OverallResults";
import CategoryResults from "../../results/components/CategoryResults";
import { useUserProfiles } from "../../timing/useUserProfiles";
import { useAthleteRoster } from "../../coaches/hooks/useAthleteRoster";
import CrewInvitePanel from "../components/CrewInvitePanel";
import { removeCrewMember, submitReview } from "../../admin/services/stripeService";
import { removeCrewMemberAsCreator } from "../../signup/services/crewInviteService";

type Tab = "overview" | "entries" | "results" | "reviews";

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

// ---------- Series strip ----------
const SERIES_TIER: Record<EventSeriesType, {
    label: string;
    icon: string;
    stripBg: string;
    stripText: string;
    stripPadding: string;
    stripFontSize: string;
    stripFontWeight: number;
    stripLetterSpacing: string;
    borderColor: string;
    cardShadow?: string;
}> = {
    regional_series: {
        label:              "Regional Series",
        icon:               "◈",
        stripBg:            "rgba(255,212,0,0.07)",
        stripText:          "rgba(255,212,0,0.5)",
        stripPadding:       "4px 24px",
        stripFontSize:      "0.62rem",
        stripFontWeight:    700,
        stripLetterSpacing: "0.10em",
        borderColor:        "rgba(255,212,0,0.35)",
    },
    national_series: {
        label:              "National Series",
        icon:               "◉",
        stripBg:            "rgba(255,212,0,0.14)",
        stripText:          "#ffd400",
        stripPadding:       "7px 24px",
        stripFontSize:      "0.68rem",
        stripFontWeight:    800,
        stripLetterSpacing: "0.13em",
        borderColor:        "rgba(255,212,0,0.65)",
    },
    national_event: {
        label:              "National Event",
        icon:               "★",
        stripBg:            "#ffd400",
        stripText:          "#141414",
        stripPadding:       "9px 24px",
        stripFontSize:      "0.75rem",
        stripFontWeight:    800,
        stripLetterSpacing: "0.15em",
        borderColor:        "#ffd400",
        cardShadow:         "0 0 0 1px rgba(255,212,0,0.25), 0 0 24px rgba(255,212,0,0.1)",
    },
};

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
        setSearchParams(t === "overview" ? {} : { tab: t }, { replace: false });
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
    const [showCheckout, setShowCheckout] = useState(false);
    const [clubCountry,  setClubCountry]  = useState<string | null>(null);
    const [hostClubName, setHostClubName] = useState<string | null>(null);

    // ── Bookings (payer view for crew removal) ──
    const [myEventBookings, setMyEventBookings] = useState<any[]>([]);

    // ── Entry mode toggle for dual-role users ──
    const [entryMode, setEntryMode] = useState<"rower" | "coach">("rower");

    // ── Reviews tab state ──
    const [reviews,       setReviews]       = useState<any[]>([]);
    const [myReview,      setMyReview]      = useState<any | null>(null);
    const [reviewRating,  setReviewRating]  = useState(0);
    const [reviewComment, setReviewComment] = useState("");
    const [reviewBusy,    setReviewBusy]    = useState(false);
    const [reviewErr,     setReviewErr]     = useState<string | null>(null);
    const [reviewDone,    setReviewDone]    = useState(false);

    const avgRating = reviews.length
        ? reviews.reduce((s: number, r: any) => s + (r.rating ?? 0), 0) / reviews.length
        : null;

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
            const eventData = mapEvent(snap.id, snap.data() as FirestoreEventDoc);
            setEvent(eventData);
            if (eventData.clubId) {
                try {
                    const clubSnap = await getDoc(doc(db, "clubs", eventData.clubId));
                    setClubCountry(clubSnap.data()?.location?.country ?? null);
                    setHostClubName(clubSnap.data()?.name ?? null);
                } catch {
                    // Club info unavailable (e.g. unauthenticated) — not a critical failure
                }
            }
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

    // Load all reviews for the club that hosted this event (real-time)
    useEffect(() => {
        if (!event?.clubId || isTourActive) return;
        const q = query(collection(db, "reviews"), where("clubId", "==", event.clubId));
        return onSnapshot(q, (snap) => {
            const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setReviews(all);
            if (user?.uid) setMyReview(all.find((r: any) => r.eventId === eventId && r.reviewerUid === user.uid) ?? null);
        });
    }, [event?.clubId, isTourActive, user?.uid]);

    // Load the current user's paid bookings for this event (for crew removal)
    useEffect(() => {
        if (!eventId || !user?.uid || isTourActive) return;
        const q = query(
            collection(db, "bookings"),
            where("eventId",  "==", eventId),
            where("payerUid", "==", user.uid)
        );
        return onSnapshot(q, (snap) => {
            setMyEventBookings(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
    }, [eventId, user?.uid, isTourActive]);

    // ── Entries: derived state ──
    const rowerClubName = useMemo(() => p?.roles?.rower?.clubMemberships?.[0]?.clubName ?? "", [p]);
    const coachClubName = useMemo(() => (p?.roles?.coach?.clubMemberships as any[])?.[0]?.clubName ?? "", [p]);
    // For display / boat creation use whichever club is available
    const clubName = rowerClubName || coachClubName;
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
    const selectedCategoryFee = selectedCategory?.feeCents ?? 0;
    const requiresPayment = selectedCategoryFee > 0 && clubCountry === "US";

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

    // Coaches pick categories with a quantity per category (Map<categoryId, count>)
    const [coachSelectedCounts, setCoachSelectedCounts] = useState<Map<string, number>>(new Map());
    const [coachSearch,         setCoachSearch]         = useState("");

    const filteredCoachCategories = useMemo(() => {
        if (!event) return [];
        const q = coachSearch.toLowerCase().trim();
        if (!q) return event.categories;
        return event.categories.filter(c => c.name.toLowerCase().includes(q));
    }, [event, coachSearch]);

    const totalCoachBoats = useMemo(() =>
        Array.from(coachSelectedCounts.values()).reduce((sum, n) => sum + n, 0),
    [coachSelectedCounts]);

    const canCreateAsCoach = !!user && !!p?.roles?.coach &&
        !!event && totalCoachBoats > 0 && event.status === "open";

    const myPendingCrews = useMemo(() =>
        !user ? [] : boats.filter(b =>
            (b.status ?? "registered") === "pending_crew" &&
            ((b.rowerUids ?? []).includes(user.uid) || (b as any).createdByUid === user.uid)
        ),
    [boats, user]);

    const myRegisteredBoats = useMemo(() =>
        !user ? [] : boats.filter(b =>
            b.status !== "pending_crew" &&
            ((b.rowerUids ?? []).includes(user.uid) || (b as any).createdByUid === user.uid)
        ),
    [boats, user]);

    const otherRegisteredBoats = useMemo(() =>
        !user
            ? boats.filter(b => b.status !== "pending_crew")
            : boats.filter(b =>
                b.status !== "pending_crew" &&
                !(b.rowerUids ?? []).includes(user.uid) &&
                (b as any).createdByUid !== user.uid
            ),
    [boats, user]);

    const registeredBoats = useMemo(() =>
        boats.filter(b => b.status !== "pending_crew"),
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
    function renderCrewNames(b: any, allowRemove = false) {
        const uids: string[] = Array.isArray(b.rowerUids) ? b.rowerUids : [];
        const isPayer     = myEventBookings.some(bk => bk.boatId === b.id);
        const isCreator   = !!user && b.createdByUid === user.uid;
        const closingMs   = event?.closingDate ? new Date(event.closingDate).getTime() : null;
        const regClosed   = closingMs != null && Date.now() > closingMs;
        const canRemove   = allowRemove && (isPayer || isCreator) && !regClosed;
        if (!uids.length) return <p className="esu-muted">No crew yet.</p>;
        return (
            <ul className="esu-crew-list">
                {uids.map(uid => (
                    <li key={uid} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span className="esu-crew-avatar">{bestName(userByUid.get(uid)).charAt(0)}</span>
                            <span>{bestName(userByUid.get(uid))}</span>
                            {user?.uid === uid && <span className="esu-you-tag">you</span>}
                        </span>
                        {canRemove && uid !== user?.uid && (
                            <button
                                onClick={() => onRemoveCrewMember(b.id, uid)}
                                title="Remove from crew"
                                style={{
                                    background: "transparent",
                                    border: "1px solid rgba(255,107,107,0.3)",
                                    color: "#ff6b6b",
                                    borderRadius: 4,
                                    padding: "1px 7px",
                                    fontSize: 11,
                                    cursor: "pointer",
                                    fontWeight: 600,
                                    lineHeight: 1.6,
                                }}
                            >
                                ×
                            </button>
                        )}
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

    async function onCreateBoatAsCoach() {
        console.log("[coach] onCreateBoatAsCoach called", { canCreateAsCoach, event: !!event, eventId, user: user?.uid, totalCoachBoats, coachSelectedCounts: Object.fromEntries(coachSelectedCounts) });
        if (!canCreateAsCoach || !event || !eventId || !user) {
            console.log("[coach] early return — canCreateAsCoach:", canCreateAsCoach, "event:", !!event, "eventId:", eventId, "user:", user?.uid);
            return;
        }
        setSignupErr(null);
        setSuccessMsg(null);
        setBusy(true);
        try {
            const tasks: Promise<string>[] = [];
            for (const [catId, count] of coachSelectedCounts.entries()) {
                if (count === 0) continue;
                const cat = event.categories.find(c => c.id === catId);
                if (!cat) { console.log("[coach] cat not found for", catId); continue; }
                const bc   = parseBoatClassFromCategory(cat.name);
                const size = bc ? boatSizeFromBoatClass(bc) as BoatSize : null;
                console.log("[coach] category", cat.name, "→ bc:", bc, "size:", size);
                if (!size) { console.log("[coach] skipping — no size for", cat.name); continue; }
                for (let i = 0; i < count; i++) {
                    tasks.push(createBoatAsCoach({
                        eventId,
                        categoryId:   cat.id,
                        categoryName: cat.name,
                        category:     cat.name,
                        clubName,
                        boatSize:     size,
                        coachUid:     user.uid,
                        adjustmentMs: 0,
                    }));
                }
            }
            console.log("[coach] tasks queued:", tasks.length);
            await Promise.all(tasks);
            console.log("[coach] all tasks resolved");
            await reloadBoats();
            setCoachSelectedCounts(new Map());
            const n = tasks.length;
            setSuccessMsg(`${n} ${n === 1 ? "entry" : "entries"} created! Share the invite links with your crews.`);
        } catch (e: any) {
            console.error("[coach] error:", e);
            setSignupErr(e?.message ?? "Failed to create entries");
        } finally {
            setBusy(false);
        }
    }

    async function onRemoveCrewMember(boatId: string, targetUid: string) {
        if (!eventId) return;
        try {
            const booking = myEventBookings.find(bk => bk.boatId === boatId);
            if (booking) {
                await removeCrewMember({ bookingId: booking.id, targetUid });
            } else {
                await removeCrewMemberAsCreator({ eventId, boatId, targetUid });
            }
            await reloadBoats();
        } catch (e: any) {
            setSignupErr(e?.message ?? "Failed to remove crew member.");
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
                        {hostClubName && (
                            <div className="esu-detail-row">
                                <span className="esu-detail-label">Hosted by</span>
                                <span>{hostClubName}</span>
                            </div>
                        )}
                        {avgRating !== null && (
                            <div className="esu-detail-row">
                                <span className="esu-detail-label">Club rating</span>
                                <button
                                    onClick={() => setTab("reviews")}
                                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                                >
                                    <span style={{ color: "#FEB959", fontSize: 14 }}>
                                        {"★".repeat(Math.round(avgRating))}{"☆".repeat(5 - Math.round(avgRating))}
                                    </span>
                                    <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>
                                        {avgRating.toFixed(1)} ({reviews.length})
                                    </span>
                                </button>
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
        const closingMs = toTimestamp(event.closingDate);
        const isRegistrationClosed = closingMs != null && Date.now() > closingMs;
        return (
            <div>
                {myRegisteredBoats.length > 0 && (
                    <div className="esu-entries-banner">
                        <span className="esu-banner-icon">✓</span>
                        <span>You have <strong>{myRegisteredBoats.length}</strong> registered {myRegisteredBoats.length === 1 ? "entry" : "entries"} in this event.</span>
                    </div>
                )}

                {/* ── Sign-up card ── */}
                {(() => {
                    const hasRower = !!p?.roles?.rower;
                    const hasCoach = !!p?.roles?.coach;
                    const hasBoth  = hasRower && hasCoach;
                    const mode     = hasBoth ? entryMode : (hasRower ? "rower" : "coach");
                    const fmtFee   = (c: number) =>
                        new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(c / 100);

                    if (!hasRower && !hasCoach) return (
                        <div className="esu-card esu-info-card">
                            <div className="esu-info-icon">ℹ</div>
                            <div>
                                <strong>Registration for rowers and coaches</strong>
                                <p className="esu-muted" style={{ margin: "4px 0 0" }}>
                                    Sign in with a rower or coach account to enter this event.
                                </p>
                            </div>
                        </div>
                    );

                    if (event.status !== "open") return (
                        <div className="esu-card esu-info-card">
                            <div className="esu-info-icon">🔒</div>
                            <div>
                                <strong>Registration is {event.status}</strong>
                                <p className="esu-muted" style={{ margin: "4px 0 0" }}>Sign-up is no longer available for this event.</p>
                            </div>
                        </div>
                    );

                    if (isRegistrationClosed) return (
                        <div className="esu-card" style={{ display: "flex", alignItems: "flex-start", gap: "1rem" }}>
                            <div style={{ fontSize: "1.25rem", lineHeight: 1, marginTop: "2px", opacity: 0.5 }}>🗓</div>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: "0.95rem", color: "rgba(255,255,255,0.8)", marginBottom: "0.3rem" }}>Registration deadline passed</div>
                                <div style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.4)" }}>
                                    Entries closed on {formatDate(event.closingDate)}. The start list is shown below.
                                </div>
                            </div>
                        </div>
                    );

                    // ── Primary action label for the button ──
                    const rowerLabel = busy ? "Signing up…"
                        : requiresPayment ? `Pay & enter as rower — ${fmtFee(selectedCategoryFee)}`
                        : derivedBoatSize && derivedBoatSize > 1 ? "Create crew as rower →"
                        : "Register as rower →";

                    const coachLabel = busy
                        ? "Creating entries…"
                        : totalCoachBoats === 0
                            ? "Select categories above"
                            : totalCoachBoats === 1
                                ? "Create 1 entry & get invite link →"
                                : `Create ${totalCoachBoats} entries & get invite links →`;

                    return (
                        <div className="esu-card esu-signup-card" data-tour="signup-form">
                            <h3 className="esu-card-section-title">
                                {mode === "rower" ? "Enter a category" : "Enter a crew (coach)"}
                            </h3>

                            {/* Mode toggle — only shown for users with both rower and coach roles */}
                            {hasBoth && (
                                <div style={{
                                    display: "flex", background: "var(--surface-2)",
                                    borderRadius: 8, padding: 3, marginBottom: 14, gap: 3,
                                }}>
                                    {(["rower", "coach"] as const).map(m => (
                                        <button
                                            key={m}
                                            onClick={() => setEntryMode(m)}
                                            style={{
                                                flex: 1, padding: "7px 10px", borderRadius: 6,
                                                background: mode === m ? "#FEB959" : "transparent",
                                                color: mode === m ? "#141414" : "rgba(255,255,255,0.5)",
                                                border: "none", cursor: "pointer",
                                                fontSize: 13, fontWeight: mode === m ? 700 : 400,
                                                transition: "all 0.15s",
                                            }}
                                        >
                                            {m === "rower" ? "🚣 Enter as Rower" : "🎽 Enter as Coach"}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Category selector */}
                            {mode === "rower" ? (
                                eligibleCategories.length === 0 ? (
                                    <p className="esu-muted">No eligible categories found for your profile.</p>
                                ) : (
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
                                )
                            ) : (
                                event.categories.length === 0 ? (
                                    <p className="esu-muted">No categories available.</p>
                                ) : (
                                    <div>
                                        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                                            <input
                                                type="text"
                                                placeholder={`Search ${event.categories.length} categories…`}
                                                value={coachSearch}
                                                onChange={e => setCoachSearch(e.target.value)}
                                                style={{
                                                    flex: 1, padding: "7px 10px", borderRadius: 6,
                                                    border: "1px solid var(--border)",
                                                    background: "var(--surface-2)", color: "var(--text)",
                                                    fontSize: 13,
                                                }}
                                            />
                                            {totalCoachBoats > 0 && (
                                                <button
                                                    onClick={() => setCoachSelectedCounts(new Map())}
                                                    style={{
                                                        background: "transparent",
                                                        border: "1px solid var(--border)",
                                                        color: "rgba(255,255,255,0.5)",
                                                        borderRadius: 6, padding: "6px 10px",
                                                        fontSize: 12, cursor: "pointer", whiteSpace: "nowrap",
                                                    }}
                                                >
                                                    Clear all
                                                </button>
                                            )}
                                        </div>

                                        <div style={{
                                            maxHeight: 240, overflowY: "auto",
                                            border: "1px solid var(--border)", borderRadius: 8,
                                            background: "var(--surface-2)",
                                        }}>
                                            {filteredCoachCategories.length === 0 ? (
                                                <p style={{ padding: "12px 14px", margin: 0, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
                                                    No categories match "{coachSearch}"
                                                </p>
                                            ) : filteredCoachCategories.map((c, i) => {
                                                const bc    = parseBoatClassFromCategory(c.name);
                                                const size  = bc ? boatSizeFromBoatClass(bc) : null;
                                                const count = coachSelectedCounts.get(c.id) ?? 0;
                                                return (
                                                    <div key={c.id} style={{
                                                        display: "flex", alignItems: "center", gap: 10,
                                                        padding: "8px 12px",
                                                        borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.06)",
                                                        background: count > 0 ? "rgba(254,185,89,0.06)" : "transparent",
                                                        transition: "background 0.1s",
                                                    }}>
                                                        <span style={{ flex: 1, fontSize: 13, color: count > 0 ? "#f0eee8" : "rgba(255,255,255,0.7)" }}>
                                                            {c.name}
                                                        </span>
                                                        {size && (
                                                            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", whiteSpace: "nowrap" }}>
                                                                {boatSizeLabel(size)}
                                                            </span>
                                                        )}
                                                        <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                                                            <button
                                                                onClick={() => setCoachSelectedCounts(prev => {
                                                                    const next = new Map(prev);
                                                                    const curr = next.get(c.id) ?? 0;
                                                                    if (curr <= 1) next.delete(c.id);
                                                                    else next.set(c.id, curr - 1);
                                                                    return next;
                                                                })}
                                                                disabled={count === 0}
                                                                style={{
                                                                    width: 22, height: 22, borderRadius: 4, padding: 0,
                                                                    background: count > 0 ? "rgba(254,185,89,0.15)" : "rgba(255,255,255,0.04)",
                                                                    border: "1px solid rgba(255,255,255,0.1)",
                                                                    color: count > 0 ? "#FEB959" : "rgba(255,255,255,0.2)",
                                                                    fontSize: 15, cursor: count > 0 ? "pointer" : "default",
                                                                    display: "flex", alignItems: "center", justifyContent: "center",
                                                                }}
                                                            >
                                                                −
                                                            </button>
                                                            <span style={{
                                                                fontSize: 13, minWidth: 16, textAlign: "center",
                                                                fontWeight: count > 0 ? 700 : 400,
                                                                color: count > 0 ? "#FEB959" : "rgba(255,255,255,0.3)",
                                                            }}>
                                                                {count}
                                                            </span>
                                                            <button
                                                                onClick={() => setCoachSelectedCounts(prev => {
                                                                    const next = new Map(prev);
                                                                    next.set(c.id, (next.get(c.id) ?? 0) + 1);
                                                                    return next;
                                                                })}
                                                                style={{
                                                                    width: 22, height: 22, borderRadius: 4, padding: 0,
                                                                    background: "rgba(254,185,89,0.15)",
                                                                    border: "1px solid rgba(254,185,89,0.3)",
                                                                    color: "#FEB959", fontSize: 15, cursor: "pointer",
                                                                    display: "flex", alignItems: "center", justifyContent: "center",
                                                                }}
                                                            >
                                                                +
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {filteredCoachCategories.length > 0 && (
                                            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
                                                <button
                                                    onClick={() => setCoachSelectedCounts(prev => {
                                                        const next = new Map(prev);
                                                        filteredCoachCategories.forEach(c => {
                                                            if (!next.has(c.id)) next.set(c.id, 1);
                                                        });
                                                        return next;
                                                    })}
                                                    style={{
                                                        background: "transparent", border: "none",
                                                        color: "#FEB959", fontSize: 12, cursor: "pointer",
                                                        padding: "2px 0", textDecoration: "underline",
                                                    }}
                                                >
                                                    Set all to 1
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )
                            )}

                            {/* Meta badges */}
                            <div className="esu-signup-meta-row">
                                {mode === "rower" && derivedBoatSize && (
                                    <span className="esu-badge esu-badge--brand">🚣 {boatSizeLabel(derivedBoatSize)}</span>
                                )}
                                {mode === "coach" && totalCoachBoats > 0 && (
                                    <span className="esu-badge esu-badge--brand">
                                        {totalCoachBoats} {totalCoachBoats === 1 ? "entry" : "entries"} queued
                                    </span>
                                )}
                                {mode === "rower" && alreadySignedUp && (
                                    <span className="esu-already-tag">✓ Already entered</span>
                                )}
                                {!clubName && (
                                    <span className="esu-error-text">⚠ No club set on your profile</span>
                                )}
                            </div>

                            {/* Fee badge (rower mode, paid event) */}
                            {mode === "rower" && selectedCategoryFee > 0 && (
                                <div className="esu-fee-badge">
                                    <span className="esu-fee-label">Entry fee</span>
                                    <span className="esu-fee-amount">{fmtFee(selectedCategoryFee)}</span>
                                </div>
                            )}

                            {successMsg && <div className="esu-success-banner">{successMsg}</div>}
                            {signupErr   && <div className="esu-error-banner">{signupErr}</div>}

                            {/* ── Action button ── */}
                            {mode === "rower" ? (
                                <button
                                    className="esu-btn-primary esu-signup-btn"
                                    disabled={!canCreate || busy}
                                    onClick={requiresPayment ? () => setShowCheckout(true) : onCreateBoat}
                                >
                                    {busy ? (
                                        <span className="esu-btn-loading">Signing up…</span>
                                    ) : rowerLabel}
                                </button>
                            ) : (
                                <button
                                    className="esu-btn-primary esu-signup-btn"
                                    disabled={!canCreateAsCoach || busy}
                                    onClick={onCreateBoatAsCoach}
                                >
                                    {busy ? (
                                        <span className="esu-btn-loading">Creating entries…</span>
                                    ) : coachLabel}
                                </button>
                            )}
                        </div>
                    );
                })()}

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
                                            {renderCrewNames(b, true)}
                                        </div>
                                        <CrewInvitePanel
                                            boat={b as any}
                                            eventId={eventId!}
                                            inviteUrl={url}
                                            onAthleteAdded={reloadBoats}
                                        />
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
                                            <EsuBoatCard key={b.id} b={b} userByUid={userByUid} renderCrewNames={(boat) => renderCrewNames(boat, true)} isOwn />
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

    async function onSubmitReview() {
        if (!eventId || reviewRating < 1 || reviewBusy) return;
        setReviewBusy(true);
        setReviewErr(null);
        try {
            await submitReview({ eventId, rating: reviewRating, comment: reviewComment.trim() });
            setReviewDone(true);
        } catch (e: any) {
            setReviewErr(e?.message ?? "Failed to submit review.");
        } finally {
            setReviewBusy(false);
        }
    }

    function renderReviewsTab() {
        if (!event) return null;
        const isFinished = event.status === "finished";

        return (
            <div>
                {/* ── Summary ── */}
                {reviews.length > 0 && (
                    <div className="esu-card" style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 4 }}>
                        <div style={{ fontSize: 36, fontWeight: 800, color: "#FEB959", lineHeight: 1 }}>
                            {avgRating!.toFixed(1)}
                        </div>
                        <div>
                            <div style={{ color: "#FEB959", fontSize: 18, letterSpacing: 2 }}>
                                {"★".repeat(Math.round(avgRating!)) + "☆".repeat(5 - Math.round(avgRating!))}
                            </div>
                            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                                {reviews.length} review{reviews.length !== 1 ? "s" : ""} across all {hostClubName ?? "club"} events
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Write a review ── */}
                {user && !myReview && !reviewDone && isFinished && (
                    <div className="esu-card" style={{ marginBottom: 4 }}>
                        <h3 className="esu-card-section-title">Leave a review</h3>
                        <p className="esu-muted" style={{ fontSize: 13, marginBottom: 12 }}>
                            Rate your experience at this event hosted by {hostClubName ?? "the club"}.
                        </p>
                        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                            {[1, 2, 3, 4, 5].map(n => (
                                <button
                                    key={n}
                                    onClick={() => setReviewRating(n)}
                                    style={{
                                        background: "transparent",
                                        border: "none",
                                        fontSize: 28,
                                        cursor: "pointer",
                                        color: n <= reviewRating ? "#FEB959" : "rgba(255,255,255,0.2)",
                                        padding: "0 2px",
                                        lineHeight: 1,
                                        transition: "color 0.15s",
                                    }}
                                >
                                    ★
                                </button>
                            ))}
                        </div>
                        <textarea
                            rows={3}
                            value={reviewComment}
                            onChange={e => setReviewComment(e.target.value)}
                            placeholder="Share your experience (optional)"
                            style={{
                                width: "100%", boxSizing: "border-box",
                                padding: 10, borderRadius: 6,
                                border: "1px solid var(--border)",
                                background: "var(--surface-2)", color: "var(--text)",
                                fontSize: 13, resize: "vertical", marginBottom: 10,
                            }}
                        />
                        {reviewErr && <p style={{ color: "#ff6b6b", fontSize: 13, marginBottom: 8 }}>{reviewErr}</p>}
                        <button
                            className="esu-btn-primary"
                            onClick={onSubmitReview}
                            disabled={reviewRating < 1 || reviewBusy}
                        >
                            {reviewBusy ? "Submitting…" : "Submit review"}
                        </button>
                    </div>
                )}

                {myReview && !reviewDone && (
                    <div className="esu-card" style={{ marginBottom: 4, border: "1px solid rgba(72,199,142,0.3)" }}>
                        <div style={{ color: "#48c78e", fontWeight: 600, marginBottom: 4 }}>
                            You reviewed this event {"★".repeat(myReview.rating)}
                        </div>
                        {myReview.comment && <p style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", margin: 0 }}>{myReview.comment}</p>}
                    </div>
                )}

                {reviewDone && (
                    <div className="esu-card" style={{ marginBottom: 4, border: "1px solid rgba(72,199,142,0.3)" }}>
                        <div style={{ color: "#48c78e", fontWeight: 600 }}>✓ Review submitted — thanks!</div>
                    </div>
                )}

                {!isFinished && !myReview && !reviewDone && (
                    <div className="esu-card esu-info-card">
                        <div className="esu-info-icon">🔒</div>
                        <div>
                            <strong>Reviews open after the event</strong>
                            <p className="esu-muted" style={{ margin: "4px 0 0" }}>
                                You can leave a review once the event has finished.
                            </p>
                        </div>
                    </div>
                )}

                {/* ── Review list ── */}
                {reviews.length > 0 && (
                    <div style={{ display: "grid", gap: 10, marginTop: 8 }}>
                        {reviews.map((r: any) => (
                            <div key={r.id} className="esu-card" style={{ padding: "14px 16px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: 14, color: "#f0eee8" }}>{r.reviewerName}</div>
                                        {(r.eventName || r.eventYear) && (
                                            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 2 }}>
                                                {r.eventName}{r.eventName && r.eventYear ? ` · ${r.eventYear}` : r.eventYear ?? ""}
                                            </div>
                                        )}
                                        <div style={{ color: "#FEB959", fontSize: 15, marginTop: 4 }}>
                                            {"★".repeat(r.rating ?? 0)}{"☆".repeat(5 - (r.rating ?? 0))}
                                        </div>
                                    </div>
                                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", whiteSpace: "nowrap", marginTop: 2 }}>
                                        {r.createdAt?.toDate
                                            ? r.createdAt.toDate().toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" })
                                            : ""}
                                    </div>
                                </div>
                                {r.comment && (
                                    <p style={{ margin: "8px 0 0", fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}>
                                        {r.comment}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {reviews.length === 0 && (
                    <div className="esu-card" style={{ textAlign: "center", padding: "2.5rem 1.5rem" }}>
                        <div style={{ fontSize: "2rem", marginBottom: "0.75rem", opacity: 0.25 }}>★</div>
                        <div style={{ fontWeight: 600, fontSize: "1rem", color: "rgba(255,255,255,0.7)", marginBottom: "0.4rem" }}>No reviews yet</div>
                        <div style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.3)" }}>
                            {isFinished ? "Be the first to leave a review." : "Reviews will be available after the event."}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ── Render ──
    return (
        <>
            {showCheckout && event && selectedCategory && (
                <Suspense fallback={null}>
                    <StripeCheckoutModal
                        eventId={eventId!}
                        categoryId={selectedCategory.id}
                        categoryName={selectedCategory.name}
                        onClose={() => setShowCheckout(false)}
                    />
                </Suspense>
            )}
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
                            {(() => {
                                const tier = event.seriesType ? SERIES_TIER[event.seriesType] : null;
                                const isNationalEvent = event.seriesType === "national_event";
                                const borderCol = tier?.borderColor ?? "rgba(254,185,89,0.4)";
                                return (
                                    <div style={{
                                        borderRadius: 14,
                                        overflow: "hidden",
                                        background: "var(--surface)",
                                        border: `1px solid ${borderCol}`,
                                        boxShadow: tier?.cardShadow ?? "0 4px 24px rgba(0,0,0,0.4)",
                                        marginBottom: 20,
                                    }}>
                                        {/* Hero gradient area — full-width, 100px */}
                                        <div style={{ position: "relative", height: 100, overflow: "hidden" }}>
                                            <div style={{
                                                position: "absolute", inset: 0,
                                                background: "linear-gradient(155deg, #32302a 0%, #2a2a30 45%, #1e1e22 100%)",
                                                backgroundSize: "220% 220%",
                                                animation: "gradPan 11s ease-in-out infinite alternate, heroZoom 14s ease-in-out infinite alternate",
                                            }} />
                                            <div style={{
                                                position: "absolute", inset: 0,
                                                background: "linear-gradient(to top, var(--surface) 0%, transparent 55%)",
                                            }} />

                                            {/* Top-right: tier badge (pulsing for national events) */}
                                            {tier && (
                                                <div style={{
                                                    position: "absolute", top: 10, right: 12,
                                                    background: "rgba(254,185,89,0.10)",
                                                    border: "1px solid rgba(254,185,89,0.22)",
                                                    color: "#FEB959",
                                                    fontSize: "10px", fontWeight: 500,
                                                    letterSpacing: "0.06em", textTransform: "uppercase",
                                                    padding: "3px 9px", borderRadius: 4,
                                                    whiteSpace: "nowrap",
                                                    animation: isNationalEvent ? "selGold 2.4s ease-in-out infinite" : undefined,
                                                }}>
                                                    {tier.icon} {tier.label}
                                                </div>
                                            )}

                                            {/* Bottom-left: location label + event name */}
                                            <div style={{ position: "absolute", bottom: 10, left: 14, right: tier ? 140 : 14 }}>
                                                <div style={{
                                                    fontSize: "10px", fontWeight: 500,
                                                    letterSpacing: "0.10em", textTransform: "uppercase",
                                                    color: "rgba(254,185,89,0.45)", marginBottom: 4,
                                                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                                                }}>
                                                    {event.location}
                                                </div>
                                                <div style={{
                                                    fontSize: "20px", fontWeight: 500,
                                                    color: "#f0eee8", lineHeight: 1.15,
                                                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                                                }}>
                                                    {event.name}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Card body: date / distance / status */}
                                        <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                                            <div>
                                                <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>
                                                    {formatDate(event.startDate)} · {event.lengthMeters}m
                                                </div>
                                                {event.closingDate && (
                                                    <div style={{ fontSize: "11px", color: "rgba(254,185,89,0.65)", marginTop: 2 }}>
                                                        Closes {formatDate(event.closingDate)}
                                                    </div>
                                                )}
                                            </div>
                                            <EsuStatusPill status={event.status} />
                                        </div>
                                    </div>
                                );
                            })()}

                            <div className="esu-tab-bar">
                                {(["overview", "entries", "results", "reviews"] as Tab[]).map(t => (
                                    <button
                                        key={t}
                                        className={`esu-tab-btn ${activeTab === t ? "esu-tab-btn--active" : ""}`}
                                        onClick={() => setTab(t)}
                                    >
                                        {t === "overview" ? "Overview"
                                            : t === "entries" ? "Entries"
                                            : t === "results" ? "Results"
                                            : reviews.length > 0 ? `Reviews (${reviews.length})` : "Reviews"}
                                    </button>
                                ))}
                            </div>

                            {activeTab === "overview" && renderOverviewTab()}
                            {activeTab === "entries" && renderEntriesTab()}
                            {activeTab === "results" && renderResultsTab()}
                            {activeTab === "reviews" && renderReviewsTab()}
                        </>
                    )}
                </div>
            </main>
            <Footer />
        </>
    );
}
