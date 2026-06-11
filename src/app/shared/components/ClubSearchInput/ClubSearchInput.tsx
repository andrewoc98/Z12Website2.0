import { httpsCallable }              from "firebase/functions";
import { useEffect, useRef, useState } from "react";
import { functions }                  from "../../../shared/lib/firebase";
import type { ClubRef }               from "../../../features/auth/types.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

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
        <div className="flex items-center gap-2 px-[10px] py-2 bg-[rgba(254,185,89,0.05)] border border-[rgba(254,185,89,0.16)] rounded-[10px] transition-[background] hover:bg-[rgba(254,185,89,0.09)]">
            {membership.logoUrl && (
                <img src={membership.logoUrl} alt="" className="w-7 h-7 rounded-[5px] object-cover flex-shrink-0" />
            )}
            <span className="flex-1 text-[0.88rem] font-semibold text-text min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{membership.clubName}</span>
            {membership.membershipStatus === "pending" && (
                <span className="text-[0.7rem] font-bold tracking-[0.07em] uppercase text-[#f5b457] bg-[rgba(245,180,87,0.1)] px-[7px] py-[2px] rounded-[4px] border border-[rgba(245,180,87,0.22)] flex-shrink-0">Pending</span>
            )}
            <button
                type="button"
                className="px-[9px] py-[4px] text-[0.73rem] !normal-case !tracking-normal rounded-[6px] bg-[rgba(255,77,109,0.1)] border border-[rgba(255,77,109,0.3)] text-[#f87171] transition-[background] hover:bg-[rgba(255,77,109,0.18)] hover:shadow-none disabled:opacity-50 disabled:cursor-not-allowed min-h-0"
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
            className="w-full flex items-center gap-[10px] px-[14px] py-[10px] bg-transparent border-0 border-b border-b-white/5 last:border-b-0 text-left cursor-pointer transition-[background] hover:bg-[rgba(254,185,89,0.08)] hover:shadow-none focus-visible:outline-none focus-visible:bg-[rgba(254,185,89,0.1)] active:bg-[rgba(254,185,89,0.14)] disabled:opacity-50 disabled:cursor-not-allowed !normal-case !tracking-normal min-h-0 rounded-none"
            onClick={() => onSelect(club)}
            disabled={joining}
        >
            {club.logoUrl && (
                <img src={club.logoUrl} alt="" className="w-8 h-8 rounded-[6px] object-cover flex-shrink-0" />
            )}
            <span className="flex-1 text-[0.9rem] font-semibold text-text min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{club.name}</span>
            {club.location.city && (
                <span className="text-[0.75rem] text-muted whitespace-nowrap flex-shrink-0">
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
                const fn   = httpsCallable<SearchClubsRequest, SearchClubsResponse>(functions, "searchClubs");
                const res  = await fn({ term: searchTerm.trim() });
                const filtered = res.data.clubs.filter(c => !joinedIds.has(c.id));
                setResults(filtered);
                setShowResults(true);
            } catch (e: any) {
                const msg = e?.code === "functions/resource-exhausted"
                    ? "Too many searches — please wait a moment and try again."
                    : "Search failed — please try again.";
                setError(msg);
            } finally {
                setSearching(false);
            }
        }, DEBOUNCE_MS);

        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }, [searchTerm]);

    useEffect(() => {
        function onMouseDown(e: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setShowResults(false);
            }
        }
        document.addEventListener("mousedown", onMouseDown);
        return () => document.removeEventListener("mousedown", onMouseDown);
    }, []);

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
            setError(e?.message ?? "Failed to join club. Please try again.");
        } finally {
            setJoining(false);
        }
    }

    async function handleLeave(clubId: string) {
        if (!confirm("Are you sure you want to leave this club?")) return;
        setLeavingId(clubId);
        setError(null);
        try {
            const fn = httpsCallable<LeaveClubRequest, void>(functions, "leaveClub");
            await fn({ clubId, memberRole });
            onLeft(clubId);
        } catch (e: any) {
            setError(e?.message ?? "Failed to leave club. Please try again.");
        } finally {
            setLeavingId(null);
        }
    }

    return (
        <div className="relative w-full flex flex-col gap-[10px]" ref={wrapperRef}>

            {currentMemberships.length > 0 && (
                <div className="flex flex-col gap-[6px]">
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

            <div className="relative flex items-center gap-2">
                <input
                    type="text"
                    className="flex-1 bg-white/[0.04] border-2 border-brand-warm rounded-[12px] px-[14px] py-3 pr-[42px] text-text text-[0.95rem] outline-none transition-[border-color,box-shadow,background] focus:border-[#f5b457] focus:bg-white/[0.06] focus:[box-shadow:0_0_0_4px_rgba(254,185,89,0.12)] disabled:opacity-55 disabled:cursor-not-allowed w-full"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    onFocus={() => results.length > 0 && setShowResults(true)}
                    placeholder="Search for a club to join…"
                    disabled={joining}
                    autoComplete="off"
                />
                {searching && (
                    <span
                        className="absolute right-[14px] top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-[rgba(254,185,89,0.2)] border-t-brand-warm rounded-full animate-[club-spin_0.65s_linear_infinite] pointer-events-none flex-shrink-0"
                        aria-label="Searching…"
                    />
                )}
                {joining && (
                    <span className="text-[0.8rem] text-brand-warm font-semibold tracking-[0.04em] whitespace-nowrap flex-shrink-0 animate-[club-pulse_1.2s_ease-in-out_infinite]">
                        Joining…
                    </span>
                )}
            </div>

            {showResults && results.length > 0 && (
                <div
                    className="absolute top-[calc(100%+6px)] left-0 right-0 z-[200] bg-surface-2 border border-[rgba(254,185,89,0.22)] rounded-[12px] shadow-[0_16px_40px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.04)] overflow-hidden max-h-[280px] overflow-y-auto [scrollbar-width:thin] [scrollbar-color:rgba(254,185,89,0.25)_transparent] animate-[club-dropdown-in_0.14s_ease]"
                    role="listbox"
                >
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
                <p className="text-[0.82rem] text-white/40 m-0 pt-[4px] leading-[1.5]">
                    No clubs found for "{searchTerm}". Ask your club admin to register the club.
                </p>
            )}

            {error && <p className="error">{error}</p>}
        </div>
    );
}
