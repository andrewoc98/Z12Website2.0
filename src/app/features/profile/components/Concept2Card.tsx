import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../../shared/lib/firebase";
import Modal from "../../../shared/components/Modal/Modal";
import { startConcept2Link, unlinkConcept2 } from "../services/concept2Service";
import type { Concept2LinkState } from "../../events/types";

type Banner = { kind: "ok" | "err"; text: string };

const ERROR_COPY: Record<string, string> = {
    declined: "You cancelled the Concept2 authorisation.",
    expired: "That link request expired. Please try again.",
    invalid_request: "Concept2 sent back an incomplete response. Please try again.",
    exchange_failed: "Concept2 rejected the authorisation. Please try again.",
};

/**
 * Account-level Concept2 Logbook connection.
 *
 * The link is per-account rather than per-event: one OAuth grant covers every
 * indoor event the athlete ever enters. The tokens themselves live server-side
 * at users/{uid}/private/concept2 — this reads the public mirror on the user doc.
 */
export default function Concept2Card({ uid }: { uid: string }) {
    const [link, setLink] = useState<Concept2LinkState | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [confirmUnlink, setConfirmUnlink] = useState(false);

    const [params, setParams] = useSearchParams();
    // Banner raised by our own actions (unlink). The OAuth callback's banner is
    // derived from the URL below rather than mirrored into state.
    const [actionBanner, setActionBanner] = useState<Banner | null>(null);

    const callbackStatus = params.get("concept2");
    const callbackBanner: Banner | null = !callbackStatus
        ? null
        : callbackStatus === "linked"
            ? { kind: "ok", text: "Concept2 Logbook connected." }
            : {
                kind: "err",
                text: ERROR_COPY[params.get("reason") ?? ""] ?? "Could not connect your Concept2 Logbook.",
            };

    const banner = actionBanner ?? callbackBanner;

    // Strip the callback params once they've been read, so a refresh doesn't
    // replay the banner. Touches the router, not component state.
    useEffect(() => {
        if (!callbackStatus) return;
        const next = new URLSearchParams(params);
        next.delete("concept2");
        next.delete("reason");
        const timer = setTimeout(() => setParams(next, { replace: true }), 4000);
        return () => clearTimeout(timer);
    }, [callbackStatus, params, setParams]);

    useEffect(() => {
        return onSnapshot(
            doc(db, "users", uid),
            (snap) => {
                setLink((snap.data()?.concept2 as Concept2LinkState) ?? null);
                setLoading(false);
            },
            () => setLoading(false),
        );
    }, [uid]);

    async function handleConnect() {
        setBusy(true);
        setErr(null);
        try {
            const { url } = await startConcept2Link({});
            window.location.href = url;
        } catch (e) {
            setErr(e instanceof Error ? e.message : "Could not start the Concept2 connection.");
            setBusy(false);
        }
    }

    async function handleUnlink() {
        setConfirmUnlink(false);
        setBusy(true);
        setErr(null);
        try {
            await unlinkConcept2({});
            setActionBanner({ kind: "ok", text: "Concept2 Logbook disconnected." });
        } catch (e) {
            setErr(e instanceof Error ? e.message : "Could not disconnect your Concept2 Logbook.");
        } finally {
            setBusy(false);
        }
    }

    const linked = link?.linked === true;

    return (
        <section className="card profile-section">
            <h3 className="section-title">Concept2 Logbook</h3>

            {banner && (
                <div
                    style={{
                        marginBottom: 12,
                        padding: "10px 14px",
                        borderRadius: "var(--radius-sm)",
                        fontSize: 13,
                        background: banner.kind === "ok" ? "var(--brand-soft)" : "rgba(255,77,109,0.10)",
                        border: `1px solid ${banner.kind === "ok" ? "var(--brand)" : "var(--danger)"}`,
                        color: banner.kind === "ok" ? "var(--brand)" : "var(--danger)",
                    }}
                >
                    {banner.text}
                </div>
            )}

            {loading ? (
                <p className="muted" style={{ fontSize: 13 }}>Checking…</p>
            ) : linked ? (
                <>
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            flexWrap: "wrap",
                        }}
                    >
                        <span style={{ color: "var(--brand)", fontSize: 18 }}>✓</span>
                        <div>
                            <div style={{ fontWeight: 600, fontSize: 14 }}>
                                Connected as {link!.username}
                            </div>
                            <div className="muted" style={{ fontSize: 12.5 }}>
                                Your 2k scores import automatically for any indoor erg event you enter.
                            </div>
                        </div>
                        <button
                            type="button"
                            className="btn-ghost"
                            onClick={() => setConfirmUnlink(true)}
                            disabled={busy}
                            style={{ marginLeft: "auto" }}
                        >
                            Disconnect
                        </button>
                    </div>
                </>
            ) : (
                <>
                    <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
                        Connect your Concept2 Logbook to submit scores in indoor erg events.
                        We only read your workout results — we never post or change anything.
                        Only pieces Concept2 marks as verified (uploaded straight from a PM5 via
                        ErgData or the Concept2 Utility) can be ranked.
                    </p>
                    <button
                        type="button"
                        className="btn-primary"
                        onClick={handleConnect}
                        disabled={busy}
                    >
                        {busy ? "Opening Concept2…" : "Connect Concept2 Logbook →"}
                    </button>
                </>
            )}

            {err && <p className="text-[crimson]" style={{ fontSize: 13, marginTop: 10 }}>{err}</p>}

            {confirmUnlink && (
                <Modal
                    title="Disconnect Concept2?"
                    message="You will not be able to submit new erg scores until you reconnect. Scores already imported stay on their leaderboards."
                    onClose={() => setConfirmUnlink(false)}
                    actions={[
                        { label: "Cancel", onClick: () => setConfirmUnlink(false) },
                        { label: "Disconnect", variant: "primary", onClick: handleUnlink },
                    ]}
                />
            )}
        </section>
    );
}
