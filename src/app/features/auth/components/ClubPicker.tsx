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
import "../../../shared/components/ClubSearchInput/ClubSearch.css";


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

    // Clear input when parent clears value
    useEffect(() => { if (!value) setSearchTerm(""); }, [value]);

    // Close on outside click
    useEffect(() => {
        function onMouseDown(e: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setShowResults(false);
            }
        }
        document.addEventListener("mousedown", onMouseDown);
        return () => document.removeEventListener("mousedown", onMouseDown);
    }, []);

    // Debounced search
    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);

        // Don't re-search if the input matches the already-selected club
        if (value && searchTerm === value.clubName) return;

        // Clear selection when user edits the input
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
                const fn  = httpsCallable<SearchClubsRequest, SearchClubsResponse>(
                    functions, "searchClubs",
                );
                const res = await fn({ term: searchTerm.trim() });
                setResults(res.data.clubs);
                setShowResults(true);
            } catch (e: any) {
                console.error("[ClubPicker] searchClubs failed:", e);
                const msg = e?.code === "functions/resource-exhausted"
                    ? "Too many searches — please wait a moment."
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
        <div className="club-search-wrapper" ref={wrapperRef}>
            <div className="club-search-input-row">
                <input
                    type="text"
                    className="club-search-input"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    onFocus={() => results.length > 0 && setShowResults(true)}
                    placeholder="Search for your club…"
                    autoComplete="off"
                />
                {searching && <span className="club-search-spinner" aria-label="Searching…" />}
                {value && (
                    <button
                        type="button"
                        className="btn btn--xs btn--secondary"
                        onClick={handleClear}
                        aria-label="Clear selection"
                    >
                        ✕
                    </button>
                )}
            </div>

            {value && (
                <p className="club-search-selected">✓ {value.clubName}</p>
            )}

            {showResults && results.length > 0 && (
                <div className="club-search-results" role="listbox">
                    {results.map(club => (
                        <button
                            key={club.id}
                            type="button"
                            className="club-search-result"
                            onClick={() => handleSelect(club)}
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
                    ))}
                </div>
            )}

            {showResults && !searching && results.length === 0 && searchTerm.trim() && (
                <p className="club-search-empty">
                    No clubs found for "{searchTerm}". You can join a club after registration.
                </p>
            )}

            {error && <p className="error">{error}</p>}
        </div>
    );
}