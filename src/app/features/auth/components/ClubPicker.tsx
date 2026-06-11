/**
 * ClubPicker.tsx
 *
 * Search-only club selector for use during registration.
 * Does NOT call joinClub — returns a ClubSelection so the parent
 * can store the ID and call joinClub after account creation.
 */

import { httpsCallable }               from "firebase/functions";
import { useEffect, useRef, useState }  from "react";
import { functions }                   from "../../../shared/lib/firebase";
import type {ClubSearchResult} from "../../../shared/components/ClubSearchInput/ClubSearchInput.tsx";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SearchClubsRequest  { term: string; federationId?: string; limit?: number; }
interface SearchClubsResponse { clubs: ClubSearchResult[]; }

export interface ClubSelection {
    clubId:   string;
    clubName: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DEBOUNCE_MS = 300;

// ── Component ─────────────────────────────────────────────────────────────────

export function ClubPicker({ value, onChange }: {
    value:    ClubSelection | null;
    onChange: (club: ClubSelection | null) => void;
}) {
    const [searchTerm,  setSearchTerm]  = useState(value?.clubName ?? "");
    const [results,     setResults]     = useState<ClubSearchResult[]>([]);
    const [searching,   setSearching]   = useState(false);
    const [showResults, setShowResults] = useState(false);
    const [error,       setError]       = useState<string | null>(null);

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const wrapperRef  = useRef<HTMLDivElement>(null);

    useEffect(() => { if (!value) setSearchTerm(""); }, [value]);

    useEffect(() => {
        function onMouseDown(e: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setShowResults(false);
            }
        }
        document.addEventListener("mousedown", onMouseDown);
        return () => document.removeEventListener("mousedown", onMouseDown);
    }, []);

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);

        if (value && searchTerm === value.clubName) return;

        if (value) onChange(null);

        if (!searchTerm.trim()) {
            setResults([]);
            setShowResults(false);
            return;
        }

        debounceRef.current = setTimeout(async () => {
            setSearching(true);
            setError(null);
            try {
                const fn  = httpsCallable<SearchClubsRequest, SearchClubsResponse>(functions, "searchClubs");
                const res = await fn({ term: searchTerm.trim() });
                setResults(res.data.clubs);
                setShowResults(true);
            } catch (e: any) {
                const msg = e?.code === "functions/resource-exhausted"
                    ? "Too many searches — please wait a moment."
                    : "Search failed — please try again.";
                setError(msg);
            } finally {
                setSearching(false);
            }
        }, DEBOUNCE_MS);

        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }, [searchTerm]);

    function handleSelect(club: ClubSearchResult) {
        onChange({ clubId: club.id, clubName: club.name });
        setSearchTerm(club.name);
        setShowResults(false);
        setResults([]);
        setError(null);
    }

    function handleClear() {
        onChange(null);
        setSearchTerm("");
        setResults([]);
        setShowResults(false);
        setError(null);
    }

    return (
        <div className="relative w-full flex flex-col gap-[10px]" ref={wrapperRef}>
            <div className="relative flex items-center gap-2">
                <input
                    type="text"
                    className="flex-1 bg-white/[0.04] border-2 border-brand-warm rounded-[12px] px-[14px] py-3 pr-[42px] text-text text-[0.95rem] outline-none transition-[border-color,box-shadow,background] focus:border-[#f5b457] focus:bg-white/[0.06] focus:[box-shadow:0_0_0_4px_rgba(254,185,89,0.12)] w-full"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    onFocus={() => results.length > 0 && setShowResults(true)}
                    placeholder="Search for your club…"
                    autoComplete="off"
                />
                {searching && (
                    <span
                        className="absolute right-[14px] top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-[rgba(254,185,89,0.2)] border-t-brand-warm rounded-full animate-[club-spin_0.65s_linear_infinite] pointer-events-none flex-shrink-0"
                        aria-label="Searching…"
                    />
                )}
                {value && (
                    <button
                        type="button"
                        className="px-[9px] py-[4px] text-[0.73rem] !normal-case !tracking-normal rounded-[6px] bg-white/[0.06] border border-white/10 text-muted transition-[background,color] hover:bg-white/10 hover:text-text hover:shadow-none min-h-0 flex-shrink-0"
                        onClick={handleClear}
                        aria-label="Clear selection"
                    >
                        ✕
                    </button>
                )}
            </div>

            {value && (
                <p className="flex items-center gap-[6px] text-[0.85rem] font-semibold text-[#6fcf97] m-0 py-[7px] px-3 bg-[rgba(111,207,151,0.08)] border border-[rgba(111,207,151,0.2)] rounded-[8px] leading-[1.3]">
                    ✓ {value.clubName}
                </p>
            )}

            {showResults && results.length > 0 && (
                <div
                    className="absolute top-[calc(100%+6px)] left-0 right-0 z-[200] bg-surface-2 border border-[rgba(254,185,89,0.22)] rounded-[12px] shadow-[0_16px_40px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.04)] overflow-hidden max-h-[280px] overflow-y-auto [scrollbar-width:thin] [scrollbar-color:rgba(254,185,89,0.25)_transparent] animate-[club-dropdown-in_0.14s_ease]"
                    role="listbox"
                >
                    {results.map(club => (
                        <button
                            key={club.id}
                            type="button"
                            className="w-full flex items-center gap-[10px] px-[14px] py-[10px] bg-transparent border-0 border-b border-b-white/5 last:border-b-0 text-left cursor-pointer transition-[background] hover:bg-[rgba(254,185,89,0.08)] hover:shadow-none focus-visible:outline-none focus-visible:bg-[rgba(254,185,89,0.1)] !normal-case !tracking-normal min-h-0 rounded-none"
                            onClick={() => handleSelect(club)}
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
                    ))}
                </div>
            )}

            {showResults && !searching && results.length === 0 && searchTerm.trim() && (
                <p className="text-[0.82rem] text-white/40 m-0 pt-[4px] leading-[1.5]">
                    No clubs found for "{searchTerm}". You can join a club after registration.
                </p>
            )}

            {error && <p className="error">{error}</p>}
        </div>
    );
}
