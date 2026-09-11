import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../../../../shared/lib/firebase";
import { subscribeToMyErgScores, formatErgTime, formatSplit } from "../../../api/ergScores";
import { syncErgScores } from "../../../../profile/services/concept2Service";
import { ErgFinalDayFlag } from "../../EntryWindow";
import type { Concept2LinkState, ErgScoreDoc, ErgScoreStatus } from "../../../types";

const C2_VERIFY_HELP = "https://www.concept2.com/service/software/ergdata";

const STATUS_STYLE: Record<ErgScoreStatus, { label: string; color: string }> = {
    ranked:       { label: "Verified",     color: "var(--brand)" },
    unverified:   { label: "Not verified", color: "var(--brand-warm)" },
    ineligible:   { label: "Not eligible", color: "var(--muted)" },
    disqualified: { label: "Disqualified", color: "var(--danger)" },
};

type Props = {
    eventId: string;
    uid: string;
    endDate?: string;
    distanceMeters: number;
    isRegistered: boolean;
    onGoToEntries: () => void;
};

/**
 * The athlete's own view of an erg event: link state, a sync button, and every
 * piece we imported with the reason it did or did not count.
 *
 * Ineligible and unverified pieces are shown rather than silently dropped — an
 * athlete who rowed a 2k and sees nothing at all will assume the sync is broken.
 */
export default function MyErgScoresTab({
    eventId,
    uid,
    endDate,
    distanceMeters,
    isRegistered,
    onGoToEntries,
}: Props) {
    const [link, setLink] = useState<Concept2LinkState | null>(null);
    const [scores, setScores] = useState<ErgScoreDoc[]>([]);
    const [syncing, setSyncing] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);
    const [err, setErr] = useState<string | null>(null);
    const autoSynced = useRef(false);

    const linked = link?.linked === true;

    useEffect(() => {
        return onSnapshot(doc(db, "users", uid), (snap) => {
            setLink((snap.data()?.concept2 as Concept2LinkState) ?? null);
        });
    }, [uid]);

    useEffect(() => {
        if (!isRegistered) return;
        return subscribeToMyErgScores(eventId, uid, setScores, (e) => setErr(e.message));
    }, [eventId, uid, isRegistered]);

    async function runSync(silent = false) {
        setSyncing(true);
        setErr(null);
        if (!silent) setMsg(null);
        try {
            const res = await syncErgScores({ eventId });
            if (!silent) {
                setMsg(
                    res.throttled
                        ? "Already up to date — try again in a minute."
                        : res.imported > 0
                            ? `Imported ${res.imported} new ${res.imported === 1 ? "piece" : "pieces"}.`
                            : "No new pieces found in the Concept2 Logbook.",
                );
            }
        } catch (e) {
            // A background sync failing is not worth shouting about — the athlete
            // did not ask for it, and their already-imported scores still render.
            // An explicit "Sync now" reports the failure in full.
            if (!silent) {
                setErr(e instanceof Error ? e.message : "Could not sync with Concept2.");
            }
        } finally {
            setSyncing(false);
        }
    }

    // One quiet sync on open so a piece rowed this morning is simply there.
    // The server's own cooldown keeps this from hammering Concept2.
    useEffect(() => {
        if (autoSynced.current || !isRegistered || !linked) return;
        autoSynced.current = true;
        void runSync(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isRegistered, linked]);

    const bestId = useMemo(() => {
        let best: ErgScoreDoc | null = null;
        for (const s of scores) {
            if (s.status !== "ranked") continue;
            if (!best || s.timeMs < best.timeMs) best = s;
        }
        return best?.id ?? null;
    }, [scores]);

    if (!isRegistered) {
        return (
            <div className="card">
                <h3>Enter first</h3>
                <p className="muted mt-1" style={{ fontSize: 13 }}>
                    You need to enter a category before you can submit a score.
                </p>
                <button type="button" className="btn-primary mt-3" onClick={onGoToEntries}>
                    Go to entries →
                </button>
            </div>
        );
    }

    if (!linked) {
        return (
            <div className="card" style={{ borderColor: "var(--brand)" }}>
                <h3>Connect your Concept2 Logbook</h3>
                <p className="muted mt-1" style={{ fontSize: 13 }}>
                    You're entered. To submit a score, connect your Concept2 Logbook once —
                    then every 2k you row on a PM5 during this event imports automatically.
                    Only pieces Concept2 marks as verified (uploaded via ErgData or the
                    Concept2 Utility) can be ranked.
                </p>
                <Link to="/profile" className="btn-primary mt-3 inline-block">
                    Connect in your profile →
                </Link>
            </div>
        );
    }

    return (
        <div className="grid gap-3">
            <ErgFinalDayFlag endDate={endDate} variant="banner" />

            <div className="card">
                <div className="space-between" style={{ flexWrap: "wrap", gap: 10 }}>
                    <div>
                        <h3>My scores</h3>
                        <p className="muted mt-1" style={{ fontSize: 13 }}>
                            Connected as {link!.username}. Row as many {distanceMeters}m pieces as
                            you like — your fastest verified one is the one that ranks.
                        </p>
                    </div>
                    <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => runSync(false)}
                        disabled={syncing}
                    >
                        {syncing ? "Syncing…" : "Sync now"}
                    </button>
                </div>

                {msg && <p className="muted mt-2" style={{ fontSize: 13 }}>{msg}</p>}
                {err && <p className="text-[crimson] mt-2" style={{ fontSize: 13 }}>{err}</p>}
            </div>

            {scores.length === 0 ? (
                <div className="card">
                    <p className="muted" style={{ fontSize: 13, margin: 0 }}>
                        No pieces imported yet. Row {distanceMeters}m on a Concept2 RowErg with
                        ErgData running, let it sync to your Logbook, then hit Sync now.
                    </p>
                </div>
            ) : (
                <ul className="grid gap-2 list-none p-0 m-0">
                    {scores.map((s) => {
                        const style = STATUS_STYLE[s.status] ?? STATUS_STYLE.ineligible;
                        const isBest = s.id === bestId;
                        const reason = s.disqualifiedReason ?? s.ineligibleReason;
                        const when = s.workoutAt?.toDate?.();

                        return (
                            <li
                                key={s.id}
                                className="bg-surface border rounded-sm px-4 py-[14px]"
                                style={{
                                    borderColor: isBest ? "var(--brand)" : "var(--border)",
                                    background: isBest ? "rgba(255,212,0,0.03)" : undefined,
                                }}
                            >
                                <div className="space-between" style={{ gap: 12, flexWrap: "wrap" }}>
                                    <div style={{ minWidth: 0 }}>
                                        <div className="font-bold tabular-nums" style={{ fontSize: 18 }}>
                                            {formatErgTime(s.timeMs)}
                                            {isBest && (
                                                <span
                                                    style={{
                                                        marginLeft: 10,
                                                        fontSize: 10,
                                                        fontWeight: 700,
                                                        letterSpacing: "0.08em",
                                                        color: "var(--brand)",
                                                    }}
                                                >
                                                    YOUR BEST
                                                </span>
                                            )}
                                        </div>
                                        <div className="muted" style={{ fontSize: 12.5 }}>
                                            {formatSplit(s.timeMs, s.distanceMeters)} · {s.distanceMeters}m
                                            {s.strokeRate ? ` · ${s.strokeRate} s/m` : ""}
                                            {when ? ` · ${when.toLocaleDateString()}` : ""}
                                        </div>
                                    </div>

                                    <span
                                        style={{
                                            fontSize: 11,
                                            fontWeight: 700,
                                            letterSpacing: "0.06em",
                                            textTransform: "uppercase",
                                            color: style.color,
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        {style.label}
                                    </span>
                                </div>

                                {reason && (
                                    <p className="muted" style={{ fontSize: 12.5, margin: "8px 0 0" }}>
                                        {reason}
                                        {s.status === "unverified" && (
                                            <>
                                                {" "}
                                                <a
                                                    href={C2_VERIFY_HELP}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    style={{ color: "var(--brand)" }}
                                                >
                                                    How to get verified pieces →
                                                </a>
                                            </>
                                        )}
                                    </p>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
