import { ProfileHero } from "../components/ProfileHero.tsx";
import { useAuth } from "../../../providers/AuthProvider.tsx";
import { useState } from "react";
import Navbar from "../../../shared/components/Navbar/Navbar.tsx";
import { AthleteStats } from "../components/AthleteStats.tsx";
import { Navigate } from "react-router-dom";
import { ProfileEditor } from "../components/ProfileEditor.tsx";
import ProfileDetails from "../components/ProfileDetails.tsx";
import "../style/profile.css";
import { PerformanceStats } from "../components/PreformanceStats.tsx";
import Footer from "../../../shared/components/Footer/Footer.tsx";
import AdminHostInvite from "../../auth/pages/AdminHostInvite.tsx";
import DangerZone from "../components/DangerZone.tsx";

export default function ProfilePageElite() {
    const { user, profile, loading } = useAuth();
    const [unit, setUnit] = useState<"metric" | "imperial">("metric");

    if (!loading && !user) return <Navigate to="/auth" replace />;

    if (loading) return (
        <>
            <Navbar />
            <main className="page"><div className="card">Loading…</div></main>
        </>
    );

    if (!profile) return <p className="page">Profile not found</p>;

    const roles = profile.roles ?? {};
    const toggleUnit = () => setUnit(u => u === "metric" ? "imperial" : "metric");

    return (
        <>
            <Navbar />
            <main className="profile-page-elite">
                <ProfileHero profile={profile} unit={unit} toggleUnit={toggleUnit} />

                {roles.rower && (
                    <>
                        <AthleteStats unit={unit} />
                        <PerformanceStats />
                    </>
                )}

                {roles.host && <AdminHostInvite />}

                {/* ProfileDetails handles both coach athletes + rower coaches */}
                <ProfileDetails />

                <section className="card profile-section">
                    <h3 className="section-title">Edit Profile</h3>
                    <ProfileEditor profile={profile} />
                </section>
                <DangerZone user={user}/>
            </main>
            <Footer />
        </>
    );
}