import { useMemo, useState } from "react";
import { useUserProfiles } from "../useUserProfiles";
import type { BoatTimingDoc } from "../types";
import { confirmBoatTime, discardBoatTime, markBoatDNF, markBoatDNS, returnBoatToStartList } from "../api/timing";
import { formatElapsedTime, formatRowerNames } from "../lib/utils";
import Modal from "../../../shared/components/Modal/Modal";

type PendingAction = {
    title: string;
    message: string;
    onConfirm: () => void;
};

interface ReviewTabProps {
    eventId: string;
    boats: BoatTimingDoc[];
}

export default function ReviewTab({ eventId, boats }: ReviewTabProps) {
    const [busy, setBusy] = useState<Record<string, boolean>>({});
    const [msgs, setMsgs] = useState<Record<string, string>>({});
    const [pending, setPending] = useState<PendingAction | null>(null);

    const reviewBoats = useMemo(
        () =>
            boats
                .filter(b => b.status === "under_review")
                .sort((a, b) => (a.bowNumber ?? 0) - (b.bowNumber ?? 0)),
        [boats]
    );

    const allUids = useMemo(() => {
        const uids = new Set<string>();
        reviewBoats.forEach(b => b.rowerUids.forEach(uid => uids.add(uid)));
        return Array.from(uids);
    }, [reviewBoats]);

    const { profiles } = useUserProfiles(allUids);

    const showMsg = (boatId: string, msg: string) => {
        setMsgs(prev => ({ ...prev, [boatId]: msg }));
        setTimeout(() => setMsgs(prev => { const n = { ...prev }; delete n[boatId]; return n; }), 3000);
    };

    const run = (boat: BoatTimingDoc, fn: () => Promise<void>, errMsg: string) => async () => {
        setPending(null);
        setBusy(prev => ({ ...prev, [boat.id]: true }));
        try {
            await fn();
        } catch {
            showMsg(boat.id, errMsg);
        } finally {
            setBusy(prev => ({ ...prev, [boat.id]: false }));
        }
    };

    const ask = (action: PendingAction) => setPending(action);

    if (reviewBoats.length === 0) {
        return (
            <div className="review-tab">
                <p style={{ color: "var(--muted)" }}>No times under review</p>
            </div>
        );
    }

    return (
        <div className="review-tab">
            <p className="review-tab-notice">
                These times were flagged as unusually fast. Confirm to publish, or
                choose an action to correct the result.
            </p>

            {pending && (
                <Modal
                    title={pending.title}
                    message={pending.message}
                    onClose={() => setPending(null)}
                    actions={[
                        { label: "Confirm", onClick: pending.onConfirm, variant: "primary" },
                        { label: "Cancel",  onClick: () => setPending(null), variant: "secondary" },
                    ]}
                />
            )}

            {reviewBoats.map(boat => {
                const elapsed =
                    boat.startedAt != null && boat.finishedAt != null
                        ? boat.finishedAt - boat.startedAt
                        : null;
                const isBusy = !!busy[boat.id];

                return (
                    <div key={boat.id} className="review-boat-card">
                        <div className="review-boat-main">
                            <span className="review-boat-id">
                                #{boat.bowNumber} {boat.clubName}
                            </span>
                            <span className="review-boat-rowers">
                                {formatRowerNames(boat.rowerUids, profiles, boat.boatSize)}
                            </span>
                            <span className="review-boat-category">{boat.categoryName}</span>
                        </div>

                        <div className="review-boat-time">
                            <span className="review-time-label">Recorded time</span>
                            <span className="review-time">
                                {elapsed != null ? formatElapsedTime(elapsed) : "—"}
                            </span>
                            <span className="review-flag">
                                {boat.reviewReason === "manual" ? "Flagged by admin" : "⚠ Unusually fast"}
                            </span>
                        </div>

                        <div className="review-boat-actions">
                            <button
                                className="btn-primary"
                                onClick={() => ask({
                                    title: "Confirm this time?",
                                    message: `Publish the recorded time for #${boat.bowNumber} ${boat.clubName}. It will appear on the results screen immediately.`,
                                    onConfirm: run(boat, () => confirmBoatTime(eventId, boat.id), "Failed to confirm — try again"),
                                })}
                                disabled={isBusy}
                            >
                                {isBusy ? "Saving…" : "Confirm"}
                            </button>
                            <button
                                className="btn-ghost review-btn-danger"
                                onClick={() => ask({
                                    title: "Mark as DNF?",
                                    message: `Mark #${boat.bowNumber} ${boat.clubName} as Did Not Finish. They will appear at the bottom of results with a DNF status.`,
                                    onConfirm: run(boat, () => markBoatDNF(eventId, boat.id), "Failed to mark DNF — try again"),
                                })}
                                disabled={isBusy}
                            >
                                DNF
                            </button>
                            <button
                                className="btn-ghost review-btn-danger"
                                onClick={() => ask({
                                    title: "Mark as DNS?",
                                    message: `Mark #${boat.bowNumber} ${boat.clubName} as Did Not Start. They will be removed from results.`,
                                    onConfirm: run(boat, () => markBoatDNS(eventId, boat.id), "Failed to mark DNS — try again"),
                                })}
                                disabled={isBusy}
                            >
                                DNS
                            </button>
                            <button
                                className="btn-ghost"
                                onClick={() => ask({
                                    title: "Return to In Progress?",
                                    message: `Send #${boat.bowNumber} ${boat.clubName} back to In Progress. You can stop the clock again when they cross the line.`,
                                    onConfirm: run(boat, () => discardBoatTime(eventId, boat.id), "Failed to return to in progress — try again"),
                                })}
                                disabled={isBusy}
                            >
                                In Progress
                            </button>
                            <button
                                className="btn-ghost"
                                onClick={() => ask({
                                    title: "Return to Start List?",
                                    message: `Reset #${boat.bowNumber} ${boat.clubName} completely. All timing data will be cleared and they will return to the Start tab.`,
                                    onConfirm: run(boat, () => returnBoatToStartList(eventId, boat.id), "Failed to return to start list — try again"),
                                })}
                                disabled={isBusy}
                            >
                                Start List
                            </button>
                        </div>

                        {msgs[boat.id] && (
                            <span className="review-msg">{msgs[boat.id]}</span>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
