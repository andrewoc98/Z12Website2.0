import { useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import Navbar from "../../../shared/components/Navbar/Navbar";
import { acceptFederationAdminInvite, forceTokenRefresh } from "../services/federationService";

type Phase = "idle" | "submitting" | "success" | "error";

function friendlyError(msg: string): string {
    const m = msg.toLowerCase();
    if (m.includes("expired"))                return "This invite link has expired. Please ask the platform administrator to send a new one.";
    if (m.includes("no longer pending"))      return "This invite has already been used or was revoked.";
    if (m.includes("different email"))        return "This invite was sent to a different email address. Make sure you're signed in with the correct account.";
    if (m.includes("invalid invite token"))   return "The invite link is invalid. Please use the original link from your email.";
    return msg || "Something went wrong. Please try again.";
}

export default function AcceptInvitePage() {
    const [params]   = useSearchParams();
    const navigate   = useNavigate();
    const [phase, setPhase] = useState<Phase>("idle");
    const [error, setError] = useState<string | null>(null);

    const token    = params.get("token")  ?? "";
    const inviteId = params.get("invite") ?? "";
    const fedName  = params.get("fed")    ?? "a federation";

    const paramsValid = token && inviteId;

    async function onAccept() {
        if (!paramsValid) return;

        setPhase("submitting");
        setError(null);

        try {
            await acceptFederationAdminInvite({ token, inviteId });
            await forceTokenRefresh();
            setPhase("success");
            // Short pause so the success state renders before navigating
            setTimeout(() => navigate("/admin/federation", { replace: true }), 1200);
        } catch (e: any) {
            setError(friendlyError(e?.message ?? ""));
            setPhase("error");
        }
    }

    return (
        <>
            <Navbar />

            <main>
                <div className="card shell" style={{ marginTop: 32 }}>

                    <h2>Federation Administrator Invitation</h2>

                    {!paramsValid && (
                        <div className="card card--tight" style={{ borderColor: "var(--danger)", marginTop: 12 }}>
                            <p style={{ color: "var(--danger)", margin: 0 }}>
                                This link is invalid or incomplete. Please use the original link from your invitation email.
                            </p>
                        </div>
                    )}

                    {paramsValid && phase !== "success" && (
                        <>
                            <p>
                                You've been invited to administer{" "}
                                <strong style={{ color: "var(--text)" }}>{fedName}</strong>{" "}
                                on Z12 Challenge.
                            </p>
                            <p className="muted" style={{ fontSize: 13 }}>
                                Accepting this invitation will add the federation administrator role to your account.
                                You'll be redirected to your federation dashboard immediately after.
                            </p>

                            <hr />

                            {phase === "error" && error && (
                                <div className="card card--tight" style={{ borderColor: "var(--danger)", marginBottom: 12 }}>
                                    <p style={{ color: "var(--danger)", margin: 0 }}>{error}</p>
                                </div>
                            )}

                            <div className="row">
                                <button
                                    className="btn-primary"
                                    onClick={onAccept}
                                    disabled={phase === "submitting"}
                                >
                                    {phase === "submitting" ? "Accepting…" : "Accept invitation"}
                                </button>

                                <Link to="/" className="btn-ghost">
                                    Not now
                                </Link>
                            </div>
                        </>
                    )}

                    {phase === "success" && (
                        <div className="card card--tight" style={{ borderColor: "rgba(52,211,153,0.35)", marginTop: 12 }}>
                            <p style={{ color: "#34d399", margin: 0 }}>
                                Invitation accepted. Redirecting to your dashboard…
                            </p>
                        </div>
                    )}

                </div>
            </main>
        </>
    );
}
