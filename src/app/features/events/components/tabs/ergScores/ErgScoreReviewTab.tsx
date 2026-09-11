import { useEffect, useMemo, useState } from "react";
import { subscribeToAllErgScores, formatErgTime, formatSplit } from "../../../api/ergScores";
import {
    disqualifyErgScore,
    reinstateErgScore,
} from "../../../../profile/services/concept2Service";
import { useUserProfiles } from "../../../../timing/useUserProfiles";
import type { ErgScoreDoc, ErgScoreStatus } from "../../../types";

const STATUS_LABEL: Record<ErgScoreStatus, string> = {
    ranked: "Verified",
    unverified: "Not verified",
    ineligible: "Not eligible",
    disqualified: "Disqualified",
};

const FILTERS: Array<{ key: "all" | ErgScoreStatus; label: string }> = [
    { key: "all", label: "All" },
    { key: "ranked", label: "Verified" },
    { key: "unverified", label: "Not verified" },
    { key: "ineligible", label: "Not eligible" },
    { key: "disqualified", label: "Disqualified" },
];

/**
 * Host review of every imported score.
 *
 * There is deliberately no way to add a score by hand — everything on the
 * leaderboard came from Concept2. The host's only lever is striking one out,
 * which requires a reason the athlete will see.
 */
export default function ErgScoreReviewTab({ eventId }: { eventId: string }) {
    const [scores, setScores] = useState<ErgScoreDoc[]>([]);
    const [statusFilter, setStatusFilter] = useState<"all" | ErgScoreStatus>("all");
    const [categoryFilter, setCategoryFilter] = useState<string>("all");
    const [busyId, setBusyId] = useState<string | null>(null);
    const [err, setErr] = useState<string | null>(null);

    const [pendingDq, setPendingDq] = useState<ErgScoreDoc | null>(null);
    const [reason, setReason] = useState("");

    useEffect(() => {
        return subscribeToAllErgScores(eventId, setScores, (e) => setErr(e.message));
    }, [eventId]);

    const uids = useMemo(() => Array.from(new Set(scores.map((s) => s.uid))), [scores]);
    const { profiles } = useUserProfiles(uids);

    const categories = useMemo(
        () => Array.from(new Set(scores.map((s) => s.categoryName).filter(Boolean))).sort(),
        [scores],
    );

    const visible = useMemo(
        () =>
            scores.filter(
                (s) =>
                    (statusFilter === "all" || s.status === statusFilter) &&
                    (categoryFilter === "all" || s.categoryName === categoryFilter),
            ),
        [scores, statusFilter, categoryFilter],
    );

    async function confirmDisqualify() {
        if (!pendingDq || !reason.trim()) return;
        const score = pendingDq;
        setPendingDq(null);
        setBusyId(score.id);
        setErr(null);
        try {
            await disqualifyErgScore({ eventId, scoreId: score.id, reason: reason.trim() });
            setReason("");
        } catch (e) {
            setErr(e instanceof Error ? e.message : "Could not disqualify that score.");
        } finally {
            setBusyId(null);
        }
    }

    async function handleReinstate(score: ErgScoreDoc) {
        setBusyId(score.id);
        setErr(null);
        try {
            await reinstateErgScore({ eventId, scoreId: score.id });
        } catch (e) {
            setErr(e instanceof Error ? e.message : "Could not reinstate that score.");
        } finally {
            setBusyId(null);
        }
    }

    return (
        <div className="grid gap-3">
            <div className="card">
                <h3>Erg scores</h3>
                <p className="muted mt-1" style={{ fontSize: 13 }}>
                    Every piece imported from athletes' Concept2 Logbooks. Verified pieces rank
                    automatically — you only need to act if something looks wrong.
                </p>

                <div className="row mt-3" style={{ flexWrap: "wrap", gap: 8 }}>
                    {FILTERS.map((f) => (
                        <button
                            key={f.key}
                            type="button"
                            className={statusFilter === f.key ? "btn-primary" : "btn-ghost"}
                            onClick={() => setStatusFilter(f.key)}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>

                {categories.length > 0 && (
                    <div className="row mt-2">
                        <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                        >
                            <option value="all">All categories</option>
                            {categories.map((c) => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>
                )}

                {err && <p className="text-[crimson] mt-2" style={{ fontSize: 13 }}>{err}</p>}
            </div>

            {visible.length === 0 ? (
                <div className="card">
                    <p className="muted" style={{ fontSize: 13, margin: 0 }}>
                        No scores match these filters.
                    </p>
                </div>
            ) : (
                <ul className="grid gap-2 list-none p-0 m-0">
                    {visible.map((s) => {
                        const profile = profiles[s.uid];
                        const name = profile?.displayName ?? profile?.fullName ?? "Unknown";
                        const when = s.workoutAt?.toDate?.();
                        const busy = busyId === s.id;

                        return (
                            <li
                                key={s.id}
                                className="bg-surface border border-border rounded-sm px-4 py-[14px]"
                            >
                                <div className="space-between" style={{ gap: 12, flexWrap: "wrap" }}>
                                    <div style={{ minWidth: 0 }}>
                                        <div className="font-semibold truncate">
                                            {name}
                                            <span className="muted" style={{ fontWeight: 400 }}>
                                                {" "}· {s.categoryName || "—"}
                                            </span>
                                        </div>
                                        <div className="muted" style={{ fontSize: 12.5 }}>
                                            {formatSplit(s.timeMs, s.distanceMeters)} · {s.distanceMeters}m ·{" "}
                                            {STATUS_LABEL[s.status]}
                                            {when ? ` · ${when.toLocaleDateString()}` : ""}
                                        </div>
                                        {(s.disqualifiedReason || s.ineligibleReason) && (
                                            <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
                                                {s.disqualifiedReason ?? s.ineligibleReason}
                                            </div>
                                        )}
                                    </div>

                                    <div className="row" style={{ gap: 8, alignItems: "center" }}>
                                        <span className="font-bold tabular-nums">
                                            {formatErgTime(s.timeMs)}
                                        </span>
                                        {s.status === "disqualified" ? (
                                            <button
                                                type="button"
                                                className="btn-ghost"
                                                disabled={busy}
                                                onClick={() => handleReinstate(s)}
                                            >
                                                {busy ? "…" : "Reinstate"}
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                className="btn-ghost"
                                                disabled={busy}
                                                onClick={() => { setPendingDq(s); setReason(""); }}
                                                style={{ color: "var(--danger)" }}
                                            >
                                                {busy ? "…" : "Disqualify"}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}

            {pendingDq && (
                <div
                    className="fixed inset-0 bg-black/65 backdrop-blur-[4px] flex justify-center items-center z-[1000] p-[16px]"
                    onClick={() => setPendingDq(null)}
                >
                    <form
                        className="w-[min(440px,100%)] bg-surface border border-border rounded-DEFAULT shadow-DEFAULT px-[18px] py-5"
                        onClick={(e) => e.stopPropagation()}
                        onSubmit={(e) => { e.preventDefault(); void confirmDisqualify(); }}
                    >
                        <h3 className="mb-2">Disqualify this score?</h3>
                        <p className="text-muted mb-3" style={{ fontSize: 13 }}>
                            The athlete will see the reason you give. Their next-fastest verified
                            piece becomes their ranked score.
                        </p>

                        <label>
                            <span style={{ fontSize: 13 }}>Reason</span>
                            <input
                                autoFocus
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder="e.g. Piece rowed on a machine not entered in this event"
                            />
                        </label>

                        <div className="flex justify-end gap-[10px] flex-wrap mt-4">
                            <button
                                type="button"
                                className="btn-ghost min-w-[110px]"
                                onClick={() => setPendingDq(null)}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="btn-primary min-w-[110px]"
                                disabled={!reason.trim()}
                            >
                                Disqualify
                            </button>
                        </div>
                    </form>
                </div>
            )}

        </div>
    );
}
