import { httpsCallable }              from "firebase/functions";
import { useEffect, useRef, useState } from "react";
import { functions }                  from "../../../shared/lib/firebase";
import type { ClubRef }               from "../../../features/auth/types.ts";
import "./ClubSearch.css";

// ── Types ─────────────────────────────────────────────────────────────────────

// Mirrors ClubSearchResult from club.functions.ts
export interface ClubSearchResult {
    id:              string;
    name:            string;
    shortName?:      string;
    logoUrl?:        string;
    federationId?:   string;
    federationName?: string;
    location:        { city: string; country: string };
    openMembership:  boolean;
    memberCount:     number;
}

interface SearchClubsRequest  { term: string; federationId?: string; limit?: number; }
interface SearchClubsResponse { clubs: ClubSearchResult[]; }
interface JoinClubRequest     { clubId: string; memberRole: "rower" | "coach"; }
interface JoinClubResponse    { clubRef: ClubRef; }
interface LeaveClubRequest    { clubId: string; memberRole: "rower" | "coach"; }

// ── Constants ─────────────────────────────────────────────────────────────────

const DEBOUNCE_MS = 300;

// ── Sub-components ────────────────────────────────────────────────────────────

function MembershipBadge({ membership, onLeave, leaving }: {
    membership: ClubRef;
    onLeave:    (clubId: string) => void;
    leaving:    boolean;
}) {
    return (
        <div className="club-membership-badge">
            {membership.logoUrl && (
                <img src={membership.logoUrl} alt="" className="club-badge-logo" />
            )}
            <span className="club-badge-name">{membership.clubName}</span>
            {membership.membershipStatus === "pending" && (
                <span className="club-badge-pending">Pending</span>
            )}
            <button
                type="button"
                className="btn btn--danger btn--xs"
                onClick={() => onLeave(membership.clubId)}
                disabled={leaving}
            >
                {leaving ? "Leaving…" : "Leave"}
            </button>
        </div>
    );
}

function ClubResultItem({ club, onSelect, joining }: {
    club:     ClubSearchResult;
    onSelect: (club: ClubSearchResult) => void;
    joining:  boolean;
}) {
    return (
        <button
            type="button"
            className="club-search-result"
            onClick={() => onSelect(club)}
            disabled={joining}
        >
            {club.logoUrl && (
                <img src={club.logoUrl} alt="" className="club-result-logo" />
            )}
            <span className="club-result-name">{club.name}</span>
            {club.location.city && (
                <span className="club-result-location">
                    {club.location.city}
                    {club.federationName ? ` · ${club.federationName}` : ""}
                </span>
            )}
        </button>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ClubSearchInput({ currentMemberships, memberRole, onJoined, onLeft }: {
    currentMemberships: ClubRef[];
    memberRole:         "rower" | "coach";
    onJoined:           (ref: ClubRef) => void;
    onLeft:             (clubId: string) => void;
}) {
    const [searchTerm,  setSearchTerm]  = useState("");
    const [results,     setResults]     = useState<ClubSearchResult[]>([]);
    const [searching,   setSearching]   = useState(false);
    const [joining,     setJoining]     = useState(false);
    const [leavingId,   setLeavingId]   = useState<string | null>(null);
    const [error,       setError]       = useState<string | null>(null);
    const [showResults, setShowResults] = useState(false);

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const wrapperRef  = useRef<HTMLDivElement>(null);

    const joinedIds = new Set(currentMemberships.map(m => m.clubId));

    // ── Search ───────────────────────────────────────────────────────────────

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);

        if (!searchTerm.trim()) {
            setResults([]);
            setShowResults(false);
            return;
        }

        debounceRef.current = setTimeout(async () => {
            setSearching(true);
            setError(null);
            try {
                const fn   = httpsCallable<SearchClubsRequest, SearchClubsResponse>(
                    functions, "searchClubs",
                );
                const res  = await fn({ term: searchTerm.trim() });
                const filtered = res.data.clubs.filter(c => !joinedIds.has(c.id));
                setResults(filtered);
                setShowResults(true);
            } catch (e: any) {
                console.error("[ClubSearchInput] searchClubs failed:", e);
                // Show friendly message — rate limit gets its own copy
                const msg = e?.code === "functions/resource-exhausted"
                    ? "Too many searches — please wait a moment and try again."
                    : "Search failed — please try again.";
                setError(msg);
            } finally {
                setSearching(false);
            }
        }, DEBOUNCE_MS);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [searchTerm]);

    // ── Close on outside click ───────────────────────────────────────────────

    useEffect(() => {
        function onMouseDown(e: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setShowResults(false);
            }
        }
        document.addEventListener("mousedown", onMouseDown);
        return () => document.removeEventListener("mousedown", onMouseDown);
    }, []);

    // ── Join ─────────────────────────────────────────────────────────────────

    async function handleSelect(club: ClubSearchResult) {
        setJoining(true);
        setError(null);
        setShowResults(false);
        setSearchTerm("");
        try {
            const fn     = httpsCallable<JoinClubRequest, JoinClubResponse>(functions, "joinClub");
            const result = await fn({ clubId: club.id, memberRole });
            onJoined(result.data.clubRef);
        } catch (e: any) {
            console.error("[ClubSearchInput] joinClub failed:", e);
            setError(e?.message ?? "Failed to join club. Please try again.");
        } finally {
            setJoining(false);
        }
    }

    // ── Leave ────────────────────────────────────────────────────────────────

    async function handleLeave(clubId: string) {
        if (!confirm("Are you sure you want to leave this club?")) return;
        setLeavingId(clubId);
        setError(null);
        try {
            const fn = httpsCallable<LeaveClubRequest, void>(functions, "leaveClub");
            await fn({ clubId, memberRole });
            onLeft(clubId);
        } catch (e: any) {
            console.error("[ClubSearchInput] leaveClub failed:", e);
            setError(e?.message ?? "Failed to leave club. Please try again.");
        } finally {
            setLeavingId(null);
        }
    }

    // ── Render ───────────────────────────────────────────────────────────────

    return (
        <div className="club-search-wrapper" ref={wrapperRef}>

            {currentMemberships.length > 0 && (
                <div className="club-memberships-list">
                    {currentMemberships.map(m => (
                        <MembershipBadge
                            key={m.clubId}
                            membership={m}
                            onLeave={handleLeave}
                            leaving={leavingId === m.clubId}
                        />
                    ))}
                </div>
            )}

            <div className="club-search-input-row">
                <input
                    type="text"
                    className="club-search-input"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    onFocus={() => results.length > 0 && setShowResults(true)}
                    placeholder="Search for a club to join…"
                    disabled={joining}
                    autoComplete="off"
                />
                {searching && <span className="club-search-spinner" aria-label="Searching…" />}
                {joining   && <span className="club-search-joining">Joining…</span>}
            </div>

            {showResults && results.length > 0 && (
                <div className="club-search-results" role="listbox">
                    {results.map(club => (
                        <ClubResultItem
                            key={club.id}
                            club={club}
                            onSelect={handleSelect}
                            joining={joining}
                        />
                    ))}
                </div>
            )}

            {showResults && !searching && results.length === 0 && searchTerm.trim() && (
                <p className="club-search-empty">
                    No clubs found for "{searchTerm}". Ask your club admin to register the club.
                </p>
            )}

            {error && <p className="error">{error}</p>}
        </div>
    );
}