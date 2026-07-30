import { useEffect, useMemo, useState } from "react";
import { subscribeToEventPayments } from "../../../api/events";
import type { EventCategory, EventPayment } from "../../../types";

// Destination-charge split: the host's transfer is exactly 90% of entry fees;
// the 10% platform fee + Stripe processing costs come out of the payer passthrough.
// Mirrors calcFeeBreakdown in the Cloud Functions.
const HOST_SHARE = 0.9;

const ACTIVE_BOAT_STATUSES = new Set(["registered", "in_progress", "finished"]);

const PAYMENT_STATUS: Record<EventPayment["status"], { label: string; color: string }> = {
    held:      { label: "Held",     color: "#FEB959" },
    succeeded: { label: "Paid out", color: "#22c55e" },
    refunded:  { label: "Refunded", color: "var(--muted)" },
    disputed:  { label: "Disputed", color: "#ff6b6b" },
};

function fmtCents(cents: number) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function fmtDate(ts: any): string {
    if (!ts) return "—";
    try {
        const d: Date = ts.toDate ? ts.toDate() : new Date(ts);
        return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
    } catch { return "—"; }
}

export default function FinancesTab({ event, boats = [] }: any) {
    const [payments, setPayments] = useState<EventPayment[]>([]);
    const [loading, setLoading]   = useState(true);
    const [error, setError]       = useState<string | null>(null);

    useEffect(() => {
        if (!event?.id) return;
        const unsub = subscribeToEventPayments(
            event.id,
            (p) => { setPayments(p); setLoading(false); },
            (e) => { setError(e.message); setLoading(false); }
        );
        return unsub;
    }, [event?.id]);

    const categories: EventCategory[] = useMemo(() => event?.categories ?? [], [event?.categories]);
    const hasPaidCategories = categories.some(c => (c.feeCents ?? 0) > 0);

    const feeByCategoryId = useMemo(
        () => new Map(categories.map(c => [c.id, c.feeCents ?? 0])),
        [categories]
    );

    const summary = useMemo(() => {
        const active   = payments.filter(p => p.status !== "refunded");
        const refunded = payments.filter(p => p.status === "refunded");

        // Per-payment rounding matches the backend transfer amount exactly.
        const grossFees  = active.reduce((s, p) => s + (p.eventFeeCents ?? 0), 0);
        const hostNet    = active.reduce((s, p) => s + Math.round((p.eventFeeCents ?? 0) * HOST_SHARE), 0);
        const platformCut = active.reduce(
            (s, p) => s + ((p.totalChargedCents ?? 0) - Math.round((p.eventFeeCents ?? 0) * HOST_SHARE)), 0
        );
        const refundedTotal = refunded.reduce((s, p) => s + (p.totalChargedCents ?? 0), 0);

        // Pending crews auto-refund at the closing date if they never fill,
        // so their share of the payout is money the host can't count on yet.
        const pendingAtRisk = boats
            .filter((b: any) => b.status === "pending_crew")
            .reduce((s: number, b: any) => s + Math.round((feeByCategoryId.get(b.categoryId) ?? 0) * HOST_SHARE), 0);

        const disputed = payments.some(p => p.status === "disputed");

        return { grossFees, hostNet, platformCut, refundedTotal, pendingAtRisk, disputed };
    }, [payments, boats, feeByCategoryId]);

    const categoryRows = useMemo(() => {
        return categories
            .filter(c => (c.feeCents ?? 0) > 0)
            .map(c => {
                const catBoats = boats.filter((b: any) => b.categoryId === c.id);
                const paid    = catBoats.filter((b: any) => ACTIVE_BOAT_STATUSES.has(b.status)).length;
                const pending = catBoats.filter((b: any) => b.status === "pending_crew").length;
                const fee = c.feeCents ?? 0;
                return {
                    id: c.id,
                    name: c.name,
                    fee,
                    paid,
                    pending,
                    collected: fee * (paid + pending),
                    atRisk: fee * pending,
                };
            })
            .filter(r => r.paid + r.pending > 0);
    }, [categories, boats]);

    const boatById = useMemo(
        () => new Map(boats.map((b: any) => [b.id, b])),
        [boats]
    );

    const entriesLabel = (p: EventPayment): string => {
        if (p.boatIds?.length) return `${p.boatIds.length} crew${p.boatIds.length === 1 ? "" : "s"}`;
        const boat: any = p.boatId ? boatById.get(p.boatId) : null;
        return boat?.categoryName ?? boat?.category ?? "1 entry";
    };

    if (loading) return <div className="loading">Loading finances…</div>;

    if (error) {
        return <p className="text-[#ff6b6b] text-[13px]">Failed to load payments: {error}</p>;
    }

    if (!hasPaidCategories && payments.length === 0) {
        return (
            <section className="card">
                <h2>Finances</h2>
                <p className="text-muted text-[13px] m-0">
                    This event has no paid categories, so there is nothing to show here.
                    Set entry fees on the Categories tab to start collecting payments.
                </p>
            </section>
        );
    }

    return (
        <div className="flex flex-col gap-5 bg-bg text-text">

            <section className="card">
                <h2>Revenue</h2>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-4">
                    <Stat label="Entry Fees Collected" value={fmtCents(summary.grossFees)} />
                    <Stat label={`Your Payout (${HOST_SHARE * 100}%)`} value={fmtCents(summary.hostNet)} highlight />
                    <Stat label="Platform & Processing" value={fmtCents(summary.platformCut)} />
                    <Stat label="Refunded to Payers" value={fmtCents(summary.refundedTotal)} />
                </div>
                <p className="text-muted text-[12px] mt-3 mb-0">
                    Payers cover Stripe processing costs on top of the entry fee. Your payout is
                    {" "}{HOST_SHARE * 100}% of collected entry fees, transferred to your connected Stripe account.
                </p>
            </section>

            <section className="card">
                <h2>Exposure</h2>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-4">
                    <Stat
                        label="Refund Liability"
                        value={fmtCents(summary.hostNet)}
                        alert={summary.hostNet > 0}
                    />
                    <Stat
                        label="Pending Crews At Risk"
                        value={fmtCents(summary.pendingAtRisk)}
                        alert={summary.pendingAtRisk > 0}
                    />
                </div>
                <p className="text-muted text-[12px] mt-3 mb-0">
                    Refund liability is the payout clawed back if the event is cancelled — every active
                    booking is refunded in full. Pending crews are refunded automatically at the closing
                    date if they never fill, so that portion of your payout is not secure yet.
                </p>
                {summary.disputed && (
                    <p className="text-[#ff6b6b] text-[13px] mt-2 mb-0">
                        One or more payments are disputed — check your Stripe dashboard.
                    </p>
                )}
            </section>

            {categoryRows.length > 0 && (
                <section className="card">
                    <h2>By Category</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-[13px]">
                            <thead>
                                <tr className="text-muted uppercase text-[11px] tracking-[0.05em]">
                                    <Th align="left">Category</Th>
                                    <Th>Fee</Th>
                                    <Th>Paid Crews</Th>
                                    <Th>Pending</Th>
                                    <Th>Entry Fees</Th>
                                    <Th>At Risk</Th>
                                </tr>
                            </thead>
                            <tbody>
                                {categoryRows.map(r => (
                                    <tr key={r.id} className="border-t border-border">
                                        <Td align="left">{r.name}</Td>
                                        <Td>{fmtCents(r.fee)}</Td>
                                        <Td>{r.paid}</Td>
                                        <Td>{r.pending}</Td>
                                        <Td>{fmtCents(r.collected)}</Td>
                                        <Td alert={r.atRisk > 0}>{fmtCents(r.atRisk)}</Td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            <section className="card">
                <h2>Payments</h2>
                {payments.length === 0 ? (
                    <p className="text-muted text-[13px] m-0">No payments received yet.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-[13px]">
                            <thead>
                                <tr className="text-muted uppercase text-[11px] tracking-[0.05em]">
                                    <Th align="left">Date</Th>
                                    <Th align="left">Entries</Th>
                                    <Th>Entry Fees</Th>
                                    <Th>Charged</Th>
                                    <Th>Status</Th>
                                </tr>
                            </thead>
                            <tbody>
                                {payments.map(p => {
                                    const s = PAYMENT_STATUS[p.status] ?? PAYMENT_STATUS.held;
                                    return (
                                        <tr key={p.id} className="border-t border-border">
                                            <Td align="left">{fmtDate(p.createdAt)}</Td>
                                            <Td align="left">{entriesLabel(p)}</Td>
                                            <Td>{fmtCents(p.eventFeeCents ?? 0)}</Td>
                                            <Td>{fmtCents(p.totalChargedCents ?? 0)}</Td>
                                            <td className="text-right px-2 py-[10px] font-bold" style={{ color: s.color }}>
                                                {s.label}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
}

function Stat({ label, value, highlight, alert }: any) {
    const border = alert
        ? "border-[rgba(255,107,107,0.25)] bg-[rgba(255,107,107,0.08)]"
        : highlight
            ? "border-[rgba(254,185,89,0.35)] bg-[rgba(254,185,89,0.08)]"
            : "border-border bg-surface";
    return (
        <div className={`p-[14px] rounded-[8px] flex flex-col border ${border}`}>
            <span className="text-[22px] font-semibold text-text">{value}</span>
            <span className="text-[11px] text-muted">{label}</span>
        </div>
    );
}

function Th({ children, align = "right" }: any) {
    return (
        <th className={`px-2 pb-[10px] pt-[6px] font-semibold ${align === "left" ? "text-left" : "text-right"}`}>
            {children}
        </th>
    );
}

function Td({ children, align = "right", alert }: any) {
    return (
        <td className={`px-2 py-[10px] ${align === "left" ? "text-left" : "text-right"} ${alert ? "text-[#ff6b6b]" : ""}`}>
            {children}
        </td>
    );
}
