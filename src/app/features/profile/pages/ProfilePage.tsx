import { ProfileHero } from "../components/ProfileHero.tsx";
import { useAuth } from "../../../providers/AuthProvider.tsx";
import { useState } from "react";
import Navbar from "../../../shared/components/Navbar/Navbar.tsx";
import { saveCoreProfile } from "../api/user.ts";
import { AthleteStats } from "../components/AthleteStats.tsx";
import { Navigate } from "react-router-dom";
import { ProfileEditor } from "../components/ProfileEditor.tsx";
import { PerformanceStats } from "../components/PreformanceStats.tsx";
import Footer from "../../../shared/components/Footer/Footer.tsx";
import DangerZone from "../components/DangerZone.tsx";
import type { UserProfile } from "../../auth/types.ts";
import { MyCoachesSection } from "../../coaches/components/MyCoachesSection.tsx";
import { MyAthletesSection } from "../../coaches/components/MyAthletesSection.tsx";
import { ClubInvitesSection } from "../components/ClubInvitesSection.tsx";
import { ConsentSettings } from "../components/ConsentSettings.tsx";
import { RaceHistory } from "../components/RaceHistory.tsx";

export default function ProfilePageElite() {
    const { user, profile: authProfile, loading } = useAuth();
    const [unit, setUnit] = useState<"metric" | "imperial">(authProfile?.units ?? "metric");

    // Local copy of profile so club join/leave updates can be applied
    // optimistically without waiting for AuthProvider to re-fetch.
    // Initialised once from authProfile — onProfileChange handles subsequent updates.
    const [profile, setProfile] = useState<UserProfile | null>(authProfile ?? null);

    if (!loading && !user) return <Navigate to="/auth" replace />;

    if (loading) return (
        <>
            <Navbar />
            <main className="page"><div className="card">Loading…</div></main>
        </>
    );

    if (!profile) return <p className="page">Profile not found</p>;

    const roles = profile.roles ?? {};
    const toggleUnit = async () => {
        const next: "metric" | "imperial" = unit === "metric" ? "imperial" : "metric";
        setUnit(next);
        if (user) {
            try { await saveCoreProfile(user.uid, { units: next }); } catch (_) {}
        }
    };

    return (
        <div className="page-container">
            <Navbar />
            <main className="profile-page-elite">
                <ProfileHero profile={profile} unit={unit} toggleUnit={toggleUnit} />

                {roles.coach && <MyAthletesSection profile={profile} />}

                {roles.rower && (
                    <>
                        <AthleteStats unit={unit} />
                        <PerformanceStats />
                        <RaceHistory />
                        <MyCoachesSection profile={profile} />
                    </>
                )}

                <ClubInvitesSection />

                <section className="card profile-section">
                    <h3 className="section-title">Edit Profile</h3>
                    <ProfileEditor
                        profile={profile}
                        unit={unit}
                        onProfileChange={(updated) =>
                            setProfile(p => p ? { ...p, ...updated } : p)
                        }
                    />
                </section>

                <section className="card profile-section">
                    <h3 className="section-title">Privacy & Data</h3>
                    <ConsentSettings
                        profile={profile}
                        onProfileChange={(updated) =>
                            setProfile(p => p ? { ...p, ...updated } : p)
                        }
                    />
                </section>

                <DangerZone user={user}/>
            </main>
            <Footer />
        </div>
    );
}