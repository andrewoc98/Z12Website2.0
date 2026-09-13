import type { ConnectStatus } from "../services/stripeService";

/**
 * Collapsed-by-default readout of what Stripe currently reports for the
 * caller's Connect account. Onboarding failures are otherwise invisible — the
 * host just sees a spinner — so this exists to make them debuggable live,
 * without putting jargon in front of a host who doesn't need it.
 */
export default function StripeConnectDiagnostics({
    status,
    error,
    checking,
}: {
    status:   ConnectStatus | null;
    error:    { code?: string; message: string } | null;
    checking: boolean;
}) {
    if (!status && !error) return null;

    const rows: Array<[string, string]> = [];

    if (status) {
        rows.push(["Stripe account", status.accountId ?? "none linked"]);
        rows.push(["Details submitted", status.detailsSubmitted ? "yes" : "no"]);
        rows.push(["Payouts enabled", status.payoutsEnabled ? "yes" : "no"]);
        rows.push(["Charges enabled", status.chargesEnabled ? "yes" : "no"]);
        if (status.disabledReason) rows.push(["Disabled reason", status.disabledReason]);
        if (status.pastDue.length)      rows.push(["Past due", status.pastDue.join(", ")]);
        if (status.currentlyDue.length) rows.push(["Currently due", status.currentlyDue.join(", ")]);
        rows.push(["Last checked", new Date(status.checkedAt).toLocaleTimeString()]);
    }

    if (error) {
        rows.push(["Error", error.code ? `${error.code}: ${error.message}` : error.message]);
    }

    return (
        <details style={{ marginTop: 20, textAlign: "left" }}>
            <summary style={{ cursor: "pointer", fontSize: 13, color: "var(--muted)" }}>
                Technical details{checking ? " (checking…)" : ""}
            </summary>
            <dl style={{
                margin:       "12px 0 0",
                padding:      "12px 14px",
                background:   "var(--surface-2)",
                borderRadius: 8,
                fontSize:     12.5,
                lineHeight:   1.7,
            }}>
                {rows.map(([label, value]) => (
                    <div key={label} style={{ display: "flex", gap: 10 }}>
                        <dt style={{ color: "var(--muted)", minWidth: 130, flexShrink: 0 }}>{label}</dt>
                        <dd style={{ margin: 0, wordBreak: "break-word" }}>{value}</dd>
                    </div>
                ))}
            </dl>
        </details>
    );
}
