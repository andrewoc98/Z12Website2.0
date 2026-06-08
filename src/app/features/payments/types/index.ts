export type PaymentStatus = "pending" | "held" | "released" | "refunded";

export type PaymentDoc = {
    id?: string;
    eventId: string;
    boatId: string;
    payerId: string;
    hostId: string;
    stripePaymentIntentId: string;
    eventFeeCents: number;
    processingFeeCents: number;
    totalChargedCents: number;
    status: PaymentStatus;
    stripeTransferId?: string;
    stripeRefundId?: string;
    processingFeeDeducted?: boolean;
    createdAt: any;
};

export type FeeBreakdown = {
    eventFeeCents: number;
    processingFeeCents: number;
    totalChargedCents: number;
};

export function calculateFeeBreakdown(eventFeeCents: number): FeeBreakdown {
    const grossed = (eventFeeCents + 30) / (1 - 0.029);
    const totalChargedCents = Math.ceil(grossed);
    const processingFeeCents = totalChargedCents - eventFeeCents;
    return { eventFeeCents, processingFeeCents, totalChargedCents };
}

export function formatCents(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`;
}
