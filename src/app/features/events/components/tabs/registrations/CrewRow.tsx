import { useState } from "react";

const STATUS_CLS: Record<string, string> = {
    registered: "bg-[#22c55e] text-brand-ink",
    pending_crew: "bg-brand-warm text-brand-ink",
};

export default function CrewRow({ boat }: any) {

    const [bow, setBow] = useState(boat.bowNumber || "");

    const saveBow = () => {
        // TODO: update bow number API
        console.log("update bow", bow);
    };

    return (
        <div className="grid grid-cols-[80px_1fr_1fr_140px] py-[10px] border-b border-border items-center text-text bg-surface transition-[background] duration-[120ms] hover:bg-surface-2 max-[700px]:grid-cols-1 max-[700px]:gap-[6px] max-[700px]:p-3 max-[700px]:rounded-[8px] max-[700px]:mb-2">

            <input
                className={`w-[60px] p-[6px] rounded-[6px] border bg-surface text-text ${!bow ? "border-[#ff6b6b] bg-[rgba(255,107,107,0.08)]" : "border-border"}`}
                value={bow}
                placeholder="—"
                onChange={e => setBow(e.target.value)}
                onBlur={saveBow}
            />

            <span>{boat.clubName}</span>

            <span>{boat.categoryId}</span>

            <span className={`px-[10px] py-1 rounded-full text-[12px] capitalize ${STATUS_CLS[boat.status] ?? "bg-surface-2 text-muted"}`}>
                {boat.status}
            </span>

        </div>
    );
}
