import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "../../../../../shared/lib/firebase";
import type { EventDoc } from "../../../types";
import { formatCents } from "../../../../../features/payments/types";

type Props = {
    event: EventDoc & { [key: string]: any };
    hostId: string;
    onRegisterClick: () => void;
};

function Stars({ rating }: { rating: number }) {
    return (
        <span className="ep-stars">
            {[1, 2, 3, 4, 5].map((n) => (
                <span key={n} className={`ep-star${n <= Math.round(rating) ? " ep-star--filled" : ""}`}>★</span>
            ))}
        </span>
    );
}

function formatDate(ts: any) {
    if (!ts) return "—";
    const d = typeof ts?.toDate === "function" ? ts.toDate()
        : ts instanceof Date ? ts
        : typeof ts === "string" ? new Date(ts)
        : null;
    if (!d || isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-IE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export default function OverviewTab({ event, hostId, onRegisterClick }: Props) {
    const [hostName, setHostName] = useState<string>("");
    const [avgRating, setAvgRating] = useState<number | null>(null);
    const [reviewCount, setReviewCount] = useState(0);

    useEffect(() => {
        if (!hostId) return;
        getDoc(doc(db, "users", hostId)).then((snap) => {
            if (snap.exists()) {
                const d = snap.data();
                setHostName(d.displayName ?? d.fullName ?? d.roles?.host?.name ?? "Host");
            }
        });
    }, [hostId]);

    useEffect(() => {
        if (!hostId) return;
        getDocs(query(collection(db, "reviews"), where("hostId", "==", hostId))).then((snap) => {
            if (snap.empty) return;
            const ratings = snap.docs.map((d) => d.data().rating as number);
            setReviewCount(ratings.length);
            setAvgRating(ratings.reduce((a, b) => a + b, 0) / ratings.length);
        });
    }, [hostId]);

    const lowestCategoryFee = useMemo(() => {
        const fees = (event.categories ?? [])
            .map((c: any) => c.feeCents as number | undefined)
            .filter((f): f is number => typeof f === "number" && f > 0);
        return fees.length ? Math.min(...fees) : null;
    }, [event.categories]);

    return (
        <div className="ep-overview-grid">
            {/* Event details */}
            <div className="card ep-info-card">
                <h3 style={{ marginBottom: "0.75rem", fontSize: "0.95rem" }}>Event Details</h3>
                <div className="ep-info-row">
                    <span className="ep-info-row-label">Location</span>
                    <span>{event.location}</span>
                </div>
                {event.startDate && (
                    <div className="ep-info-row">
                        <span className="ep-info-row-label">Start</span>
                        <span>{formatDate(event.startDate)}</span>
                    </div>
                )}
                {event.endDate && (
                    <div className="ep-info-row">
                        <span className="ep-info-row-label">End</span>
                        <span>{formatDate(event.endDate)}</span>
                    </div>
                )}
                {event.lengthMeters && (
                    <div className="ep-info-row">
                        <span className="ep-info-row-label">Course</span>
                        <span>{event.lengthMeters}m</span>
                    </div>
                )}
                {(event.categories ?? []).length > 0 && (
                    <div className="ep-info-row">
                        <span className="ep-info-row-label">Categories</span>
                        <span>{event.categories.length} available</span>
                    </div>
                )}
            </div>

            {/* Host card */}
            {hostName && (
                <div className="card ep-host-card">
                    <div className="ep-host-avatar">
                        {hostName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div className="ep-host-name">{hostName}</div>
                        <div className="ep-host-rating">
                            {avgRating != null ? (
                                <>
                                    <Stars rating={avgRating} />
                                    {" "}{avgRating.toFixed(1)} ({reviewCount} {reviewCount === 1 ? "review" : "reviews"})
                                </>
                            ) : (
                                "No reviews yet"
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Entry fee */}
            {lowestCategoryFee != null && (
                <div className="ep-fee-display">
                    <div className="ep-fee-display-label">Entry fee from</div>
                    <div className="ep-fee-display-amount">
                        {formatCents(lowestCategoryFee)}
                        <span style={{ fontSize: "0.75rem", fontWeight: 400, color: "var(--muted)", marginLeft: "0.4rem" }}>
                            + ~{formatCents(Math.ceil((lowestCategoryFee + 30) / 0.971) - lowestCategoryFee)} processing fee
                        </span>
                    </div>
                </div>
            )}

            {/* Register CTA */}
            {event.status === "open" && (
                <button className="ep-cta-btn" onClick={onRegisterClick}>
                    Register for this Event →
                </button>
            )}
        </div>
    );
}
