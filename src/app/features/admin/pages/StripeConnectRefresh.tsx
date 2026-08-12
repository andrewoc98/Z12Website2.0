import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../../../shared/components/Navbar/Navbar";
import { createConnectAccount } from "../services/stripeService";

export default function StripeConnectRefresh() {
    const [err, setErr] = useState<string | null>(null);

    useEffect(() => {
        createConnectAccount({})
            .then(({ url }) => { window.location.href = url; })
            .catch((e: any) => setErr(e?.message ?? "Could not refresh Stripe link."));
    }, []);

    return (
        <>
            <Navbar />
            <main>
                <div className="card auth-card" style={{ maxWidth: 480, margin: "60px auto", textAlign: "center" }}>
                    {err ? (
                        <>
                            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠</div>
                            <h2 style={{ color: "#ff6b6b" }}>Something went wrong</h2>
                            <p className="muted" style={{ marginBottom: 24 }}>{err}</p>
                            <Link to="/admin/club">
                                <button className="btn-ghost">Back to Dashboard</button>
                            </Link>
                        </>
                    ) : (
                        <>
                            <div className="sco-spinner" style={{ margin: "0 auto 16px" }} />
                            <p className="muted">Refreshing your Stripe onboarding link…</p>
                        </>
                    )}
                </div>
            </main>
        </>
    );
}
