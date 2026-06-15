import { Link } from "react-router-dom";
import Navbar from "../../../shared/components/Navbar/Navbar";

export default function StripeConnectComplete() {
    return (
        <>
            <Navbar />
            <main>
                <div className="card auth-card" style={{ maxWidth: 480, margin: "60px auto", textAlign: "center" }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>✓</div>
                    <h2 style={{ color: "#FEB959", marginBottom: 8 }}>Stripe connected!</h2>
                    <p className="muted" style={{ marginBottom: 24 }}>
                        Your payout account is set up. Entry fees will be transferred to your Stripe balance
                        automatically when athletes register for your events.
                    </p>
                    <Link to="/admin/club">
                        <button className="btn-primary">Back to Club Dashboard</button>
                    </Link>
                </div>
            </main>
        </>
    );
}
