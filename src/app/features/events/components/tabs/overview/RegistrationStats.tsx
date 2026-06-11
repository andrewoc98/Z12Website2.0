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

            <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-4">

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
        <div className={`bg-surface p-[14px] rounded-[8px] flex flex-col border ${alert ? "border-[rgba(255,107,107,0.25)] bg-[rgba(255,107,107,0.08)] text-[#ff6b6b]" : "border-border"}`}>
            <span className="text-[22px] font-semibold text-text">{value}</span>
            <span className="text-[11px] text-muted">{label}</span>
        </div>
    );
}
