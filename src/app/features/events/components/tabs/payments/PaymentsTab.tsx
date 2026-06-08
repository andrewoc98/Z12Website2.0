import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../../../../shared/lib/firebase";
import { formatCents } from "../../../../../features/payments/types";
import type { PaymentDoc } from "../../../../../features/payments/types";

const STATUS_LABEL: Record<string, string> = {
    pending:   "Pending",
    held:      "Registered",
    confirmed: "Confirmed",
    refunded:  "Refunded",
};

const STATUS_COLOR: Record<string, string> = {
    pending:   "#ffd400",
    held:      "#22c55e",
    confirmed: "#3b82f6",
    refunded:  "#6b7280",
};

export default function PaymentsTab({ event }: { event: any }) {
    const [payments, setPayments] = useState<(PaymentDoc & { id: string })[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!event?.id) return;
        (async () => {
            const q = query(collection(db, "payments"), where("eventId", "==", event.id));
            const snap = await getDocs(q);
            setPayments(snap.docs.map((d) => ({ id: d.id, ...d.data() } as any)));
            setLoading(false);
        })();
    }, [event?.id]);

    const activePayments   = payments.filter((p) => p.status === "held" || (p.status as string) === "confirmed");
    const refundedPayments = payments.filter((p) => p.status === "refunded");
    const totalHeldCents     = activePayments.reduce((s, p) => s + (p.eventFeeCents ?? 0), 0);
    const totalRefundedCents = refundedPayments.reduce((s, p) => s + (p.eventFeeCents ?? 0), 0);

    if (loading) return <p style={{ color: "var(--muted)", padding: "1rem 0" }}>Loading payments…</p>;

    return (
        <div style={{ padding: "1rem 0" }}>
            {/* Summary cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(148px, 1fr))", gap: 12, marginBottom: "1.5rem" }}>
                {[
                    { label: "Registered",      value: String(activePayments.length) },
                    { label: "Revenue Held",     value: formatCents(totalHeldCents) },
                    { label: "Refunded",         value: String(refundedPayments.length) },
                    { label: "Refunded Amount",  value: formatCents(totalRefundedCents) },
                ].map(({ label, value }) => (
                    <div key={label} className="card" style={{ padding: "0.85rem 1rem" }}>
                        <div style={{ fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                            {label}
                        </div>
                        <div style={{ fontSize: "1.15rem", fontWeight: 600 }}>{value}</div>
                    </div>
                ))}
            </div>

            {payments.length === 0 ? (
                <p style={{ color: "var(--muted)" }}>No registrations yet.</p>
            ) : (
                <>
                    <div style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 130px 90px",
                        gap: 8,
                        padding: "0.4rem 0 0.6rem",
                        borderBottom: "1px solid rgba(255,255,255,0.1)",
                        fontSize: "0.72rem",
                        color: "var(--muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                    }}>
                        <span>Registered</span>
                        <span>Amount Paid</span>
                        <span>Status</span>
                    </div>

                    {payments.map((p) => (
                        <div key={p.id} style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 130px 90px",
                            gap: 8,
                            padding: "0.7rem 0",
                            borderBottom: "1px solid rgba(255,255,255,0.06)",
                            fontSize: "0.85rem",
                            alignItems: "center",
                        }}>
                            <span style={{ color: "var(--muted)" }}>
                                {p.createdAt?.toDate?.()?.toLocaleDateString("en-US", {
                                    month: "short", day: "numeric", year: "numeric",
                                }) ?? "—"}
                            </span>
                            <span>{formatCents(p.totalChargedCents)}</span>
                            <span style={{
                                display: "inline-block",
                                padding: "2px 8px",
                                borderRadius: 999,
                                fontSize: "0.72rem",
                                background: (STATUS_COLOR[p.status] ?? "#6b7280") + "22",
                                color: STATUS_COLOR[p.status] ?? "#6b7280",
                                border: `1px solid ${STATUS_COLOR[p.status] ?? "#6b7280"}44`,
                            }}>
                                {STATUS_LABEL[p.status] ?? p.status}
                            </span>
                        </div>
                    ))}
                </>
            )}
        </div>
    );
}
