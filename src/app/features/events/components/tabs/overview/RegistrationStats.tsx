import { useMemo } from "react";

export default function RegistrationStats({ boats }: any) {

    const stats = useMemo(() => {

        const total = boats.length;
        const registered = boats.filter((b:any) => b.status === "registered" || b.status === "finished").length;
        const pending = boats.filter((b:any) => b.status === "pending_crew").length;
        const missingBow = boats.filter((b:any) => !b.bowNumber).length;

        return { total, registered, pending, missingBow };

    }, [boats]);

    return (
        <section className="card">

            <h2>Registration Status</h2>

            <div className="stats-grid">

                <Stat label="Total Crews" value={stats.total} />
                <Stat label="Registered" value={stats.registered} />
                <Stat label="Pending Crew" value={stats.pending} />
                <Stat label="Missing Bow Numbers" value={stats.missingBow} alert />

            </div>

        </section>
    );
}

function Stat({ label, value, alert }: any) {
    return (
        <div className={`stat ${alert ? "alert" : ""}`}>
            <span className="stat-value">{value}</span>
            <span className="stat-label">{label}</span>
        </div>
    );
}