import { useEffect, useMemo, useState } from "react";
import {
    collection, doc, documentId, getDoc, getDocs, orderBy, query, where,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../../../../../shared/lib/firebase";
import { useAuth } from "../../../../../providers/AuthProvider";

type ReviewDoc = {
    id: string;
    eventId: string;
    reviewerId: string;
    hostId: string;
    rating: number;
    comment?: string;
    createdAt: any;
};

type Props = {
    eventId: string;
    hostId: string;
};

function Stars({ rating, interactive, onSelect }: { rating: number; interactive?: boolean; onSelect?: (n: number) => void }) {
    const [hover, setHover] = useState(0);
    return (
        <div className={interactive ? "ep-star-selector" : "ep-stars"}>
            {[1, 2, 3, 4, 5].map((n) => (
                interactive ? (
                    <button
                        key={n}
                        type="button"
                        className={`ep-star-btn${n <= (hover || rating) ? " ep-star-btn--selected" : ""}`}
                        onMouseEnter={() => setHover(n)}
                        onMouseLeave={() => setHover(0)}
                        onClick={() => onSelect?.(n)}
                    >★</button>
                ) : (
                    <span key={n} className={`ep-star${n <= Math.round(rating) ? " ep-star--filled" : ""}`}>★</span>
                )
            ))}
        </div>
    );
}

function formatDate(ts: any) {
    if (!ts) return "";
    const d = typeof ts?.toDate === "function" ? ts.toDate() : ts instanceof Date ? ts : new Date(ts);
    return d.toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" });
}

function reviewerInitials(name: string) {
    const parts = name.split(" ");
    if (parts.length >= 2) return `${parts[0]} ${parts[1].charAt(0)}.`;
    return parts[0];
}

export default function ReviewsTab({ eventId, hostId }: Props) {
    const { user } = useAuth() as any;

    const [reviews, setReviews] = useState<ReviewDoc[]>([]);
    const [reviewerNames, setReviewerNames] = useState<Map<string, string>>(new Map());
    const [eventLabels, setEventLabels] = useState<Map<string, string>>(new Map());
    const [loading, setLoading] = useState(true);

    // Eligibility checks
    const [canReview, setCanReview] = useState(false);
    const [alreadyReviewed, setAlreadyReviewed] = useState(false);

    // Submission form
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [submitErr, setSubmitErr] = useState<string | null>(null);
    const [submitted, setSubmitted] = useState(false);

    useEffect(() => {
        if (!hostId) return;
        (async () => {
            setLoading(true);
            try {
                const snap = await getDocs(
                    query(
                        collection(db, "reviews"),
                        where("hostId", "==", hostId),
                        orderBy("createdAt", "desc")
                    )
                );
                const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ReviewDoc));
                setReviews(docs);

                // Batch-fetch reviewer display names
                const uids = Array.from(new Set(docs.map((r) => r.reviewerId)));
                const nameMap = new Map<string, string>();
                for (let i = 0; i < uids.length; i += 10) {
                    const batch = uids.slice(i, i + 10);
                    const usersSnap = await getDocs(
                        query(collection(db, "users"), where(documentId(), "in", batch))
                    );
                    usersSnap.docs.forEach((d) => {
                        const data = d.data();
                        nameMap.set(d.id, data.displayName ?? data.fullName ?? "Rower");
                    });
                }
                setReviewerNames(nameMap);

                // Batch-fetch event names and years
                const eventIds = Array.from(new Set(docs.map((r) => r.eventId)));
                const labelMap = new Map<string, string>();
                for (let i = 0; i < eventIds.length; i += 10) {
                    const batch = eventIds.slice(i, i + 10);
                    const eventsSnap = await getDocs(
                        query(collection(db, "events"), where(documentId(), "in", batch))
                    );
                    eventsSnap.docs.forEach((d) => {
                        const data = d.data();
                        const year = data.startAt?.toDate?.()?.getFullYear()
                            ?? data.endAt?.toDate?.()?.getFullYear()
                            ?? new Date().getFullYear();
                        labelMap.set(d.id, `${data.name ?? "Event"} · ${year}`);
                    });
                }
                setEventLabels(labelMap);
            } finally {
                setLoading(false);
            }
        })();
    }, [hostId]);

    // Check if signed-in user can submit a review
    useEffect(() => {
        if (!user || !eventId) return;
        (async () => {
            // Already reviewed?
            const reviewDocId = `${eventId}_${user.uid}`;
            const existingReview = await getDoc(doc(db, "reviews", reviewDocId));
            if (existingReview.exists()) {
                setAlreadyReviewed(true);
                return;
            }

            // Event must have ended
            const eventDoc = await getDoc(doc(db, "events", eventId));
            if (!eventDoc.exists) return;
            const endAt = eventDoc.data()?.endAt;
            if (endAt && endAt.toDate() > new Date()) return;

            // Participation check: confirmed payment (paid events) …
            const paymentsSnap = await getDocs(
                query(
                    collection(db, "payments"),
                    where("eventId", "==", eventId),
                    where("payerId", "==", user.uid),
                    where("status", "in", ["held", "released"])
                )
            );
            if (!paymentsSnap.empty) {
                setCanReview(true);
                return;
            }

            // … or listed as a rower in any boat (free / timing events)
            const boatsSnap = await getDocs(
                query(
                    collection(db, "events", eventId, "boats"),
                    where("rowerUids", "array-contains", user.uid)
                )
            );
            if (!boatsSnap.empty) setCanReview(true);
        })();
    }, [user, eventId]);

    const avgRating = useMemo(() => {
        if (!reviews.length) return null;
        return reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
    }, [reviews]);

    async function handleSubmitReview(e: React.FormEvent) {
        e.preventDefault();
        if (!rating) return;
        setSubmitting(true);
        setSubmitErr(null);
        try {
            const fn = httpsCallable(functions, "submitReview");
            await fn({ eventId, rating, comment });
            setSubmitted(true);
            setCanReview(false);
            // Add the submitted review to the local list optimistically
            const newReview: ReviewDoc = {
                id: `${eventId}_${user.uid}`,
                eventId,
                reviewerId: user.uid,
                hostId,
                rating,
                comment,
                createdAt: new Date(),
            };
            setReviews((prev) => [newReview, ...prev]);
        } catch (err: any) {
            setSubmitErr(err?.message ?? "Failed to submit review.");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div>
            {/* Summary header */}
            <div className="card ep-reviews-header">
                {avgRating != null ? (
                    <>
                        <div>
                            <div className="ep-star-big">{avgRating.toFixed(1)}</div>
                            <div className="ep-star-sub">{reviews.length} {reviews.length === 1 ? "review" : "reviews"}</div>
                        </div>
                        <Stars rating={avgRating} />
                    </>
                ) : (
                    <p className="ep-muted">No reviews for this host yet.</p>
                )}
            </div>

            {/* Submit form */}
            {canReview && !submitted && (
                <form className="card ep-review-form" onSubmit={handleSubmitReview}>
                    <h3>Leave a Review</h3>

                    <label className="ep-field-label">Your rating</label>
                    <Stars rating={rating} interactive onSelect={setRating} />

                    <label className="ep-field-label" style={{ marginTop: "0.75rem" }}>
                        Comment (optional)
                    </label>
                    <textarea
                        className="ep-comment-area"
                        maxLength={500}
                        placeholder="Tell future rowers about your experience…"
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                    />
                    <div className="ep-char-count">{comment.length}/500</div>

                    {submitErr && <p className="ep-error-text">{submitErr}</p>}

                    <button
                        type="submit"
                        className="ep-pay-btn"
                        style={{ marginTop: "0.75rem" }}
                        disabled={!rating || submitting}
                    >
                        {submitting ? "Submitting…" : "Submit Review"}
                    </button>
                </form>
            )}

            {submitted && (
                <div className="ep-success-banner">Review submitted — thank you!</div>
            )}

            {alreadyReviewed && (
                <div className="ep-info-box" style={{ marginBottom: "1rem" }}>
                    You've already left a review for this event.
                </div>
            )}

            {!user && (
                <div className="ep-info-box" style={{ marginBottom: "1rem" }}>
                    <a href="/auth" className="ep-link">Sign in</a> to leave a review after attending an event.
                </div>
            )}

            {/* Reviews list */}
            {loading ? (
                <div className="ep-skeleton-bar" style={{ height: 80, borderRadius: 8 }} />
            ) : reviews.length === 0 ? (
                <p className="ep-muted">No reviews yet — be the first!</p>
            ) : (
                reviews.map((r) => (
                    <div key={r.id} className="card ep-review-card">
                        <div className="ep-review-top">
                            <div className="ep-reviewer-name">
                                {reviewerInitials(reviewerNames.get(r.reviewerId) ?? "Rower")}
                            </div>
                            <div className="ep-review-date">{formatDate(r.createdAt)}</div>
                        </div>
                        {eventLabels.get(r.eventId) && (
                            <div className="ep-review-event">{eventLabels.get(r.eventId)}</div>
                        )}
                        <Stars rating={r.rating} />
                        {r.comment && <p className="ep-review-text">{r.comment}</p>}
                    </div>
                ))
            )}
        </div>
    );
}
