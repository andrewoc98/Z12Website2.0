import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../../shared/components/Navbar/Navbar";
import RequireAuth from "../../../guards/RequiredAuth";
import { useAuth } from "../../../providers/AuthProvider";
import { useClubCreationRequest } from "../hooks/useClubCreationRequest";
import { listActiveFederations } from "../services/federationService";
import { submitClubCreationRequest } from "../services/clubAdminService";
import { forceTokenRefresh } from "../services/federationService";
import type { ClubCreationRequest } from "../types/admin.types";
import "../styles/platformAdmin.css";
import "../styles/clubRequest.css";

// ── Stepper indicator ────────────────────────────────────────────────────────

const STEPS = ["Select federation", "Club details", "Review & submit"] as const;

function Stepper({ current }: { current: 1 | 2 | 3 }) {
    return (
        <div className="cr-stepper">
            {STEPS.map((label, i) => {
                const n    = (i + 1) as 1 | 2 | 3;
                const done = n < current;
                const active = n === current;
                return (
                    <>
                        {i > 0 && (
                            <div
                                key={`conn-${i}`}
                                className={`cr-connector${done ? " cr-connector--done" : ""}`}
                            />
                        )}
                        <div
                            key={n}
                            className={`cr-step${active ? " cr-step--active" : ""}${done ? " cr-step--done" : ""}`}
                        >
                            <div className="cr-step__circle">{done ? "✓" : n}</div>
                            <div className="cr-step__label">{label}</div>
                        </div>
                    </>
                );
            })}
        </div>
    );
}

// ── Status tracker ───────────────────────────────────────────────────────────

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-IE", {
        day: "numeric", month: "long", year: "numeric",
    });
}

function StatusTracker({ request }: { request: ClubCreationRequest }) {
    const navigate  = useNavigate();
    const [refreshing, setRefreshing] = useState(false);

    const isApproved = request.status === "approved";
    const isRejected = request.status === "rejected";
    const isPending  = request.status === "pending";

    async function goToDashboard() {
        setRefreshing(true);
        await forceTokenRefresh();
        navigate("/admin/club", { replace: true });
    }

    return (
        <div className="cr-tracker">

            {/* Step 1 — Submitted */}
            <div className="cr-tracker__step cr-tracker__step--done">
                <div className="cr-tracker__icon">✓</div>
                <div className="cr-tracker__body">
                    <div className="cr-tracker__title">Request submitted</div>
                    <div className="cr-tracker__sub">
                        {formatDate(request.submittedAt)} · <strong style={{ color: "var(--text)" }}>{request.proposedClubName}</strong>
                    </div>
                </div>
            </div>

            {/* Step 2 — Under review / outcome */}
            <div className={`cr-tracker__step${isPending ? " cr-tracker__step--active" : isRejected ? " cr-tracker__step--rejected" : " cr-tracker__step--done"}`}>
                <div className="cr-tracker__icon">
                    {isPending ? "⏳" : isRejected ? "✕" : "✓"}
                </div>
                <div className="cr-tracker__body">
                    <div className="cr-tracker__title">
                        {isPending  ? "Under review" : ""}
                        {isApproved ? "Approved" : ""}
                        {isRejected ? "Not approved" : ""}
                    </div>
                    <div className="cr-tracker__sub">
                        {isPending && "A federation administrator will review your request."}
                        {isApproved && request.reviewedAt && `Approved on ${formatDate(request.reviewedAt)}`}
                        {isRejected && request.reviewedAt && `Reviewed on ${formatDate(request.reviewedAt)}`}
                    </div>
                    {isRejected && request.rejectionReason && (
                        <div className="cr-tracker__reason">
                            <strong>Reason:</strong> {request.rejectionReason}
                        </div>
                    )}
                </div>
            </div>

            {/* Step 3 — Club active (only shown when approved) */}
            {(isApproved || isPending) && (
                <div className={`cr-tracker__step${isApproved ? " cr-tracker__step--done" : ""}`}>
                    <div className="cr-tracker__icon">{isApproved ? "✓" : "🏠"}</div>
                    <div className="cr-tracker__body">
                        <div className="cr-tracker__title">Club active</div>
                        {isApproved ? (
                            <div className="cr-tracker__sub">
                                You are now the club administrator.
                                {" "}
                                <button
                                    className="pa-btn pa-btn--primary"
                                    style={{ display: "inline-block", marginTop: 10 }}
                                    onClick={goToDashboard}
                                    disabled={refreshing}
                                >
                                    {refreshing ? "Loading…" : "Go to club dashboard →"}
                                </button>
                            </div>
                        ) : (
                            <div className="cr-tracker__sub">Pending approval</div>
                        )}
                    </div>
                </div>
            )}

        </div>
    );
}

// ── Multi-step form ──────────────────────────────────────────────────────────

type FedOption = { id: string; name: string; country: string };

type FormData = {
    federationId:            string;
    federationName:          string;
    proposedClubName:        string;
    proposedClubLocation:    string;
    proposedClubDescription: string;
    supportingInfo:          string;
};

const EMPTY_FORM: FormData = {
    federationId:            "",
    federationName:          "",
    proposedClubName:        "",
    proposedClubLocation:    "",
    proposedClubDescription: "",
    supportingInfo:          "",
};

function Step1({
    federations,
    loading,
    selected,
    onSelect,
    onNext,
}: {
    federations: FedOption[];
    loading:     boolean;
    selected:    string;
    onSelect:    (id: string, name: string) => void;
    onNext:      () => void;
}) {
    return (
        <>
            <h3 style={{ marginTop: 0 }}>Which federation is this club for?</h3>
            <p className="muted" style={{ fontSize: 13, margin: "0 0 16px" }}>
                Select the governing body this club will belong to.
            </p>

            {loading ? (
                <div className="stack">
                    {[1, 2, 3].map(i => <div key={i} className="pa-skeleton-row" style={{ height: 60 }} />)}
                </div>
            ) : federations.length === 0 ? (
                <div className="pa-empty">
                    <div className="pa-empty__icon">🌐</div>
                    <p className="pa-empty__text">No active federations found. Contact the platform administrator.</p>
                </div>
            ) : (
                <div className="cr-fed-list">
                    {federations.map(fed => (
                        <button
                            key={fed.id}
                            className={`cr-fed-card${selected === fed.id ? " cr-fed-card--selected" : ""}`}
                            onClick={() => onSelect(fed.id, fed.name)}
                        >
                            <div className="cr-fed-card__radio" />
                            <div>
                                <div className="cr-fed-card__name">{fed.name}</div>
                                <div className="cr-fed-card__country">{fed.country}</div>
                            </div>
                        </button>
                    ))}
                </div>
            )}

            <div className="cr-nav">
                <span />
                <button
                    className="pa-btn pa-btn--primary"
                    onClick={onNext}
                    disabled={!selected}
                >
                    Next →
                </button>
            </div>
        </>
    );
}

function Step2({
    form,
    onChange,
    onBack,
    onNext,
}: {
    form:     FormData;
    onChange: (patch: Partial<FormData>) => void;
    onBack:   () => void;
    onNext:   () => void;
}) {
    const valid =
        form.proposedClubName.trim() &&
        form.proposedClubLocation.trim() &&
        form.proposedClubDescription.trim();

    return (
        <>
            <h3 style={{ marginTop: 0 }}>Tell us about your club</h3>

            <label>
                Proposed club name *
                <input
                    value={form.proposedClubName}
                    onChange={e => onChange({ proposedClubName: e.target.value })}
                    placeholder="e.g. Tralee Rowing Club"
                    autoFocus
                />
            </label>

            <label>
                Location *
                <input
                    value={form.proposedClubLocation}
                    onChange={e => onChange({ proposedClubLocation: e.target.value })}
                    placeholder="e.g. Tralee, Kerry"
                />
            </label>

            <label>
                Description *
                <textarea
                    value={form.proposedClubDescription}
                    onChange={e => onChange({ proposedClubDescription: e.target.value })}
                    placeholder="Briefly describe the club, its purpose, and the community it will serve."
                    style={{ minHeight: 90, resize: "vertical" }}
                />
            </label>

            <label>
                Supporting information
                <textarea
                    value={form.supportingInfo}
                    onChange={e => onChange({ supportingInfo: e.target.value })}
                    placeholder="Optional — any additional context that may help the review (e.g. founding members, facilities, partnerships)."
                    style={{ minHeight: 70, resize: "vertical" }}
                />
            </label>

            <div className="cr-nav">
                <button className="pa-btn pa-btn--ghost" onClick={onBack}>← Back</button>
                <button className="pa-btn pa-btn--primary" onClick={onNext} disabled={!valid}>
                    Next →
                </button>
            </div>
        </>
    );
}

function Step3({
    form,
    submitting,
    error,
    onBack,
    onSubmit,
}: {
    form:       FormData;
    submitting: boolean;
    error:      string | null;
    onBack:     () => void;
    onSubmit:   () => void;
}) {
    return (
        <>
            <h3 style={{ marginTop: 0 }}>Review your request</h3>
            <p className="muted" style={{ fontSize: 13, margin: "0 0 16px" }}>
                Check the details below before submitting. The federation administrator will be notified.
            </p>

            <div className="card card--tight cr-review">
                {([
                    ["Federation",   form.federationName],
                    ["Club name",    form.proposedClubName],
                    ["Location",     form.proposedClubLocation],
                    ["Description",  form.proposedClubDescription],
                    form.supportingInfo ? ["Supporting info", form.supportingInfo] : null,
                ] as ([string, string] | null)[]).filter(Boolean).map(([label, value]) => (
                    <div key={label} className="cr-review__row">
                        <div className="cr-review__label">{label}</div>
                        <div className="cr-review__value">{value}</div>
                    </div>
                ))}
            </div>

            {error && <div className="pa-error" style={{ marginTop: 12 }}>{error}</div>}

            <div className="cr-nav">
                <button className="pa-btn pa-btn--ghost" onClick={onBack} disabled={submitting}>← Back</button>
                <button className="pa-btn pa-btn--primary" onClick={onSubmit} disabled={submitting}>
                    {submitting ? "Submitting…" : "Submit request"}
                </button>
            </div>
        </>
    );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ClubCreationRequestPage() {
    return (
        <RequireAuth>
            <ClubCreationRequestContent />
        </RequireAuth>
    );
}

function ClubCreationRequestContent() {
    const { user } = useAuth();
    const { requests, loading: reqLoading, reload } = useClubCreationRequest(user?.uid ?? null);

    const [federations, setFederations] = useState<FedOption[]>([]);
    const [fedLoading,  setFedLoading]  = useState(true);

    const [step,       setStep]       = useState<1 | 2 | 3>(1);
    const [form,       setForm]       = useState<FormData>(EMPTY_FORM);
    const [submitting, setSubmitting] = useState(false);
    const [submitErr,  setSubmitErr]  = useState<string | null>(null);

    useEffect(() => {
        listActiveFederations({})
            .then(r => setFederations(r.federations))
            .catch(() => setFederations([]))
            .finally(() => setFedLoading(false));
    }, []);

    // Most recent request (pending takes priority)
    const activeRequest =
        requests.find(r => r.status === "pending") ??
        requests.find(r => r.status === "approved") ??
        requests[0] ?? null;

    // Show tracker if there's a pending or approved request
    const showTracker = activeRequest?.status === "pending" || activeRequest?.status === "approved";

    function patch(p: Partial<FormData>) {
        setForm(prev => ({ ...prev, ...p }));
    }

    async function onSubmit() {
        setSubmitting(true);
        setSubmitErr(null);
        try {
            await submitClubCreationRequest({
                federationId:            form.federationId,
                proposedClubName:        form.proposedClubName.trim(),
                proposedClubLocation:    form.proposedClubLocation.trim(),
                proposedClubDescription: form.proposedClubDescription.trim(),
                supportingInfo:          form.supportingInfo.trim() || undefined,
            });
            reload();
        } catch (err: any) {
            const m = (err?.message ?? "").toLowerCase();
            if (m.includes("pending")) {
                setSubmitErr("You already have a pending club creation request.");
            } else if (m.includes("not-found") || m.includes("federation")) {
                setSubmitErr("Selected federation not found. Please go back and choose again.");
            } else {
                setSubmitErr("Something went wrong. Please try again.");
            }
        } finally {
            setSubmitting(false);
        }
    }

    const mostRecentRejected = !showTracker && requests.find(r => r.status === "rejected");

    return (
        <>
            <Navbar />

            <main>
                <div className="shell" style={{ paddingTop: 24 }}>
                    <div className="card">

                        {reqLoading ? (
                            <div className="stack">
                                {[1, 2, 3].map(i => <div key={i} className="pa-skeleton-row" />)}
                            </div>
                        ) : showTracker && activeRequest ? (
                            <>
                                <h2 style={{ marginTop: 0 }}>Request Status</h2>
                                <p className="muted" style={{ fontSize: 13, margin: "0 0 20px" }}>
                                    Your club creation request is being reviewed.
                                </p>
                                <StatusTracker request={activeRequest} />
                            </>
                        ) : (
                            <>
                                {mostRecentRejected && (
                                    <div style={{
                                        padding: "10px 14px", borderRadius: "var(--radius-sm)",
                                        background: "rgba(255,77,109,0.08)", border: "1px solid rgba(255,77,109,0.2)",
                                        marginBottom: 20, fontSize: "0.875rem", color: "var(--muted)",
                                    }}>
                                        Your previous request for <strong style={{ color: "var(--text)" }}>
                                            {mostRecentRejected.proposedClubName}
                                        </strong> was not approved.
                                        You may submit a new request below.
                                    </div>
                                )}

                                <Stepper current={step} />

                                {step === 1 && (
                                    <Step1
                                        federations={federations}
                                        loading={fedLoading}
                                        selected={form.federationId}
                                        onSelect={(id, name) => patch({ federationId: id, federationName: name })}
                                        onNext={() => setStep(2)}
                                    />
                                )}
                                {step === 2 && (
                                    <Step2
                                        form={form}
                                        onChange={patch}
                                        onBack={() => setStep(1)}
                                        onNext={() => setStep(3)}
                                    />
                                )}
                                {step === 3 && (
                                    <Step3
                                        form={form}
                                        submitting={submitting}
                                        error={submitErr}
                                        onBack={() => setStep(2)}
                                        onSubmit={onSubmit}
                                    />
                                )}
                            </>
                        )}

                    </div>
                </div>
            </main>
        </>
    );
}
