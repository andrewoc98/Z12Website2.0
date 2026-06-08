import { useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs, limit, orderBy, query, startAfter, where } from "firebase/firestore";
import type { QueryDocumentSnapshot } from "firebase/firestore";
import { Link } from "react-router-dom";
import Navbar from "../../../shared/components/Navbar/Navbar";
import { db } from "../../../shared/lib/firebase";
import { useAuth } from "../../../providers/AuthProvider";
import { formatCents } from "../types";
import type { PaymentDoc } from "../types";
import styles from "./MyOrdersPage.module.css";

const PAGE_SIZE = 10;

type OrderWithEvent = PaymentDoc & {
    id: string;
    eventName?: string;
    eventDate?: string;
    eventEndDate?: Date;
    eventLocation?: string;
};

const STATUS_LABEL: Record<string, string> = {
    pending:   "Awaiting Payment",
    held:      "Registered",
    released:  "Registered",
    confirmed: "Event Confirmed",
    refunded:  "Refunded",
};

type Filter = "all" | "upcoming" | "past";

async function enrichWithEvents(raw: OrderWithEvent[]): Promise<OrderWithEvent[]> {
    const eventIds = [...new Set(raw.map((p) => p.eventId))];
    const eventMap: Record<string, any> = {};
    await Promise.all(
        eventIds.map(async (eid) => {
            const eSnap = await getDoc(doc(db, "events", eid));
            if (eSnap.exists()) eventMap[eid] = eSnap.data();
        })
    );
    return raw.map((p) => {
        const e = eventMap[p.eventId];
        return {
            ...p,
            eventName:     e?.name,
            eventDate:     e?.startAt?.toDate?.()?.toLocaleDateString("en-US", {
                year: "numeric", month: "long", day: "numeric",
            }),
            eventEndDate:  e?.endAt?.toDate?.() as Date | undefined,
            eventLocation: e?.location,
        };
    });
}

export default function MyOrdersPage() {
    const { user } = useAuth() as any;
    const [orders, setOrders] = useState<OrderWithEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [cursor, setCursor] = useState<QueryDocumentSnapshot | null>(null);
    const [filter, setFilter] = useState<Filter>("all");

    useEffect(() => {
        if (!user) return;
        setOrders([]);
        setCursor(null);
        setHasMore(false);
        setLoading(true);

        (async () => {
            const q = query(
                collection(db, "payments"),
                where("payerId", "==", user.uid),
                orderBy("createdAt", "desc"),
                limit(PAGE_SIZE + 1)
            );
            const snap = await getDocs(q);
            const more = snap.docs.length > PAGE_SIZE;
            const docs = snap.docs.slice(0, PAGE_SIZE);
            const raw = docs.map((d) => ({ id: d.id, ...d.data() } as OrderWithEvent));
            const enriched = await enrichWithEvents(raw);
            setOrders(enriched);
            setHasMore(more);
            setCursor(docs[docs.length - 1] ?? null);
            setLoading(false);
        })();
    }, [user]);

    async function loadMore() {
        if (!user || !cursor) return;
        setLoadingMore(true);
        const q = query(
            collection(db, "payments"),
            where("payerId", "==", user.uid),
            orderBy("createdAt", "desc"),
            startAfter(cursor),
            limit(PAGE_SIZE + 1)
        );
        const snap = await getDocs(q);
        const more = snap.docs.length > PAGE_SIZE;
        const docs = snap.docs.slice(0, PAGE_SIZE);
        const raw = docs.map((d) => ({ id: d.id, ...d.data() } as OrderWithEvent));
        const enriched = await enrichWithEvents(raw);
        setOrders((prev) => [...prev, ...enriched]);
        setHasMore(more);
        setCursor(docs[docs.length - 1] ?? null);
        setLoadingMore(false);
    }

    const now = new Date();
    const visible = orders.filter((o) => {
        if (filter === "upcoming") return !o.eventEndDate || o.eventEndDate >= now;
        if (filter === "past")     return !!o.eventEndDate && o.eventEndDate < now;
        return true;
    });

    return (
        <>
            <Navbar />
            <main className={styles.page}>
                <div className={styles.container}>
                    <h1 className={styles.title}>My Registrations</h1>
                    <p className={styles.subtitle}>Your event registrations and payment history.</p>

                    <div className={styles.filters}>
                        {(["all", "upcoming", "past"] as Filter[]).map((f) => (
                            <button
                                key={f}
                                className={filter === f ? "btn-primary" : "btn-ghost"}
                                onClick={() => setFilter(f)}
                            >
                                {f}
                            </button>
                        ))}
                    </div>

                    {loading && <p style={{ color: "var(--muted)" }}>Loading…</p>}

                    {!loading && visible.length === 0 && (
                        <div className={styles.emptyState}>
                            <p>
                                {filter === "all"
                                    ? "You haven't registered for any events yet."
                                    : `No ${filter} registrations.`}
                            </p>
                            <Link to="/events" className="btn-primary">Browse Races →</Link>
                        </div>
                    )}

                    {!loading && visible.map((order) => (
                        <div key={order.id} className={`card ${styles.card}`}>
                            <div className={styles.cardHeader}>
                                <span className={styles.eventName}>{order.eventName ?? "Event"}</span>
                                <span className={styles.badge} data-status={order.status}>
                                    {STATUS_LABEL[order.status] ?? order.status}
                                </span>
                            </div>

                            {order.eventDate && (
                                <p className={styles.meta}>{order.eventDate}</p>
                            )}
                            {order.eventLocation && (
                                <p className={styles.metaLocation}>{order.eventLocation}</p>
                            )}

                            <div className={styles.breakdown}>
                                <div className={styles.breakdownRow}>
                                    <span>Event Fee</span>
                                    <span>{formatCents(order.eventFeeCents)}</span>
                                </div>
                                <div className={styles.breakdownRow}>
                                    <span>Processing Fee</span>
                                    <span>{formatCents(order.processingFeeCents)}</span>
                                </div>
                                <div className={styles.totalRow}>
                                    <span>Total Paid</span>
                                    <span>{formatCents(order.totalChargedCents)}</span>
                                </div>
                            </div>

                            <div className={styles.cardFooter}>
                                <Link to={`/events/${order.eventId}`}>View Event →</Link>
                            </div>
                        </div>
                    ))}

                    {hasMore && (
                        <div className={styles.loadMore}>
                            <button
                                className="btn-ghost"
                                onClick={loadMore}
                                disabled={loadingMore}
                            >
                                {loadingMore ? "Loading…" : "Load more"}
                            </button>
                        </div>
                    )}
                </div>
            </main>
        </>
    );
}
