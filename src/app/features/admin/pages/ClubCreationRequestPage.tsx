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

const STEPS = ["Select federation", "Club details", "Review & submit"] as const;

function Stepper({ current }: { current: 1 | 2 | 3 }) {
    const circleCls = (n: 1 | 2 | 3) => {
        const done = n < current;
        const active = n === current;
        if (done)   return "w-8 h-8 rounded-full border-2 flex items-center justify-center text-[0.8rem] font-bold shrink-0 bg-[rgba(52,211,153,0.15)] border-[rgba(52,211,153,0.5)] text-[#34d399] transition-[background,border-color,color]";
        if (active) return "w-8 h-8 rounded-full border-2 flex items-center justify-center text-[0.8rem] font-bold shrink-0 bg-brand-warm border-brand-warm text-brand-ink transition-[background,border-color,color]";
        return "w-8 h-8 rounded-full border-2 flex items-center justify-center text-[0.8rem] font-bold shrink-0 bg-surface-2 border-border text-muted transition-[background,border-color,color]";
    };
    const labelCls = (n: 1 | 2 | 3) => {
        const done = n < current;
        const active = n === current;
        if (done)   return "text-[0.7rem] font-medium text-[#34d399] text-center whitespace-nowrap transition-[color]";
        if (active) return "text-[0.7rem] font-semibold text-brand-warm text-center whitespace-nowrap transition-[color]";
        return "text-[0.7rem] font-medium text-muted text-center whitespace-nowrap transition-[color]";
    };
    const connectorCls = (afterStep: 1 | 2) => {
        return `flex-1 max-w-[48px] h-[2px] mb-[26px] transition-[background] ${afterStep < current ? "bg-[rgba(52,211,153,0.4)]" : "bg-border"}`;
    };

    return (
        <div className="flex items-center justify-center mb-6">
            {STEPS.map((label, i) => {
                const n = (i + 1) as 1 | 2 | 3;
                return (
                    <>
                        {i > 0 && (
                            <div key={`conn-${i}`} className={connectorCls(i as 1 | 2)} />
                        )}
                        <div key={n} className="flex flex-col items-center gap-[6px] min-w-[80px]">
                            <div className={circleCls(n)}>{n < current ? "✓" : n}</div>
                            <div className={labelCls(n)}>{label}</div>
                        </div>
                    </>
                );
            })}
        </div>
    );
}

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

    const iconCls = (state: "done" | "active" | "rejected" | "default") => {
        const base = "w-8 h-8 rounded-full border-2 flex items-center justify-center text-[0.85rem] shrink-0 z-[1]";
        if (state === "done")     return `${base} bg-[rgba(52,211,153,0.15)] border-[rgba(52,211,153,0.5)] text-[#34d399]`;
        if (state === "active")   return `${base} bg-[rgba(254,185,89,0.15)] border-[rgba(254,185,89,0.5)] text-brand-warm animate-[cr-pulse_2s_ease-in-out_infinite]`;
        if (state === "rejected") return `${base} bg-[rgba(255,77,109,0.15)] border-[rgba(255,77,109,0.4)] text-danger`;
        return `${base} bg-surface-2 border-border text-muted`;
    };

    const stepCls = (isDone: boolean, isLast: boolean) => {
        const connector = isLast ? "" : `before:content-[''] before:absolute before:left-[15px] before:top-8 before:bottom-[-8px] before:w-[2px] ${isDone ? "before:bg-[rgba(52,211,153,0.4)]" : "before:bg-border"}`;
        return `flex gap-4 relative ${connector}`;
    };

    return (
        <div className="flex flex-col">

            <div className={stepCls(true, false)}>
                <div className={iconCls("done")}>✓</div>
                <div className="pb-6 pt-1">
                    <div className="font-semibold text-[0.9rem] text-text">Request submitted</div>
                    <div className="text-[0.8rem] text-muted mt-[3px] leading-[1.5]">
                        {formatDate(request.submittedAt)} · <strong style={{ color: "var(--text)" }}>{request.proposedClubName}</strong>
                    </div>
                </div>
            </div>

            <div className={stepCls(isApproved, !isApproved && !isPending)}>
                <div className={iconCls(isPending ? "active" : isRejected ? "rejected" : "done")}>
                    {isPending ? "⏳" : isRejected ? "✕" : "✓"}
                </div>
                <div className="pb-6 pt-1">
                    <div className="font-semibold text-[0.9rem] text-text">
                        {isPending  ? "Under review" : ""}
                        {isApproved ? "Approved" : ""}
                        {isRejected ? "Not approved" : ""}
                    </div>
                    <div className="text-[0.8rem] text-muted mt-[3px] leading-[1.5]">
                        {isPending && "A federation administrator will review your request."}
                        {isApproved && request.reviewedAt && `Approved on ${formatDate(request.reviewedAt)}`}
                        {isRejected && request.reviewedAt && `Reviewed on ${formatDate(request.reviewedAt)}`}
                    </div>
                    {isRejected && request.rejectionReason && (
                        <div className="mt-2 px-3 py-[10px] bg-[rgba(255,77,109,0.08)] border border-[rgba(255,77,109,0.2)] rounded-[8px] text-[0.8rem] text-white/70 leading-[1.5]">
                            <strong>Reason:</strong> {request.rejectionReason}
                        </div>
                    )}
                </div>
            </div>

            {(isApproved || isPending) && (
                <div className={stepCls(isApproved, true)}>
                    <div className={iconCls(isApproved ? "done" : "default")}>{isApproved ? "✓" : "🏠"}</div>
                    <div className="pb-6 pt-1">
                        <div className="font-semibold text-[0.9rem] text-text">Club active</div>
                        {isApproved ? (
                            <div className="text-[0.8rem] text-muted mt-[3px] leading-[1.5]">
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
                            <div className="text-[0.8rem] text-muted mt-[3px]">Pending approval</div>
                        )}
                    </div>
                </div>
            )}

        </div>
    );
}

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

const fedCardBase = "flex items-center gap-4 px-4 py-[14px] bg-surface-2 border border-border rounded-[12px] cursor-pointer text-left w-full font-sans normal-case tracking-normal min-h-[unset] transition-[border-color,background,box-shadow]";

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
                <div className="flex flex-col gap-2 max-h-[320px] overflow-y-auto [scrollbar-width:thin] [scrollbar-color:var(--color-border)_transparent] pr-1">
                    {federations.map(fed => (
                        <button
                            key={fed.id}
                            className={`${fedCardBase} ${selected === fed.id ? "border-brand-warm bg-brand-warm/8" : "hover:border-brand-warm/35 hover:bg-brand-warm/4 hover:shadow-none"}`}
                            onClick={() => onSelect(fed.id, fed.name)}
                        >
                            <div className={`w-[18px] h-[18px] rounded-full border-2 shrink-0 flex items-center justify-center transition-[border-color] ${selected === fed.id ? "border-brand-warm after:content-[''] after:w-2 after:h-2 after:rounded-full after:bg-brand-warm" : "border-border"}`} />
                            <div>
                                <div className="font-semibold text-[0.9rem] text-text">{fed.name}</div>
                                <div className="text-[0.78rem] text-muted mt-[2px]">{fed.country}</div>
                            </div>
                        </button>
                    ))}
                </div>
            )}

            <div className="flex justify-between items-center mt-4 gap-2">
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

            <div className="flex justify-between items-center mt-4 gap-2">
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

            <div className="card p-3 flex flex-col gap-3">
                {([
                    ["Federation",   form.federationName],
                    ["Club name",    form.proposedClubName],
                    ["Location",     form.proposedClubLocation],
                    ["Description",  form.proposedClubDescription],
                    form.supportingInfo ? ["Supporting info", form.supportingInfo] : null,
                ] as ([string, string] | null)[]).filter((x): x is [string, string] => x !== null).map(([label, value]) => (
                    <div key={label} className="flex gap-[10px] items-start font-sans text-[0.875rem]">
                        <div className="text-muted min-w-[120px] shrink-0 text-[0.78rem] font-semibold uppercase tracking-[0.05em] pt-[2px]">{label}</div>
                        <div className="text-text flex-1 leading-[1.5]">{value}</div>
                    </div>
                ))}
            </div>

            {error && <div className="pa-error" style={{ marginTop: 12 }}>{error}</div>}

            <div className="flex justify-between items-center mt-4 gap-2">
                <button className="pa-btn pa-btn--ghost" onClick={onBack} disabled={submitting}>← Back</button>
                <button className="pa-btn pa-btn--primary" onClick={onSubmit} disabled={submitting}>
                    {submitting ? "Submitting…" : "Submit request"}
                </button>
            </div>
        </>
    );
}

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

    const activeRequest =
        requests.find(r => r.status === "pending") ??
        requests.find(r => r.status === "approved") ??
        requests[0] ?? null;

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
