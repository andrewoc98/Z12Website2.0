import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import Navbar from "../../../shared/components/Navbar/Navbar";
import { getUserProfileByUid } from "../../profile/api/user";
import type { UserProfile } from "../../auth/types";
import PublicProfileResults from "./PublicProfileResults";
import { formatLength, formatWeight } from "../api/community.ts";
import PublicProfileRelationships from "../components/PublicProfileRelationships.tsx";

import "../styles/Community.css";

export default function PublicProfilePage() {
    const { uid } = useParams();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [unit, setUnit] = useState<"metric" | "imperial">("metric");

    useEffect(() => {
        async function load() {
            if (!uid) return;
            const p = await getUserProfileByUid(uid);
            setProfile(p);
        }
        load();
    }, [uid]);

    if (!profile) return <p className="page">Loading...</p>;

    const toggleUnits = () => setUnit(unit === "metric" ? "imperial" : "metric");

    const stats = profile.roles?.rower?.stats;
    const perf = profile.roles?.rower?.performances;

    const safeLength = (val?: number) => val != null ? formatLength(val, unit) : "-";
    const safeWeight = (val?: number) => val != null ? formatWeight(val, unit) : "-";
    const safeTime = (val?: number) => val != null ? formatTime(val) : "-";

    return (
        <>
            <Navbar />

            <main className="profile-page-elite">

                {/* HERO */}
                <section className="profile-hero card">
                    <div className="profile-avatar">
                        {profile.displayName?.charAt(0)}
                    </div>
                    <div>
                        <h2>{profile.displayName}</h2>
                        <p className="muted">{profile.primaryRole}</p>
                        {profile.roles?.rower && (
                            <p className="muted">Club: {profile.roles.rower.club ?? "-"}</p>
                        )}
                        {profile.roles?.rower && (
                            <button className="btn-toggle" onClick={toggleUnits}>
                                Switch to {unit === "metric" ? "Imperial" : "Metric"}
                            </button>
                        )}
                    </div>
                </section>
                <PublicProfileRelationships
                    uid={profile.uid}
                    roles={profile.roles}
                />

                {/* ATHLETE STATS */}
                {profile.roles?.rower && (
                    <section className="card profile-section stats-section">
                        <h3 className="section-title">Athlete Stats</h3>
                        <div className="stats-grid">
                            <Stat label="Height" value={safeLength(stats?.heightCm)} />
                            <Stat label="Wingspan" value={safeLength(stats?.wingspanCm)} />
                            <Stat label="Weight" value={safeWeight(stats?.weightKg)} />
                        </div>
                    </section>
                )}

                {/* PERFORMANCE */}
                {profile.roles?.rower && (
                    <section className="card profile-section stats-section">
                        <h3 className="section-title">Best Performances</h3>
                        <div className="stats-grid">
                            <Stat label="100m" value={safeTime(perf?.best100m)} />
                            <Stat label="500m" value={safeTime(perf?.best500m)} />
                            <Stat label="2000m" value={safeTime(perf?.best2000m)} />
                            <Stat label="6000m" value={safeTime(perf?.best6000m)} />
                        </div>
                    </section>
                )}

                {/* RESULTS */}
                {profile.roles?.rower && (
                    <PublicProfileResults uid={profile.uid} />
                )}

            </main>
        </>
    );
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div className="stat-card">
            <div className="stat-value">{value}</div>
            <div className="muted">{label}</div>
        </div>
    );
}

function formatTime(seconds: number) {

    const m = Math.floor(seconds / 60);
    const s = (seconds % 60).toFixed(1);
    return `${m}:${s.toString().padStart(2, "0")}`;
}
