import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { doc, updateDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import Navbar from "../../../shared/components/Navbar/Navbar";
import { db, functions } from "../../../shared/lib/firebase";
import { useAuth } from "../../../providers/AuthProvider";

type HostData = {
    country?: string;
    stripeOnboarded?: boolean;
    stripeConnectedAccountId?: string;
};

const COUNTRIES = [
    { code: "US", label: "United States" },
    { code: "OTHER", label: "Other (payouts not yet available)" },
];

export default function HostPayoutPage() {
    const { user, profile } = useAuth() as any;
    const [searchParams] = useSearchParams();
    const setupResult = searchParams.get("setup");

    const [hostData, setHostData] = useState<HostData>({});
    const [country, setCountry] = useState("");
    const [savingCountry, setSavingCountry] = useState(false);
    const [countryErr, setCountryErr] = useState<string | null>(null);
    const [loadingLink, setLoadingLink] = useState(false);
    const [linkErr, setLinkErr] = useState<string | null>(null);

    useEffect(() => {
        if (!profile) return;
        const h = profile?.roles?.host ?? {};
        setHostData(h);
        setCountry(h.country ?? "");
    }, [profile]);

    async function handleSaveCountry() {
        if (!user) return;
        setSavingCountry(true);
        setCountryErr(null);
        try {
            await updateDoc(doc(db, "users", user.uid), {
                "roles.host.country": country,
            });
            setHostData((prev) => ({ ...prev, country }));
        } catch (err: any) {
            setCountryErr(err?.message ?? "Failed to save country.");
        } finally {
            setSavingCountry(false);
        }
    }

    async function handleSetupPayouts() {
        setLoadingLink(true);
        setLinkErr(null);
        try {
            const fn = httpsCallable(functions, "createConnectAccountLink");
            const result = await fn({});
            const data = result.data as { url: string };
            window.location.href = data.url;
        } catch (err: any) {
            setLinkErr(err?.message ?? "Failed to start payout setup.");
        } finally {
            setLoadingLink(false);
        }
    }

    const isUS = hostData.country === "US";
    const isOnboarded = hostData.stripeOnboarded === true;

    return (
        <>
            <Navbar />
            <main style={{ minHeight: "100vh", background: "var(--surface)", color: "var(--text)", padding: "2rem 1rem" }}>
                <div style={{ maxWidth: 540, margin: "0 auto" }}>
                    <h1 style={{ fontFamily: "DIN Condensed", fontSize: "1.8rem", marginBottom: "0.5rem" }}>
                        Payout Setup
                    </h1>
                    <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginBottom: "2rem" }}>
                        Receive entry fees from your events via Stripe Express. Currently available to US-based hosts only.
                    </p>

                    {setupResult === "complete" && (
                        <div style={{ background: "#1a3a1a", border: "1px solid #4caf50", borderRadius: 8, padding: "0.85rem 1rem", color: "#4caf50", fontSize: "0.9rem", marginBottom: "1.5rem" }}>
                            Payout setup complete! Your account is now verified.
                        </div>
                    )}

                    {setupResult === "refresh" && (
                        <div style={{ background: "#2a1a1a", border: "1px solid var(--danger)", borderRadius: 8, padding: "0.85rem 1rem", color: "var(--danger)", fontSize: "0.9rem", marginBottom: "1.5rem" }}>
                            Setup was not completed. Please try again.
                        </div>
                    )}

                    {/* Country section */}
                    <div className="card" style={{ padding: "1.25rem", marginBottom: "1.5rem" }}>
                        <h2 style={{ fontSize: "1rem", marginBottom: "0.75rem" }}>Your Country</h2>
                        <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: "1rem" }}>
                            Stripe payouts are currently only available to US-based hosts.
                        </p>

                        <label style={{ display: "block", fontSize: "0.8rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.35rem" }}>
                            Country
                        </label>
                        <select
                            value={country}
                            onChange={(e) => setCountry(e.target.value)}
                            style={{
                                width: "100%",
                                background: "var(--surface-2)",
                                border: "1px solid rgba(255,255,255,0.12)",
                                borderRadius: 6,
                                color: "var(--text)",
                                fontSize: "0.9rem",
                                padding: "0.55rem 0.75rem",
                                marginBottom: "0.75rem",
                            }}
                        >
                            <option value="">Select your country</option>
                            {COUNTRIES.map((c) => (
                                <option key={c.code} value={c.code}>{c.label}</option>
                            ))}
                        </select>

                        {countryErr && <p style={{ color: "var(--danger)", fontSize: "0.85rem", marginBottom: "0.5rem" }}>{countryErr}</p>}

                        <button
                            className="btn-primary"
                            onClick={handleSaveCountry}
                            disabled={savingCountry || !country || country === hostData.country}
                        >
                            {savingCountry ? "Saving…" : "Save Country"}
                        </button>
                    </div>

                    {/* Stripe Connect section */}
                    <div className="card" style={{ padding: "1.25rem" }}>
                        <h2 style={{ fontSize: "1rem", marginBottom: "0.75rem" }}>Stripe Payout Account</h2>

                        {isOnboarded ? (
                            <div>
                                <div style={{ background: "#1a3a1a", borderRadius: 6, padding: "0.75rem 1rem", color: "#4caf50", fontSize: "0.9rem", marginBottom: "1rem" }}>
                                    ✓ Your Stripe account is verified and ready to receive payouts.
                                </div>
                                <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                                    You can view your payout history in your{" "}
                                    <a href="https://connect.stripe.com/express_login" target="_blank" rel="noreferrer" style={{ color: "var(--brand)" }}>
                                        Stripe Express dashboard
                                    </a>.
                                </p>
                            </div>
                        ) : (
                            <>
                                {!isUS && (
                                    <div style={{ background: "var(--surface-2)", borderRadius: 6, padding: "0.85rem 1rem", color: "var(--muted)", fontSize: "0.85rem", marginBottom: "1rem" }}>
                                        Stripe payouts are not yet available in your country. Set your country to United States above to continue.
                                    </div>
                                )}

                                {linkErr && (
                                    <p style={{ color: "var(--danger)", fontSize: "0.85rem", marginBottom: "0.75rem" }}>{linkErr}</p>
                                )}

                                <button
                                    className="btn-primary"
                                    onClick={handleSetupPayouts}
                                    disabled={!isUS || loadingLink}
                                >
                                    {loadingLink ? "Loading…" : "Set Up Payouts →"}
                                </button>

                                <p style={{ color: "var(--muted)", fontSize: "0.78rem", marginTop: "0.75rem" }}>
                                    You'll be redirected to Stripe to complete onboarding. This typically takes 2–5 minutes.
                                </p>
                            </>
                        )}
                    </div>
                </div>
            </main>
        </>
    );
}
