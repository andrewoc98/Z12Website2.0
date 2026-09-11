import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ErgFinalDayFlag } from "../../EntryWindow";
import { formatErgTime } from "../../../api/ergScores";
import type { EventCategory } from "../../../types";

export type ErgEntryRow = {
    id: string;
    clubName?: string;
    categoryName?: string;
    category?: string;
    rowerUids?: string[];
    ergBestTimeMs?: number | null;
    ergScoreCount?: number;
};

type Props = {
    eventId: string;
    endDate?: string;
    distanceMeters: number;
    entries: ErgEntryRow[];
    profiles: Record<string, { displayName?: string; fullName?: string }>;
    currentUserUid?: string;

    /** Signed in with a rower role — erg events are individual entry only. */
    isRower: boolean;
    isRegistrationClosed: boolean;
    concept2Linked: boolean;
    clubName: string;

    eligibleCategories: EventCategory[];
    categoryId: string;
    onCategoryChange: (id: string) => void;
    selectedFeeCents: number;
    requiresPayment: boolean;

    canEnter: boolean;
    busy: boolean;
    onEnter: () => void;
    onCheckout: () => void;

    signupErr: string | null;
    successMsg: string | null;

    onGoToScores: () => void;
};

const fmtFee = (c: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(c / 100);

function athleteName(
    uid: string | undefined,
    profiles: Record<string, { displayName?: string; fullName?: string }>,
): string {
    if (!uid) return "Unknown";
    const p = profiles[uid];
    return p?.displayName?.trim() || p?.fullName?.trim() || "Unknown";
}

/**
 * The Entries tab for indoor erg events.
 *
 * Deliberately much smaller than the open-water version: there are no crews to
 * build, no invite links, no bow numbers and no coach entry, so the whole tab is
 * "where do I stand" plus "who else is in". The open-water tab is untouched.
 */
export default function ErgEntriesTab({
    endDate,
    distanceMeters,
    entries,
    profiles,
    currentUserUid,
    isRower,
    isRegistrationClosed,
    concept2Linked,
    clubName,
    eligibleCategories,
    categoryId,
    onCategoryChange,
    selectedFeeCents,
    requiresPayment,
    canEnter,
    busy,
    onEnter,
    onCheckout,
    signupErr,
    successMsg,
    onGoToScores,
}: Props) {
    const myEntry = useMemo(
        () => (!currentUserUid ? null : entries.find(e => (e.rowerUids ?? []).includes(currentUserUid)) ?? null),
        [entries, currentUserUid],
    );

    // Everyone in the field, fastest first, with the not-yet-scored behind them.
    const field = useMemo(() => {
        return [...entries].sort((a, b) => {
            const at = a.ergBestTimeMs ?? Infinity;
            const bt = b.ergBestTimeMs ?? Infinity;
            if (at !== bt) return at - bt;
            return athleteName(a.rowerUids?.[0], profiles).localeCompare(
                athleteName(b.rowerUids?.[0], profiles),
            );
        });
    }, [entries, profiles]);

    const scored = field.filter(e => e.ergBestTimeMs != null).length;

    return (
        <div className="grid gap-3">
            <ErgFinalDayFlag endDate={endDate} variant="banner" />

            {/* ── Your entry ─────────────────────────────────────────────── */}
            {myEntry ? (
                <div className="esu-card" style={{ borderColor: "var(--brand)" }}>
                    <div className="space-between" style={{ gap: 12, flexWrap: "wrap" }}>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: 15 }}>You're entered</div>
                            <div className="esu-muted" style={{ fontSize: 13, marginTop: 2 }}>
                                {myEntry.categoryName ?? myEntry.category} ·{" "}
                                {myEntry.ergBestTimeMs != null
                                    ? `Best ${formatErgTime(myEntry.ergBestTimeMs)} from ${myEntry.ergScoreCount} verified ${myEntry.ergScoreCount === 1 ? "piece" : "pieces"}`
                                    : "No verified score yet"}
                            </div>
                        </div>
                        <button type="button" className="btn-primary" onClick={onGoToScores}>
                            {myEntry.ergBestTimeMs != null ? "My scores" : "Submit a score"}
                        </button>
                    </div>

                    {!concept2Linked && (
                        <div
                            style={{
                                marginTop: 12,
                                paddingTop: 12,
                                borderTop: "1px solid var(--border)",
                                fontSize: 13,
                            }}
                        >
                            <span className="esu-muted">
                                Your Concept2 Logbook isn't connected, so no scores can import.
                            </span>{" "}
                            <Link to="/profile" style={{ color: "var(--brand)" }}>
                                Connect it in your profile →
                            </Link>
                        </div>
                    )}
                </div>
            ) : isRegistrationClosed ? (
                <div className="esu-card">
                    <div style={{ fontWeight: 700, fontSize: 15 }}>This event has ended</div>
                    <p className="esu-muted" style={{ fontSize: 13, margin: "4px 0 0" }}>
                        Entries and scores are closed. The final standings are in the Results tab.
                    </p>
                </div>
            ) : !isRower ? (
                <div className="esu-card">
                    <div style={{ fontWeight: 700, fontSize: 15 }}>Rower account required</div>
                    <p className="esu-muted" style={{ fontSize: 13, margin: "4px 0 0" }}>
                        Indoor events are entered by individual athletes. Sign in with a rower
                        account to take part.
                    </p>
                </div>
            ) : (
                <div className="esu-card">
                    <div style={{ fontWeight: 700, fontSize: 15 }}>Enter this event</div>
                    <p className="esu-muted" style={{ fontSize: 13, margin: "4px 0 12px" }}>
                        One entry, unlimited {distanceMeters}m attempts. Your fastest verified
                        piece is the one that ranks.
                    </p>

                    {eligibleCategories.length === 0 ? (
                        <p className="esu-muted" style={{ fontSize: 13, margin: 0 }}>
                            No categories match your profile. Check your date of birth and gender
                            are set in your profile.
                        </p>
                    ) : (
                        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
                            <label className="esu-field-label" style={{ flex: "1 1 220px", margin: 0 }}>
                                Category
                                <div className="esu-custom-select">
                                    <select value={categoryId} onChange={e => onCategoryChange(e.target.value)}>
                                        {eligibleCategories.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </label>

                            <button
                                type="button"
                                className="btn-primary"
                                disabled={busy || (!requiresPayment && !canEnter)}
                                onClick={requiresPayment ? onCheckout : onEnter}
                            >
                                {busy
                                    ? "Entering…"
                                    : requiresPayment
                                        ? `Enter — ${fmtFee(selectedFeeCents)}`
                                        : "Enter event"}
                            </button>
                        </div>
                    )}

                    {!clubName && (
                        <p className="esu-error-text" style={{ fontSize: 13, marginTop: 10 }}>
                            No club set on your profile — join a club before entering.
                        </p>
                    )}
                    {signupErr && (
                        <p className="text-[crimson]" style={{ fontSize: 13, marginTop: 10 }}>{signupErr}</p>
                    )}
                    {successMsg && (
                        <p className="esu-muted" style={{ fontSize: 13, marginTop: 10 }}>{successMsg}</p>
                    )}
                </div>
            )}

            {/* ── The field ──────────────────────────────────────────────── */}
            <div className="esu-card">
                <div className="space-between" style={{ gap: 12, flexWrap: "wrap" }}>
                    <h3 className="esu-card-section-title" style={{ margin: 0 }}>
                        Field
                    </h3>
                    <span className="esu-muted" style={{ fontSize: 12.5 }}>
                        {field.length} entered · {scored} with a verified score
                    </span>
                </div>

                {field.length === 0 ? (
                    <p className="esu-muted" style={{ fontSize: 13, margin: "12px 0 0" }}>
                        Nobody has entered yet. Be the first.
                    </p>
                ) : (
                    <ul className="grid gap-2 list-none p-0" style={{ margin: "12px 0 0" }}>
                        {field.map(entry => {
                            const uid = entry.rowerUids?.[0];
                            const isMe = !!(currentUserUid && uid === currentUserUid);
                            const time = entry.ergBestTimeMs;

                            return (
                                <li
                                    key={entry.id}
                                    className="bg-surface-2 border rounded-sm px-3 py-2"
                                    style={{
                                        borderColor: isMe ? "var(--brand)" : "var(--border)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        gap: 12,
                                    }}
                                >
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontSize: 14, fontWeight: 600 }}>
                                            {athleteName(uid, profiles)}
                                            {isMe && (
                                                <span
                                                    style={{
                                                        marginLeft: 8,
                                                        fontSize: 10,
                                                        fontWeight: 700,
                                                        letterSpacing: "0.07em",
                                                        color: "var(--brand)",
                                                    }}
                                                >
                                                    YOU
                                                </span>
                                            )}
                                        </div>
                                        <div className="esu-muted" style={{ fontSize: 12 }}>
                                            {entry.clubName || "—"} · {entry.categoryName ?? entry.category}
                                        </div>
                                    </div>

                                    <span
                                        className={time == null ? "esu-muted" : undefined}
                                        style={{
                                            fontSize: 13,
                                            fontWeight: time == null ? 400 : 700,
                                            fontVariantNumeric: "tabular-nums",
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        {time == null ? "No score yet" : formatErgTime(time)}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
}
